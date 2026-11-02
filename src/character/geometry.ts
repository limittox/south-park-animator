import type { BodyGeo } from '../types';

/** Base head size that every head-anchored part is drawn against (head coordinates). */
export const HEAD_RX = 128;
export const HEAD_RY = 110;

/** Characters stand on the ground at y = 480 (character coordinates). */
export const GROUND_Y = 480;

/*
 * Proportions follow the show's cut-outs, measured in head radii (R):
 * kids are a near-round head (ry ≈ 1.03 R) sitting on a stubby body whose feet
 * are only ~1.9 R below the head's centre, with a sliver of trouser and flat shoes.
 * Adults have a smaller head on a long body, about 1.6× a kid's height. The heavy grown-up
 * is broad with a long torso and short legs; the beanpole has stick-thin arms and legs.
 */
const kid: BodyGeo = {
  cx: 200,
  headCx: 200,
  headCy: 272,
  headRx: 110,
  headRy: 114,
  torsoTop: 330,
  torsoBottom: 452,
  shoulder: 66,
  hip: 80,
  belly: 0,
  legTop: 446,
  legBottom: 474,
  legSep: 38,
  legW: 78,
  footY: 477,
  footRx: 44,
  footRy: 9,
  footSep: 44,
  shoulderY: 348,
  handX: 94,
  handY: 427,
  handR: 12,
  armW: 26,
  isAdult: false,
};

export const BODY_GEOS: Record<string, BodyGeo> = {
  kid,
  husky: {
    ...kid,
    headCy: 290,
    headRx: 126,
    headRy: 104,
    torsoTop: 340,
    torsoBottom: 450,
    shoulder: 100,
    hip: 140,
    belly: 22,
    legTop: 440,
    legSep: 56,
    legW: 108,
    footSep: 62,
    footRx: 54,
    shoulderY: 362,
    handX: 160,
    handY: 398,
    handR: 16,
    armW: 36,
  },
  skinny: {
    ...kid,
    headCy: 287,
    headRx: 102,
    headRy: 106,
    torsoTop: 340,
    torsoBottom: 455,
    shoulder: 54,
    hip: 66,
    legTop: 448,
    legSep: 28,
    legW: 56,
    footSep: 32,
    footRx: 32,
    shoulderY: 362,
    handX: 82,
    handY: 432,
    handR: 10.5,
    armW: 24,
  },
  adult: {
    ...kid,
    headCy: 57,
    headRx: 82,
    headRy: 85,
    torsoTop: 128,
    torsoBottom: 300,
    shoulder: 70,
    hip: 76,
    legTop: 290,
    legBottom: 464,
    legSep: 29,
    legW: 58,
    footY: 472,
    footRx: 34,
    footRy: 12,
    footSep: 32,
    shoulderY: 150,
    handX: 86,
    handY: 280,
    handR: 12,
    armW: 22,
    isAdult: true,
  },
  dadbod: {
    ...kid,
    headCy: 58,
    headRx: 86,
    headRy: 88,
    torsoTop: 130,
    torsoBottom: 336,
    shoulder: 96,
    hip: 120,
    belly: 26,
    legTop: 326,
    legBottom: 466,
    legSep: 50,
    legW: 96,
    footSep: 54,
    footRx: 46,
    footY: 472,
    footRy: 12,
    shoulderY: 156,
    handX: 136,
    handY: 262,
    handR: 14,
    armW: 30,
    isAdult: true,
  },
  // Broad shoulders over narrow hips, thick arms: the show's gym-going grown-ups.
  buff: {
    ...kid,
    headCy: 54,
    headRx: 78,
    headRy: 81,
    torsoTop: 124,
    torsoBottom: 300,
    shoulder: 104,
    hip: 66,
    legTop: 290,
    legBottom: 466,
    legSep: 30,
    legW: 52,
    footY: 472,
    footRx: 34,
    footRy: 12,
    footSep: 32,
    shoulderY: 140,
    handX: 112,
    handY: 276,
    handR: 15,
    armW: 32,
    isAdult: true,
  },
  lanky: {
    ...kid,
    headCy: 28,
    headRx: 74,
    headRy: 77,
    torsoTop: 92,
    torsoBottom: 284,
    shoulder: 48,
    hip: 46,
    legTop: 282,
    legBottom: 466,
    legSep: 14,
    legW: 27,
    footSep: 18,
    footRx: 25,
    footY: 472,
    footRy: 11,
    shoulderY: 112,
    handX: 58,
    handY: 268,
    handR: 10,
    armW: 15,
    isAdult: true,
  },
};

/**
 * Face parts are drawn against the older, flatter head and nudged into the show's
 * layout here: big eyes that meet in the middle and tuck under hat brims, and a
 * small mouth down near the chin.
 */
export const FACE_FIT = {
  eyes: 'translate(0 6) scale(1.3 1)',
  mouth: 'translate(0 18)',
  jaw: 'translate(0 6)',
  nose: 'translate(0 14)',
  detail: 'translate(0 8)',
  gear: 'translate(0 6) scale(1.2 1)',
};

/** Grown-ups have more chin: eyes sit at the middle of the head and the mouth about halfway down to the chin. */
export const ADULT_FACE_FIT: typeof FACE_FIT = {
  eyes: 'translate(0 0) scale(1.3 1)',
  mouth: 'translate(0 -7)',
  jaw: 'translate(0 -6)',
  nose: 'translate(0 2)',
  detail: 'translate(0 2)',
  gear: 'translate(0 0) scale(1.2 1)',
};

/**
 * Head shapes stretch everything drawn on the head. Eyes keep the show's shape on any head:
 * the extra vertical scale undoes the head's stretch relative to the round kid head.
 */
export function eyeFit(fit: typeof FACE_FIT, g: BodyGeo): string {
  const stretch = g.headRy / HEAD_RY / (g.headRx / HEAD_RX);
  return `${fit.eyes} scale(1 ${(1.2 / stretch).toFixed(3)})`;
}

/** Box that frames a whole character standing on the ground, with room for tall hats and a sidekick. */
export function charFrame(g: BodyGeo): { x: number; y: number; w: number; h: number } {
  const top = g.headCy - g.headRy * 2.1;
  const h = GROUND_Y + 24 - top;
  const w = Math.max(h * 0.9, 500);
  return { x: g.cx - w / 2, y: top, w, h };
}

export function frameViewBox(g: BodyGeo): string {
  const f = charFrame(g);
  return `${f.x} ${f.y} ${f.w} ${f.h}`;
}

export interface HeadShape {
  sx: number;
  sy: number;
  path: string;
  canadian?: boolean;
}

const ROUND =
  'M -128 0 C -128 -64 -70 -110 0 -110 C 70 -110 128 -64 128 0 C 128 58 76 110 0 110 C -76 110 -128 58 -128 0 Z';

export const HEAD_SHAPES: Record<string, HeadShape> = {
  round: { sx: 1, sy: 1, path: ROUND },
  wide: { sx: 1.12, sy: 0.96, path: ROUND },
  egg: {
    sx: 0.94,
    sy: 1.08,
    path: 'M -128 10 C -128 -70 -72 -116 0 -116 C 72 -116 128 -70 128 10 C 128 66 74 108 0 108 C -74 108 -128 66 -128 10 Z',
  },
  square: {
    sx: 1.02,
    sy: 0.98,
    path: 'M -128 -40 C -128 -96 -96 -110 -40 -110 L 40 -110 C 96 -110 128 -96 128 -40 L 128 50 C 128 98 96 110 40 110 L -40 110 C -96 110 -128 98 -128 50 Z',
  },
  canadian: {
    sx: 1.04,
    sy: 0.92,
    canadian: true,
    path: 'M -128 6 C -128 -62 -70 -112 0 -112 C 70 -112 128 -62 128 6 C 128 60 74 106 0 106 C -74 106 -128 60 -128 6 Z',
  },
};

/** Where the Canadian head splits when it talks (head coordinates). */
export const CANADIAN_SPLIT_Y = 56;

export function getGeo(body: string, headShape: string): BodyGeo {
  const base = BODY_GEOS[body] ?? BODY_GEOS.kid;
  const shape = HEAD_SHAPES[headShape] ?? HEAD_SHAPES.round;
  return { ...base, headRx: base.headRx * shape.sx, headRy: base.headRy * shape.sy };
}

/**
 * Sitting, seen from the front: everything above the hips drops to `hipY` while the feet stay
 * on the floor, so the legs get shorter (thighs pointing at the camera). Feet never pass the hips.
 */
export function seatedGeo(g: BodyGeo, hipY: number | undefined): BodyGeo {
  if (hipY === undefined) return g;
  const d = Math.min(hipY, g.legBottom - 6) - g.legTop;
  if (d <= 0) return g;
  return { ...g, headCy: g.headCy + d, torsoTop: g.torsoTop + d, torsoBottom: g.torsoBottom + d, legTop: g.legTop + d, shoulderY: g.shoulderY + d, handY: g.handY + d };
}

/** Body outline for shirts and everything worn on the torso. */
export function torsoPath(g: BodyGeo, inset = 0): string {
  const { cx, torsoTop: top, torsoBottom: bot, belly } = g;
  const sh = g.shoulder - inset;
  const hip = g.hip - inset;
  const mid = top + (bot - top) * 0.45;
  return [
    `M ${cx - sh * 0.7} ${top}`,
    `C ${cx - sh} ${top} ${cx - sh} ${top + 10} ${cx - sh} ${top + 26}`,
    `C ${cx - sh - belly} ${mid} ${cx - hip - belly * 0.6} ${bot - 32} ${cx - hip} ${bot - 12}`,
    `Q ${cx - hip} ${bot} ${cx - hip + 14} ${bot}`,
    `Q ${cx} ${bot + 6} ${cx + hip - 14} ${bot}`,
    `Q ${cx + hip} ${bot} ${cx + hip} ${bot - 12}`,
    `C ${cx + hip + belly * 0.6} ${bot - 32} ${cx + sh + belly} ${mid} ${cx + sh} ${top + 26}`,
    `C ${cx + sh} ${top + 10} ${cx + sh} ${top} ${cx + sh * 0.7} ${top}`,
    'Z',
  ].join(' ');
}

/** Horizontal half-width of the torso at a given y (handy for belts, stripes, hems). */
export function torsoHalfWidthAt(g: BodyGeo, y: number): number {
  const t = Math.min(1, Math.max(0, (y - g.torsoTop - 26) / (g.torsoBottom - 12 - g.torsoTop - 26)));
  const bulge = Math.sin(t * Math.PI) * g.belly * 0.9;
  return g.shoulder + (g.hip - g.shoulder) * t + bulge;
}

export type Pt = [number, number];

export interface ArmGeo {
  side: -1 | 1;
  start: Pt;
  ctrl: Pt;
  end: Pt;
}

export function armGeo(g: BodyGeo, side: -1 | 1): ArmGeo {
  const sx = g.cx + side * (g.shoulder - 8);
  const sy = g.shoulderY;
  const ex = g.cx + side * g.handX;
  const ey = g.handY - 8;
  return {
    side,
    start: [sx, sy],
    ctrl: [g.cx + side * (g.shoulder + 10 + g.belly * 0.5), sy + (ey - sy) * 0.55],
    end: [ex, ey],
  };
}

/** Point on a quadratic bezier. */
export function quadAt(a: ArmGeo, t: number): Pt {
  const [x0, y0] = a.start;
  const [x1, y1] = a.ctrl;
  const [x2, y2] = a.end;
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2];
}

/** The [0, t] piece of the arm curve, as an SVG path. */
export function armPath(a: ArmGeo, t0 = 0, t1 = 1): string {
  // de Casteljau split, twice.
  const split = (p0: Pt, p1: Pt, p2: Pt, t: number): [Pt, Pt, Pt, Pt, Pt] => {
    const l: Pt = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
    const r: Pt = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
    const m: Pt = [l[0] + (r[0] - l[0]) * t, l[1] + (r[1] - l[1]) * t];
    return [p0, l, m, r, p2];
  };
  let [p0, p1, p2] = [a.start, a.ctrl, a.end];
  if (t1 < 1) {
    const s = split(p0, p1, p2, t1);
    [p0, p1, p2] = [s[0], s[1], s[2]];
  }
  if (t0 > 0) {
    const s = split(p0, p1, p2, t0 / t1);
    [p0, p1, p2] = [s[2], s[3], s[4]];
  }
  return `M ${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`;
}

export function handPos(g: BodyGeo, side: -1 | 1): Pt {
  return [g.cx + side * g.handX, g.handY];
}
