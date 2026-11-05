import type { ReactNode } from 'react';
import type { KitPiece, KitSet, TimeOfDay } from '../episode/types';
import { dots, ink, O, scallop, seeded, starPath } from '../character/parts/common';
import { shade } from '../lib/color';
import { bareTree, cloud, DAY_SKY, DISPLAY, mountains, PAINT, PINE, pine, ROAD, SCENE_H, SCENE_W, SNOW } from '../scenes/backgrounds';

/*
 * The paper set-piece kit: flat cut-out props the LLM arranges into any location the script names.
 * Same rules as the photo booth scenes: props are drawn with ink and FLAT_CSS turns that into a thin,
 * darker edge; natural shapes (`.nat`) get no edge; nobody casts a shadow.
 *
 * Every piece is drawn with the centre of its base at (0, 0), growing up into negative y.
 */

/** Interior: the wall meets the floor here. */
export const FLOOR_Y = 650;
/** Exterior: where the ground starts behind everything. */
export const GROUND_TOP = 700;

export interface ResolvedPiece extends KitPiece {
  y: number;
  scale: number;
  color: string;
  color2: string;
  text: string;
  flip: boolean;
  front: boolean;
}

export interface KitCtx {
  time: TimeOfDay;
  set: KitSet;
  /** Being drawn again over whoever sits at it, so leave out anything that belongs behind them. */
  cover?: boolean;
}

export interface KitPieceDef {
  id: string;
  name: string;
  /** One line for the LLM. */
  desc: string;
  place: 'interior' | 'exterior' | 'any';
  anchor: 'floor' | 'wall' | 'ground' | 'sky';
  /** Natural size in scene units. */
  w: number;
  h: number;
  /** Where the base sits when the LLM leaves y out. */
  defaultY?: number;
  defaultColor?: string;
  defaultColor2?: string;
  /** Takes a text label. */
  text?: boolean;
  /** What `color` / `color2` paint, for the LLM. */
  colors?: string;
  /**
   * People can sit on it: seat height above the base and the width they share (piece units).
   * `cover` pieces (tables, desks) are drawn again over whoever sits at them.
   */
  seat?: { h: number; w: number; cover?: boolean };
  /** Its picture, for people who appear on it (piece units, from the base). */
  screen?: { x: number; y: number; w: number; h: number };
  render(p: ResolvedPiece, ctx: KitCtx): ReactNode;
  /** Drawn after the night tint: lit windows, lamps, flames, the moon. */
  lights?(p: ResolvedPiece, ctx: KitCtx): ReactNode;
}

/* ------------------------------------------------------------ helpers */

const f = (color: string) => ({ fill: color, ...ink });
const nat = 'nat';
const CHALK = "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive";
const LIT = '#ffe58a';
const GLOW = '#fff6a8';
const LAMP_SHADE = 'M -60 -330 L 60 -330 L 34 -440 L -34 -440 Z';
/** The bands round the top and bottom of the lamp shade. */
const LAMP_TRIM = 'M -60 -330 L 60 -330 L 57 -344 L -57 -344 Z M -36 -430 L 36 -430 L 34 -440 L -34 -440 Z';
const PRODUCT_COLORS = ['#d33b2c', '#f2c230', '#3b6fd8', '#7fbf3f', '#e86fb0', '#f0742a', '#2ec4c4', '#ffffff', '#8a5530', '#9b6bc0'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Outdoors in this town it's usually snowing. */
export function isSnowy(set: KitSet): boolean {
  return set.place === 'exterior' && (set.ground === 'snow' || set.ground === 'road' || set.ground === 'sidewalk');
}

const isDark = (ctx: KitCtx) => ctx.time === 'night';
const isDim = (ctx: KitCtx) => ctx.time !== 'day';

export function wrapWords(text: string, max: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[.,!?]*$/, '') + '…';
    return kept;
  }
  return out;
}

const fitSize = (lines: string[], width: number, max: number, em = 0.64) =>
  Math.min(max, width / Math.max(1, Math.max(...lines.map((l) => l.length), 1) * em));

/** Centred lines of text. Flipped pieces un-mirror their text so it still reads. */
function Label(props: { p: ResolvedPiece; y: number; lines: string[]; size: number; fill: string; font?: string; weight?: number; x?: number; anchor?: 'start' | 'middle' }) {
  const { p, y, lines, size, fill, font = DISPLAY, weight, x = 0, anchor = 'middle' } = props;
  const lh = size * 1.08;
  const y0 = y - ((lines.length - 1) * lh) / 2 + size * 0.36;
  return (
    <g transform={p.flip ? 'scale(-1 1)' : undefined}>
      {lines.map((l, i) => (
        <text key={i} x={x} y={y0 + i * lh} textAnchor={anchor} fontFamily={font} fontSize={size} fontWeight={weight} fill={fill}>
          {l}
        </text>
      ))}
    </g>
  );
}

/** A sign's text, wrapped and sized to fit a box. */
function fitLabel(p: ResolvedPiece, text: string, y: number, w: number, h: number, fill: string, opts: { max?: number; chars?: number; lines?: number; font?: string; weight?: number } = {}) {
  const { max = 40, chars = 12, lines: maxLines = 2, font = DISPLAY, weight } = opts;
  const lines = wrapWords(font === CHALK ? text : text.toUpperCase(), chars, maxLines);
  if (!lines.length) return null;
  const size = Math.min(fitSize(lines, w, max, font === CHALK ? 0.52 : 0.64), h / (lines.length * 1.1));
  return <Label p={p} y={y} lines={lines} size={size} fill={fill} font={font} weight={weight} />;
}

/** What you see through a window: sky for the time of day over a snowy hill. */
function glassView(x: number, y: number, w: number, h: number, time: TimeOfDay, seed = 1) {
  const sky = time === 'night' ? '#24306a' : time === 'dusk' ? '#f6b27a' : '#bfe6ff';
  const hill = time === 'night' ? '#8e95b8' : '#ffffff';
  const rnd = seeded(seed);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} {...f(sky)} />
      {time === 'night' &&
        Array.from({ length: Math.max(3, Math.round((w * h) / 4000)) }, (_, i) => (
          <circle key={i} cx={x + 6 + rnd() * (w - 12)} cy={y + 6 + rnd() * h * 0.5} r={1.5 + rnd() * 1.5} fill="#fff" />
        ))}
      {time === 'day' && <ellipse cx={x + w * 0.68} cy={y + h * 0.26} rx={Math.min(30, w * 0.16)} ry={Math.min(10, h * 0.06)} fill="#fff" />}
      <path
        className={nat}
        d={`M ${x} ${y + h} L ${x} ${y + h * 0.74} Q ${x + w * 0.3} ${y + h * 0.58} ${x + w * 0.56} ${y + h * 0.72} T ${x + w} ${y + h * 0.66} L ${x + w} ${y + h} Z`}
        fill={hill}
      />
    </g>
  );
}

/** Cross-shaped window bars. */
const bars = (x: number, y: number, w: number, h: number, color: string, wd = 8) => (
  <g>
    <rect x={x + w / 2 - wd / 2} y={y} width={wd} height={h} {...f(color)} strokeWidth={2} />
    <rect x={x} y={y + h / 2 - wd / 2} width={w} height={wd} {...f(color)} strokeWidth={2} />
  </g>
);

/** A grid of building windows; at night some of them are lit (drawn by `litGrid`). */
interface Grid {
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  ww: number;
  wh: number;
  gx: number;
  gy: number;
}
const gridCells = (g: Grid) => {
  const out: [number, number][] = [];
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) out.push([g.x0 + c * (g.ww + g.gx), g.y0 + r * (g.wh + g.gy)]);
  return out;
};
const winGrid = (g: Grid, ctx: KitCtx, glass = '#4ab1ac') => (
  <g>
    {gridCells(g).map(([x, y]) => (
      <rect key={`${x},${y}`} x={x} y={y} width={g.ww} height={g.wh} {...f(isDim(ctx) ? '#2e3a5c' : glass)} strokeWidth={2} />
    ))}
  </g>
);
const litGrid = (g: Grid, ctx: KitCtx, seed: number, share = 0.6) => {
  if (!isDim(ctx)) return null;
  const rnd = seeded(seed);
  return (
    <g>
      {gridCells(g).map(([x, y]) =>
        rnd() < (ctx.time === 'dusk' ? share * 0.5 : share) ? <rect key={`${x},${y}`} x={x} y={y} width={g.ww} height={g.wh} fill={LIT} /> : null,
      )}
    </g>
  );
};

/** Lumpy snow cap along a roof line from (x0, y0) to (x1, y1). */
const snowCap = (x0: number, y0: number, x1: number, y1: number, depth = 14) => {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 50));
  let d = `M ${x0} ${y0 - 4} L ${x1} ${y1 - 4} L ${x1} ${y1 + 4}`;
  for (let i = n - 1; i >= 0; i--) {
    const xa = x0 + ((x1 - x0) * i) / n;
    const ya = y0 + ((y1 - y0) * i) / n;
    const xm = x0 + ((x1 - x0) * (i + 0.5)) / n;
    const ym = y0 + ((y1 - y0) * (i + 0.5)) / n;
    d += ` Q ${xm} ${ym + depth} ${xa} ${ya + 4}`;
  }
  return <path className={nat} d={d + ' Z'} fill={SNOW} />;
};

const glow = (cx: number, cy: number, r: number) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={GLOW} opacity={0.22} />
    <circle cx={cx} cy={cy} r={r * 0.55} fill={GLOW} opacity={0.3} />
  </g>
);

function flames(cx: number, base: number, s = 1) {
  return (
    <g>
      <path
        d={`M ${cx - 40 * s} ${base} Q ${cx - 50 * s} ${base - 70 * s} ${cx - 14 * s} ${base - 100 * s} Q ${cx - 12 * s} ${base - 56 * s} ${cx} ${base - 64 * s} Q ${cx + 2 * s} ${base - 120 * s} ${cx + 34 * s} ${base - 150 * s} Q ${cx + 32 * s} ${base - 76 * s} ${cx + 52 * s} ${base - 50 * s} Q ${cx + 60 * s} ${base - 20 * s} ${cx + 44 * s} ${base} Z`}
        {...f('#f0742a')}
      />
      <path d={`M ${cx - 20 * s} ${base} Q ${cx - 22 * s} ${base - 44 * s} ${cx} ${base - 60 * s} Q ${cx + 8 * s} ${base - 34 * s} ${cx + 18 * s} ${base - 44 * s} Q ${cx + 32 * s} ${base - 20 * s} ${cx + 22 * s} ${base} Z`} fill="#f2c230" />
    </g>
  );
}

/* ------------------------------------------------------------ pieces */

export const KIT_PIECES: KitPieceDef[] = [
  /* ---------- walls and fixtures ---------- */
  {
    id: 'door',
    name: 'Door',
    desc: 'Wooden door in a painted frame, flush with the back wall. Text puts a name plate on it ("PRINCIPAL").',
    place: 'interior',
    anchor: 'floor',
    w: 224,
    h: 452,
    defaultY: FLOOR_Y + 2,
    defaultColor: '#8a5a32',
    defaultColor2: '#d7dbdd',
    text: true,
    colors: 'color = door, color2 = frame',
    render: (p) => {
      const d = shade(p.color, -0.14);
      return (
        <g>
          <rect x={-112} y={-452} width={224} height={452} {...f(p.color2)} />
          <rect x={-94} y={-434} width={188} height={434} {...f(p.color)} />
          <rect x={-68} y={-404} width={136} height={150} rx={4} fill={d} />
          <rect x={-68} y={-226} width={136} height={186} rx={4} fill={d} />
          <circle cx={66} cy={-214} r={10} {...f('#f2c230')} strokeWidth={2} />
          {p.text && (
            <g>
              <rect x={-76} y={-372} width={152} height={64} rx={6} {...f('#f4f1e8')} />
              {fitLabel(p, p.text, -340, 132, 52, '#2e2a26', { max: 26, chars: 11, font: PAINT, weight: 700 })}
            </g>
          )}
        </g>
      );
    },
  },
  {
    id: 'window',
    name: 'Window',
    desc: 'Four-pane window on the back wall showing the sky for the time of day. color2 adds curtains.',
    place: 'interior',
    anchor: 'wall',
    w: 260,
    h: 220,
    defaultY: 470,
    defaultColor: '#f4f4f4',
    colors: 'color = frame, color2 = curtains (optional)',
    render: (p, ctx) => (
      <g>
        <rect x={-130} y={-220} width={260} height={220} {...f(p.color)} />
        {glassView(-112, -202, 224, 184, ctx.time, hash(p.id))}
        {bars(-112, -202, 224, 184, p.color, 10)}
        <rect x={-146} y={-14} width={292} height={22} {...f(shade(p.color, -0.08))} />
        {p.color2 && (
          <g>
            <path d="M -156 -236 L -96 -236 Q -106 -120 -86 4 L -156 4 Z" {...f(p.color2)} />
            <path d="M 156 -236 L 96 -236 Q 106 -120 86 4 L 156 4 Z" {...f(p.color2)} />
            <rect x={-166} y={-246} width={332} height={18} {...f(shade(p.color2, -0.25))} />
          </g>
        )}
      </g>
    ),
  },
  {
    id: 'big-window',
    name: 'Picture Window',
    desc: 'Wide three-pane window with a view of snowy pines; good for living rooms, offices, hospital rooms.',
    place: 'interior',
    anchor: 'wall',
    w: 560,
    h: 300,
    defaultY: 500,
    defaultColor: '#f4f4f4',
    colors: 'color = frame, color2 = curtains (optional)',
    render: (p, ctx) => {
      const pane = (x: number, i: number) => (
        <g key={i}>
          {glassView(x, -284, 168, 268, ctx.time, hash(p.id) + i)}
          {ctx.time !== 'night' && pine(x + 120 - i * 40, -40, 0.55, true, 0.7, '#3f8a5a')}
        </g>
      );
      return (
        <g>
          <rect x={-280} y={-300} width={560} height={300} {...f(p.color)} />
          {pane(-262, 0)}
          {pane(-84, 1)}
          {pane(94, 2)}
          <rect x={-300} y={-14} width={600} height={24} {...f(shade(p.color, -0.08))} />
          {p.color2 && (
            <g>
              <path d="M -320 -320 L -250 -320 Q -262 -160 -240 6 L -320 6 Z" {...f(p.color2)} />
              <path d="M 320 -320 L 250 -320 Q 262 -160 240 6 L 320 6 Z" {...f(p.color2)} />
              <rect x={-330} y={-330} width={660} height={20} {...f(shade(p.color2, -0.25))} />
            </g>
          )}
        </g>
      );
    },
  },
  {
    id: 'picture',
    name: 'Framed Picture',
    desc: 'Small framed landscape painting on the wall.',
    place: 'interior',
    anchor: 'wall',
    w: 180,
    h: 140,
    defaultY: 380,
    defaultColor: '#deceb1',
    defaultColor2: '#8fb6c8',
    colors: 'color = frame, color2 = painted sky',
    render: (p) => (
      <g>
        <rect x={-90} y={-140} width={180} height={140} {...f(p.color)} />
        <rect x={-74} y={-124} width={148} height={108} fill={p.color2} />
        <path d="M -74 -16 L -74 -60 Q -30 -90 10 -66 Q 50 -84 74 -70 L 74 -16 Z" fill="#6f8f5a" />
        <path d="M -74 -16 L -74 -40 Q -10 -58 74 -36 L 74 -16 Z" fill="#4f6f46" />
        <circle cx={44} cy={-100} r={10} fill="#f2c230" />
      </g>
    ),
  },
  {
    id: 'poster',
    name: 'Poster',
    desc: 'Coloured paper poster taped to the wall with a slogan ("HANG IN THERE", "NO RUNNING").',
    place: 'interior',
    anchor: 'wall',
    w: 200,
    h: 260,
    defaultY: 440,
    defaultColor: '#f2c230',
    defaultColor2: '#d33b2c',
    text: true,
    colors: 'color = paper, color2 = lettering',
    render: (p) => (
      <g transform="rotate(-2 0 -130)">
        <rect x={-100} y={-260} width={200} height={260} {...f(p.color)} />
        {fitLabel(p, p.text || 'READ!', -150, 168, 200, p.color2, { max: 44, chars: 10, lines: 4 })}
        {[
          [-86, -246],
          [86, -246],
          [-86, -14],
          [86, -14],
        ].map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={5} fill="#c9c9c9" />
        ))}
      </g>
    ),
  },
  {
    id: 'chalkboard',
    name: 'Chalkboard',
    desc: 'Big green chalkboard in a wooden frame with chalk writing; the classroom centrepiece.',
    place: 'interior',
    anchor: 'wall',
    w: 760,
    h: 400,
    defaultY: 560,
    defaultColor: '#2f5d3a',
    defaultColor2: '#7a4a2a',
    text: true,
    colors: 'color = board, color2 = frame',
    render: (p) => {
      const lines = p.text ? wrapWords(p.text, 22, 4) : [];
      const size = lines.length ? Math.min(54, fitSize(lines, 660, 54, 0.52)) : 0;
      return (
        <g>
          <rect x={-380} y={-400} width={760} height={400} rx={8} {...f(p.color2)} />
          <rect x={-356} y={-376} width={712} height={352} fill={p.color} />
          {lines.length ? (
            <Label p={p} y={-210} lines={lines} size={size} fill="#f4f4f4" font={CHALK} />
          ) : (
            <path d="M -300 -300 q 40 -30 80 0 t 80 0 M -300 -220 l 200 0 M -300 -160 l 140 0 M 120 -300 l 60 -50 l 60 50 Z M 150 -180 q 40 -50 80 0" fill="none" stroke="#f4f4f4" strokeWidth={5} strokeLinecap="round" />
          )}
          <rect x={-356} y={-24} width={712} height={18} {...f(shade(p.color2, 0.2))} />
          <rect x={-220} y={-30} width={40} height={10} fill="#fff" />
        </g>
      );
    },
  },
  {
    id: 'whiteboard',
    name: 'Whiteboard',
    desc: 'Office or meeting-room whiteboard with marker writing.',
    place: 'interior',
    anchor: 'wall',
    w: 640,
    h: 320,
    defaultY: 540,
    defaultColor: '#3b6fd8',
    defaultColor2: '#9aa3ad',
    text: true,
    colors: 'color = marker ink, color2 = frame',
    render: (p) => {
      const lines = p.text ? wrapWords(p.text, 20, 4) : [];
      const size = lines.length ? Math.min(48, fitSize(lines, 560, 48, 0.52)) : 0;
      return (
        <g>
          <rect x={-320} y={-320} width={640} height={320} rx={6} {...f(p.color2)} />
          <rect x={-304} y={-304} width={608} height={288} fill="#fbfbf8" />
          {lines.length ? (
            <Label p={p} y={-166} lines={lines} size={size} fill={p.color} font={CHALK} />
          ) : (
            <path d="M -240 -240 l 120 0 M -240 -190 l 200 0 M 60 -90 l 60 -110 l 60 70 l 50 -40" fill="none" stroke={p.color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          )}
          <rect x={-200} y={-16} width={400} height={14} {...f(p.color2)} />
          <rect x={-150} y={-26} width={50} height={10} rx={4} fill="#d33b2c" />
          <rect x={-90} y={-26} width={50} height={10} rx={4} fill="#3b6fd8" />
        </g>
      );
    },
  },
  {
    id: 'clock',
    name: 'Wall Clock',
    desc: 'Round school-style wall clock, high on the wall.',
    place: 'interior',
    anchor: 'wall',
    w: 120,
    h: 120,
    defaultY: 230,
    defaultColor: '#ffffff',
    render: (p) => (
      <g>
        <circle cx={0} cy={-60} r={56} {...f(p.color)} strokeWidth={6} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <path key={i} d={`M ${Math.sin(a) * 44} ${-60 - Math.cos(a) * 44} L ${Math.sin(a) * 50} ${-60 - Math.cos(a) * 50}`} stroke={O} strokeWidth={3} />;
        })}
        <path d="M 0 -60 L 0 -96 M 0 -60 L 26 -46" stroke={O} strokeWidth={5} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'grandfather-clock',
    name: 'Grandfather Clock',
    desc: "Tall wooden grandfather clock with a brass pendulum; grandparents' living rooms, creepy hallways.",
    place: 'interior',
    anchor: 'floor',
    w: 140,
    h: 440,
    defaultY: 700,
    defaultColor: '#6b4226',
    render: (p) => (
      <g>
        <rect x={-50} y={-310} width={100} height={300} {...f(p.color)} />
        <rect x={-30} y={-268} width={60} height={196} rx={6} {...f(shade(p.color, -0.3))} />
        <path d="M 0 -262 L 0 -130" stroke="#c9a640" strokeWidth={5} />
        <circle cx={0} cy={-116} r={18} {...f('#e2b93b')} />
        <rect x={-64} y={-24} width={128} height={24} {...f(shade(p.color, -0.15))} />
        <rect x={-66} y={-418} width={132} height={124} rx={10} {...f(p.color)} />
        <path d="M -70 -410 Q 0 -462 70 -410 Z" {...f(shade(p.color, 0.12))} />
        <circle cx={0} cy={-356} r={46} {...f('#f4ecd6')} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <path key={i} d={`M ${Math.sin(a) * 36} ${-356 - Math.cos(a) * 36} L ${Math.sin(a) * 42} ${-356 - Math.cos(a) * 42}`} stroke={O} strokeWidth={3} />;
        })}
        <path d="M 0 -356 L 0 -386 M 0 -356 L 20 -346" stroke={O} strokeWidth={5} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'wall-sign',
    name: 'Wall Sign',
    desc: 'Painted sign high on the wall naming the place ("PRINCIPAL\'S OFFICE", "CITY WOK", "EMERGENCY").',
    place: 'interior',
    anchor: 'wall',
    w: 440,
    h: 110,
    defaultY: 200,
    defaultColor: '#ffffff',
    defaultColor2: '#d33b2c',
    text: true,
    colors: 'color = sign, color2 = lettering',
    render: (p) => (
      <g>
        <rect x={-220} y={-110} width={440} height={110} rx={8} {...f(p.color)} />
        {fitLabel(p, p.text || 'WELCOME', -55, 400, 90, p.color2, { max: 48, chars: 18, lines: 2 })}
      </g>
    ),
  },
  {
    id: 'bulletin-board',
    name: 'Bulletin Board',
    desc: 'Cork board covered in pinned notes; schools, offices, community centres.',
    place: 'interior',
    anchor: 'wall',
    w: 360,
    h: 240,
    defaultY: 460,
    defaultColor: '#c79a5e',
    defaultColor2: '#7a4a2a',
    colors: 'color = cork, color2 = frame',
    render: (p) => {
      const rnd = seeded(hash(p.id) + 3);
      const notes = ['#ffffff', '#fff3a0', '#f7b6d2', '#bfe6ff', '#c8f0a0', '#ffffff'];
      return (
        <g>
          <rect x={-180} y={-240} width={360} height={240} {...f(p.color2)} />
          <rect x={-164} y={-224} width={328} height={208} fill={p.color} />
          {notes.map((n, i) => {
            const x = -140 + (i % 3) * 100 + rnd() * 20;
            const y = -210 + Math.floor(i / 3) * 96 + rnd() * 14;
            const r = rnd() * 10 - 5;
            return (
              <g key={i} transform={`rotate(${r} ${x + 36} ${y + 40})`}>
                <rect x={x} y={y} width={72} height={80} {...f(n)} strokeWidth={2} />
                <path d={`M ${x + 12} ${y + 26} l 46 0 M ${x + 12} ${y + 42} l 38 0 M ${x + 12} ${y + 58} l 44 0`} stroke="#8a8a8a" strokeWidth={3} />
                <circle cx={x + 36} cy={y + 8} r={5} fill={PRODUCT_COLORS[i % 5]} />
              </g>
            );
          })}
        </g>
      );
    },
  },
  {
    id: 'curtain-stage',
    name: 'Stage Curtains',
    desc: 'Theatre drapes and a scalloped valance framing the back wall; school plays, talent shows, awards. Place at x=800.',
    place: 'interior',
    anchor: 'floor',
    w: 1500,
    h: 640,
    defaultY: FLOOR_Y + 2,
    defaultColor: '#b3202a',
    defaultColor2: '#f2c230',
    colors: 'color = drapes, color2 = trim',
    render: (p) => {
      const d = shade(p.color, -0.22);
      const drape = (side: -1 | 1) => {
        const x0 = side * 750;
        const x1 = side * 470;
        return (
          <g key={side}>
            <path d={`M ${x0} -640 L ${x1} -640 Q ${side * 520} -320 ${side * 430} 0 L ${x0} 0 Z`} {...f(p.color)} />
            {[0.25, 0.5, 0.75].map((k) => (
              <path key={k} d={`M ${x0 + (x1 - x0) * k} -600 Q ${x0 + (x1 - x0) * k + side * 10} -300 ${x0 + (x1 - x0) * k - side * 10} 0`} fill="none" stroke={d} strokeWidth={6} />
            ))}
            <path d={`M ${side * 500} -260 q ${side * 30} 20 ${side * 60} 0`} fill="none" stroke={p.color2} strokeWidth={10} strokeLinecap="round" />
          </g>
        );
      };
      let val = 'M -760 -660 L 760 -660 L 760 -560';
      for (let i = 0; i < 12; i++) {
        const xa = 760 - (i * 1520) / 12;
        val += ` Q ${xa - 1520 / 24} -500 ${xa - 1520 / 12} -560`;
      }
      return (
        <g>
          {drape(-1)}
          {drape(1)}
          <path d={val + ' Z'} {...f(p.color)} />
          <path d="M -760 -580 L 760 -580" stroke={p.color2} strokeWidth={8} />
        </g>
      );
    },
  },

  /* ---------- furniture ---------- */
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    desc: 'Tall wooden bookcase full of books; libraries, dens, offices.',
    place: 'interior',
    anchor: 'floor',
    w: 300,
    h: 420,
    defaultColor: '#7a4a2a',
    render: (p) => {
      const rnd = seeded(hash(p.id) + 7);
      const shelves = [-400, -306, -212, -118];
      return (
        <g>
          <rect x={-150} y={-420} width={300} height={420} {...f(p.color)} />
          <rect x={-132} y={-402} width={264} height={380} fill={shade(p.color, -0.3)} />
          {shelves.map((sy, si) => {
            const books: ReactNode[] = [];
            let x = -128;
            let i = 0;
            while (x < 112) {
              const w = 14 + Math.floor(rnd() * 14);
              const h = 52 + Math.floor(rnd() * 26);
              if (x + w > 128) break;
              const lean = rnd() < 0.08 && x > -60;
              books.push(
                <rect
                  key={i++}
                  x={x}
                  y={sy + 90 - h}
                  width={w}
                  height={h}
                  {...f(PRODUCT_COLORS[Math.floor(rnd() * PRODUCT_COLORS.length)])}
                  strokeWidth={2}
                  transform={lean ? `rotate(12 ${x + w} ${sy + 90})` : undefined}
                />,
              );
              x += w + (lean ? 18 : 1);
            }
            return (
              <g key={si}>
                {books}
                <rect x={-132} y={sy + 90} width={264} height={12} {...f(p.color)} strokeWidth={2} />
              </g>
            );
          })}
        </g>
      );
    },
  },
  {
    id: 'store-shelf',
    name: 'Store Shelf',
    desc: 'Supermarket aisle shelving stacked with colourful boxes, cans and bottles; big-box stores, grocery, pharmacy.',
    place: 'interior',
    anchor: 'floor',
    w: 440,
    h: 340,
    defaultColor: '#c2bec5',
    defaultColor2: '#e8e4ea',
    colors: 'color = metal, color2 = back panel',
    render: (p) => {
      const rnd = seeded(hash(p.id) + 11);
      const rows = [-336, -226, -116];
      return (
        <g>
          <rect x={-220} y={-340} width={440} height={340} {...f(p.color2)} />
          {rows.map((ry, ri) => {
            const items: ReactNode[] = [];
            let x = -206;
            let i = 0;
            while (x < 190) {
              const kind = Math.floor(rnd() * 3);
              const col = PRODUCT_COLORS[Math.floor(rnd() * PRODUCT_COLORS.length)];
              const base = ry + 98;
              if (kind === 0) {
                const w = 36 + Math.floor(rnd() * 16);
                const h = 60 + Math.floor(rnd() * 26);
                if (x + w > 206) break;
                items.push(
                  <g key={i++}>
                    <rect x={x} y={base - h} width={w} height={h} {...f(col)} strokeWidth={2} />
                    <rect x={x + 6} y={base - h + 14} width={w - 12} height={14} fill={shade(col, 0.5)} />
                  </g>,
                );
                x += w + 3;
              } else if (kind === 1) {
                if (x + 28 > 206) break;
                items.push(
                  <g key={i++}>
                    <rect x={x} y={base - 44} width={28} height={44} rx={4} {...f(col)} strokeWidth={2} />
                    <rect x={x} y={base - 32} width={28} height={14} fill="#fff" opacity={0.8} />
                  </g>,
                );
                x += 31;
              } else {
                if (x + 26 > 206) break;
                items.push(
                  <path
                    key={i++}
                    d={`M ${x} ${base} L ${x} ${base - 50} Q ${x} ${base - 62} ${x + 9} ${base - 66} L ${x + 9} ${base - 80} L ${x + 17} ${base - 80} L ${x + 17} ${base - 66} Q ${x + 26} ${base - 62} ${x + 26} ${base - 50} L ${x + 26} ${base} Z`}
                    {...f(col)}
                    strokeWidth={2}
                  />,
                );
                x += 29;
              }
            }
            return (
              <g key={ri}>
                {items}
                <rect x={-220} y={ry + 98} width={440} height={14} {...f(p.color)} strokeWidth={2} />
                {[-170, -60, 50, 160].map((tx) => (
                  <rect key={tx} x={tx} y={ry + 101} width={22} height={9} fill="#f2c230" />
                ))}
              </g>
            );
          })}
          <rect x={-228} y={-350} width={16} height={350} {...f(p.color)} />
          <rect x={212} y={-350} width={16} height={350} {...f(p.color)} />
          <rect x={-228} y={-10} width={456} height={10} {...f(shade(p.color, -0.2))} />
        </g>
      );
    },
  },
  {
    id: 'fridge-case',
    name: 'Grocery Fridge',
    desc: 'Glass-door supermarket fridge full of drinks, with a lit header sign (text, default "COLD STUFF").',
    place: 'interior',
    anchor: 'floor',
    w: 420,
    h: 440,
    defaultColor: '#d9d4d3',
    defaultColor2: '#3b6fd8',
    text: true,
    colors: 'color = cabinet, color2 = header sign',
    render: (p) => {
      const rnd = seeded(hash(p.id) + 5);
      return (
        <g>
          <rect x={-210} y={-440} width={420} height={440} {...f(p.color)} />
          <rect x={-200} y={-430} width={400} height={60} {...f(p.color2)} />
          {fitLabel(p, p.text || 'COLD STUFF', -400, 370, 50, '#ffffff', { max: 40, chars: 18, lines: 1 })}
          {[-196, -64, 68].map((dx, di) => (
            <g key={dx}>
              <rect x={dx} y={-360} width={128} height={340} {...f('#d6f0ff')} />
              {[-340, -240, -140].map((sy) => (
                <g key={sy}>
                  {Array.from({ length: 4 }, (_, k) => {
                    const col = PRODUCT_COLORS[Math.floor(rnd() * PRODUCT_COLORS.length)];
                    const bx = dx + 10 + k * 28;
                    return <rect key={k} x={bx} y={sy + 22} width={20} height={64} rx={6} fill={col} />;
                  })}
                  <rect x={dx + 4} y={sy + 86} width={120} height={6} fill="#9aa3ad" />
                </g>
              ))}
              <path d={`M ${dx + 18} ${-330} L ${dx + 50} ${-360} M ${dx + 18} ${-290} L ${dx + 90} ${-360}`} stroke="#fff" strokeWidth={5} opacity={0.7} />
              <rect x={di === 2 ? dx + 10 : dx + 108} y={-250} width={10} height={90} rx={4} {...f('#9aa3ad')} strokeWidth={2} />
            </g>
          ))}
        </g>
      );
    },
  },
  {
    id: 'counter',
    name: 'Counter',
    desc: 'Shop or bar counter; set front:true so a clerk or bartender stands behind it.',
    place: 'interior',
    anchor: 'floor',
    w: 520,
    h: 210,
    defaultY: 760,
    defaultColor: '#8a5a32',
    defaultColor2: '#d9d4d3',
    colors: 'color = body, color2 = top',
    render: (p) => {
      const seam = shade(p.color, -0.24);
      return (
        <g>
          <rect x={-250} y={-190} width={500} height={190} {...f(p.color)} />
          {[-236, -111, 14, 139].map((x) => (
            <g key={x}>
              <rect x={x} y={-166} width={97} height={136} rx={3} fill={shade(p.color, -0.1)} stroke={seam} strokeWidth={3} />
              <path d={`M ${x + 16} -150 v 104 M ${x + 50} -152 v 50 M ${x + 74} -112 v 64`} stroke={seam} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
            </g>
          ))}
          <rect x={-250} y={-16} width={500} height={16} fill={shade(p.color, -0.34)} />
          <rect x={-266} y={-210} width={532} height={26} {...f(p.color2)} />
          <rect x={-266} y={-192} width={532} height={8} fill={shade(p.color2, -0.16)} />
          <path d="M -250 -203 h 130 M -90 -203 h 60" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        </g>
      );
    },
  },
  {
    id: 'checkout',
    name: 'Checkout',
    desc: 'Store checkout counter with a conveyor belt and a cash register; front:true puts the cashier behind it.',
    place: 'interior',
    anchor: 'floor',
    w: 480,
    h: 300,
    defaultY: 760,
    defaultColor: '#5b6b8c',
    defaultColor2: '#d9d4d3',
    colors: 'color = counter, color2 = top',
    render: (p) => (
      <g>
        <rect x={-236} y={-300} width={8} height={112} fill="#8e9aa6" />
        <circle cx={-232} cy={-308} r={16} {...f('#7fbf3f')} />
        <rect x={-240} y={-170} width={480} height={170} {...f(p.color)} />
        <rect x={-222} y={-150} width={210} height={124} rx={4} fill={shade(p.color, -0.12)} />
        <rect x={12} y={-150} width={210} height={124} rx={4} fill={shade(p.color, -0.12)} />
        <rect x={-240} y={-14} width={480} height={14} fill={shade(p.color, -0.34)} />
        <rect x={-252} y={-190} width={504} height={24} {...f(p.color2)} />
        <rect x={-252} y={-172} width={504} height={6} fill={shade(p.color2, -0.16)} />
        <rect x={-190} y={-246} width={42} height={46} rx={3} {...f('#d33b2c')} />
        <rect x={-190} y={-232} width={42} height={14} fill="#fff" />
        <rect x={-136} y={-232} width={58} height={32} rx={3} {...f('#f2c230')} />
        <path d="M -128 -222 h 42 M -128 -212 h 28" stroke="#c9981a" strokeWidth={4} strokeLinecap="round" />
        <rect x={-66} y={-226} width={30} height={26} rx={4} {...f('#7fbf3f')} />
        <rect x={-240} y={-200} width={260} height={14} rx={7} {...f('#2b2b2f')} />
        <path d={Array.from({ length: 12 }, (_, i) => `M ${-226 + i * 21} -197 v 8`).join(' ')} stroke="#55555a" strokeWidth={3} />
        <rect x={32} y={-196} width={38} height={8} rx={2} fill="#b3261e" />
        <g>
          <rect x={80} y={-270} width={150} height={80} rx={6} {...f('#9aa3ad')} />
          <rect x={92} y={-260} width={70} height={30} fill="#7fbf3f" />
          <path d="M 100 -250 h 44 M 100 -240 h 28" stroke="#3f7d2a" strokeWidth={4} strokeLinecap="round" />
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={174 + c * 16} y={-260 + r * 18} width={12} height={12} fill="#e8e4ea" />))}
          <rect x={92} y={-220} width={70} height={8} rx={3} fill="#6b7078" />
          <path d="M 198 -270 L 198 -296 L 214 -296 L 214 -270 Z" {...f('#fff')} strokeWidth={2} />
          <path d="M 202 -288 h 8 M 202 -280 h 8" stroke="#9aa3ad" strokeWidth={2} />
          <rect x={112} y={-300} width={70} height={34} rx={4} {...f('#3d3d44')} />
          <rect x={120} y={-294} width={54} height={20} fill="#2ec4c4" />
          <path d="M 126 -284 h 30" stroke="#0f6a6a" strokeWidth={4} strokeLinecap="round" />
        </g>
      </g>
    ),
  },
  {
    id: 'desk',
    name: 'Office Desk',
    seat: { h: 110, w: 300, cover: true },
    desc: 'Wooden desk with drawers; offices, police stations. Put a computer on it (computer y = desk y - 200).',
    place: 'interior',
    anchor: 'floor',
    w: 380,
    h: 200,
    defaultY: 760,
    defaultColor: '#7a4a2a',
    render: (p) => {
      const seam = shade(p.color, -0.26);
      return (
        <g>
          <rect x={-30} y={-176} width={182} height={92} fill={shade(p.color, -0.24)} />
          <rect x={-180} y={-180} width={150} height={180} {...f(p.color)} />
          {[-166, -114, -62].map((y) => (
            <g key={y}>
              <rect x={-168} y={y} width={126} height={44} rx={2} fill={shade(p.color, -0.12)} stroke={seam} strokeWidth={2.5} />
              <rect x={-122} y={y + 18} width={34} height={8} rx={4} fill="#f2c230" />
            </g>
          ))}
          <rect x={-184} y={-12} width={158} height={12} fill={seam} />
          <rect x={150} y={-180} width={28} height={180} {...f(p.color)} />
          <rect x={146} y={-12} width={36} height={12} fill={seam} />
          <rect x={-190} y={-200} width={380} height={26} {...f(shade(p.color, 0.08))} />
          <path d="M -170 -192 h 110 M -30 -186 h 150 M 130 -193 h 40" stroke={shade(p.color, -0.08)} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'school-desk',
    name: 'School Desk',
    seat: { h: 92, w: 150, cover: true },
    desc: 'Kid-sized classroom desk with a yellow top and a blue chair back; put a row of them in a classroom.',
    place: 'interior',
    anchor: 'floor',
    w: 200,
    h: 200,
    defaultY: 800,
    defaultColor: '#e4dc4a',
    defaultColor2: '#3b6fd8',
    colors: 'color = desk top, color2 = chair',
    render: (p, ctx) => (
      <g>
        {!ctx.cover && (
          <g>
            <rect x={-70} y={-196} width={140} height={60} rx={6} {...f(p.color2)} />
            <rect x={-44} y={-182} width={88} height={12} rx={6} fill={shade(p.color2, -0.3)} />
          </g>
        )}
        <rect x={-86} y={-110} width={14} height={110} {...f('#8e8c92')} />
        <rect x={72} y={-110} width={14} height={110} {...f('#8e8c92')} />
        <rect x={-72} y={-52} width={144} height={8} fill="#77757b" />
        <rect x={-90} y={-8} width={22} height={8} rx={3} fill="#3d3d44" />
        <rect x={68} y={-8} width={22} height={8} rx={3} fill="#3d3d44" />
        <rect x={-72} y={-110} width={144} height={36} {...f('#77757b')} />
        <rect x={-64} y={-106} width={128} height={26} fill="#3b3a40" />
        <rect x={-58} y={-102} width={13} height={22} fill="#d33b2c" />
        <rect x={-44} y={-100} width={11} height={20} fill="#3b6fd8" />
        <rect x={-32} y={-103} width={15} height={23} fill="#7fbf3f" />
        <rect x={-100} y={-136} width={200} height={26} rx={4} {...f(p.color)} />
        <rect x={-100} y={-118} width={200} height={8} fill={shade(p.color, -0.18)} />
        <path d="M -70 -128 h 140" stroke={shade(p.color, -0.24)} strokeWidth={3} strokeLinecap="round" />
        <path d="M -46 -143 L 22 -143 L 34 -140 L 22 -137 L -46 -137 Z" fill="#f2c230" />
        <rect x={-56} y={-143} width={10} height={6} rx={2} fill="#f27bb4" />
        <path d="M 26 -142 L 34 -140 L 26 -138 Z" fill="#3d3d44" />
      </g>
    ),
  },
  {
    id: 'teacher-desk',
    name: "Teacher's Desk",
    seat: { h: 120, w: 380, cover: true },
    desc: "Big teacher's desk with an apple, papers and a mug; set front:true with the teacher behind it.",
    place: 'interior',
    anchor: 'floor',
    w: 460,
    h: 250,
    defaultY: 780,
    defaultColor: '#8a5530',
    render: (p) => {
      const seam = shade(p.color, -0.26);
      return (
        <g>
          <rect x={-220} y={-200} width={440} height={200} {...f(p.color)} />
          <rect x={-88} y={-188} width={176} height={188} fill={shade(p.color, -0.26)} />
          {[-208, 100].map((x) =>
            [-188, -128, -68].map((y) => (
              <g key={`${x},${y}`}>
                <rect x={x} y={y} width={108} height={54} rx={2} fill={shade(p.color, -0.1)} stroke={seam} strokeWidth={2.5} />
                <rect x={x + 38} y={y + 23} width={32} height={8} rx={4} fill="#c9a227" />
              </g>
            )),
          )}
          <rect x={-232} y={-222} width={464} height={26} {...f(shade(p.color, 0.1))} />
          <path d="M -214 -214 h 150 M -30 -207 h 170 M 170 -214 h 44" stroke={shade(p.color, -0.06)} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={-150} cy={-244} r={22} {...f('#d33b2c')} />
          <ellipse cx={-158} cy={-252} rx={5} ry={8} transform="rotate(24 -158 -252)" fill="#fff" opacity={0.5} />
          <path d="M -150 -266 q 4 -12 14 -14" fill="none" stroke="#5a3a22" strokeWidth={4} />
          <ellipse cx={-136} cy={-276} rx={10} ry={5} fill="#7fbf3f" />
          <rect x={-40} y={-236} width={110} height={14} {...f('#fff')} strokeWidth={2} transform="rotate(-4 15 -229)" />
          <rect x={-36} y={-248} width={110} height={14} {...f('#fff')} strokeWidth={2} transform="rotate(3 19 -241)" />
          <path d="M -26 -243 h 66 M -26 -239 h 46" stroke="#9fb0c0" strokeWidth={1.5} transform="rotate(3 19 -241)" />
          <rect x={130} y={-262} width={40} height={40} rx={6} {...f('#3b6fd8')} />
          <rect x={130} y={-250} width={40} height={8} fill="#fff" />
          <path d="M 170 -252 q 16 0 16 12 q 0 12 -16 12" fill="none" stroke={O} strokeWidth={4} />
        </g>
      );
    },
  },
  {
    id: 'table',
    name: 'Table',
    seat: { h: 96, w: 280, cover: true },
    desc: 'Plain table; dining rooms, restaurants, kitchens, break rooms.',
    place: 'interior',
    anchor: 'floor',
    w: 320,
    h: 150,
    defaultY: 780,
    defaultColor: '#a5713d',
    render: (p) => {
      const leg = shade(p.color, -0.15);
      const grain = shade(p.color, -0.16);
      return (
        <g>
          <path d="M -144 -124 L -122 -124 L -126 0 L -138 0 Z" {...f(leg)} />
          <path d="M 122 -124 L 144 -124 L 138 0 L 126 0 Z" {...f(leg)} />
          <rect x={-146} y={-124} width={292} height={20} {...f(shade(p.color, -0.08))} />
          <rect x={-160} y={-150} width={320} height={28} rx={3} {...f(p.color)} />
          <rect x={-160} y={-150} width={320} height={7} rx={3} fill={shade(p.color, 0.16)} />
          <path d="M -146 -132 h 76 M -40 -135 h 96 M 84 -130 h 58" stroke={grain} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'chair',
    name: 'Chair',
    seat: { h: 108, w: 100 },
    desc: 'Wooden chair.',
    place: 'interior',
    anchor: 'floor',
    w: 120,
    h: 220,
    defaultY: 780,
    defaultColor: '#a5713d',
    render: (p) => {
      const slat = shade(p.color, -0.12);
      return (
        <g>
          <rect x={-50} y={-212} width={14} height={104} {...f(p.color)} />
          <rect x={36} y={-212} width={14} height={104} {...f(p.color)} />
          {[-184, -158, -132].map((y) => (
            <rect key={y} x={-36} y={y} width={72} height={13} {...f(slat)} />
          ))}
          <rect x={-54} y={-222} width={108} height={26} rx={10} {...f(shade(p.color, 0.08))} />
          <path d="M -40 -212 h 56" stroke={shade(p.color, 0.3)} strokeWidth={3} strokeLinecap="round" />
          <path d="M -50 -92 L -36 -92 L -38 0 L -48 0 Z" {...f(p.color)} />
          <path d="M 36 -92 L 50 -92 L 48 0 L 38 0 Z" {...f(p.color)} />
          <rect x={-40} y={-46} width={80} height={9} fill={slat} />
          <rect x={-58} y={-112} width={116} height={20} rx={3} {...f(shade(p.color, 0.08))} />
          <rect x={-58} y={-98} width={116} height={6} fill={shade(p.color, -0.18)} />
        </g>
      );
    },
  },
  {
    id: 'couch',
    name: 'Couch',
    seat: { h: 168, w: 520 },
    desc: 'Living-room couch with a throw pillow.',
    place: 'interior',
    anchor: 'floor',
    w: 640,
    h: 280,
    defaultY: 720,
    defaultColor: '#868072',
    defaultColor2: '#f2c230',
    colors: 'color = upholstery, color2 = pillow',
    render: (p) => {
      const fold = shade(p.color, -0.2);
      const arm = shade(p.color, -0.12);
      return (
        <g>
          <rect x={-292} y={-16} width={34} height={16} rx={3} fill="#5a3a22" />
          <rect x={258} y={-16} width={34} height={16} rx={3} fill="#5a3a22" />
          <path d="M -280 -140 Q -300 -280 -200 -280 L 200 -280 Q 300 -280 280 -140 L 300 -8 L -300 -8 Z" {...f(p.color)} />
          {[-258, -86, 86].map((x) => (
            <rect key={x} x={x} y={-264} width={172} height={96} rx={26} fill={shade(p.color, 0.05)} stroke={fold} strokeWidth={3} />
          ))}
          <rect x={-260} y={-110} width={520} height={102} fill={shade(p.color, -0.08)} />
          {[-260, -87, 87].map((x) => (
            <rect key={x} x={x} y={-180} width={173} height={80} rx={26} {...f(shade(p.color, 0.1))} />
          ))}
          <path d="M -240 -168 h 120 M -66 -168 h 120 M 108 -168 h 120" stroke={shade(p.color, 0.26)} strokeWidth={4} strokeLinecap="round" />
          <path d="M -240 -28 h 480" stroke={fold} strokeWidth={3} strokeDasharray="14 10" />
          <rect x={-320} y={-180} width={80} height={172} rx={30} {...f(arm)} />
          <rect x={240} y={-180} width={80} height={172} rx={30} {...f(arm)} />
          <circle cx={-280} cy={-140} r={25} fill="none" stroke={fold} strokeWidth={3} />
          <circle cx={280} cy={-140} r={25} fill="none" stroke={fold} strokeWidth={3} />
          <circle cx={-280} cy={-140} r={6} fill={fold} />
          <circle cx={280} cy={-140} r={6} fill={fold} />
          <g transform="rotate(-8 -145 -205)">
            <rect x={-200} y={-240} width={110} height={70} rx={20} {...f(p.color2)} />
            <path d="M -192 -222 h 94 M -192 -205 h 94 M -192 -188 h 94" stroke={shade(p.color2, -0.2)} strokeWidth={5} />
          </g>
        </g>
      );
    },
  },
  {
    id: 'armchair',
    name: 'Armchair',
    seat: { h: 150, w: 190 },
    desc: 'Comfy single armchair; dads, therapists, talk shows.',
    place: 'interior',
    anchor: 'floor',
    w: 280,
    h: 260,
    defaultY: 720,
    defaultColor: '#b8433a',
    render: (p) => {
      const fold = shade(p.color, -0.26);
      const arm = shade(p.color, -0.14);
      return (
        <g>
          <rect x={-122} y={-14} width={28} height={14} rx={3} fill="#5a3a22" />
          <rect x={94} y={-14} width={28} height={14} rx={3} fill="#5a3a22" />
          <path d="M -110 -130 Q -126 -260 -50 -260 L 50 -260 Q 126 -260 110 -130 L 120 -8 L -120 -8 Z" {...f(p.color)} />
          <path d="M -82 -152 Q -92 -240 -40 -240 L 40 -240 Q 92 -240 82 -152" fill="none" stroke={fold} strokeWidth={3} />
          <path d={dots([[-44, -212], [0, -212], [44, -212], [-22, -182], [22, -182]])} stroke={fold} strokeWidth={9} strokeLinecap="round" />
          <rect x={-100} y={-90} width={200} height={82} fill={shade(p.color, -0.08)} />
          <rect x={-100} y={-160} width={200} height={80} rx={26} {...f(shade(p.color, 0.12))} />
          <path d="M -78 -148 h 156" stroke={shade(p.color, 0.3)} strokeWidth={4} strokeLinecap="round" />
          <rect x={-140} y={-170} width={64} height={162} rx={28} {...f(arm)} />
          <rect x={76} y={-170} width={64} height={162} rx={28} {...f(arm)} />
          <circle cx={-108} cy={-138} r={20} fill="none" stroke={fold} strokeWidth={3} />
          <circle cx={108} cy={-138} r={20} fill="none" stroke={fold} strokeWidth={3} />
          <circle cx={-108} cy={-138} r={5} fill={fold} />
          <circle cx={108} cy={-138} r={5} fill={fold} />
        </g>
      );
    },
  },
  {
    id: 'tv',
    name: 'TV',
    desc: 'Chunky TV on a low wooden stand; text shows on the screen.',
    place: 'interior',
    anchor: 'floor',
    w: 300,
    h: 330,
    defaultY: 700,
    defaultColor: '#3d3d44',
    defaultColor2: '#2ec4c4',
    text: true,
    colors: 'color = TV body, color2 = screen',
    screen: { x: -118, y: -310, w: 236, h: 160 },
    render: (p) => (
      <g>
        <rect x={-140} y={-10} width={30} height={10} fill={shade('#6b4226', -0.3)} />
        <rect x={110} y={-10} width={30} height={10} fill={shade('#6b4226', -0.3)} />
        <rect x={-150} y={-110} width={300} height={102} {...f('#6b4226')} />
        <rect x={-130} y={-90} width={120} height={64} fill={shade('#6b4226', -0.15)} />
        <rect x={10} y={-90} width={120} height={64} fill={shade('#6b4226', -0.15)} />
        <circle cx={-24} cy={-58} r={6} fill="#c9a227" />
        <circle cx={24} cy={-58} r={6} fill="#c9a227" />
        <path d="M -30 -320 L -70 -380 M 30 -320 L 70 -380" stroke={O} strokeWidth={4} />
        <circle cx={-70} cy={-382} r={7} fill="#9aa3ad" />
        <circle cx={70} cy={-382} r={7} fill="#9aa3ad" />
        <rect x={-140} y={-330} width={280} height={210} rx={14} {...f(p.color)} />
        <rect x={-118} y={-310} width={236} height={160} rx={8} fill={p.color2} />
        <path d="M -104 -298 L -60 -298 L -104 -224 Z" fill="#fff" opacity={0.18} />
        {p.text && fitLabel(p, p.text, -230, 210, 130, '#ffffff', { max: 34, chars: 10, lines: 3 })}
        <circle cx={-90} cy={-134} r={7} fill="#9aa3ad" />
        <circle cx={-66} cy={-134} r={7} fill="#9aa3ad" />
        <path d="M 20 -139 h 92 M 20 -129 h 92" stroke={shade(p.color, 0.28)} strokeWidth={3.5} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'bed',
    name: 'Bed',
    seat: { h: 124, w: 360 },
    desc: 'Bed seen from the side with a headboard on the left, pillow and blanket; bedrooms.',
    place: 'interior',
    anchor: 'floor',
    w: 480,
    h: 260,
    defaultY: 740,
    defaultColor: '#3b6fd8',
    defaultColor2: '#7a4a2a',
    colors: 'color = blanket, color2 = wood',
    render: (p) => {
      const wood = shade(p.color2, -0.18);
      const cap = shade(p.color2, 0.14);
      return (
        <g>
          <rect x={-232} y={-30} width={20} height={30} fill={p.color2} />
          <rect x={210} y={-30} width={20} height={30} fill={p.color2} />
          <rect x={-240} y={-260} width={40} height={260} rx={10} {...f(p.color2)} />
          <rect x={-230} y={-244} width={20} height={200} rx={5} fill={wood} />
          <rect x={-248} y={-272} width={56} height={18} rx={8} {...f(cap)} />
          <rect x={200} y={-160} width={40} height={160} rx={10} {...f(p.color2)} />
          <rect x={210} y={-146} width={20} height={106} rx={5} fill={wood} />
          <rect x={192} y={-172} width={56} height={18} rx={8} {...f(cap)} />
          <rect x={-200} y={-80} width={400} height={50} {...f(shade(p.color2, -0.1))} />
          <path d={dots([[-186, -55], [186, -55]])} stroke="#c9a227" strokeWidth={9} strokeLinecap="round" />
          <rect x={-200} y={-130} width={400} height={56} rx={10} {...f('#f4f4f4')} />
          <path d="M -194 -92 h 80" stroke="#c9d4de" strokeWidth={3} strokeDasharray="10 7" />
          <ellipse cx={-156} cy={-148} rx={42} ry={20} {...f('#dfe7ef')} />
          <ellipse cx={-150} cy={-140} rx={50} ry={24} {...f('#ffffff')} />
          <path d="M -188 -146 q 18 -12 44 -6 M -176 -132 q 16 6 34 2" fill="none" stroke="#c9d4de" strokeWidth={3} strokeLinecap="round" />
          <path d="M -100 -150 L 200 -150 L 200 -70 L -110 -70 Q -122 -110 -100 -150 Z" {...f(p.color)} />
          <path d="M -8 -150 h 28 v 80 h -28 Z M 62 -150 h 28 v 80 h -28 Z M 132 -150 h 28 v 80 h -28 Z" fill={shade(p.color, -0.14)} />
          <path d="M -110 -128 h 310 v 12 h -310 Z" fill={shade(p.color, 0.16)} opacity={0.7} />
          <path d="M -100 -150 L -60 -150 L -70 -70 L -110 -70 Q -122 -110 -100 -150 Z" fill={shade(p.color, 0.3)} />
          <path d="M -60 -78 h 256" stroke={shade(p.color, -0.3)} strokeWidth={3} strokeDasharray="12 8" />
        </g>
      );
    },
  },
  {
    id: 'hospital-bed',
    name: 'Hospital Bed',
    desc: 'Metal hospital bed with rails, mint sheets and an IV drip on the left; hospital rooms.',
    place: 'interior',
    anchor: 'floor',
    w: 540,
    h: 380,
    defaultY: 740,
    defaultColor: '#bfe6d9',
    defaultColor2: '#9aa3ad',
    colors: 'color = sheets, color2 = metal',
    render: (p) => (
      <g>
        <rect x={-268} y={-380} width={8} height={380} {...f(p.color2)} />
        <path d="M -296 -380 L -232 -380" stroke={p.color2} strokeWidth={6} />
        <path d="M -286 -380 L -286 -350 Q -286 -300 -264 -300 Q -242 -300 -242 -350 L -242 -380 Z" {...f('#e8f6ff')} />
        <path d="M -264 -300 Q -250 -220 -190 -170" fill="none" stroke="#9aa3ad" strokeWidth={3} />
        <rect x={-220} y={-110} width={440} height={30} {...f(p.color2)} />
        <path d="M -210 -110 L -210 -40 M 210 -110 L 210 -40 M -210 -60 L 210 -60" stroke={p.color2} strokeWidth={10} />
        <circle cx={-190} cy={-20} r={18} {...f('#3d3d44')} />
        <circle cx={190} cy={-20} r={18} {...f('#3d3d44')} />
        <path d="M -200 -110 L -200 -190 Q -200 -210 -180 -206 L -60 -150 L 210 -150 L 210 -110 Z" {...f('#f4f4f4')} />
        <ellipse cx={-160} cy={-196} rx={42} ry={18} transform="rotate(26 -160 -196)" {...f('#ffffff')} />
        <path d="M -90 -160 L 214 -160 L 214 -104 L -120 -104 Z" {...f(p.color)} />
        <path d="M -40 -150 L 160 -150 L 160 -126 L -40 -126 Z" fill="none" stroke={p.color2} strokeWidth={6} />
        <rect x={-60} y={-176} width={8} height={56} {...f(p.color2)} strokeWidth={2} />
        <rect x={148} y={-176} width={8} height={56} {...f(p.color2)} strokeWidth={2} />
        <path d="M -60 -176 L 156 -176" stroke={p.color2} strokeWidth={8} />
      </g>
    ),
  },
  {
    id: 'floor-lamp',
    name: 'Floor Lamp',
    desc: 'Floor lamp with a shade; glows in the evening.',
    place: 'interior',
    anchor: 'floor',
    w: 130,
    h: 380,
    defaultY: 700,
    defaultColor: '#b2c475',
    defaultColor2: '#dbb016',
    colors: 'color = shade, color2 = pole',
    render: (p) => {
      const trim = shade(p.color, -0.22);
      const collar = shade(p.color2, -0.2);
      return (
        <g>
          <ellipse cx={0} cy={0} rx={56} ry={12} {...f(p.color2)} />
          <ellipse cx={0} cy={-3} rx={34} ry={7} fill={shade(p.color2, 0.26)} />
          <rect x={-8} y={-330} width={16} height={330} {...f(p.color2)} />
          <path d="M -3 -320 V -14" stroke={shade(p.color2, 0.4)} strokeWidth={3} strokeLinecap="round" />
          <rect x={-12} y={-24} width={24} height={10} rx={3} fill={collar} />
          <rect x={-12} y={-190} width={24} height={10} rx={3} fill={collar} />
          <path d="M 22 -330 V -282" stroke="#8d939b" strokeWidth={2.5} strokeDasharray="3 3" />
          <circle cx={22} cy={-278} r={5} fill={collar} />
          <rect x={-16} y={-342} width={32} height={14} rx={3} fill={collar} />
          <path d={LAMP_SHADE} {...f(p.color)} />
          <path d={LAMP_TRIM} fill={trim} />
          <path d="M -30 -344 L -18 -428 M 0 -344 L 0 -428 M 30 -344 L 18 -428" stroke={shade(p.color, -0.1)} strokeWidth={2.5} />
        </g>
      );
    },
    lights: (p, ctx) =>
      isDim(ctx) ? (
        <g>
          {glow(0, -380, 120)}
          <path d={LAMP_SHADE} fill={shade(p.color, 0.55)} />
          <path d={LAMP_TRIM} fill={shade(p.color, 0.2)} />
        </g>
      ) : null,
  },
  {
    id: 'plant',
    name: 'Potted Plant',
    desc: 'Leafy plant in a terracotta pot; offices, lobbies, waiting rooms.',
    place: 'any',
    anchor: 'floor',
    w: 160,
    h: 230,
    defaultY: 700,
    defaultColor: '#c8643a',
    defaultColor2: '#3f9a3a',
    colors: 'color = pot, color2 = leaves',
    render: (p) => (
      <g>
        <g className={nat}>
          {[-50, -20, 15, 45, 0].map((a, i) => (
            <ellipse key={i} cx={a * 1.4} cy={-150 - (i % 2) * 30} rx={22} ry={66} transform={`rotate(${a} ${a * 1.4} ${-150 - (i % 2) * 30})`} fill={i % 2 ? shade(p.color2, 0.18) : p.color2} />
          ))}
        </g>
        <path d="M -56 -96 L 56 -96 L 42 0 L -42 0 Z" {...f(p.color)} />
        <rect x={-62} y={-104} width={124} height={20} {...f(shade(p.color, -0.12))} />
      </g>
    ),
  },
  {
    id: 'fridge',
    name: 'Fridge',
    desc: 'Kitchen fridge with a freezer door, magnets and a kid\'s drawing.',
    place: 'interior',
    anchor: 'floor',
    w: 200,
    h: 400,
    defaultY: 690,
    defaultColor: '#e9eef0',
    render: (p) => (
      <g>
        <rect x={-100} y={-400} width={200} height={400} rx={14} {...f(p.color)} />
        <path d="M -100 -280 L 100 -280" stroke={O} strokeWidth={3} />
        <rect x={70} y={-370} width={12} height={70} rx={6} {...f('#9aa3ad')} strokeWidth={2} />
        <rect x={70} y={-250} width={12} height={110} rx={6} {...f('#9aa3ad')} strokeWidth={2} />
        <rect x={-70} y={-240} width={80} height={90} {...f('#fff')} strokeWidth={2} transform="rotate(-5 -30 -195)" />
        <path d="M -56 -176 l 16 -30 l 16 22 l 14 -16 l 14 24 M -46 -216 a 8 8 0 1 0 0.1 0" fill="none" stroke="#3b6fd8" strokeWidth={3} />
        <circle cx={-30} cy={-238} r={7} fill="#d33b2c" />
        <rect x={-60} y={-110} width={22} height={16} fill="#f2c230" />
        <rect x={-20} y={-90} width={18} height={18} fill="#7fbf3f" />
        <circle cx={-60} cy={-340} r={9} fill="#e86fb0" />
      </g>
    ),
  },
  {
    id: 'stove',
    name: 'Stove',
    desc: 'Kitchen stove with four burners and an oven.',
    place: 'interior',
    anchor: 'floor',
    w: 220,
    h: 260,
    defaultY: 700,
    defaultColor: '#f4f4f4',
    render: (p) => (
      <g>
        <rect x={-110} y={-260} width={220} height={50} {...f(shade(p.color, -0.08))} />
        {[-60, -20, 20, 60].map((x) => (
          <circle key={x} cx={x} cy={-236} r={8} {...f('#3d3d44')} strokeWidth={2} />
        ))}
        <rect x={-110} y={-210} width={220} height={210} {...f(p.color)} />
        <rect x={-114} y={-214} width={228} height={18} {...f('#2b2b2f')} />
        <rect x={-80} y={-170} width={160} height={110} rx={8} {...f('#3d3d44')} />
        <rect x={-64} y={-156} width={128} height={70} rx={6} fill="#5a5a66" />
        <rect x={-70} y={-186} width={140} height={10} rx={5} fill="#9aa3ad" />
      </g>
    ),
  },
  {
    id: 'cabinets',
    name: 'Kitchen Cabinets',
    desc: 'Kitchen wall: base cabinets with a countertop and sink, upper cabinets above.',
    place: 'interior',
    anchor: 'floor',
    w: 500,
    h: 460,
    defaultY: 700,
    defaultColor: '#a5713d',
    defaultColor2: '#d9d4d3',
    colors: 'color = cabinets, color2 = countertop',
    render: (p) => {
      const door = (x: number, y: number, w: number, h: number, k: string) => (
        <g key={k}>
          <rect x={x} y={y} width={w} height={h} {...f(p.color)} />
          <rect x={x + 14} y={y + 14} width={w - 28} height={h - 28} fill={shade(p.color, -0.1)} />
          <rect x={x + w / 2 - 14} y={y + 22} width={28} height={8} rx={4} fill="#9aa3ad" />
        </g>
      );
      return (
        <g>
          {[-250, -125, 0, 125].map((x, i) => door(x, -190, 125, 190, `b${i}`))}
          <rect x={-262} y={-210} width={524} height={24} {...f(p.color2)} />
          <rect x={-60} y={-214} width={120} height={14} fill="#9aa3ad" />
          <path d="M 0 -214 L 0 -250 Q 0 -262 20 -262 L 30 -262" fill="none" stroke="#9aa3ad" strokeWidth={8} strokeLinecap="round" />
          {[-250, -125, 0, 125].map((x, i) => door(x, -460, 125, 150, `u${i}`))}
        </g>
      );
    },
  },
  {
    id: 'lockers',
    name: 'Lockers',
    desc: 'Row of four school lockers; hallways and locker rooms.',
    place: 'interior',
    anchor: 'floor',
    w: 480,
    h: 400,
    defaultY: 690,
    defaultColor: '#3b6fd8',
    render: (p) => (
      <g>
        {[-240, -120, 0, 120].map((x) => (
          <g key={x}>
            <rect x={x} y={-380} width={120} height={360} {...f(p.color)} />
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M ${x + 30} ${-350 + i * 14} L ${x + 90} ${-350 + i * 14}`} stroke={shade(p.color, -0.3)} strokeWidth={4} />
            ))}
            <rect x={x + 94} y={-220} width={10} height={40} rx={3} fill="#9aa3ad" />
          </g>
        ))}
        <rect x={-246} y={-400} width={492} height={22} {...f(shade(p.color, -0.2))} />
        <rect x={-246} y={-20} width={492} height={20} {...f('#5a5a66')} />
      </g>
    ),
  },
  {
    id: 'flag',
    name: 'Flag',
    desc: 'Flag on a pole with a starred banner; classrooms, courtrooms, town hall.',
    place: 'any',
    anchor: 'floor',
    w: 200,
    h: 400,
    defaultY: 700,
    defaultColor: '#d33b2c',
    defaultColor2: '#f4f4f4',
    colors: 'color = flag, color2 = stripes',
    render: (p) => (
      <g>
        <rect x={-66} y={-380} width={10} height={380} {...f('#c9c9c9')} />
        <circle cx={-61} cy={-388} r={11} {...f('#f2c230')} />
        <ellipse cx={-61} cy={0} rx={40} ry={10} {...f('#6b4226')} />
        <path d="M -56 -370 Q 20 -390 100 -366 L 100 -260 Q 20 -284 -56 -264 Z" {...f(p.color)} />
        <path d="M -56 -334 Q 20 -354 100 -330 M -56 -298 Q 20 -318 100 -294" fill="none" stroke={p.color2} strokeWidth={12} />
        <path d={starPath(-14, -330, 22, 0.42)} fill="#f2c230" stroke={O} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'vending-machine',
    name: 'Vending Machine',
    desc: 'Snack vending machine; hallways, break rooms, waiting rooms.',
    place: 'any',
    anchor: 'floor',
    w: 220,
    h: 420,
    defaultY: 700,
    defaultColor: '#d33b2c',
    render: (p) => {
      const rnd = seeded(hash(p.id) + 21);
      return (
        <g>
          <rect x={-110} y={-420} width={220} height={420} rx={10} {...f(p.color)} />
          <rect x={-94} y={-404} width={140} height={300} {...f('#d6f0ff')} />
          {[0, 1, 2, 3].map((r) => (
            <g key={r}>
              {[0, 1, 2, 3].map((c) => (
                <rect key={c} x={-88 + c * 34} y={-392 + r * 72} width={26} height={40} rx={4} fill={PRODUCT_COLORS[Math.floor(rnd() * PRODUCT_COLORS.length)]} />
              ))}
              <rect x={-94} y={-348 + r * 72} width={140} height={6} fill="#9aa3ad" />
            </g>
          ))}
          <rect x={58} y={-392} width={40} height={70} {...f('#3d3d44')} />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={78} cy={-296 + i * 30} r={9} {...f('#e8e4ea')} strokeWidth={2} />
          ))}
          <rect x={-80} y={-80} width={120} height={44} rx={6} {...f('#2b2b2f')} />
          <rect x={-110} y={-440} width={220} height={30} rx={8} {...f(shade(p.color, -0.25))} />
          <Label p={p} y={-425} lines={['SNACKS']} size={24} fill="#fff" />
        </g>
      );
    },
    lights: (_p, ctx) => (isDark(ctx) ? <rect x={-94} y={-404} width={140} height={300} fill={GLOW} opacity={0.25} /> : null),
  },
  {
    id: 'podium',
    name: 'Podium',
    desc: 'Lectern with a microphone and a front panel (text); speeches, assemblies, press conferences. Usually front:true.',
    place: 'any',
    anchor: 'floor',
    w: 220,
    h: 300,
    defaultY: 800,
    defaultColor: '#7a4a2a',
    defaultColor2: '#f2c230',
    text: true,
    colors: 'color = wood, color2 = front panel',
    render: (p) => (
      <g>
        <path d="M -80 0 L -96 -250 L 96 -250 L 80 0 Z" {...f(p.color)} />
        <path d="M -116 -246 L 116 -246 L 106 -290 L -106 -290 Z" {...f(shade(p.color, 0.12))} />
        <path d="M 30 -290 Q 40 -330 60 -340" fill="none" stroke="#3d3d44" strokeWidth={6} />
        <ellipse cx={64} cy={-346} rx={12} ry={16} {...f('#3d3d44')} />
        {p.text ? (
          <g>
            <rect x={-70} y={-200} width={140} height={110} rx={6} {...f(p.color2)} />
            {fitLabel(p, p.text, -145, 124, 90, '#1d1d1d', { max: 30, chars: 9, lines: 3 })}
          </g>
        ) : (
          <circle cx={0} cy={-150} r={44} {...f(p.color2)} />
        )}
      </g>
    ),
  },
  {
    id: 'fireplace',
    name: 'Fireplace',
    desc: 'Brick fireplace with a crackling fire and a wooden mantel; living rooms, cabins, lodges.',
    place: 'interior',
    anchor: 'floor',
    w: 380,
    h: 340,
    defaultY: 690,
    defaultColor: '#b8433a',
    defaultColor2: '#6b4226',
    colors: 'color = bricks, color2 = mantel',
    render: (p) => (
      <g>
        <rect x={-170} y={-300} width={340} height={300} {...f(p.color)} />
        {Array.from({ length: 7 }, (_, r) => (
          <path key={r} d={`M -170 ${-260 + r * 40} L 170 ${-260 + r * 40}`} stroke={shade(p.color, -0.2)} strokeWidth={3} />
        ))}
        {Array.from({ length: 7 }, (_, r) =>
          [0, 1, 2, 3].map((c) => {
            const x = -150 + c * 90 + (r % 2) * 45;
            return x < 170 ? <path key={`${r}${c}`} d={`M ${x} ${-300 + r * 40} L ${x} ${-260 + r * 40}`} stroke={shade(p.color, -0.2)} strokeWidth={3} /> : null;
          }),
        )}
        <path d="M -100 0 L -100 -150 Q -100 -200 0 -200 Q 100 -200 100 -150 L 100 0 Z" {...f('#2b1b22')} />
        <rect x={-70} y={-24} width={140} height={18} rx={9} {...f('#7a4a2a')} transform="rotate(6 0 -15)" />
        {flames(0, -10, 0.8)}
        <rect x={-196} y={-326} width={392} height={30} {...f(p.color2)} />
      </g>
    ),
    lights: (_p, ctx) => (isDim(ctx) ? glow(0, -60, 150) : null),
  },
  {
    id: 'rug',
    name: 'Rug',
    desc: 'Oval rug lying on the floor in front of the furniture.',
    place: 'interior',
    anchor: 'floor',
    w: 560,
    h: 100,
    defaultY: 900,
    defaultColor: '#7a9091',
    render: (p) => (
      <g className={nat}>
        {Array.from({ length: 13 }, (_, i) => (i - 6) * 5).map((d) => {
          // A little fringe around each end.
          const a = (d * Math.PI) / 180;
          return <path key={d} d={`M ${Math.cos(a) * 276} ${-50 + Math.sin(a) * 280 * 0.17} l 16 ${d * 0.1} M ${-Math.cos(a) * 276} ${-50 + Math.sin(a) * 280 * 0.17} l -16 ${d * 0.1}`} stroke={shade(p.color, 0.3)} strokeWidth={3} strokeLinecap="round" />;
        })}
        <ellipse cx={0} cy={-50} rx={280} ry={50} fill={p.color} />
        <ellipse cx={0} cy={-50} rx={244} ry={38} fill="none" stroke={shade(p.color, 0.3)} strokeWidth={8} />
        <ellipse cx={0} cy={-50} rx={196} ry={26} fill={shade(p.color, -0.14)} />
        <ellipse cx={0} cy={-50} rx={120} ry={13} fill="none" stroke={shade(p.color, 0.3)} strokeWidth={5} />
      </g>
    ),
  },
  {
    id: 'computer',
    name: 'Computer',
    desc: 'Desktop computer monitor and keyboard; sits on a desk (y = desk y - 200).',
    place: 'interior',
    anchor: 'floor',
    w: 180,
    h: 160,
    defaultY: 560,
    defaultColor: '#3d3d44',
    defaultColor2: '#5aaeea',
    colors: 'color = case, color2 = screen',
    screen: { x: -68, y: -148, w: 136, h: 88 },
    render: (p) => (
      <g>
        <rect x={-14} y={-50} width={28} height={40} {...f(p.color)} />
        <rect x={-50} y={-14} width={100} height={14} rx={4} {...f(p.color)} />
        <rect x={-80} y={-160} width={160} height={114} rx={8} {...f(p.color)} />
        <rect x={-68} y={-148} width={136} height={88} rx={4} fill={p.color2} />
        <path d="M -54 -130 l 60 0 M -54 -112 l 90 0 M -54 -94 l 40 0" stroke="#fff" strokeWidth={5} opacity={0.8} />
        <rect x={56} y={-10} width={60} height={12} rx={3} {...f('#d9d4d3')} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'toilet',
    name: 'Toilet',
    seat: { h: 100, w: 120 },
    desc: 'Toilet seen from the front; bathrooms.',
    place: 'interior',
    anchor: 'floor',
    w: 150,
    h: 220,
    defaultY: 760,
    defaultColor: '#f4f4f4',
    render: (p) => (
      <g>
        <rect x={-60} y={-220} width={120} height={90} rx={10} {...f(p.color)} />
        <rect x={-30} y={-210} width={20} height={8} rx={3} fill="#9aa3ad" />
        <path d="M -40 0 L -34 -70 L 34 -70 L 40 0 Z" {...f(p.color)} />
        <ellipse cx={0} cy={-100} rx={74} ry={36} {...f(p.color)} />
        <ellipse cx={0} cy={-104} rx={52} ry={22} fill={shade(p.color, -0.2)} />
      </g>
    ),
  },
  {
    id: 'stall',
    name: 'Bathroom Stall',
    desc: 'Grey bathroom stall with a door that stops short of the floor.',
    place: 'interior',
    anchor: 'floor',
    w: 280,
    h: 450,
    defaultY: 700,
    defaultColor: '#8e9aa6',
    render: (p) => {
      const line = shade(p.color, -0.16);
      return (
        <g>
          <rect x={-140} y={-450} width={20} height={410} {...f(shade(p.color, -0.1))} />
          <rect x={120} y={-450} width={20} height={410} {...f(shade(p.color, -0.1))} />
          <rect x={-148} y={-462} width={296} height={14} rx={3} {...f(shade(p.color, -0.26))} />
          <rect x={-120} y={-400} width={240} height={350} {...f(p.color)} />
          <rect x={-100} y={-380} width={200} height={310} rx={4} fill="none" stroke={line} strokeWidth={4} />
          <rect x={-128} y={-360} width={20} height={28} rx={3} fill="#c9c9c9" />
          <rect x={-128} y={-120} width={20} height={28} rx={3} fill="#c9c9c9" />
          <rect x={76} y={-252} width={40} height={36} rx={4} fill="#9aa3ad" />
          <rect x={84} y={-240} width={24} height={14} rx={3} fill="#d33b2c" />
          <path d="M -8 -352 v 12 q 0 8 8 8 q 8 0 8 -8" fill="none" stroke="#c9c9c9" strokeWidth={5} strokeLinecap="round" />
          <Label p={p} y={-272} lines={['WUZ', 'HERE']} size={26} fill={shade(p.color, -0.42)} font={CHALK} weight={700} />
          <path d="M -40 -212 q 40 -16 80 -2 M -30 -196 q 30 -8 58 2" fill="none" stroke={shade(p.color, -0.42)} strokeWidth={3} strokeLinecap="round" />
          <rect x={-148} y={-40} width={12} height={40} fill="#9aa3ad" />
          <rect x={136} y={-40} width={12} height={40} fill="#9aa3ad" />
        </g>
      );
    },
  },
  {
    id: 'trophy-case',
    name: 'Trophy Case',
    desc: 'Glass trophy cabinet full of gold cups; school halls, gyms, rec centres.',
    place: 'interior',
    anchor: 'floor',
    w: 360,
    h: 410,
    defaultY: 690,
    defaultColor: '#7a4a2a',
    render: (p) => {
      const cup = (x: number, y: number, s: number, k: string) => (
        <g key={k}>
          <path d={`M ${x - 22 * s} ${y - 62 * s} L ${x + 22 * s} ${y - 62 * s} Q ${x + 20 * s} ${y - 28 * s} ${x} ${y - 24 * s} Q ${x - 20 * s} ${y - 28 * s} ${x - 22 * s} ${y - 62 * s} Z`} {...f('#f2c230')} strokeWidth={2} />
          <rect x={x - 4 * s} y={y - 26 * s} width={8 * s} height={14 * s} fill="#dbb016" />
          <rect x={x - 16 * s} y={y - 12 * s} width={32 * s} height={12 * s} {...f('#6b4226')} strokeWidth={2} />
        </g>
      );
      return (
        <g>
          <rect x={-180} y={-410} width={360} height={410} {...f(p.color)} />
          <rect x={-160} y={-390} width={320} height={330} {...f('#d6f0ff')} />
          {[-280, -170].map((y) => (
            <rect key={y} x={-160} y={y} width={320} height={8} fill="#9aa3ad" />
          ))}
          {cup(-100, -280, 1.2, 'a')}
          {cup(0, -280, 1.6, 'b')}
          {cup(100, -280, 1.1, 'c')}
          {cup(-60, -170, 1, 'd')}
          {cup(60, -170, 1.3, 'e')}
          <circle cx={-110} cy={-90} r={16} {...f('#f2c230')} strokeWidth={2} />
          <circle cx={110} cy={-90} r={16} {...f('#c9c9c9')} strokeWidth={2} />
          <path d="M -140 -370 L -100 -390 M -140 -330 L -60 -390" stroke="#fff" strokeWidth={5} opacity={0.7} />
        </g>
      );
    },
  },
  {
    id: 'filing-cabinet',
    name: 'Filing Cabinet',
    desc: 'Grey three-drawer filing cabinet; offices, police stations.',
    place: 'interior',
    anchor: 'floor',
    w: 160,
    h: 300,
    defaultY: 700,
    defaultColor: '#9aa3ad',
    render: (p) => (
      <g>
        <rect x={-80} y={-300} width={160} height={300} {...f(p.color)} />
        {[-290, -194, -98].map((y) => (
          <g key={y}>
            <rect x={-68} y={y} width={136} height={86} {...f(shade(p.color, 0.08))} strokeWidth={2} />
            <rect x={-24} y={y + 20} width={48} height={10} rx={4} fill="#5a5a66" />
            <rect x={-20} y={y + 40} width={40} height={18} fill="#fff" />
          </g>
        ))}
      </g>
    ),
  },
  {
    id: 'trash-can',
    name: 'Trash Can',
    desc: 'Metal trash can with a lid.',
    place: 'any',
    anchor: 'floor',
    w: 100,
    h: 140,
    defaultY: 780,
    defaultColor: '#9aa3ad',
    render: (p, ctx) => {
      const band = shade(p.color, -0.16);
      return (
        <g>
          <path d="M -46 -96 q -16 -2 -14 12 q 2 10 15 6 M 46 -96 q 16 -2 14 12 q -2 10 -15 6" fill="none" stroke={shade(p.color, -0.32)} strokeWidth={6} strokeLinecap="round" />
          <path d="M -42 0 L -48 -120 L 48 -120 L 42 0 Z" {...f(p.color)} />
          <path d="M 24 -110 L 48 -120 L 42 0 L 22 0 Z" fill={shade(p.color, -0.1)} />
          {[-24, 0, 24].map((x) => (
            <path key={x} d={`M ${x} -100 L ${x * 0.9} -20`} stroke={shade(p.color, -0.22)} strokeWidth={4} />
          ))}
          <path d="M -47 -110 L 47 -110 L 46 -98 L -46 -98 Z M -43.4 -18 L 43.4 -18 L 42 0 L -42 0 Z" fill={band} />
          <ellipse cx={-14} cy={-58} rx={9} ry={15} transform="rotate(12 -14 -58)" fill={shade(p.color, 0.2)} />
          <ellipse cx={0} cy={-122} rx={54} ry={12} {...f(shade(p.color, 0.1))} />
          <ellipse cx={0} cy={-124} rx={38} ry={7} fill="none" stroke={band} strokeWidth={3} />
          <path d="M -15 -128 q 15 -24 30 0" fill="none" stroke={shade(p.color, -0.26)} strokeWidth={7} strokeLinecap="round" />
          {isSnowy(ctx.set) && <path className={nat} d="M -52 -126 Q -30 -146 0 -138 Q 30 -150 52 -126 Z" fill={SNOW} />}
        </g>
      );
    },
  },

  /* ---------- buildings ---------- */
  {
    id: 'house',
    name: 'House',
    desc: 'Family house with a pitched roof, chimney, windows and front door; roofs get snow on snowy ground.',
    place: 'exterior',
    anchor: 'ground',
    w: 380,
    h: 370,
    defaultColor: '#c8433a',
    defaultColor2: '#5a3a22',
    colors: 'color = walls, color2 = roof',
    render: (p, ctx) => (
      <g>
        <rect x={80} y={-350} width={40} height={90} {...f('#8a5a3a')} />
        <rect x={-150} y={-230} width={300} height={230} {...f(p.color)} />
        <path d="M -180 -226 L 0 -340 L 180 -226 Z" {...f(p.color2)} />
        {isSnowy(ctx.set) && (
          <g>
            {snowCap(-180, -226, 0, -340, 12)}
            {snowCap(0, -340, 180, -226, 12)}
            <path className={nat} d="M 76 -350 Q 100 -366 124 -350 Z" fill={SNOW} />
          </g>
        )}
        {winGrid({ x0: -126, y0: -190, cols: 1, rows: 1, ww: 80, wh: 70, gx: 0, gy: 0 }, ctx, '#bfe6ff')}
        {winGrid({ x0: 46, y0: -190, cols: 1, rows: 1, ww: 80, wh: 70, gx: 0, gy: 0 }, ctx, '#bfe6ff')}
        <rect x={-34} y={-130} width={68} height={130} {...f(shade(p.color, -0.35))} />
        <circle cx={20} cy={-62} r={5} fill="#f2c230" />
        <rect x={-48} y={-4} width={96} height={10} {...f('#9aa3ad')} strokeWidth={2} />
      </g>
    ),
    lights: (p, ctx) => (
      <g>
        {litGrid({ x0: -126, y0: -190, cols: 1, rows: 1, ww: 80, wh: 70, gx: 0, gy: 0 }, ctx, hash(p.id), 0.8)}
        {litGrid({ x0: 46, y0: -190, cols: 1, rows: 1, ww: 80, wh: 70, gx: 0, gy: 0 }, ctx, hash(p.id) + 1, 0.8)}
      </g>
    ),
  },
  {
    id: 'shop',
    name: 'Shop',
    desc: 'Main Street shopfront with a big sign (text = shop name), awning, window and door.',
    place: 'exterior',
    anchor: 'ground',
    w: 340,
    h: 400,
    defaultColor: '#5b6b8c',
    defaultColor2: '#d33b2c',
    text: true,
    colors: 'color = walls, color2 = awning',
    render: (p, ctx) => {
      const roof = shade(p.color, -0.4);
      return (
        <g>
          <rect x={-170} y={-360} width={340} height={360} {...f(p.color)} />
          <rect x={-176} y={-386} width={352} height={30} {...f(roof)} />
          {isSnowy(ctx.set) && <path className={nat} d="M -176 -384 Q -90 -404 0 -390 Q 90 -404 176 -384 Z" fill={SNOW} />}
          <rect x={-140} y={-344} width={280} height={96} rx={6} {...f('#fff')} />
          {fitLabel(p, p.text || 'SHOP', -296, 256, 80, roof, { max: 36, chars: 12, lines: 2 })}
          {winGrid({ x0: -140, y0: -200, cols: 1, rows: 1, ww: 140, wh: 120, gx: 0, gy: 0 }, ctx)}
          <path d="M -140 -140 L 0 -140 M -70 -200 L -70 -80" stroke={O} strokeWidth={3} />
          <path d="M -150 -236 L 10 -236 L 22 -206 L -162 -206 Z" {...f(p.color2)} />
          <rect x={40} y={-190} width={90} height={190} {...f(shade(p.color, -0.35))} />
          <circle cx={112} cy={-92} r={6} fill="#f2c230" stroke={O} strokeWidth={2} />
        </g>
      );
    },
    lights: (p, ctx) => litGrid({ x0: -140, y0: -200, cols: 1, rows: 1, ww: 140, wh: 120, gx: 0, gy: 0 }, ctx, hash(p.id), 0.9),
  },
  {
    id: 'building',
    name: 'Tall Building',
    desc: 'Tall office / apartment block with rows of windows; downtown, city scenes.',
    place: 'exterior',
    anchor: 'ground',
    w: 320,
    h: 620,
    defaultColor: '#8a8fa0',
    render: (p, ctx) => (
      <g>
        <rect x={-160} y={-600} width={320} height={600} {...f(p.color)} />
        <rect x={-170} y={-620} width={340} height={26} {...f(shade(p.color, -0.25))} />
        {isSnowy(ctx.set) && <path className={nat} d="M -170 -618 Q 0 -640 170 -618 Z" fill={SNOW} />}
        {winGrid({ x0: -130, y0: -570, cols: 4, rows: 8, ww: 44, wh: 40, gx: 28, gy: 22 }, ctx, '#9fd4ee')}
        <rect x={-40} y={-80} width={80} height={80} {...f('#3d3d44')} />
        <path d="M 0 -80 L 0 0" stroke={O} strokeWidth={3} />
      </g>
    ),
    lights: (p, ctx) => litGrid({ x0: -130, y0: -570, cols: 4, rows: 8, ww: 44, wh: 40, gx: 28, gy: 22 }, ctx, hash(p.id), 0.5),
  },
  {
    id: 'school',
    name: 'School',
    desc: 'Long brick elementary school with a sign over the doors (text, default "ELEMENTARY").',
    place: 'exterior',
    anchor: 'ground',
    w: 780,
    h: 400,
    defaultColor: '#b8433a',
    defaultColor2: '#e8e4d8',
    text: true,
    colors: 'color = brick, color2 = trim',
    render: (p, ctx) => (
      <g>
        <rect x={-380} y={-320} width={760} height={320} {...f(p.color)} />
        <rect x={-390} y={-340} width={780} height={26} {...f(p.color2)} />
        {isSnowy(ctx.set) && <path className={nat} d="M -390 -338 Q -200 -356 0 -342 Q 200 -356 390 -338 Z" fill={SNOW} />}
        {winGrid({ x0: -350, y0: -290, cols: 4, rows: 2, ww: 54, wh: 70, gx: 22, gy: 40 }, ctx, '#9fd4ee')}
        {winGrid({ x0: 80, y0: -290, cols: 4, rows: 2, ww: 54, wh: 70, gx: 22, gy: 40 }, ctx, '#9fd4ee')}
        <rect x={-120} y={-410} width={240} height={410} {...f(shade(p.color, -0.1))} />
        <rect x={-132} y={-430} width={264} height={26} {...f(p.color2)} />
        {isSnowy(ctx.set) && <path className={nat} d="M -132 -428 Q 0 -448 132 -428 Z" fill={SNOW} />}
        <circle cx={0} cy={-350} r={30} {...f('#fff')} strokeWidth={4} />
        <path d="M 0 -350 L 0 -370 M 0 -350 L 14 -342" stroke={O} strokeWidth={4} strokeLinecap="round" />
        <rect x={-110} y={-300} width={220} height={60} rx={6} {...f('#fff')} />
        {fitLabel(p, p.text || 'ELEMENTARY', -270, 200, 48, p.color, { max: 34, chars: 14, lines: 2 })}
        <rect x={-70} y={-200} width={140} height={200} {...f('#3d3d44')} />
        <path d="M 0 -200 L 0 0" stroke={O} strokeWidth={3} />
        <rect x={-100} y={-10} width={200} height={10} {...f('#9aa3ad')} strokeWidth={2} />
      </g>
    ),
    lights: (p, ctx) => (
      <g>
        {litGrid({ x0: -350, y0: -290, cols: 4, rows: 2, ww: 54, wh: 70, gx: 22, gy: 40 }, ctx, hash(p.id), 0.3)}
        {litGrid({ x0: 80, y0: -290, cols: 4, rows: 2, ww: 54, wh: 70, gx: 22, gy: 40 }, ctx, hash(p.id) + 1, 0.3)}
      </g>
    ),
  },
  {
    id: 'church',
    name: 'Church',
    desc: 'White wooden church with a steeple, round window and arched door.',
    place: 'exterior',
    anchor: 'ground',
    w: 380,
    h: 600,
    defaultColor: '#f4f1e8',
    defaultColor2: '#6e2a26',
    colors: 'color = walls, color2 = roof',
    render: (p, ctx) => (
      <g>
        <rect x={-160} y={-260} width={320} height={260} {...f(p.color)} />
        <path d="M -190 -256 L 0 -380 L 190 -256 Z" {...f(p.color2)} />
        {isSnowy(ctx.set) && (
          <g>
            {snowCap(-190, -256, -60, -340, 10)}
            {snowCap(60, -340, 190, -256, 10)}
          </g>
        )}
        <rect x={-50} y={-470} width={100} height={210} {...f(p.color)} />
        <path d="M -62 -466 L 0 -580 L 62 -466 Z" {...f(p.color2)} />
        <path d="M 0 -580 L 0 -630 M -18 -612 L 18 -612" stroke="#f2c230" strokeWidth={8} strokeLinecap="round" />
        <path d="M -20 -400 Q -20 -430 0 -430 Q 20 -430 20 -400 L 20 -360 L -20 -360 Z" {...f('#3d3d44')} />
        <circle cx={0} cy={-190} r={36} {...f(isDim(ctx) ? '#2e3a5c' : '#9fd4ee')} />
        <path d="M -36 -190 L 36 -190 M 0 -226 L 0 -154" stroke={O} strokeWidth={3} />
        <path d="M -44 0 L -44 -90 Q -44 -136 0 -136 Q 44 -136 44 -90 L 44 0 Z" {...f('#7a4a2a')} />
        <path d="M 0 -136 L 0 0" stroke={O} strokeWidth={3} />
        {[-120, 92].map((x) => (
          <path key={x} d={`M ${x} -60 L ${x} -150 Q ${x + 14} -170 ${x + 28} -150 L ${x + 28} -60 Z`} {...f(isDim(ctx) ? '#2e3a5c' : '#9fd4ee')} />
        ))}
      </g>
    ),
    lights: (_p, ctx) =>
      isDim(ctx) ? (
        <g>
          <circle cx={0} cy={-190} r={36} fill={LIT} />
          <path d="M -36 -190 L 36 -190 M 0 -226 L 0 -154" stroke={O} strokeWidth={3} />
        </g>
      ) : null,
  },
  {
    id: 'police-station',
    name: 'Police Station',
    desc: 'Blue-grey police station with a sign band (text, default "POLICE"), blue lamps and glass doors.',
    place: 'exterior',
    anchor: 'ground',
    w: 580,
    h: 400,
    defaultColor: '#5b6b8c',
    defaultColor2: '#2e4fa8',
    text: true,
    colors: 'color = walls, color2 = lettering',
    render: (p, ctx) => (
      <g>
        <rect x={-280} y={-360} width={560} height={360} {...f(p.color)} />
        <rect x={-290} y={-386} width={580} height={30} {...f(shade(p.color, -0.3))} />
        {isSnowy(ctx.set) && <path className={nat} d="M -290 -384 Q 0 -404 290 -384 Z" fill={SNOW} />}
        <rect x={-200} y={-340} width={400} height={70} rx={6} {...f('#fff')} />
        {fitLabel(p, p.text || 'POLICE', -305, 370, 56, p.color2, { max: 50, chars: 16, lines: 1 })}
        {winGrid({ x0: -250, y0: -240, cols: 2, rows: 1, ww: 70, wh: 90, gx: 20, gy: 0 }, ctx, '#9fd4ee')}
        {winGrid({ x0: 90, y0: -240, cols: 2, rows: 1, ww: 70, wh: 90, gx: 20, gy: 0 }, ctx, '#9fd4ee')}
        <rect x={-70} y={-180} width={140} height={180} {...f('#9fd4ee')} />
        <path d="M 0 -180 L 0 0" stroke={O} strokeWidth={4} />
        {[-100, 100].map((x) => (
          <g key={x}>
            <rect x={x - 6} y={-220} width={12} height={40} fill="#3d3d44" />
            <rect x={x - 16} y={-250} width={32} height={34} rx={6} {...f('#3b8fd8')} />
          </g>
        ))}
      </g>
    ),
    lights: (p, ctx) =>
      isDim(ctx) ? (
        <g>
          {litGrid({ x0: -250, y0: -240, cols: 2, rows: 1, ww: 70, wh: 90, gx: 20, gy: 0 }, ctx, hash(p.id), 0.7)}
          {litGrid({ x0: 90, y0: -240, cols: 2, rows: 1, ww: 70, wh: 90, gx: 20, gy: 0 }, ctx, hash(p.id) + 1, 0.7)}
          {[-100, 100].map((x) => (
            <g key={x}>
              {glow(x, -233, 50)}
              <rect x={x - 16} y={-250} width={32} height={34} rx={6} fill="#8fd0ff" />
            </g>
          ))}
        </g>
      ) : null,
  },
  {
    id: 'hospital',
    name: 'Hospital',
    desc: 'Cream hospital block with a red-cross sign, rows of windows and an entrance canopy (text, default "HOSPITAL").',
    place: 'exterior',
    anchor: 'ground',
    w: 620,
    h: 520,
    defaultColor: '#e8e4d8',
    defaultColor2: '#d33b2c',
    text: true,
    colors: 'color = walls, color2 = cross + lettering',
    render: (p, ctx) => (
      <g>
        <rect x={-300} y={-480} width={600} height={480} {...f(p.color)} />
        <rect x={-310} y={-500} width={620} height={26} {...f(shade(p.color, -0.25))} />
        {isSnowy(ctx.set) && <path className={nat} d="M -310 -498 Q 0 -518 310 -498 Z" fill={SNOW} />}
        <rect x={-50} y={-470} width={100} height={100} rx={8} {...f('#fff')} />
        <path d="M -14 -456 L 14 -456 L 14 -434 L 36 -434 L 36 -406 L 14 -406 L 14 -384 L -14 -384 L -14 -406 L -36 -406 L -36 -434 L -14 -434 Z" fill={p.color2} />
        {winGrid({ x0: -270, y0: -372, cols: 3, rows: 3, ww: 54, wh: 50, gx: 26, gy: 26 }, ctx, '#9fd4ee')}
        {winGrid({ x0: 80, y0: -372, cols: 3, rows: 3, ww: 54, wh: 50, gx: 26, gy: 26 }, ctx, '#9fd4ee')}
        <rect x={-60} y={-130} width={120} height={130} {...f('#9fd4ee')} />
        <path d="M 0 -130 L 0 0" stroke={O} strokeWidth={4} />
        <path d="M -136 -170 L 136 -170 L 156 -124 L -156 -124 Z" {...f('#fff')} />
        {fitLabel(p, p.text || 'HOSPITAL', -147, 240, 36, p.color2, { max: 36, chars: 16, lines: 1 })}
      </g>
    ),
    lights: (p, ctx) => (
      <g>
        {litGrid({ x0: -270, y0: -372, cols: 3, rows: 3, ww: 54, wh: 50, gx: 26, gy: 26 }, ctx, hash(p.id), 0.7)}
        {litGrid({ x0: 80, y0: -372, cols: 3, rows: 3, ww: 54, wh: 50, gx: 26, gy: 26 }, ctx, hash(p.id) + 1, 0.7)}
      </g>
    ),
  },
  {
    id: 'gas-pump',
    name: 'Gas Pump',
    desc: 'Petrol pump on a concrete island with a hose; gas stations.',
    place: 'exterior',
    anchor: 'ground',
    w: 170,
    h: 290,
    defaultY: 760,
    defaultColor: '#d33b2c',
    render: (p) => (
      <g>
        <rect x={-84} y={-24} width={168} height={24} {...f('#c9c9c9')} />
        <rect x={-56} y={-280} width={112} height={256} rx={10} {...f(p.color)} />
        <rect x={-40} y={-260} width={80} height={60} rx={4} {...f('#2b2b2f')} />
        <path d="M -30 -240 l 40 0 M -30 -222 l 26 0" stroke="#7fbf3f" strokeWidth={6} />
        <rect x={-40} y={-180} width={80} height={30} {...f('#fff')} strokeWidth={2} />
        <path d="M 56 -150 Q 96 -150 96 -100 L 96 -40" fill="none" stroke="#2b2b2f" strokeWidth={8} strokeLinecap="round" />
        <rect x={40} y={-190} width={30} height={50} rx={4} {...f('#3d3d44')} />
      </g>
    ),
  },

  /* ---------- outdoor props ---------- */
  {
    id: 'pine',
    name: 'Pine Tree',
    desc: 'Tall snowy pine (snow only on snowy ground); scatter several at different scales.',
    place: 'exterior',
    anchor: 'ground',
    w: 210,
    h: 360,
    defaultColor: PINE,
    render: (p, ctx) => pine(0, 0, 1.8, isSnowy(ctx.set), 0.72, p.color),
  },
  {
    id: 'bare-tree',
    name: 'Bare Tree',
    desc: 'Leafless dark tree; spooky woods, winter parks.',
    place: 'exterior',
    anchor: 'ground',
    w: 240,
    h: 330,
    render: () => bareTree(0, 0, 1.3),
  },
  {
    id: 'bush',
    name: 'Bush',
    desc: 'Round shrub (snow-topped on snowy ground).',
    place: 'exterior',
    anchor: 'ground',
    w: 220,
    h: 120,
    defaultY: 740,
    defaultColor: '#3f8a3a',
    render: (p, ctx) => (
      <g className={nat}>
        <path d={scallop(0, -54, 100, 50, 9, 0.1)} fill={p.color} />
        <path d={scallop(6, -28, 76, 20, 8, 0.1)} fill={shade(p.color, -0.16)} />
        <path d={scallop(-34, -66, 48, 28, 7, 0.12)} fill={shade(p.color, 0.14)} />
        <path d={scallop(40, -58, 38, 24, 6, 0.12)} fill={shade(p.color, 0.08)} />
        <path d="M -72 -66 q 8 -9 16 0 M -36 -82 q 8 -9 16 0 M -18 -52 q 8 -9 16 0 M 26 -66 q 8 -9 16 0 M 56 -48 q 8 -9 16 0 M -56 -36 q 8 -9 16 0" fill="none" stroke={shade(p.color, -0.26)} strokeWidth={3.5} strokeLinecap="round" />
        <path d={dots([[-52, -54], [-8, -74], [14, -40], [50, -66], [76, -44], [-24, -30]])} stroke="#d33b2c" strokeWidth={8} strokeLinecap="round" />
        {isSnowy(ctx.set) && <path d={`M -96 -70 Q -60 -118 0 -108 Q 60 -122 96 -70 Q 50 -86 0 -78 Q -50 -90 -96 -70 Z`} fill={SNOW} />}
      </g>
    ),
  },
  {
    id: 'fence',
    name: 'Fence',
    desc: 'Wooden picket fence segment (320 wide); line several up for a yard.',
    place: 'exterior',
    anchor: 'ground',
    w: 320,
    h: 130,
    defaultY: 760,
    defaultColor: '#a5713d',
    render: (p, ctx) => {
      const xs = Array.from({ length: 8 }, (_, i) => -152 + i * 40);
      return (
        <g>
          <rect x={-160} y={-96} width={320} height={16} {...f(shade(p.color, -0.12))} />
          <rect x={-160} y={-44} width={320} height={16} {...f(shade(p.color, -0.12))} />
          {xs.map((x) => (
            <path key={x} d={`M ${x} 0 L ${x} -110 L ${x + 13} -128 L ${x + 26} -110 L ${x + 26} 0 Z`} {...f(p.color)} />
          ))}
          <path d={xs.map((x, i) => `M ${x + 8 + (i % 3) * 3} ${-104 + (i % 2) * 12} v ${40 + (i % 3) * 8} M ${x + 18 - (i % 2) * 4} ${-58 + (i % 3) * 6} v 34`).join(' ')} stroke={shade(p.color, -0.2)} strokeWidth={2} strokeLinecap="round" />
          <path d={dots(xs.flatMap((x) => [[x + 13, -88], [x + 13, -36]] as [number, number][]))} stroke={shade(p.color, -0.5)} strokeWidth={4.5} strokeLinecap="round" />
          {isSnowy(ctx.set) &&
            Array.from({ length: 8 }, (_, i) => <path key={i} className={nat} d={`M ${-154 + i * 40} -110 L ${-139 + i * 40} -132 L ${-124 + i * 40} -110 Z`} fill={SNOW} />)}
        </g>
      );
    },
  },
  {
    id: 'streetlight',
    name: 'Street Light',
    desc: 'Lamp post with a lantern head; lights up at dusk and night.',
    place: 'exterior',
    anchor: 'ground',
    w: 110,
    h: 440,
    defaultY: 740,
    defaultColor: '#3d3d44',
    render: (p) => {
      const ring = shade(p.color, 0.2);
      return (
        <g>
          <rect x={-30} y={-16} width={60} height={16} {...f(p.color)} />
          <path d="M -18 -16 L -13 -76 L 13 -76 L 18 -16 Z" {...f(p.color)} />
          <rect x={-9} y={-380} width={18} height={310} {...f(p.color)} />
          <path d="M -3 -366 V -84" stroke={shade(p.color, 0.32)} strokeWidth={3} strokeLinecap="round" />
          <rect x={-14} y={-80} width={28} height={8} rx={3} fill={ring} />
          <rect x={-13} y={-300} width={26} height={7} rx={3} fill={ring} />
          <path d="M -30 -348 H 30" stroke={p.color} strokeWidth={6} strokeLinecap="round" />
          <path d="M -30 -380 L 30 -380 L 20 -430 L -20 -430 Z" {...f(p.color)} />
          <path d="M -24 -384 L 24 -384 L 17 -426 L -17 -426 Z" fill="#fff1b0" />
          <circle cx={0} cy={-404} r={11} fill="#fff6a8" />
          <path d="M 0 -384 V -426 M -21 -405 H 21" stroke={p.color} strokeWidth={3} />
          <path d="M -24 -430 L 24 -430 L 0 -446 Z" {...f(p.color)} />
          <circle cx={0} cy={-450} r={5} fill={p.color} />
        </g>
      );
    },
    lights: (_p, ctx) =>
      isDim(ctx) ? (
        <g>
          <path d="M -20 -390 L -90 0 L 90 0 L 20 -390 Z" fill={GLOW} opacity={0.12} />
          {glow(0, -404, 70)}
          <circle cx={0} cy={-404} r={13} fill={GLOW} />
        </g>
      ) : null,
  },
  {
    id: 'bench',
    name: 'Bench',
    seat: { h: 78, w: 240 },
    desc: 'Wooden park bench; parks, bus stops, the pond.',
    place: 'exterior',
    anchor: 'ground',
    w: 260,
    h: 130,
    defaultY: 800,
    defaultColor: '#a5713d',
    render: (p, ctx) => {
      const iron = '#3d3d44';
      const grain = shade(p.color, -0.2);
      return (
        <g>
          <rect x={-110} y={-60} width={14} height={60} {...f(iron)} />
          <rect x={96} y={-60} width={14} height={60} {...f(iron)} />
          <rect x={-118} y={-6} width={30} height={6} rx={2} fill={iron} />
          <rect x={88} y={-6} width={30} height={6} rx={2} fill={iron} />
          <rect x={-104} y={-126} width={10} height={46} fill={iron} />
          <rect x={94} y={-126} width={10} height={46} fill={iron} />
          <rect x={-130} y={-126} width={260} height={9} rx={2} {...f(p.color)} />
          <rect x={-130} y={-114} width={260} height={9} rx={2} {...f(p.color)} />
          <rect x={-130} y={-80} width={260} height={10} rx={2} {...f(p.color)} />
          <rect x={-130} y={-68} width={260} height={10} rx={2} {...f(p.color)} />
          <path d="M -80 -122 h 60 M 10 -110 h 70 M -66 -75 h 44 M 30 -63 h 60" stroke={grain} strokeWidth={2} strokeLinecap="round" />
          <path d={dots([[-99, -121], [-99, -109], [-99, -75], [-99, -63], [99, -121], [99, -109], [99, -75], [99, -63]])} stroke="#c9c9c9" strokeWidth={4} strokeLinecap="round" />
          <path d="M -122 -60 V -88 Q -122 -98 -110 -98 H -94 M 122 -60 V -88 Q 122 -98 110 -98 H 94" fill="none" stroke={iron} strokeWidth={8} strokeLinecap="round" />
          {isSnowy(ctx.set) && <path className={nat} d="M -130 -126 q 130 -18 260 0" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" />}
        </g>
      );
    },
  },
  {
    id: 'car',
    name: 'Car',
    desc: 'Flat little family car seen from the side (faces right; flip to face left).',
    place: 'exterior',
    anchor: 'ground',
    w: 360,
    h: 190,
    defaultY: 820,
    defaultColor: '#3b6fd8',
    render: (p, ctx) => (
      <g>
        <path d="M -100 -110 L -70 -176 L 80 -176 L 120 -110 Z" {...f(p.color)} />
        <path d="M -82 -114 L -60 -162 L -6 -162 L -6 -114 Z M 6 -114 L 6 -162 L 70 -162 L 100 -114 Z" {...f(isDim(ctx) ? '#2e3a5c' : '#bfe6ff')} />
        <path d="M -60 -156 L -46 -156 L -68 -118 L -76 -118 Z M 22 -158 L 36 -158 L 18 -128 L 8 -128 Z" fill="#fff" opacity={0.5} />
        <rect x={-176} y={-120} width={352} height={84} rx={30} {...f(p.color)} />
        <path d="M -150 -108 H 150" stroke={shade(p.color, 0.28)} strokeWidth={4} strokeLinecap="round" />
        <path d="M 96 -122 q 4 -12 22 -11 q 5 7 -3 13 Z" fill={shade(p.color, -0.3)} />
        <rect x={150} y={-104} width={24} height={18} rx={6} fill="#fff6a8" />
        <rect x={-176} y={-100} width={18} height={16} rx={4} fill="#d33b2c" />
        <rect x={158} y={-56} width={30} height={14} rx={6} fill="#9aa3ad" />
        <rect x={-188} y={-56} width={30} height={14} rx={6} fill="#9aa3ad" />
        <path d="M -6 -114 L -6 -50 M 20 -88 L 40 -88 M -46 -88 L -26 -88" stroke={O} strokeWidth={3} />
        <circle cx={-134} cy={-86} r={7} fill={shade(p.color, -0.22)} />
        <path d="M -150 -36 A 42 42 0 0 1 -66 -36 Z M 66 -36 A 42 42 0 0 1 150 -36 Z" fill="#1f1f22" />
        {[-108, 108].map((x) => (
          <g key={x}>
            <circle cx={x} cy={-34} r={34} {...f('#2b2b2f')} />
            <circle cx={x} cy={-34} r={14} {...f('#c9c9c9')} strokeWidth={2} />
            <circle cx={x} cy={-34} r={5} fill="#7a7a80" />
          </g>
        ))}
        {isSnowy(ctx.set) && <path className={nat} d="M -72 -176 Q 0 -196 80 -176 Z" fill={SNOW} />}
      </g>
    ),
    lights: (_p, ctx) => (isDark(ctx) ? <path d="M 174 -96 L 330 -140 L 330 -40 Z" fill={GLOW} opacity={0.3} /> : null),
  },
  {
    id: 'bus-stop-sign',
    name: 'Crossing Sign',
    desc: 'Yellow diamond pedestrian-crossing sign on a post, like the one at the bus stop.',
    place: 'exterior',
    anchor: 'ground',
    w: 170,
    h: 420,
    defaultY: 760,
    render: () => (
      <g transform="translate(-175 -810)">
        <rect x={168} y={540} width={14} height={270} {...f('#5a3a22')} />
        <path d="M 175 400 L 255 480 L 175 560 L 95 480 Z" {...f('#f8de03')} />
        <path d="M 175 414 L 241 480 L 175 546 L 109 480 Z" fill="none" stroke={O} strokeWidth={4} />
        <g fill={O}>
          <circle cx={156} cy={452} r={8} />
          <path d="M 150 462 L 164 462 L 168 492 L 172 512 L 164 512 L 158 494 L 152 512 L 144 512 L 148 490 Z" />
          <rect x={132} y={474} width={16} height={14} rx={2} />
          <circle cx={196} cy={456} r={7} />
          <path d="M 191 465 L 203 465 L 206 490 L 210 508 L 203 508 L 197 492 L 192 508 L 185 508 L 189 488 Z" />
        </g>
      </g>
    ),
  },
  {
    id: 'mailbox',
    name: 'Mailbox',
    desc: 'Blue street mailbox on short legs.',
    place: 'exterior',
    anchor: 'ground',
    w: 100,
    h: 180,
    defaultY: 790,
    defaultColor: '#2e4fa8',
    render: (p, ctx) => (
      <g>
        <rect x={-38} y={-40} width={12} height={40} fill="#2b2b2f" />
        <rect x={26} y={-40} width={12} height={40} fill="#2b2b2f" />
        <rect x={-44} y={-6} width={24} height={6} rx={2} fill="#2b2b2f" />
        <rect x={20} y={-6} width={24} height={6} rx={2} fill="#2b2b2f" />
        <path d="M -46 -40 L -46 -140 Q -46 -176 0 -176 Q 46 -176 46 -140 L 46 -40 Z" {...f(p.color)} />
        <path d="M 26 -40 L 26 -168 Q 46 -160 46 -140 L 46 -40 Z" fill={shade(p.color, -0.18)} />
        <path d="M -32 -150 Q -30 -164 -12 -168" fill="none" stroke={shade(p.color, 0.34)} strokeWidth={4} strokeLinecap="round" />
        <rect x={-34} y={-148} width={68} height={24} rx={4} fill={shade(p.color, -0.24)} />
        <rect x={-30} y={-140} width={60} height={10} rx={4} fill="#2b2b2f" />
        <rect x={-14} y={-150} width={28} height={6} rx={3} fill="#c9c9c9" />
        <rect x={-30} y={-110} width={60} height={30} fill="#fff" />
        <Label p={p} y={-95} lines={['MAIL']} size={19} fill={p.color} />
        <rect x={-46} y={-60} width={92} height={7} fill={shade(p.color, 0.22)} />
        {isSnowy(ctx.set) && <path className={nat} d="M -44 -150 Q -40 -186 0 -184 Q 40 -186 44 -150 Q 20 -164 0 -160 Q -20 -166 -44 -150 Z" fill={SNOW} />}
      </g>
    ),
  },
  {
    id: 'hydrant',
    name: 'Fire Hydrant',
    desc: 'Red fire hydrant.',
    place: 'exterior',
    anchor: 'ground',
    w: 80,
    h: 110,
    defaultY: 810,
    defaultColor: '#d33b2c',
    render: (p) => {
      const dark = shade(p.color, -0.2);
      const deep = shade(p.color, -0.36);
      return (
        <g>
          <rect x={-30} y={-10} width={60} height={10} {...f(dark)} />
          <path d={dots([[-22, -5], [-7, -5], [7, -5], [22, -5]])} stroke="#c9c9c9" strokeWidth={3.5} strokeLinecap="round" />
          <rect x={-22} y={-86} width={44} height={78} rx={6} {...f(p.color)} />
          <path d="M -13 -80 V -18" stroke={shade(p.color, 0.34)} strokeWidth={4} strokeLinecap="round" />
          <rect x={-22} y={-34} width={44} height={7} fill="#f4f4f4" />
          <rect x={-38} y={-66} width={76} height={20} rx={8} {...f(p.color)} />
          <rect x={-46} y={-64} width={10} height={16} rx={3} fill={dark} />
          <rect x={36} y={-64} width={10} height={16} rx={3} fill={dark} />
          <path d="M -40 -50 q 8 18 28 8" fill="none" stroke="#c9c9c9" strokeWidth={2.5} strokeDasharray="3 3" />
          <circle cx={0} cy={-56} r={13} fill={dark} />
          <path d="M -6 -56 L -3 -61 L 3 -61 L 6 -56 L 3 -51 L -3 -51 Z" fill={deep} />
          <path d="M -24 -86 Q -24 -112 0 -112 Q 24 -112 24 -86 Z" {...f(p.color)} />
          <rect x={-27} y={-90} width={54} height={7} rx={3} fill={dark} />
          <path d={dots([[-16, -86.5], [0, -86.5], [16, -86.5]])} stroke="#c9c9c9" strokeWidth={3} strokeLinecap="round" />
          <path d="M -8 -124 L 8 -124 L 10 -110 L -10 -110 Z" fill={dark} />
        </g>
      );
    },
  },
  {
    id: 'snowman',
    name: 'Snowman',
    desc: 'Three-ball snowman with a top hat, carrot nose and scarf.',
    place: 'exterior',
    anchor: 'ground',
    w: 180,
    h: 330,
    defaultY: 800,
    defaultColor: '#1d1d1d',
    defaultColor2: '#d33b2c',
    colors: 'color = hat, color2 = scarf',
    render: (p) => (
      <g>
        <path d="M -40 -190 L -110 -230 M -104 -226 l -10 -18 M 40 -190 L 110 -236 M 104 -232 l 14 -14" stroke="#6b4226" strokeWidth={6} strokeLinecap="round" />
        <g className={nat}>
          {/* A pale blue edge, or he disappears against the snow he's standing on. */}
          <circle cx={0} cy={-70} r={72} fill={SNOW} stroke="#b4c6d8" strokeWidth={3} />
          <circle cx={0} cy={-184} r={54} fill={SNOW} stroke="#b4c6d8" strokeWidth={3} />
          <circle cx={0} cy={-268} r={40} fill={SNOW} stroke="#b4c6d8" strokeWidth={3} />
        </g>
        <path d="M -42 -236 Q 0 -224 42 -236 L 40 -222 Q 0 -210 -40 -222 Z M 18 -228 l 10 46 l 18 -4 l -12 -44 Z" {...f(p.color2)} />
        <circle cx={-14} cy={-276} r={5} fill={O} />
        <circle cx={14} cy={-276} r={5} fill={O} />
        <path d="M 0 -264 L 40 -258 L 0 -254 Z" {...f('#f0742a')} strokeWidth={2} />
        {[-190, -164, -138].map((y) => (
          <circle key={y} cx={0} cy={y} r={5} fill={O} />
        ))}
        <rect x={-44} y={-308} width={88} height={10} {...f(p.color)} />
        <rect x={-28} y={-358} width={56} height={52} {...f(p.color)} />
      </g>
    ),
  },
  {
    id: 'signpost',
    name: 'Signpost',
    desc: 'Weathered plank sign on a post with painted text ("CAMP LAKE", "KEEP OUT").',
    place: 'exterior',
    anchor: 'ground',
    w: 280,
    h: 330,
    defaultY: 790,
    text: true,
    render: (p, ctx) => {
      const lines = wrapWords((p.text || 'THIS WAY').toUpperCase(), 14, 2);
      const size = Math.min(40, fitSize(lines, 230, 40, 0.62), 90 / (lines.length * 1.1));
      const planks = 3;
      const ph = 120 / planks;
      return (
        <g>
          <rect x={-10} y={-200} width={20} height={200} {...f('#6f604c')} />
          <path d="M -3 -180 v 70 M 4 -130 v 90 M -4 -60 v 44" stroke="#544836" strokeWidth={2.5} strokeLinecap="round" />
          {Array.from({ length: planks }, (_, i) => {
            const top = -300 + i * ph;
            const tilt = i % 2 ? 3 : -2;
            return <path key={i} d={`M -140 ${top + tilt} L 140 ${top - tilt} L 140 ${top + ph - tilt} L -140 ${top + ph + tilt} Z`} {...f(i % 2 ? '#8a7863' : '#97846c')} />;
          })}
          <path d="M -134 -288 h 16 M -136 -272 h 12 M 118 -286 h 16 M 122 -272 h 12 M -134 -246 h 12 M 120 -244 h 14 M -134 -208 h 16 M 118 -206 h 16" stroke="#6f604c" strokeWidth={2.5} strokeLinecap="round" />
          <path d={dots([[-126, -280], [126, -280], [-126, -240], [126, -240], [-126, -200], [126, -200]])} stroke="#3d3528" strokeWidth={5} strokeLinecap="round" />
          <Label p={p} y={-240} lines={lines} size={size} fill="#2e2a26" font={PAINT} weight={700} />
          {isSnowy(ctx.set) && <path className={nat} d="M -142 -300 q 142 -20 284 0 l 0 10 q -142 -14 -284 0 Z" fill={SNOW} />}
        </g>
      );
    },
  },
  {
    id: 'rock',
    name: 'Rock',
    seat: { h: 88, w: 160 },
    desc: 'Grey boulder.',
    place: 'exterior',
    anchor: 'ground',
    w: 200,
    h: 110,
    defaultY: 800,
    defaultColor: '#8e8c92',
    render: (p, ctx) => (
      <g className={nat}>
        <ellipse cx={-112} cy={-7} rx={18} ry={9} fill={shade(p.color, -0.1)} />
        <ellipse cx={116} cy={-5} rx={13} ry={7} fill={shade(p.color, 0.08)} />
        <path d="M -100 0 Q -110 -60 -60 -90 Q -10 -118 50 -96 Q 104 -76 100 0 Z" fill={p.color} />
        <path d="M 50 -96 Q 104 -76 100 0 L 28 0 Q 46 -50 14 -103 Q 32 -104 50 -96 Z" fill={shade(p.color, -0.16)} />
        <path d="M -92 -18 Q -60 -36 -30 -20 Q -12 -10 -6 0 L -100 0 Q -100 -10 -92 -18 Z" fill={shade(p.color, -0.08)} />
        <path d="M -38 -40 l 14 -14 l -4 -14 l 16 -10 M -24 -54 l -16 -5" fill="none" stroke={shade(p.color, -0.32)} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 54 -60 l -10 14 l 8 12" fill="none" stroke={shade(p.color, -0.36)} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={dots([[-60, -58], [-74, -40], [-8, -28], [12, -46], [70, -28], [46, -16], [-50, -10]])} stroke={shade(p.color, -0.24)} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M -50 -76 Q -10 -96 30 -84" fill="none" stroke={shade(p.color, 0.3)} strokeWidth={8} strokeLinecap="round" />
        {isSnowy(ctx.set) && <path d="M -72 -82 Q -10 -126 64 -92 Q 20 -96 -10 -86 Q -40 -92 -72 -82 Z" fill={SNOW} />}
      </g>
    ),
  },
  {
    id: 'campfire',
    name: 'Campfire',
    desc: 'Crossed logs with a fire; glows at night.',
    place: 'exterior',
    anchor: 'ground',
    w: 220,
    h: 170,
    defaultY: 880,
    render: () => (
      <g>
        <rect x={-100} y={-26} width={200} height={26} rx={12} transform="rotate(12 0 -13)" {...f('#7a4a2a')} />
        <rect x={-100} y={-26} width={200} height={26} rx={12} transform="rotate(-12 0 -13)" {...f('#8a5530')} />
        {flames(0, -16, 1)}
      </g>
    ),
    lights: (_p, ctx) => (isDim(ctx) ? glow(0, -60, 160) : null),
  },
  {
    id: 'tent',
    name: 'Tent',
    desc: 'Triangle camping tent.',
    place: 'exterior',
    anchor: 'ground',
    w: 280,
    h: 230,
    defaultY: 780,
    defaultColor: '#d33b2c',
    render: (p) => (
      <g>
        <path d="M 0 -220 L -176 6 M 0 -220 L 176 6" stroke="#8a7a5a" strokeWidth={3} />
        <path d="M -176 6 l -7 -12 M 176 6 l 7 -12" stroke="#5a3a22" strokeWidth={6} strokeLinecap="round" />
        <path d="M -140 0 L 0 -220 L 140 0 Z" {...f(p.color)} />
        {/* The door: a dark gap with its flaps tied back. */}
        <path d="M 0 -176 L -52 0 L 52 0 Z" fill={shade(p.color, -0.6)} />
        <path d="M 0 -176 L -52 0 L -74 0 Q -46 -96 0 -176 Z M 0 -176 L 52 0 L 74 0 Q 46 -96 0 -176 Z" {...f(shade(p.color, 0.14))} strokeWidth={2} />
        <path d="M -38 -46 l -24 6 M 38 -46 l 24 6" stroke="#f2e2b8" strokeWidth={4} strokeLinecap="round" />
        <path d="M 0 -220 L 0 -244" stroke="#8a7a5a" strokeWidth={4} />
        <path d="M 0 -244 L 30 -234 L 0 -224 Z" fill="#f2c230" />
      </g>
    ),
  },
  {
    id: 'dumpster',
    name: 'Dumpster',
    desc: 'Green dumpster; alleys, behind restaurants.',
    place: 'exterior',
    anchor: 'ground',
    w: 300,
    h: 200,
    defaultY: 780,
    defaultColor: '#2f6b4f',
    render: (p, ctx) => {
      const rib = shade(p.color, -0.16);
      const lid = shade(p.color, -0.25);
      return (
        <g>
          <path d="M -112 -176 q 8 -34 42 -22 q 16 -16 34 6 L -36 -176 Z" fill="#2b2b2f" />
          <path d="M -80 -196 q 10 8 22 -2" fill="none" stroke="#55555a" strokeWidth={3} strokeLinecap="round" />
          <rect x={30} y={-206} width={66} height={40} rx={2} transform="rotate(-10 62 -186)" fill="#c9a07a" />
          <path d="M -140 -20 L -150 -170 L 150 -170 L 140 -20 Z" {...f(p.color)} />
          {[-110, -38, 38, 110].map((x) => (
            <rect key={x} x={x - 8} y={-160} width={16} height={128} rx={3} fill={rib} />
          ))}
          <rect x={-147} y={-138} width={294} height={10} rx={3} fill={shade(p.color, -0.3)} />
          <path d="M -134 -30 q 12 -16 26 -4 q 8 8 2 14 L -134 -20 Z M 96 -158 q 18 -8 44 -2 q -2 18 -20 14 q -18 2 -24 -12 Z" fill="#8a5a32" opacity={0.75} />
          <Label p={p} y={-82} lines={['TRASH']} size={38} fill={shade(p.color, 0.42)} />
          <path d="M -156 -170 L 0 -170 L 0 -192 L -150 -186 Z M 156 -170 L 0 -170 L 0 -192 L 150 -196 Z" {...f(lid)} />
          <path d="M -120 -180 h 60 M 60 -182 h 60" stroke={shade(lid, -0.3)} strokeWidth={4} strokeLinecap="round" />
          {[-110, 110].map((x) => (
            <g key={x}>
              <circle cx={x} cy={-12} r={12} {...f('#2b2b2f')} />
              <circle cx={x} cy={-12} r={4} fill="#9aa3ad" />
            </g>
          ))}
          {isSnowy(ctx.set) && <path className={nat} d="M -156 -186 Q 0 -214 156 -196 Z" fill={SNOW} />}
        </g>
      );
    },
  },

  /* ---------- sky ---------- */
  {
    id: 'cloud',
    name: 'Cloud',
    desc: 'Puffy flat cloud in the sky.',
    place: 'exterior',
    anchor: 'sky',
    w: 300,
    h: 110,
    defaultY: 200,
    defaultColor: '#ffffff',
    render: (p) => (
      <g>
        {cloud(0, -55, 1.4, p.color)}
        <path className={nat} d="M -92 -44 q 16 -16 32 -2 M -18 -36 q 18 -16 36 -2 M 54 -46 q 16 -14 32 0 M -36 -72 q 14 -14 28 -2" fill="none" stroke={shade(p.color, -0.1)} strokeWidth={5} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'sun-moon',
    name: 'Sun / Moon',
    desc: 'The sun by day (low and orange at dusk); the moon with craters at night.',
    place: 'exterior',
    anchor: 'sky',
    w: 180,
    h: 180,
    defaultY: 260,
    render: (_p, ctx) => {
      if (ctx.time === 'night') return null;
      const dusk = ctx.time === 'dusk';
      const r = dusk ? 84 : 66;
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const at = (d: number, off: number) => `${(Math.cos(a + off) * d).toFixed(1)} ${(-90 + Math.sin(a + off) * d).toFixed(1)}`;
        return `M ${at(r + 8, -0.13)} L ${at(r + 34, 0)} L ${at(r + 8, 0.13)} Z`;
      }).join(' ');
      return (
        <g className={nat}>
          {!dusk && <path d={rays} fill="#ffd23c" />}
          <circle cx={0} cy={-90} r={r} fill={dusk ? '#ff9a3c' : '#ffe25c'} />
          <circle cx={0} cy={-90} r={r * 0.72} fill={dusk ? '#ffb45e' : '#fff0a0'} />
        </g>
      );
    },
    lights: (_p, ctx) =>
      ctx.time === 'night' ? (
        <g>
          <circle cx={0} cy={-90} r={70} fill="#fff6c4" stroke={O} strokeWidth={3} />
          <path d="M 28 -154 A 70 70 0 0 1 28 -26 A 84 84 0 0 0 28 -154 Z" fill="#efe3a6" />
          <circle cx={-24} cy={-110} r={12} fill="#e9dfa8" />
          <circle cx={-27} cy={-113} r={8} fill="#ddd196" />
          <circle cx={30} cy={-64} r={8} fill="#e9dfa8" />
          <circle cx={10} cy={-120} r={6} fill="#e9dfa8" />
          <circle cx={-34} cy={-64} r={9} fill="#e9dfa8" />
          <circle cx={-36} cy={-66} r={5.5} fill="#ddd196" />
          <circle cx={4} cy={-58} r={4} fill="#e9dfa8" />
          <circle cx={38} cy={-108} r={5} fill="#e9dfa8" />
        </g>
      ) : null,
  },
];

const BY_ID = new Map(KIT_PIECES.map((d) => [d.id, d]));

export function getPieceDef(type: string): KitPieceDef | undefined {
  return BY_ID.get(type);
}

/* ------------------------------------------------------------ backgrounds */

const SKIES: Record<TimeOfDay, string> = { day: DAY_SKY, dusk: '#f2a56b', night: '#1a2558' };

/** Night and dusk outdoors: everything below the sky gets the same flat tint (like a dark overlay), lights stay bright. */
const TINT: Record<TimeOfDay, string | null> = {
  day: null,
  dusk: '0.88 0 0 0 0.05  0 0.88 0 0 0.02  0 0 0.88 0 0.027  0 0 0 1 0',
  night: '0.62 0 0 0 0.015  0 0.62 0 0 0.024  0 0 0.62 0 0.076  0 0 0 1 0',
};

function tintDef(time: TimeOfDay): ReactNode {
  const m = TINT[time];
  if (!m) return null;
  return (
    <defs>
      <filter id={`kit-tint-${time}`} x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={m} />
      </filter>
    </defs>
  );
}

function wallLayer(set: KitSet): ReactNode {
  const { wall, wallAccent: acc } = set;
  const line = shade(wall, -0.1);
  let pattern: ReactNode = null;
  switch (set.wallStyle) {
    case 'stripes':
      pattern = Array.from({ length: 16 }, (_, i) => <rect key={i} x={i * 100 + 25} y={0} width={50} height={FLOOR_Y} fill={acc} />);
      break;
    case 'panels':
      pattern = Array.from({ length: 8 }, (_, i) => <path key={i} d={`M ${i * 220 + 110} 0 L ${i * 220 + 110} ${FLOOR_Y}`} stroke={line} strokeWidth={3} />);
      break;
    case 'brick': {
      const rows: ReactNode[] = [];
      const mortar = shade(wall, -0.18);
      for (let r = 0; r * 44 < FLOOR_Y; r++) {
        rows.push(<path key={`h${r}`} d={`M 0 ${r * 44} L 1600 ${r * 44}`} stroke={mortar} strokeWidth={3} />);
        for (let x = (r % 2) * 55; x < 1600; x += 110) rows.push(<path key={`v${r},${x}`} d={`M ${x} ${r * 44} L ${x} ${r * 44 + 44}`} stroke={mortar} strokeWidth={3} />);
      }
      pattern = rows;
      break;
    }
    case 'tiles': {
      const out: ReactNode[] = [];
      for (let x = 80; x < 1600; x += 80) out.push(<path key={`v${x}`} d={`M ${x} 0 L ${x} ${FLOOR_Y}`} stroke={acc} strokeWidth={3} />);
      for (let y = 80; y < FLOOR_Y; y += 80) out.push(<path key={`h${y}`} d={`M 0 ${y} L 1600 ${y}`} stroke={acc} strokeWidth={3} />);
      pattern = out;
      break;
    }
    case 'wainscot':
      pattern = (
        <g>
          <rect x={0} y={420} width={1600} height={FLOOR_Y - 420} fill={acc} />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M ${i * 100 + 50} 440 L ${i * 100 + 50} ${FLOOR_Y - 20}`} stroke={shade(acc, -0.12)} strokeWidth={3} />
          ))}
          <rect x={0} y={408} width={1600} height={18} {...f(shade(acc, -0.2))} />
        </g>
      );
      break;
    default:
      break;
  }
  return (
    <g>
      <rect x={0} y={0} width={SCENE_W} height={FLOOR_Y + 10} fill={wall} />
      {pattern}
    </g>
  );
}

/** Floor lines converge on a point high above the room, so tiles and boards read as flat ground. */
function floorLayer(set: KitSet): ReactNode {
  const { floor } = set;
  const top = FLOOR_Y;
  const depth = SCENE_H - top;
  // Horizontal line positions, closer together towards the back.
  const rowsY: number[] = [];
  for (let y = 14, gap = 16; y < depth; gap *= 1.28, y += gap) rowsY.push(top + y);
  const xFar = (x: number) => 800 + (x - 800) * 0.62;
  const line = shade(floor, -0.15);
  let pattern: ReactNode = null;
  switch (set.floorStyle) {
    case 'boards':
      pattern = (
        <g>
          {rowsY.map((y) => (
            <path key={y} d={`M 0 ${y} L 1600 ${y}`} stroke={line} strokeWidth={3} />
          ))}
          {rowsY.map((y, i) =>
            i < rowsY.length - 1 ? (
              <path key={`j${y}`} d={`M ${((i * 397) % 1400) + 100} ${y} L ${((i * 397) % 1400) + 100} ${rowsY[i + 1]}`} stroke={line} strokeWidth={3} />
            ) : null,
          )}
        </g>
      );
      break;
    case 'tiles':
    case 'checker': {
      const xs = Array.from({ length: 23 }, (_, i) => -400 + i * 110);
      const ys = [top, ...rowsY.filter((_, i) => i % 2 === 1), SCENE_H];
      const at = (x: number, y: number) => {
        const k = (y - top) / depth;
        return xFar(x) + (x - xFar(x)) * k;
      };
      if (set.floorStyle === 'checker') {
        const alt = shade(floor, floor === '#1d1d1d' ? 0.9 : 0.6);
        const cells: ReactNode[] = [];
        for (let r = 0; r < ys.length - 1; r++)
          for (let c = 0; c < xs.length - 1; c++) {
            if ((r + c) % 2) continue;
            const [y0, y1] = [ys[r], ys[r + 1]];
            cells.push(
              <path
                key={`${r},${c}`}
                d={`M ${at(xs[c], y0)} ${y0} L ${at(xs[c + 1], y0)} ${y0} L ${at(xs[c + 1], y1)} ${y1} L ${at(xs[c], y1)} ${y1} Z`}
                fill={alt}
              />,
            );
          }
        pattern = <g>{cells}</g>;
      } else {
        pattern = (
          <g>
            {ys.slice(1, -1).map((y) => (
              <path key={y} d={`M 0 ${y} L 1600 ${y}`} stroke={line} strokeWidth={3} />
            ))}
            {xs.map((x) => (
              <path key={x} d={`M ${xFar(x)} ${top} L ${x} ${SCENE_H}`} stroke={line} strokeWidth={3} />
            ))}
          </g>
        );
      }
      break;
    }
    case 'carpet': {
      const rnd = seeded(77);
      pattern = (
        <g>
          {Array.from({ length: 90 }, (_, i) => (
            <circle key={i} cx={rnd() * 1600} cy={top + 20 + rnd() * (depth - 20)} r={2 + rnd() * 2} fill={shade(floor, -0.08)} />
          ))}
        </g>
      );
      break;
    }
    default:
      break;
  }
  return (
    <g>
      <rect x={0} y={top} width={SCENE_W} height={depth} {...f(floor)} />
      {pattern}
      <rect x={0} y={top - 14} width={SCENE_W} height={22} {...f(shade(set.wall, 0.45))} />
    </g>
  );
}

function skyLayer(set: KitSet): ReactNode {
  const color = set.sky ?? SKIES[set.time];
  const rnd = seeded(31);
  return (
    <g>
      <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill={color} />
      {!set.sky && set.time === 'dusk' && <rect x={0} y={460} width={SCENE_W} height={300} fill="#f7c98b" />}
      {set.time === 'night' &&
        Array.from({ length: 80 }, (_, i) => <circle key={i} cx={rnd() * 1600} cy={rnd() * 560} r={rnd() * 2.2 + 0.6} fill="#fff" opacity={0.6 + rnd() * 0.4} />)}
    </g>
  );
}

function townRow(): { x: number; w: number; h: number; col: string }[] {
  const cols = ['#c8433a', '#3b6fd8', '#e3c14a', '#5aa36a', '#9b6bc0', '#e08a3c', '#4aa3b5'];
  const out = [];
  for (let i = 0, x = 30; x < 1600; i++) {
    const w = 60 + (i % 3) * 12;
    out.push({ x: x + w / 2, w, h: 40 + (i % 2) * 14, col: cols[i % cols.length] });
    x += w + 26 + ((i * 37) % 30);
  }
  return out;
}

function cityRow(): { x: number; w: number; h: number; col: string }[] {
  const cols = ['#7a86a8', '#6a7698', '#8a94b4', '#5f6b8c'];
  const out = [];
  for (let i = 0, x = -20; x < 1620; i++) {
    const w = 110 + ((i * 53) % 60);
    out.push({ x: x + w / 2, w, h: 200 + ((i * 97) % 240), col: cols[i % cols.length] });
    x += w + 6;
  }
  return out;
}

function backdropLayer(set: KitSet): ReactNode {
  const snowy = isSnowy(set);
  const base = GROUND_TOP + 20;
  switch (set.backdrop) {
    case 'mountains':
      return (
        <g>
          {mountains(base + 40)}
          {[60, 170, 290, 1250, 1370, 1500].map((x, i) => pine(x, base - 6 + (i % 2) * 8, 1.1 + (i % 3) * 0.2, snowy, 0.72))}
        </g>
      );
    case 'town':
      return (
        <g>
          <g transform={`translate(0 ${base * 0.2}) scale(1 0.8)`}>{mountains(base + 40)}</g>
          {townRow().map((h) => (
            <g key={h.x}>
              <rect x={h.x - h.w / 2} y={base - h.h} width={h.w} height={h.h} {...f(h.col)} />
              <path d={`M ${h.x - h.w / 2 - 6} ${base - h.h} L ${h.x} ${base - h.h - 26} L ${h.x + h.w / 2 + 6} ${base - h.h} Z`} {...f(snowy ? '#f4f4f4' : shade(h.col, -0.35))} />
              <rect x={h.x - 8} y={base - h.h + 12} width={14} height={12} fill="#2e3a5c" />
            </g>
          ))}
        </g>
      );
    case 'forest':
      return (
        <g>
          {Array.from({ length: 19 }, (_, i) => pine(i * 90 - 20, base - 30, 1.5, snowy, 0.6, '#1d6a3a'))}
          {Array.from({ length: 14 }, (_, i) => pine(i * 125 + 30, base + 4, 2.1 + (i % 3) * 0.2, snowy, 0.66))}
        </g>
      );
    case 'city':
      return (
        <g>
          {cityRow().map((b) => (
            <g key={b.x}>
              <rect x={b.x - b.w / 2} y={base - b.h} width={b.w} height={b.h} {...f(b.col)} />
              {Array.from({ length: Math.floor((b.h - 30) / 40) }, (_, r) =>
                Array.from({ length: Math.floor((b.w - 20) / 34) }, (_, c) => (
                  <rect key={`${r},${c}`} x={b.x - b.w / 2 + 16 + c * 34} y={base - b.h + 20 + r * 40} width={18} height={20} fill={shade(b.col, 0.35)} />
                )),
              )}
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

/** Lit windows in the distant town / city at night. */
function backdropLights(set: KitSet): ReactNode {
  if (set.time === 'day') return null;
  const base = GROUND_TOP + 20;
  const rnd = seeded(5);
  if (set.backdrop === 'town')
    return (
      <g>
        {townRow().map((h) => (rnd() < 0.7 ? <rect key={h.x} x={h.x - 8} y={base - h.h + 12} width={14} height={12} fill={LIT} /> : null))}
      </g>
    );
  if (set.backdrop === 'city')
    return (
      <g>
        {cityRow().map((b) =>
          Array.from({ length: Math.floor((b.h - 30) / 40) }, (_, r) =>
            Array.from({ length: Math.floor((b.w - 20) / 34) }, (_, c) =>
              rnd() < 0.35 ? <rect key={`${b.x},${r},${c}`} x={b.x - b.w / 2 + 16 + c * 34} y={base - b.h + 20 + r * 40} width={18} height={20} fill={LIT} /> : null,
            ),
          ),
        )}
      </g>
    );
  return null;
}

function groundLayer(set: KitSet): ReactNode {
  const hill = `M 0 ${GROUND_TOP} Q 400 ${GROUND_TOP - 30} 800 ${GROUND_TOP} T 1600 ${GROUND_TOP - 10} L 1600 1000 L 0 1000 Z`;
  switch (set.ground) {
    case 'grass':
      return <path className={nat} d={hill} fill="#6db33f" />;
    case 'dirt':
      return <path className={nat} d={hill} fill="#9a7a52" />;
    case 'sand':
      return <path className={nat} d={hill} fill="#e8d29a" />;
    case 'road': {
      // Like Main Street: a snowy verge, the road, the curb, then the pavement people stand on.
      return (
        <g>
          <path className={nat} d={`M 0 ${GROUND_TOP} Q 400 ${GROUND_TOP - 20} 800 ${GROUND_TOP} T 1600 ${GROUND_TOP - 6} L 1600 760 L 0 760 Z`} {...f(SNOW)} />
          <rect x={0} y={740} width={1600} height={130} {...f(ROAD)} />
          <path d="M 0 805 L 1600 805" stroke="#f2c230" strokeWidth={8} strokeDasharray="70 50" />
          <rect x={0} y={870} width={1600} height={18} {...f('#9792a1')} />
          <rect x={0} y={886} width={1600} height={114} {...f('#dddddd')} />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M ${i * 200 + 60} 888 L ${i * 200 + 40} 1000`} stroke="#c4c4c4" strokeWidth={3} />
          ))}
        </g>
      );
    }
    case 'sidewalk':
      return (
        <g>
          <rect x={0} y={GROUND_TOP} width={1600} height={20} {...f('#9792a1')} />
          <rect x={0} y={GROUND_TOP + 18} width={1600} height={SCENE_H - GROUND_TOP} {...f('#dddddd')} />
          {[790, 870, 950].map((y) => (
            <path key={y} d={`M 0 ${y} L 1600 ${y}`} stroke="#c4c4c4" strokeWidth={3} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M ${800 + (i * 150 - 825) * 0.7} ${GROUND_TOP + 18} L ${i * 150 - 25} 1000`} stroke="#c4c4c4" strokeWidth={3} />
          ))}
          <path className={nat} d={`M 0 ${GROUND_TOP + 2} q 80 -26 160 0 q 60 -18 120 0 Z M 1220 ${GROUND_TOP + 2} q 100 -30 200 0 q 100 -24 180 0 Z`} fill={SNOW} />
        </g>
      );
    default:
      return <path className={nat} d={hill} {...f(SNOW)} />;
  }
}

/* ------------------------------------------------------------ the set */

/** Stand-in for unknown piece types so resolve/bounds never fail. */
const fallbackDef = (set: KitSet): KitPieceDef => ({
  id: 'unknown',
  name: 'Unknown',
  desc: '',
  place: 'any',
  anchor: set.place === 'exterior' ? 'ground' : 'floor',
  w: 200,
  h: 200,
  render: () => null,
});

/** A piece with colour, scale and base y filled in exactly as the renderer draws it. */
export function resolvePiece(set: KitSet, piece: KitPiece): ResolvedPiece {
  return resolveWith(piece, BY_ID.get(piece.type) ?? fallbackDef(set));
}

/** Scene-space box around the drawn piece (for drag handles). */
export function pieceBounds(set: KitSet, piece: KitPiece): { x: number; y: number; w: number; h: number } {
  const def = BY_ID.get(piece.type) ?? fallbackDef(set);
  const p = resolveWith(piece, def);
  const w = def.w * p.scale;
  const h = def.h * p.scale;
  return { x: p.x - w / 2, y: p.y - h, w, h };
}

function resolveWith(p: KitPiece, def: KitPieceDef): ResolvedPiece {
  const front = !!p.front;
  const anchorY = def.anchor === 'wall' ? 460 : def.anchor === 'sky' ? 220 : def.anchor === 'ground' ? (front ? 990 : GROUND_TOP + 20) : front ? 1000 : 700;
  return {
    ...p,
    y: p.y ?? (front && (def.anchor === 'floor' || def.anchor === 'ground') ? anchorY : def.defaultY ?? anchorY),
    scale: p.scale ?? 1,
    color: p.color ?? def.defaultColor ?? '#c2bec5',
    color2: p.color2 ?? def.defaultColor2 ?? '',
    text: p.text ?? '',
    flip: !!p.flip,
    front,
  };
}

function placed(p: ResolvedPiece, children: ReactNode, key: string): ReactNode {
  if (children === null || children === undefined || children === false) return null;
  const s = p.scale;
  return (
    <g key={key} transform={`translate(${p.x} ${p.y}) scale(${p.flip ? -s : s} ${s})`}>
      {children}
    </g>
  );
}

const ORDER = { sky: 0, wall: 1, floor: 2, ground: 2 } as const;

/** Background (behind the cast) and foreground (in front of it) for a kit set. */
export function renderKitSet(set: KitSet): { back: ReactNode; front: ReactNode } {
  const ctx: KitCtx = { time: set.time, set };
  const items = set.pieces
    .map((p) => {
      const def = BY_ID.get(p.type);
      return def ? { def, p: resolvePiece(set, p) } : null;
    })
    .filter((x): x is { def: KitPieceDef; p: ResolvedPiece } => !!x)
    .sort((a, b) => ORDER[a.def.anchor] - ORDER[b.def.anchor] || a.p.y - b.p.y);
  const backItems = items.filter((i) => !i.p.front);
  const frontItems = items.filter((i) => i.p.front);
  const draw = (list: typeof items) => list.map(({ def, p }) => placed(p, def.render(p, ctx), p.id));
  const lights = (list: typeof items) => list.map(({ def, p }) => (def.lights ? placed(p, def.lights(p, ctx), `${p.id}-l`) : null));

  if (set.place === 'interior') {
    return {
      back: (
        <g className="sp-scene">
          {wallLayer(set)}
          {floorLayer(set)}
          {draw(backItems)}
          {lights(backItems)}
        </g>
      ),
      front: frontItems.length ? (
        <g className="sp-scene">
          {draw(frontItems)}
          {lights(frontItems)}
        </g>
      ) : null,
    };
  }

  const tint = TINT[set.time] ? `url(#kit-tint-${set.time})` : undefined;
  return {
    back: (
      <g className="sp-scene">
        {tintDef(set.time)}
        {skyLayer(set)}
        <g filter={tint}>
          {backdropLayer(set)}
          {groundLayer(set)}
        </g>
        {backdropLights(set)}
        <g filter={tint}>{draw(backItems)}</g>
        {lights(backItems)}
      </g>
    ),
    front: frontItems.length ? (
      <g className="sp-scene">
        {tintDef(set.time)}
        <g filter={tint}>{draw(frontItems)}</g>
        {lights(frontItems)}
      </g>
    ) : null,
  };
}

/** One piece on its own, tinted like the set: a table or desk drawn again over the people sitting at it. */
export function renderKitPiece(set: KitSet, pieceId: string): ReactNode {
  const piece = set.pieces.find((p) => p.id === pieceId);
  const def = piece && BY_ID.get(piece.type);
  if (!piece || !def) return null;
  const p = resolvePiece(set, piece);
  const tint = set.place === 'exterior' && TINT[set.time] ? `url(#kit-tint-${set.time})` : undefined;
  return (
    <g className="sp-scene">
      {tint && tintDef(set.time)}
      <g filter={tint}>{placed(p, def.render(p, { time: set.time, set, cover: true }), p.id)}</g>
    </g>
  );
}

/** Where the characters' feet go. */
export function kitGroundY(set: KitSet): number {
  return set.place === 'exterior' && set.ground === 'road' ? 945 : 930;
}

export function defaultKitSet(place: 'interior' | 'exterior'): KitSet {
  if (place === 'exterior')
    return {
      kind: 'kit',
      place,
      time: 'day',
      wall: '#d8c7a0',
      wallStyle: 'plain',
      wallAccent: '#b49a6a',
      floor: '#7c6053',
      floorStyle: 'plain',
      ground: 'snow',
      backdrop: 'mountains',
      pieces: [
        { id: 'cloud-1', type: 'cloud', x: 330, y: 170 },
        { id: 'cloud-2', type: 'cloud', x: 1250, y: 130, scale: 0.8 },
        { id: 'pine-1', type: 'pine', x: 150, y: 760, scale: 1.1 },
        { id: 'pine-2', type: 'pine', x: 1460, y: 750 },
      ],
    };
  return {
    kind: 'kit',
    place,
    time: 'day',
    wall: '#d8c7a0',
    wallStyle: 'plain',
    wallAccent: '#b49a6a',
    floor: '#7c6053',
    floorStyle: 'plain',
    ground: 'snow',
    backdrop: 'mountains',
    pieces: [
      { id: 'door-1', type: 'door', x: 220 },
      { id: 'window-1', type: 'window', x: 820 },
      { id: 'clock-1', type: 'clock', x: 1300 },
    ],
  };
}

/* ------------------------------------------------------------ LLM support */

const WALL_STYLES: KitSet['wallStyle'][] = ['plain', 'stripes', 'panels', 'brick', 'tiles', 'wainscot'];
const FLOOR_STYLES: KitSet['floorStyle'][] = ['plain', 'boards', 'tiles', 'carpet', 'checker'];
const GROUNDS: KitSet['ground'][] = ['snow', 'grass', 'road', 'sidewalk', 'dirt', 'sand'];
const BACKDROPS: KitSet['backdrop'][] = ['mountains', 'town', 'forest', 'city', 'none'];
const TIMES: TimeOfDay[] = ['day', 'dusk', 'night'];

export function kitCatalogForPrompt(): string {
  const piece = (d: KitPieceDef) =>
    `- ${d.id} (${d.place}, ${d.anchor}, ${d.w}×${d.h}${d.defaultY !== undefined ? `, y≈${d.defaultY}` : ''}${d.text ? ', text' : ''}${d.seat ? (d.seat.cover ? ', seat behind it' : ', seat') : ''}) — ${d.desc}${d.colors ? ` [${d.colors}]` : ''}`;
  return [
    'PAPER SET KIT (a set is { "kind": "kit", "place", "time", ...style, "pieces": [...] })',
    `place: interior | exterior. time: ${TIMES.join(' | ')}.`,
    `Interior: wall colour + wallStyle (${WALL_STYLES.join(' | ')}) + wallAccent colour; floor colour + floorStyle (${FLOOR_STYLES.join(' | ')}). The wall meets the floor at y=${FLOOR_Y}.`,
    `Exterior: ground (${GROUNDS.join(' | ')}; "road" = road across the middle with a pavement in front), backdrop (${BACKDROPS.join(' | ')}), optional sky colour. Ground starts at y=${GROUND_TOP}.`,
    'Piece = { "id", "type", "x", "y"?, "scale"?, "color"?, "color2"?, "text"?, "flip"?, "front"? }. x = centre of the base (0–1600); y = where the base stands.',
    `Placement: wall pieces hang on the back wall (y = bottom edge); back-wall furniture stands around y 690–720; outdoor buildings stand around y 720; characters stand at y≈930. Pieces at y 960–1000 with "front": true are drawn IN FRONT of the characters (counters, desks and podiums people stand behind). Leave the middle (x 450–1150, in front of y 760) mostly clear for the cast.`,
    'Colours are #hex. Sizes are natural at scale 1 (kids are ~370 tall, adults ~610).',
    'Pieces:',
    ...KIT_PIECES.map(piece),
  ].join('\n');
}

const ALIASES: Record<string, string> = {
  tree: 'pine',
  'pine-tree': 'pine',
  lamp: 'floor-lamp',
  sofa: 'couch',
  'cash-register': 'checkout',
  register: 'checkout',
  shelf: 'store-shelf',
  shelves: 'store-shelf',
  sign: 'wall-sign',
  blackboard: 'chalkboard',
  moon: 'sun-moon',
  sun: 'sun-moon',
  'street-light': 'streetlight',
  'lamp-post': 'streetlight',
  lamppost: 'streetlight',
  locker: 'lockers',
  bookcase: 'bookshelf',
  television: 'tv',
  freezer: 'fridge-case',
  'crossing-sign': 'bus-stop-sign',
  'trash': 'trash-can',
  bin: 'trash-can',
  lectern: 'podium',
  curtains: 'curtain-stage',
  stage: 'curtain-stage',
  'police': 'police-station',
  'bulletin': 'bulletin-board',
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const hex = (v: unknown): string | undefined => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : fallback);

export function pieceType(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (BY_ID.has(t)) return t;
  if (ALIASES[t]) return ALIASES[t];
  for (const singular of [t.replace(/es$/, ''), t.replace(/s$/, '')]) if (BY_ID.has(singular)) return singular;
  return undefined;
}

/** Repair whatever the LLM sent into a valid set. */
export function normalizeKitSet(input: unknown): KitSet {
  const o = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const guessedPlace = o.ground !== undefined || o.backdrop !== undefined ? 'exterior' : 'interior';
  const place = oneOf(o.place, ['interior', 'exterior'] as const, guessedPlace);
  const base = defaultKitSet(place);
  const rawPieces = Array.isArray(o.pieces) ? o.pieces : [];
  const used = new Set<string>();
  const pieces: KitPiece[] = [];
  rawPieces.slice(0, 60).forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Record<string, unknown>;
    const type = pieceType(r.type ?? r.id);
    if (!type) return;
    let id = typeof r.id === 'string' && r.id.trim() && !BY_ID.has(r.id.trim()) ? r.id.trim().slice(0, 40) : `${type}-${i + 1}`;
    while (used.has(id)) id = `${id}-${i + 1}`;
    used.add(id);
    const x = num(r.x);
    const y = num(r.y);
    const scale = num(r.scale);
    const piece: KitPiece = { id, type, x: clamp(x ?? 800, -300, SCENE_W + 300) };
    if (y !== undefined) piece.y = clamp(y, 0, SCENE_H + 120);
    if (scale !== undefined) piece.scale = clamp(scale, 0.2, 4);
    const color = hex(r.color);
    const color2 = hex(r.color2);
    if (color) piece.color = color;
    if (color2) piece.color2 = color2;
    if (typeof r.text === 'string' && r.text.trim()) piece.text = r.text.trim().slice(0, 80);
    if (r.flip === true) piece.flip = true;
    if (r.front === true) piece.front = true;
    pieces.push(piece);
  });
  const set: KitSet = {
    kind: 'kit',
    place,
    time: oneOf(o.time, TIMES, 'day'),
    wall: hex(o.wall) ?? base.wall,
    wallStyle: oneOf(o.wallStyle, WALL_STYLES, 'plain'),
    wallAccent: hex(o.wallAccent) ?? base.wallAccent,
    floor: hex(o.floor) ?? base.floor,
    floorStyle: oneOf(o.floorStyle, FLOOR_STYLES, 'plain'),
    ground: oneOf(o.ground, GROUNDS, 'snow'),
    backdrop: oneOf(o.backdrop, BACKDROPS, 'mountains'),
    pieces: Array.isArray(o.pieces) ? pieces : base.pieces,
  };
  const sky = hex(o.sky);
  if (sky) set.sky = sky;
  return set;
}
