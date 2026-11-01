/*
 * Every sound effect is synthesized, so nothing is copied and nothing needs downloading.
 * Each one renders into any BaseAudioContext at a given time, which lets the same code
 * serve live playback and the offline mix for video export.
 */

type Ctx = BaseAudioContext;

function env(ctx: Ctx, dest: AudioNode, when: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  g.connect(dest);
  return g;
}

function osc(ctx: Ctx, type: OscillatorType, freq: number, when: number, dur: number, out: AudioNode, slideTo?: number) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
  o.connect(out);
  o.start(when);
  o.stop(when + dur + 0.05);
  return o;
}

const noiseCache = new Map<number, AudioBuffer>();
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx.sampleRate);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noiseCache.set(ctx.sampleRate, b);
  }
  return b;
}

function noise(ctx: Ctx, when: number, dur: number, out: AudioNode, filter: BiquadFilterType, freq: number, sweepTo?: number, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, when);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, when + dur);
  src.connect(f).connect(out);
  src.start(when);
  src.stop(when + dur + 0.05);
}

/* -------------------------------------------------------------- guitar sting */

/** Karplus-Strong plucked strings: a short original strum-and-run riff for scene changes. */
const stingCache = new Map<number, AudioBuffer>();
function stingBuffer(ctx: Ctx): AudioBuffer {
  let b = stingCache.get(ctx.sampleRate);
  if (b) return b;
  const sr = ctx.sampleRate;
  const len = Math.round(sr * 2.4);
  b = ctx.createBuffer(1, len, sr);
  const out = b.getChannelData(0);
  const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  // [time, midi notes] — a strummed chord, a little walk up, and a resolving strum.
  const notes: [number, number[]][] = [
    [0, [45, 52, 57, 61, 64]],
    [0.34, [64]],
    [0.46, [66]],
    [0.58, [68]],
    [0.7, [69]],
    [0.92, [50, 57, 62, 66, 69]],
  ];
  let seed = 99;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (const [t, chord] of notes) {
    chord.forEach((m, i) => {
      const period = Math.round(sr / midi(m));
      const line = new Float32Array(period);
      for (let k = 0; k < period; k++) line[k] = rand();
      const start = Math.round((t + i * 0.012) * sr); // strum: strings a few ms apart
      const decay = t >= 0.9 ? 0.9965 : 0.994;
      let idx = 0;
      for (let s = start; s < len; s++) {
        const next = (idx + 1) % period;
        const v = line[idx];
        line[idx] = decay * 0.5 * (line[idx] + line[next]);
        out[s] += v * 0.22;
        idx = next;
      }
    });
  }
  // Fade the tail.
  for (let s = len - sr * 0.4; s < len; s++) out[s] *= (len - s) / (sr * 0.4);
  stingCache.set(sr, b);
  return b;
}

/* -------------------------------------------------------------- the effects */

export function playSfx(ctx: Ctx, dest: AudioNode, id: string, when: number): void {
  const t = Math.max(when, 0);
  switch (id) {
    case 'pop':
      osc(ctx, 'sine', 420, t, 0.09, env(ctx, dest, t, 0.4, 0.005, 0.09), 900);
      break;
    case 'boing': {
      const g = env(ctx, dest, t, 0.35, 0.01, 0.55);
      const o = osc(ctx, 'triangle', 180, t, 0.6, g);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.55);
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 18;
      depth.gain.value = 40;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + 0.6);
      break;
    }
    case 'crash':
      noise(ctx, t, 0.7, env(ctx, dest, t, 0.6, 0.005, 0.7), 'highpass', 1800);
      [1230, 1870, 2650, 3420].forEach((f) => osc(ctx, 'square', f, t, 0.4, env(ctx, dest, t, 0.04, 0.003, 0.4)));
      break;
    case 'thud':
      osc(ctx, 'sine', 130, t, 0.25, env(ctx, dest, t, 0.8, 0.005, 0.25), 45);
      noise(ctx, t, 0.12, env(ctx, dest, t, 0.4, 0.003, 0.12), 'lowpass', 600);
      break;
    case 'whoosh':
      noise(ctx, t, 0.45, env(ctx, dest, t, 0.4, 0.15, 0.3), 'bandpass', 300, 2600, 2);
      break;
    case 'ding':
      osc(ctx, 'sine', 1320, t, 1.2, env(ctx, dest, t, 0.35, 0.005, 1.2));
      osc(ctx, 'sine', 2640, t, 0.6, env(ctx, dest, t, 0.1, 0.005, 0.6));
      break;
    case 'buzzer':
      osc(ctx, 'square', 110, t, 0.6, env(ctx, dest, t, 0.25, 0.01, 0.6));
      osc(ctx, 'sawtooth', 116, t, 0.6, env(ctx, dest, t, 0.15, 0.01, 0.6));
      break;
    case 'fart': {
      const g = env(ctx, dest, t, 0.55, 0.02, 0.7);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      f.connect(g);
      const o = osc(ctx, 'sawtooth', 95, t, 0.7, f, 60);
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.type = 'square';
      lfo.frequency.value = 23;
      depth.gain.value = 22;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + 0.7);
      break;
    }
    case 'gasp':
      noise(ctx, t, 0.5, env(ctx, dest, t, 0.35, 0.08, 0.4), 'bandpass', 1400, 2400, 1.5);
      break;
    case 'slap':
      noise(ctx, t, 0.08, env(ctx, dest, t, 0.9, 0.001, 0.08), 'highpass', 1200);
      osc(ctx, 'sine', 220, t, 0.06, env(ctx, dest, t, 0.4, 0.001, 0.06), 90);
      break;
    case 'explosion':
      noise(ctx, t, 2, env(ctx, dest, t, 0.9, 0.01, 2), 'lowpass', 1400, 90);
      osc(ctx, 'sine', 70, t, 1.6, env(ctx, dest, t, 0.7, 0.01, 1.6), 28);
      break;
    case 'doorbell':
      osc(ctx, 'sine', 659, t, 0.6, env(ctx, dest, t, 0.35, 0.005, 0.6));
      osc(ctx, 'sine', 523, t + 0.45, 0.9, env(ctx, dest, t + 0.45, 0.35, 0.005, 0.9));
      break;
    case 'cheer': {
      const g = env(ctx, dest, t, 0.35, 0.25, 1.4);
      noise(ctx, t, 1.6, g, 'bandpass', 1100, 1600, 0.8);
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = 0.12;
      lfo.connect(depth).connect(g.gain);
      lfo.start(t);
      lfo.stop(t + 1.6);
      break;
    }
    case 'sting': {
      const src = ctx.createBufferSource();
      src.buffer = stingBuffer(ctx);
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(g).connect(dest);
      src.start(t);
      break;
    }
    default:
      break;
  }
}

/** Rough length of each effect, so the player knows when it has finished. */
export function sfxDuration(id: string): number {
  return id === 'sting' ? 2.4 : id === 'explosion' ? 2 : id === 'cheer' ? 1.6 : id === 'doorbell' ? 1.4 : 1;
}
