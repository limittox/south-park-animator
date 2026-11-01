import { ENV_FPS } from '../episode/timeline';

/*
 * Voice processing on plain Float32Arrays (mono), so it runs anywhere, tests included.
 *
 * The show's kids are grown-ups' voices sped up. Speeding up raises pitch *and* tempo, so
 * here the two are separated: a WSOLA time-stretch slows the line down first, then a resample
 * speeds it back up. Net effect: higher voice, natural (or chosen) speaking speed.
 */

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/**
 * Waveform-similarity overlap-add time stretch. `alpha` > 1 makes the sound longer (slower),
 * < 1 shorter (faster), without changing pitch.
 */
export function timeStretch(x: Float32Array, alpha: number, sampleRate: number): Float32Array {
  if (Math.abs(alpha - 1) < 0.005 || x.length < 64) return x.slice();
  const n = Math.max(64, Math.round(sampleRate * 0.03)) & ~1; // 30 ms frames
  const hs = n / 2; // synthesis hop
  const ha = hs / alpha; // analysis hop
  const tol = Math.round(sampleRate * 0.008);
  const w = hann(n);
  const outLen = Math.ceil(x.length * alpha) + n;
  const y = new Float32Array(outLen);
  const norm = new Float32Array(outLen);
  let prev = 0;
  for (let k = 0; ; k++) {
    const outPos = k * hs;
    const nominal = Math.round(k * ha);
    if (nominal + n >= x.length || outPos + n >= outLen) break;
    let pos = nominal;
    if (k > 0) {
      // Pick the frame near the nominal spot that best continues the previous one.
      const natural = prev + hs;
      let best = -Infinity;
      for (let d = -tol; d <= tol; d += 2) {
        const p = nominal + d;
        if (p < 0 || p + n >= x.length || natural + n >= x.length) continue;
        let score = 0;
        for (let i = 0; i < n; i += 4) score += x[p + i] * x[natural + i];
        if (score > best) {
          best = score;
          pos = p;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      y[outPos + i] += x[pos + i] * w[i];
      norm[outPos + i] += w[i];
    }
    prev = pos;
  }
  const len = Math.round(x.length * alpha);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = norm[i] > 1e-3 ? y[i] / norm[i] : 0;
  return out;
}

/** Windowed-sinc low-pass, used before speeding a voice up so it doesn't alias. */
function lowPass(x: Float32Array, cutoff: number): Float32Array {
  const taps = 31;
  const half = (taps - 1) / 2;
  const h = new Float32Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const m = i - half;
    const sinc = m === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * m) / (Math.PI * m);
    h[i] = sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1)));
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let acc = 0;
    for (let j = 0; j < taps; j++) {
      const k = i + j - half;
      if (k >= 0 && k < x.length) acc += x[k] * h[j];
    }
    y[i] = acc;
  }
  return y;
}

/** Play `x` back `ratio` times faster (ratio > 1 is higher and shorter). */
export function resample(x: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1) < 0.005) return x.slice();
  const src = ratio > 1 ? lowPass(x, 0.5 / ratio * 0.92) : x;
  const len = Math.floor(x.length / ratio);
  const y = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const p = i * ratio;
    const j = Math.floor(p);
    const f = p - j;
    y[i] = (src[j] ?? 0) * (1 - f) + (src[j + 1] ?? 0) * f;
  }
  return y;
}

/** Shift pitch by `semitones` and speak `tempo` times faster. */
export function processVoice(x: Float32Array, sampleRate: number, semitones: number, tempo: number): Float32Array {
  const ratio = Math.pow(2, semitones / 12);
  const stretched = timeStretch(x, ratio / Math.max(0.25, tempo), sampleRate);
  return resample(stretched, ratio);
}

/** Cut leading and trailing silence, leaving a few milliseconds of air. */
export function trimSilence(x: Float32Array, sampleRate: number, threshold = 0.012): Float32Array {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const th = Math.max(threshold * peak, 1e-4);
  let a = 0;
  while (a < x.length && Math.abs(x[a]) < th) a++;
  let b = x.length - 1;
  while (b > a && Math.abs(x[b]) < th) b--;
  const pad = Math.round(sampleRate * 0.03);
  return x.slice(Math.max(0, a - pad), Math.min(x.length, b + pad));
}

/** Mouth openness over time, 0..1 at ENV_FPS, from the voice's loudness. */
export function envelope(x: Float32Array, sampleRate: number): Float32Array {
  const hop = sampleRate / ENV_FPS;
  const n = Math.max(1, Math.ceil(x.length / hop));
  const rms = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = Math.floor(k * hop);
    const b = Math.min(x.length, Math.floor((k + 1) * hop));
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    rms[k] = Math.sqrt(s / Math.max(1, b - a));
  }
  const sorted = Array.from(rms).sort((p, q) => p - q);
  const ref = sorted[Math.floor(sorted.length * 0.92)] || 1;
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    // A touch of look-ahead so the mouth opens on the syllable, not after it.
    const v = Math.max(rms[k], rms[Math.min(n - 1, k + 1)] * 0.9) / ref;
    out[k] = Math.min(1, Math.pow(Math.max(0, v), 0.75));
  }
  return out;
}

/** Raw 16-bit little-endian PCM (some speech models return this) to floats. */
export function pcm16ToFloat(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes);
  const n = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}
