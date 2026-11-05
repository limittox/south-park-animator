import type { MouthShape } from '../types';

/*
 * A mouth for every pose of a line. The words say which shape comes next and the audio says
 * when: voiced poses step through the sounds in order, so pauses in the speech can't pull the
 * two apart. There's no real alignment here, just enough to look like the right word.
 */

export interface MouthPose {
  /** 0 is closed; otherwise how far it opens, 0.5 or 1. */
  level: number;
  shape: MouthShape;
}

const SOUND = /th|sh|ch|ph|wh|qu|oo|ou|ow|oa|ee|ea|ie|ai|ay|[a-z]/g;

/** The mouth for each spelling. Null is lips together. Anything else (s, k, r…) is said with the teeth nearly closed. */
const SHAPES: Record<string, MouthShape | null> = {
  a: 'ah',
  ai: 'eh',
  ay: 'eh',
  e: 'eh',
  i: 'eh',
  ee: 'ee',
  ea: 'ee',
  ie: 'ee',
  y: 'ee',
  o: 'oh',
  oa: 'oh',
  ou: 'oh',
  ow: 'oh',
  oo: 'oo',
  u: 'oo',
  w: 'oo',
  wh: 'oo',
  qu: 'oo',
  f: 'fv',
  v: 'fv',
  ph: 'fv',
  m: null,
  b: null,
  p: null,
  l: 'th',
  n: 'th',
  d: 'th',
  t: 'th',
  th: 'th',
};

/** The sounds of a line, in order. Vowels last twice as long. A silent final e isn't one. */
export function sounds(text: string): { shape: MouthShape | null; weight: number }[] {
  const words = text.toLowerCase().replace(/\b(\w+[^aeiou\W])e\b/g, '$1');
  return (words.match(SOUND) ?? []).map((s) => ({ shape: s in SHAPES ? SHAPES[s] : 'ee', weight: /^[aeiouy]/.test(s) ? 2 : 1 }));
}

/** One mouth per pose. `env` is loudness over time at `envFps`. */
export function mouthTrack(text: string, env: Float32Array, duration: number, poseFps: number, envFps: number): MouthPose[] {
  const span = envFps / poseFps;
  const levels = Array.from({ length: Math.max(1, Math.ceil(duration * poseFps)) }, (_, i) => {
    // A pose stands for all the sound until the next one, or quick syllables would fall between poses.
    const part = env.subarray(Math.round(i * span), Math.round((i + 1) * span));
    const loud = part.length ? part.reduce((a, b) => a + b, 0) / part.length : 0;
    // Cut-out mouths snap between a few sizes rather than easing.
    return loud < 0.14 ? 0 : loud < 0.5 ? 0.5 : 1;
  });
  const list = sounds(text);
  const total = list.reduce((a, s) => a + s.weight, 0);
  const voiced = levels.filter(Boolean).length;
  let said = 0;
  return levels.map((level) => {
    if (!level) return { level: 0, shape: 'ah' };
    let at = ((said++ + 0.5) / voiced) * total;
    const sound = list.find((s) => (at -= s.weight) < 0);
    if (!sound) return { level, shape: 'ah' };
    return sound.shape ? { level, shape: sound.shape } : { level: 0, shape: 'ah' };
  });
}
