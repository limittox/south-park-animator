import type { ReactNode } from 'react';
import { ink, O, scallop, seeded, starPath } from '../character/parts/common';
import { shade } from '../lib/color';
import type { TimeOfDay } from '../episode/types';

export const SCENE_W = 1600;
export const SCENE_H = 1000;

export interface SceneOpts {
  townName: string;
  studioColor: string;
  time?: TimeOfDay;
}

export interface SceneDef {
  id: string;
  name: string;
  quip: string;
  groundY: number;
  render: (o: SceneOpts) => ReactNode;
  /** Drawn over the cast, e.g. a desk the characters stand behind. */
  front?: (o: SceneOpts) => ReactNode;
  /** Can be dusk or night. Outdoors the whole picture darkens; indoors the lights stay on and only what's outside changes. */
  times?: 'outdoors' | 'indoors';
  /** Places to sit, in scene coordinates. */
  seats?: PresetSeat[];
  /** The picture of a TV in the set, for people who appear on it. */
  screen?: { x: number; y: number; w: number; h: number };
}

/** A seat drawn into a preset: sitters' feet go on `y`, their hips `h` above it, sharing width `w`. */
export interface PresetSeat {
  id: string;
  x: number;
  y: number;
  h: number;
  w: number;
  /** Drawn again over whoever sits there (the table or desk they sit behind). */
  cover?: () => ReactNode;
}

export const DISPLAY = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
/** Chunky painted serif for the town's wooden signs. */
export const PAINT = "Rockwell, 'Roboto Slab', Georgia, serif";
const f = (color: string) => ({ fill: color, ...ink });

/* ------------------------------------------------------------ helpers */

/*
 * Colours sampled from the show's own backgrounds (bus stop, Main Street, cafeteria, living room).
 * Skies are one flat colour; mountains are dark green with soft snow caps.
 */
export const DAY_SKY = '#92d6e6';
export const MOUNTAIN = '#316647';
export const PINE = '#26964a';
export const SNOW = '#f9f9f9';
export const ROAD = '#48414d';

export function sky(color = DAY_SKY) {
  return <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill={color} />;
}

export const DUSK_SKY = '#f2a56b';
export const NIGHT_SKY = '#1a2558';
/** Drawn under the set's dusk or night tint, these come out as DUSK_SKY and NIGHT_SKY. */
const UNDER_TINT: Record<TimeOfDay, string> = { day: DAY_SKY, dusk: '#ffb672', night: '#233279' };

const STARS = (() => {
  const rnd = seeded(77);
  return Array.from({ length: 46 }, () => [rnd() * SCENE_W, rnd() * 420, 2 + rnd() * 3.5]);
})();

/** The sky of a place outdoors at any time of day. */
function skyAt(time: TimeOfDay = 'day') {
  return (
    <>
      {sky(UNDER_TINT[time])}
      {time === 'night' && (
        <g className="nat">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#fff" />
          ))}
          <circle cx={1330} cy={120} r={58} fill="#fff" />
          <circle cx={1352} cy={106} r={50} fill={UNDER_TINT.night} />
        </g>
      )}
    </>
  );
}

// Natural shapes (`.nat`) stay edge-free; man-made props get the show's thin darker edges.
export function cloud(x: number, y: number, s = 1, color = '#ffffff') {
  return <path className="nat" d={scallop(x, y, 90 * s, 34 * s, 9, 0.16)} {...f(color)} />;
}

/** Broad green mountains with rounded peaks and soft snow caps, like the ones behind the bus stop. */
export function mountains(baseY: number, color = MOUNTAIN, peaks: [number, number, number][] = [[220, 230, 560], [860, 280, 640], [1480, 330, 460]]) {
  return (
    <g className="nat">
      {peaks.map(([x, y, hw], i) => {
        const h = baseY - y;
        const tl = [x - hw * 0.16, y + h * 0.1];
        const tr = [x + hw * 0.16, y + h * 0.1];
        // Point on a slope, a fraction k of the way down the mountain.
        const slope = (side: -1 | 1, k: number) => {
          const u = (k - 0.1) / 0.9;
          return [x + side * (hw * 0.16 + hw * 0.84 * u), y + h * k];
        };
        const [lx, ly] = slope(-1, 0.3);
        const [rx, ry] = slope(1, 0.26);
        // The snow cap's lower edge sags in lumps, right to left.
        const lumps = 4;
        let bottom = '';
        for (let n = 1; n <= lumps; n++) {
          const bx = rx + ((lx - rx) * n) / lumps;
          const by = ry + ((ly - ry) * n) / lumps;
          bottom += ` Q ${bx - (lx - rx) / lumps / 2} ${by + (n % 2 ? 18 : 6)} ${bx} ${by}`;
        }
        const ridge = `L ${tl[0]} ${tl[1]} Q ${x} ${y - h * 0.03} ${tr[0]} ${tr[1]}`;
        return (
          <g key={i}>
            <path d={`M ${x - hw} ${baseY} ${ridge} L ${x + hw} ${baseY} Z`} {...f(i % 2 ? shade(color, -0.03) : color)} />
            <path d={`M ${lx} ${ly} ${ridge} L ${rx} ${ry}${bottom} Z`} {...f('#f8f8f8')} />
          </g>
        );
      })}
    </g>
  );
}

/** A snowy pine like the show's: tall stacked green tiers, each buried under a cap of snow that hangs in lumps. */
export function pine(x: number, y: number, s = 1, snow = true, k = 0.6, color = PINE) {
  const tiers = [0, 1, 2, 3];
  // Keyed so a row of trees can be drawn with .map().
  return (
    <g key={`${x},${y}`} className="nat">
      <rect x={x - 7 * s} y={y - 14 * s} width={14 * s} height={16 * s} {...f('#5a3a22')} strokeWidth={2} />
      {tiers.map((t) => {
        const ty = y - 12 * s - t * 40 * s;
        const w = (56 - t * 11) * s;
        const h = 62 * s;
        // Snow covers the top part (k) of the tier; its lower edge sags in three lumps.
        const sy = ty - h + h * k;
        const sx = w * k;
        const lump = (i: number) => {
          const x0 = x - sx + (2 * sx * i) / 3;
          const x1 = x - sx + (2 * sx * (i + 1)) / 3;
          return `Q ${(x0 + x1) / 2} ${sy + 12 * s} ${x1} ${sy}`;
        };
        return (
          <g key={t}>
            <path d={`M ${x - w} ${ty} L ${x} ${ty - h} L ${x + w} ${ty} Z`} {...f(color)} strokeWidth={2.5} />
            {snow && <path d={`M ${x} ${ty - h} L ${x - sx} ${sy} ${lump(0)} ${lump(1)} ${lump(2)} Z`} fill={SNOW} />}
          </g>
        );
      })}
    </g>
  );
}

/** A weathered plank sign like the ones around the show's town: grey-brown boards and dark hand-painted letters. */
export function woodSign(x: number, y: number, w: number, h: number, lines: string[], size = 34) {
  const planks = 3;
  const ph = h / planks;
  return (
    <g>
      {Array.from({ length: planks }, (_, i) => {
        const top = y - h / 2 + i * ph;
        const tilt = i % 2 ? 3 : -2;
        return (
          <g key={i}>
            <path d={`M ${x - w / 2} ${top + tilt} L ${x + w / 2} ${top - tilt} L ${x + w / 2} ${top + ph - tilt} L ${x - w / 2} ${top + ph + tilt} Z`} {...f(i % 2 ? '#8a7863' : '#97846c')} />
            <path d={`M ${x - w / 2 + 20} ${top + ph * 0.45} q ${w * 0.2} -6 ${w * 0.4} 0 M ${x + w * 0.05} ${top + ph * 0.7} q ${w * 0.15} 4 ${w * 0.3} 0`} fill="none" stroke="#6f604c" strokeWidth={2.5} />
          </g>
        );
      })}
      {lines.map((l, i) => (
        <text key={i} x={x} y={y + (i - (lines.length - 1) / 2) * size * 1.1 + size * 0.36} textAnchor="middle" fontFamily={PAINT} fontWeight={700} fontSize={size} fill="#2e2a26">
          {l}
        </text>
      ))}
    </g>
  );
}

/** A leafless tree in dark silhouette, like the ones around the show's pond. */
export function bareTree(x: number, y: number, s = 1) {
  const branch = (x0: number, y0: number, len: number, ang: number, depth: number): string => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 - Math.sin(ang) * len;
    if (depth === 0) return `M ${x0} ${y0} L ${x1} ${y1}`;
    return `M ${x0} ${y0} L ${x1} ${y1} ` + branch(x1, y1, len * 0.7, ang + 0.45, depth - 1) + ' ' + branch(x1, y1, len * 0.68, ang - 0.4, depth - 1);
  };
  return (
    <g className="nat" stroke="#3b2a20" strokeLinecap="round" fill="none">
      <path d={`M ${x} ${y} L ${x} ${y - 120 * s}`} strokeWidth={14 * s} />
      <path d={branch(x, y - 120 * s, 70 * s, Math.PI / 2, 4)} strokeWidth={5 * s} />
    </g>
  );
}

export function sign(x: number, y: number, w: number, h: number, lines: string[], bg = '#fff', fg = '#1d1d1d', size = 34) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={6} {...f(bg)} />
      {lines.map((l, i) => (
        <text key={i} x={x} y={y + (i - (lines.length - 1) / 2) * size * 1.1 + size * 0.36} textAnchor="middle" fontFamily={DISPLAY} fontSize={size} fill={fg}>
          {l}
        </text>
      ))}
    </g>
  );
}

export function windowPane(x: number, y: number, w: number, h: number, glass = '#bfe6ff') {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} {...f(glass)} />
      <path d={`M ${x + w / 2} ${y} L ${x + w / 2} ${y + h} M ${x} ${y + h / 2} L ${x + w} ${y + h / 2}`} stroke={O} strokeWidth={3} />
      <path d={`M ${x + 8} ${y + h / 2 - 10} L ${x + w / 2 - 12} ${y + 10}`} stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/** The classroom's kid desks (left edge x) and the desk without its chair back. */
const CLASS_DESKS = [60, 340, 1060, 1340];
const classDesk = (x: number) => (
  <g>
    <rect x={x} y={760} width={200} height={26} {...f('#e4dc4a')} />
    <rect x={x + 14} y={786} width={14} height={110} {...f('#8e8c92')} />
    <rect x={x + 172} y={786} width={14} height={110} {...f('#8e8c92')} />
  </g>
);

/** The cafeteria's lunch tables (left edge x), with the bench in front and a tray. */
const LUNCH_TABLES = [20, 1300];
const lunchTable = (x: number) => (
  <g>
    <rect x={x} y={780} width={280} height={30} {...f('#d9d4d3')} />
    <rect x={x + 20} y={810} width={16} height={100} {...f('#8e8c92')} />
    <rect x={x + 244} y={810} width={16} height={100} {...f('#8e8c92')} />
    <rect x={x - 10} y={860} width={300} height={22} {...f('#c2bec5')} />
    <rect x={x + 60} y={758} width={90} height={22} rx={4} {...f('#f0742a')} strokeWidth={2} />
  </g>
);

/* ------------------------------------------------------------ scenes */

export const SCENES: SceneDef[] = [
  {
    id: 'busstop',
    name: 'Bus Stop',
    quip: 'Where all the important conversations happen. The bus is always late.',
    groundY: 845,
    times: 'outdoors',
    // Laid out like the show's bus stop: two big green mountains, snowy pines at their feet,
    // a strip of snow to stand on, the road along the bottom and a yellow crossing sign.
    render: (o) => (
      <g>
        {skyAt(o.time)}
        {mountains(760)}
        {[
          [70, 748, 1.45],
          [150, 740, 1.85],
          [235, 746, 1.55],
          [310, 742, 1.75],
          [385, 750, 1.3],
          [575, 746, 1.5],
          [650, 738, 1.95],
          [730, 744, 1.7],
          [805, 750, 1.4],
          [1330, 744, 1.6],
          [1405, 750, 1.3],
        ].map(([x, y, sc]) => pine(x, y, sc, true, 0.72))}
        <path className="nat" d="M 0 742 Q 320 718 660 738 T 1600 724 L 1600 860 L 0 860 Z" {...f(SNOW)} />
        <rect x={0} y={856} width={1600} height={144} {...f(ROAD)} />
        <g>
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
      </g>
    ),
  },
  {
    id: 'mainstreet',
    name: 'Main Street',
    quip: 'Shop local! The local shops are weird, but shop anyway.',
    groundY: 960,
    times: 'outdoors',
    render: (o) => {
      const shops = [
        { x: -320, w: 320, h: 330, color: '#5b6b8c', roof: '#36405a', name: ['POST', 'OFFICE'], awning: '#d33b2c' },
        { x: 0, w: 320, h: 340, color: '#b8433a', roof: '#6e2a26', name: ['BARGAIN', 'BARN'], awning: '#2f6b4f' },
        { x: 320, w: 300, h: 370, color: '#8fcf3f', roof: '#4f7a2a', name: ['PANCAKES', '& TAXES'], awning: '#f2c230' },
        { x: 620, w: 340, h: 320, color: '#a49c88', roof: '#5f584c', name: ['MUSEUM', 'OF ROCKS'], awning: '#4ab1ac' },
        { x: 960, w: 320, h: 360, color: '#3f7f5a', roof: '#294a3a', name: ["SHAKEY'S", 'ICE SHACK'], awning: '#df924c' },
        { x: 1280, w: 320, h: 345, color: '#2e3a5c', roof: '#1f2640', name: ["BOB'S", 'HAIRCUTS'], awning: '#df924c' },
        { x: 1600, w: 320, h: 350, color: '#c98b52', roof: '#7a4a2a', name: ['PET', 'PSYCHIC'], awning: '#2f6b4f' },
      ];
      // Colours and layout from the show's Main Street: muted shopfronts with teal windows,
      // the road across the middle, then the curb and the pavement in front.
      const base = 700;
      return (
        <g>
          {skyAt(o.time)}
          {cloud(300, 100, 1)}
          {cloud(1300, 140, 1.2)}
          {mountains(560)}
          {/* The shops sit back across the road, small enough that the mountains show above them. */}
          <g transform={`translate(800 ${base}) scale(0.74) translate(-800 ${-base})`}>
          {shops.map((s, i) => (
            <g key={i}>
              <rect x={s.x} y={base - s.h} width={s.w} height={s.h} {...f(s.color)} />
              <rect x={s.x - 6} y={base - s.h - 26} width={s.w + 12} height={30} {...f(s.roof)} />
              {sign(s.x + s.w / 2, base - s.h + 62, s.w - 60, 92, s.name, '#fff', s.roof, 32)}
              {windowPane(s.x + 30, base - 200, 110, 100, '#4ab1ac')}
              <rect x={s.x + s.w - 120} y={base - 190} width={80} height={190} {...f(shade(s.color, -0.35))} />
              <circle cx={s.x + s.w - 54} cy={base - 92} r={6} fill="#f2c230" stroke={O} strokeWidth={2} />
              <path d={`M ${s.x + 20} ${base - 232} L ${s.x + 160} ${base - 232} L ${s.x + 170} ${base - 206} L ${s.x + 10} ${base - 206} Z`} {...f(s.awning)} />
              <path d={`M ${s.x + 20} ${base - s.h - 20} q ${s.w / 2 - 20} -16 ${s.w - 40} 0`} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" />
            </g>
          ))}
          <text x={430} y={base - 110} fontFamily={DISPLAY} fontSize={18} fill="#2e8b47">OPEN 24/7</text>
          <text x={1340} y={base - 250} fontFamily={DISPLAY} fontSize={16} fill="#3b6fd8">WE CUT CORNERS</text>
          </g>
          <rect x={0} y={base} width={1600} height={160} {...f('#403945')} />
          <rect x={0} y={base + 160} width={1600} height={30} {...f('#9792a1')} />
          <rect x={0} y={base + 190} width={1600} height={120} {...f('#dddddd')} />
          <path className="nat" d={`M 0 ${base + 2} q 80 -26 160 0 q 60 -18 120 0 L 280 ${base + 2} Z M 1200 ${base + 2} q 100 -30 200 0 q 100 -24 200 0 Z`} {...f(SNOW)} />
          <g>
            <rect x={760} y={base - 300} width={14} height={300} {...f('#3d3d44')} />
            <path d={`M 740 ${base - 300} L 794 ${base - 300} L 784 ${base - 340} L 750 ${base - 340} Z`} {...f('#3d3d44')} />
            <circle cx={767} cy={base - 318} r={9} fill="#fff6a8" />
          </g>
        </g>
      );
    },
  },
  {
    id: 'classroom',
    name: 'Classroom',
    quip: 'Learning happens here. Allegedly. Sources unconfirmed.',
    groundY: 950,
    times: 'indoors',
    render: () => (
      <g>
        {/* Colours measured from the show's classroom: lime-olive walls and a flat mauve-brown floor. */}
        <rect x={0} y={0} width={1600} height={760} fill="#6ea31c" />
        <rect x={0} y={740} width={1600} height={260} {...f('#7c6053')} />
        <rect x={360} y={120} width={880} height={420} rx={8} {...f('#7a4a2a')} />
        <rect x={384} y={144} width={832} height={372} fill="#2f5d3a" />
        <g fontFamily="'Comic Sans MS', 'Chalkboard SE', cursive" fill="#f4f4f4">
          <text x={420} y={210} fontSize={46}>
            TODAY'S LESSON:
          </text>
          <text x={470} y={280} fontSize={60}>
            DON'T.
          </text>
          <text x={420} y={370} fontSize={38}>
            2 + 2 = FISH?
          </text>
          <text x={420} y={440} fontSize={30} opacity={0.85}>
            Homework: pg 4-400
          </text>
        </g>
        <path d="M 980 300 q 40 -60 80 0 q 40 60 80 0 M 1020 420 l 50 -60 l 50 60 Z" fill="none" stroke="#f4f4f4" strokeWidth={5} />
        <rect x={384} y={516} width={832} height={18} {...f('#9a6a42')} />
        <rect x={520} y={510} width={40} height={10} fill="#fff" />
        <circle cx={1400} cy={170} r={60} {...f('#fff')} strokeWidth={6} />
        <path d="M 1400 170 L 1400 130 M 1400 170 L 1430 186" stroke={O} strokeWidth={6} strokeLinecap="round" />
        <rect x={80} y={160} width={200} height={260} {...f('#f2c230')} />
        <text x={180} y={210} textAnchor="middle" fontFamily={DISPLAY} fontSize={28} fill="#d33b2c">
          HANG IN
        </text>
        <text x={180} y={244} textAnchor="middle" fontFamily={DISPLAY} fontSize={28} fill="#d33b2c">
          THERE
        </text>
        <path d="M 110 280 L 250 280" stroke="#6b4226" strokeWidth={8} strokeLinecap="round" />
        <circle cx={180} cy={318} r={26} {...f('#9a9a9a')} />
        <path d="M 162 296 l -4 -18 l 14 10 Z M 198 296 l 4 -18 l -14 10 Z" {...f('#9a9a9a')} strokeWidth={2} />
        <path d="M 166 290 l 0 -14 M 194 290 l 0 -14" stroke={O} strokeWidth={5} strokeLinecap="round" />
        <circle cx={172} cy={316} r={3} fill={O} />
        <circle cx={188} cy={316} r={3} fill={O} />
        <rect x={1320} y={300} width={220} height={150} {...f('#5aaeea')} />
        <text x={1430} y={346} textAnchor="middle" fontFamily={DISPLAY} fontSize={22} fill="#fff">
          READING:
        </text>
        <text x={1430} y={380} textAnchor="middle" fontFamily={DISPLAY} fontSize={18} fill="#fff">
          IT'S LIKE TV
        </text>
        <text x={1430} y={410} textAnchor="middle" fontFamily={DISPLAY} fontSize={18} fill="#fff">
          IN YOUR HEAD
        </text>
        <path d="M 600 40 L 1000 40 L 1000 80 L 600 80 Z" {...f('#d33b2c')} />
        <text x={800} y={72} textAnchor="middle" fontFamily={DISPLAY} fontSize={30} fill="#fff">
          GO YETIS!
        </text>
        {CLASS_DESKS.map((x) => (
          <g key={x}>
            <rect x={x + 30} y={700} width={140} height={60} {...f('#3b6fd8')} />
            {classDesk(x)}
          </g>
        ))}
        <circle cx={1440} cy={740} r={18} fill="#d33b2c" stroke={O} strokeWidth={3} />
      </g>
    ),
    // Kids sit between the chair back and the desk, so the desk is drawn again over them.
    seats: CLASS_DESKS.map((x, i) => ({ id: `desk-${i + 1}`, x: x + 100, y: 896, h: 92, w: 170, cover: () => <g className="sp-scene">{classDesk(x)}</g> })),
  },
  {
    id: 'cafeteria',
    times: 'indoors',
    name: 'Cafeteria',
    quip: 'Today\'s special: food-adjacent substance. Tomorrow: the same, but colder.',
    groundY: 950,
    render: () => (
      <g>
        {/* Colours measured from the show's cafeteria: lavender-grey walls, dark floor, pale grey tables. */}
        <rect x={0} y={0} width={1600} height={720} fill="#9a97a6" />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M ${i * 220 + 110} 0 L ${i * 220 + 110} 720`} stroke="#8d8a99" strokeWidth={3} />
        ))}
        <rect x={0} y={720} width={1600} height={280} fill="#514848" />
        <rect x={300} y={420} width={1000} height={200} {...f('#c2bec5')} />
        <rect x={300} y={400} width={1000} height={30} {...f('#d9d4d3')} />
        <g>
          <rect x={1330} y={130} width={230} height={180} {...f('#5d4632')} />
          <rect x={1344} y={144} width={202} height={152} fill="#846103" />
          {(
            [
              ['#f7f3e8', 1356, 156],
              ['#ef8fb4', 1416, 160],
              ['#9bd36a', 1480, 154],
              ['#7fd4ff', 1362, 224],
              ['#f2c230', 1430, 220],
              ['#f7f3e8', 1494, 228],
            ] as const
          ).map(([col, x, y]) => (
            <rect key={`${x},${y}`} x={x} y={y} width={46} height={56} fill={col} transform={`rotate(${(x % 7) - 3} ${x + 23} ${y + 28})`} />
          ))}
        </g>
        {(
          [
            ['HOT FOOD', '#3f9a3a', 1360, 360],
            ['MEAT', '#c8202e', 1470, 400],
            ['BREAD', '#8a5a2a', 1340, 430],
            ['FRUIT', '#e8762a', 1460, 470],
          ] as const
        ).map(([label, col, x, y]) => (
          <g key={label} transform={`rotate(-6 ${x} ${y})`}>
            <rect x={x - 8} y={y - 24} width={label.length * 15 + 16} height={32} fill={col} />
            <text x={x} y={y} fontFamily={DISPLAY} fontSize={22} fill="#fff">
              {label}
            </text>
          </g>
        ))}
        <path d="M 320 300 L 1280 300 L 1300 400 L 300 400 Z" fill="#dff3ff" opacity={0.6} stroke={O} strokeWidth={3} />
        {[
          ['#8a5530', 380],
          ['#9bd36a', 560],
          ['#f2c230', 740],
          ['#c9a7e8', 920],
          ['#d33b2c', 1100],
        ].map(([col, x]) => (
          <g key={x as number}>
            <rect x={x as number} y={406} width={140} height={22} rx={4} {...f('#9aa3ad')} strokeWidth={2} />
            <path d={scallop((x as number) + 70, 404, 58, 14, 7, 0.12)} {...f(col as string)} strokeWidth={2} />
          </g>
        ))}
        {sign(800, 160, 520, 150, ["TODAY: MEAT?", "TOMORROW: MEAT??"], '#fff', '#d33b2c', 46)}
        <rect x={80} y={120} width={180} height={240} {...f('#7fbf3f')} />
        <text x={170} y={180} textAnchor="middle" fontFamily={DISPLAY} fontSize={24} fill="#fff">
          EAT YOUR
        </text>
        <text x={170} y={214} textAnchor="middle" fontFamily={DISPLAY} fontSize={24} fill="#fff">
          VEGGIES
        </text>
        <text x={170} y={260} textAnchor="middle" fontFamily={DISPLAY} fontSize={34} fill="#26367a">
          OR ELSE
        </text>
        <path d="M 130 300 q 40 30 80 0" fill="none" stroke="#26367a" strokeWidth={6} />
        {LUNCH_TABLES.map((x) => (
          <g key={x}>{lunchTable(x)}</g>
        ))}
      </g>
    ),
    // People eat behind the tables, facing the room: the table and its front bench cover them.
    seats: LUNCH_TABLES.map((x, i) => ({ id: `table-${i + 1}`, x: x + 140, y: 910, h: 62, w: 280, cover: () => <g className="sp-scene">{lunchTable(x)}</g> })),
  },
  {
    id: 'livingroom',
    name: 'Living Room',
    quip: 'Where the family gathers to ignore each other in comfort.',
    groundY: 950,
    times: 'indoors',
    render: (o) => (
      <g>
        {/* Colours measured from the show's living rooms: pale aqua walls, yellow-green carpet, white skirting. */}
        <rect x={0} y={0} width={1600} height={740} fill="#b6dad9" />
        <rect x={0} y={720} width={1600} height={280} {...f('#c0cf7f')} />
        <rect x={0} y={700} width={1600} height={24} {...f('#d7dbdd')} />
        <ellipse className="nat" cx={800} cy={860} rx={460} ry={70} fill="#7a9091" />
        <rect x={1040} y={150} width={300} height={260} {...f('#d7dbdd')} />
        <rect x={1060} y={170} width={260} height={220} fill={o.time === 'night' ? NIGHT_SKY : o.time === 'dusk' ? DUSK_SKY : '#cfe9f2'} />
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={1070 + ((i * 53) % 240)} cy={180 + ((i * 37) % 200)} r={4} fill="#fff" />
        ))}
        <path d="M 1190 170 L 1190 390 M 1060 280 L 1320 280" stroke="#d7dbdd" strokeWidth={8} />
        <path d="M 1010 130 L 1080 130 Q 1070 280 1090 440 L 1010 440 Z M 1370 130 L 1300 130 Q 1310 280 1290 440 L 1370 440 Z" {...f('#4b4f7d')} />
        <rect x={1004} y={122} width={372} height={22} {...f('#3d4066')} />
        <rect x={720} y={140} width={180} height={140} {...f('#deceb1')} />
        <rect x={736} y={156} width={148} height={108} fill="#8fb6c8" />
        <path d="M 736 264 L 736 220 Q 780 190 820 214 Q 860 196 884 210 L 884 264 Z" fill="#6f8f5a" />
        <path d="M 736 264 L 736 240 Q 800 222 884 244 L 884 264 Z" fill="#4f6f46" />
        <path d="M 520 560 Q 500 420 600 420 L 1000 420 Q 1100 420 1080 560 L 1100 700 L 500 700 Z" {...f('#868072')} />
        <rect x={540} y={520} width={520} height={90} rx={30} {...f('#958f80')} />
        <rect x={480} y={520} width={80} height={180} rx={30} {...f('#77715f')} />
        <rect x={1040} y={520} width={80} height={180} rx={30} {...f('#77715f')} />
        <rect x={600} y={460} width={110} height={70} rx={20} {...f('#f2c230')} />
        <rect x={120} y={500} width={300} height={40} {...f('#6b4226')} />
        <rect x={140} y={540} width={20} height={160} {...f('#6b4226')} />
        <rect x={380} y={540} width={20} height={160} {...f('#6b4226')} />
        <rect x={130} y={290} width={280} height={210} rx={14} {...f('#3d3d44')} />
        <rect x={152} y={310} width={236} height={160} rx={8} fill="#2ec4c4" />
        <text x={270} y={372} textAnchor="middle" fontFamily={DISPLAY} fontSize={28} fill="#fff" stroke={O} strokeWidth={1}>
          TOOT TOOT
        </text>
        <text x={270} y={408} textAnchor="middle" fontFamily={DISPLAY} fontSize={28} fill="#f2c230" stroke={O} strokeWidth={1}>
          HOUR!
        </text>
        <circle cx={196} cy={440} r={14} {...f('#fcd9b8')} strokeWidth={2} />
        <circle cx={344} cy={440} r={14} {...f('#e8b48a')} strokeWidth={2} />
        <path d="M 230 290 L 200 230 M 310 290 L 340 230" stroke={O} strokeWidth={4} />
        <rect x={1432} y={360} width={16} height={330} {...f('#dbb016')} />
        <path d="M 1380 360 L 1500 360 L 1474 250 L 1406 250 Z" {...f('#b2c475')} />
        <ellipse cx={1440} cy={690} rx={56} ry={12} {...f('#dbb016')} />
      </g>
    ),
    seats: [{ id: 'couch', x: 800, y: 700, h: 172, w: 520 }],
    screen: { x: 152, y: 310, w: 236, h: 160 },
  },
  {
    id: 'pond',
    name: 'Frozen Pond',
    quip: 'Thin ice? Probably fine. Definitely fine. Don\'t jump.',
    groundY: 930,
    times: 'outdoors',
    render: (o) => (
      <g>
        {skyAt(o.time)}
        {cloud(400, 120, 1.1)}
        {cloud(1250, 90, 0.9)}
        {mountains(560)}
        <path className="nat" d="M 0 560 Q 400 520 800 560 T 1600 550 L 1600 1000 L 0 1000 Z" {...f(SNOW)} />
        {[60, 200, 330, 1260, 1400, 1530].map((x, i) => pine(x, 600 + (i % 2) * 24, 1.1 + (i % 3) * 0.15, true, 0.7))}
        {bareTree(1480, 800, 1.3)}
        {bareTree(520, 640, 0.8)}
        <ellipse cx={800} cy={720} rx={620} ry={120} {...f('#bfe6ff')} />
        <ellipse cx={800} cy={720} rx={540} ry={90} fill="#d6f0ff" />
        <path d="M 500 700 l 120 -20 M 900 760 l 160 -14 M 700 730 l 60 -8 M 1100 700 l 80 -10" stroke="#fff" strokeWidth={6} strokeLinecap="round" />
        <g>
          <rect x={1280} y={700} width={14} height={130} {...f('#6f604c')} />
          {woodSign(1286, 690, 250, 110, ['THIN ICE', '(PROBABLY FINE)'], 28)}
        </g>
        <g>
          <rect x={160} y={800} width={240} height={22} {...f('#a5713d')} />
          <rect x={160} y={760} width={240} height={20} {...f('#a5713d')} />
          <rect x={180} y={822} width={14} height={60} {...f('#6b4226')} />
          <rect x={366} y={822} width={14} height={60} {...f('#6b4226')} />
          <path d="M 160 760 q 120 -16 240 0" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" />
        </g>
      </g>
    ),
  },
  {
    id: 'townsign',
    name: 'Welcome Sign',
    quip: 'Edit the town name! Population: you, and a whole lot of weirdos.',
    groundY: 930,
    times: 'outdoors',
    render: (o) => {
      const town = (o.townName || 'SNOWPINE HOLLOW').toUpperCase().slice(0, 18);
      return (
        <g>
          {skyAt(o.time)}
          {cloud(200, 120, 1)}
          {cloud(1400, 160, 1.3)}
          {mountains(600)}
          <path className="nat" d="M 0 600 Q 400 560 800 600 T 1600 590 L 1600 1000 L 0 1000 Z" {...f(SNOW)} />
          {/* The town down in the valley: little houses with snowy roofs. */}
          {(
            [
              [300, '#c8433a'], [372, '#3b6fd8'], [440, '#e3c14a'], [520, '#5aa36a'], [600, '#9b6bc0'], [980, '#e08a3c'], [1050, '#4aa3b5'],
              [1120, '#c8433a'], [1190, '#e3c14a'], [1262, '#3b6fd8'], [1330, '#5aa36a'],
            ] as const
          ).map(([x, col], i) => {
            const w = 52 + (i % 3) * 8;
            const h = 34 + (i % 2) * 10;
            const y = 596 - (i % 2) * 6;
            return (
              <g key={x}>
                <rect x={x - w / 2} y={y - h} width={w} height={h} {...f(col)} />
                <path d={`M ${x - w / 2 - 6} ${y - h} L ${x} ${y - h - 24} L ${x + w / 2 + 6} ${y - h} Z`} {...f('#f4f4f4')} />
                <rect x={x - 8} y={y - h + 10} width={14} height={12} fill="#2e3a5c" />
              </g>
            );
          })}
          {[90, 260, 1340, 1500].map((x, i) => pine(x, 660 + (i % 2) * 30, 1.4 + (i % 2) * 0.25, true, 0.7))}
          <path d="M 640 1000 L 760 600 L 840 600 L 960 1000 Z" {...f('#8a8c95')} />
          <path d="M 800 620 L 800 660 M 800 700 L 800 760 M 800 810 L 800 890 M 800 940 L 800 1000" stroke="#f2c230" strokeWidth={8} />
          {/* A weathered plank sign on rough posts, like the one at the edge of the show's town. */}
          <path d="M 424 200 L 452 198 L 456 660 L 428 662 Z" {...f('#6f604c')} />
          <path d="M 1146 198 L 1174 200 L 1172 662 L 1144 660 Z" {...f('#6f604c')} />
          <g transform="translate(0 -110)">
            {woodSign(800, 395, 840, 330, [], 40)}
            <text x={800} y={318} textAnchor="middle" fontFamily={PAINT} fontWeight={700} fontSize={44} fill="#2e2a26">
              WELCOME TO
            </text>
            <text x={800} y={428} textAnchor="middle" fontFamily={PAINT} fontWeight={700} fontSize={town.length > 12 ? 70 : 96} fill="#2e2a26">
              {town}
            </text>
            <text x={800} y={500} textAnchor="middle" fontFamily={PAINT} fontWeight={700} fontSize={34} fill="#2e2a26">
              POPULATION: WEIRD
            </text>
            <path className="nat" d="M 380 236 q 420 -40 840 0 l 0 14 q -420 -30 -840 0 Z" fill={SNOW} />
          </g>
        </g>
      );
    },
  },
  {
    id: 'below',
    name: 'Down Below',
    quip: 'It\'s warm down here. Too warm. The snacks are all spicy.',
    groundY: 930,
    render: () => (
      <g>
        {sky('#6e1610')}
        <path className="nat" d="M 0 0 L 1600 0 L 1600 140 Q 1300 220 1000 150 Q 760 240 520 160 Q 260 230 0 150 Z" fill="#3a1410" />
        <path d="M 0 0 L 0 260 L 120 200 L 200 280 L 340 160 L 460 260 L 600 170 L 760 280 L 900 190 L 1060 270 L 1200 150 L 1360 260 L 1480 180 L 1600 240 L 1600 0 Z" {...f('#2a0606')} />
        {/* Jagged crimson spikes, the show's Hell landscape. */}
        {[0, 1].map((side) => {
          const x0 = side ? 1600 : 0;
          const dir = side ? -1 : 1;
          let d = `M ${x0} 720`;
          for (let i = 0; i < 9; i++) {
            const x = x0 + dir * (i * 52 + 26);
            const tip = 420 + ((i * 37) % 120) + i * 14;
            d += ` L ${x - dir * 14} 720 L ${x + dir * (i % 2 ? 10 : -8)} ${tip} L ${x + dir * 14} 720`;
          }
          return <path key={side} className="nat" d={`${d} L ${x0 + dir * 480} 720 L ${x0} 720 Z`} fill="#b8341c" />;
        })}
        {[200, 560, 980, 1380].map((x, i) => (
          <path key={i} d={`M ${x - 60} 720 Q ${x - 70} 600 ${x - 20} 560 Q ${x - 10} 620 ${x + 10} 600 Q ${x + 6} 520 ${x + 40} 480 Q ${x + 40} 580 ${x + 70} 620 Q ${x + 80} 680 ${x + 60} 720 Z`} {...f('#f0742a')} />
        ))}
        {[200, 560, 980, 1380].map((x, i) => (
          <path key={i} d={`M ${x - 30} 720 Q ${x - 30} 650 ${x} 620 Q ${x + 10} 660 ${x + 20} 640 Q ${x + 40} 680 ${x + 34} 720 Z`} fill="#f2c230" />
        ))}
        <path d="M 0 700 Q 400 660 800 700 T 1600 690 L 1600 1000 L 0 1000 Z" {...f('#5a1c12')} />
        <path d="M 0 790 Q 300 760 600 800 T 1200 790 T 1600 800 L 1600 850 Q 1200 830 800 850 T 0 840 Z" {...f('#ff8a1f')} />
        <path d="M 100 812 q 40 -10 80 0 M 700 822 q 50 -10 100 0 M 1300 812 q 40 -10 80 0" stroke="#ffe25c" strokeWidth={5} strokeLinecap="round" />
        {/* Big dark spikes crowding the foreground corners. */}
        {[0, 1].map((side) => {
          const x0 = side ? 1600 : 0;
          const dir = side ? -1 : 1;
          let d = `M ${x0} 1000`;
          for (let i = 0; i < 6; i++) {
            const x = x0 + dir * (i * 60 + 30);
            const tip = 720 + i * 40 + ((i * 29) % 50);
            d += ` L ${x - dir * 26} 1000 L ${x + dir * (i % 2 ? 16 : -12)} ${tip} L ${x + dir * 26} 1000`;
          }
          return <path key={side} className="nat" d={`${d} Z`} fill="#6a1410" />;
        })}
        {sign(1300, 420, 400, 140, ['WELCOME!', 'ABANDON ALL SNACKS'], '#2a0606', '#ff8a1f', 34)}
        <rect x={1290} y={490} width={20} height={220} {...f('#2a0606')} />
        <g transform="rotate(14 260 560)">
          <rect x={252} y={380} width={16} height={330} {...f('#3d3d44')} />
          <path d="M 220 380 L 220 320 M 260 380 L 260 300 M 300 380 L 300 320 M 220 380 L 300 380" fill="none" stroke={O} strokeWidth={14} strokeLinecap="round" />
          <path d="M 220 380 L 220 320 M 260 380 L 260 300 M 300 380 L 300 320 M 220 380 L 300 380" fill="none" stroke="#9aa3ad" strokeWidth={8} strokeLinecap="round" />
        </g>
      </g>
    ),
  },
  {
    id: 'above',
    name: 'Up Above',
    quip: 'Members only. The bouncer is very strict. Have you been nice?',
    groundY: 930,
    render: () => (
      <g>
        {sky('#9fd4ee')}
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M 800 -100 L ${i * 150 - 60} 1000 L ${i * 150 + 10} 1000 Z`} fill="#fff" opacity={0.3} />
        ))}
        {/* Pastel cloud banks like the show's Heaven. */}
        {cloud(220, 160, 1.6, '#f6c6dc')}
        {cloud(1380, 120, 1.8, '#d6c8f0')}
        {cloud(760, 80, 1.2, '#fbe3ee')}
        {cloud(140, 420, 2, '#e4dcf6')}
        {cloud(1460, 400, 2.1, '#f6d2e2')}
        <g>
          <rect x={560} y={220} width={480} height={520} rx={240} fill="none" stroke="#f2c230" strokeWidth={22} />
          <rect x={560} y={220} width={480} height={520} rx={240} fill="none" stroke={O} strokeWidth={3} />
          {[620, 680, 740, 800, 860, 920, 980].map((x) => (
            <path key={x} d={`M ${x} ${x === 800 ? 222 : 260} L ${x} 740`} stroke="#fff" strokeWidth={10} />
          ))}
          <circle cx={800} cy={300} r={36} fill="#fff" stroke="#f2c230" strokeWidth={8} />
        </g>
        {cloud(200, 620, 2.2)}
        {cloud(1400, 600, 2.4)}
        <path d={scallop(800, 900, 900, 200, 26, 0.04)} {...f('#ffffff')} />
        {sign(330, 330, 280, 110, ['MEMBERS', 'ONLY'], '#fff', '#c99a1a', 40)}
        <rect x={322} y={385} width={16} height={180} {...f('#f2c230')} />
        <ellipse cx={1300} cy={250} rx={60} ry={14} fill="none" stroke="#f2c230" strokeWidth={10} />
        <ellipse cx={1180} cy={180} rx={40} ry={10} fill="none" stroke="#f2c230" strokeWidth={8} />
      </g>
    ),
  },
  {
    id: 'space',
    name: 'Outer Space',
    quip: 'Abducted again. Third time this month. The probing is getting old.',
    groundY: 940,
    render: () => {
      const rnd = seeded(42);
      return (
        <g>
          <rect x={0} y={0} width={1600} height={1000} fill="#0d1033" />
          {Array.from({ length: 120 }, (_, i) => (
            <circle key={i} cx={rnd() * 1600} cy={rnd() * 760} r={rnd() * 2.6 + 0.6} fill="#fff" opacity={0.5 + rnd() * 0.5} />
          ))}
          <path d={starPath(1200, 140, 16, 0.4)} fill="#fff6a8" />
          <circle cx={300} cy={220} r={110} {...f('#e86fb0')} />
          <ellipse cx={300} cy={220} rx={190} ry={40} fill="none" stroke="#f2c230" strokeWidth={12} transform="rotate(-14 300 220)" />
          <ellipse cx={300} cy={220} rx={190} ry={40} fill="none" stroke={O} strokeWidth={2} transform="rotate(-14 300 220)" />
          <circle cx={1420} cy={300} r={60} {...f('#3b8fd8')} />
          <path d="M 1380 270 q 30 -10 40 20 q -30 20 -50 0 Z M 1430 320 q 20 -6 30 10 q -20 14 -30 -10 Z" fill="#7fbf3f" />
          <g>
            <path d="M 900 330 L 760 760 L 1240 760 L 1100 330 Z" fill="#c8ff8a" opacity={0.35} />
            <ellipse cx={1000} cy={320} rx={170} ry={46} {...f('#9aa3ad')} />
            <path d="M 900 300 Q 1000 200 1100 300 Z" fill="#bfe6ff" opacity={0.9} stroke={O} strokeWidth={3} />
            {[-120, -60, 0, 60, 120].map((dx) => (
              <circle key={dx} cx={1000 + dx} cy={332} r={9} fill="#f2c230" stroke={O} strokeWidth={2} />
            ))}
          </g>
          {/* A red planet surface, coloured from the show's Mars: dusty glow, layered mesas, dark rocks. */}
          <rect className="nat" x={0} y={610} width={1600} height={160} fill="#994232" opacity={0.55} />
          <path className="nat" d="M 0 700 L 120 660 L 260 668 L 300 640 L 470 646 L 520 690 L 760 680 L 820 650 L 1010 656 L 1060 690 L 1300 676 L 1360 640 L 1520 646 L 1600 676 L 1600 780 L 0 780 Z" fill="#693e29" />
          <path className="nat" d="M 0 760 L 180 740 L 220 712 L 420 716 L 460 748 L 1120 744 L 1160 716 L 1380 712 L 1420 742 L 1600 750 L 1600 1000 L 0 1000 Z" fill="#79411c" />
          <path className="nat" d="M 0 760 L 180 740 L 220 712 L 420 716 L 460 748 Z M 1120 744 L 1160 716 L 1380 712 L 1420 742 Z" fill="#6c311a" />
          <path className="nat" d="M 0 1000 L 0 880 L 90 860 L 160 900 L 260 940 L 320 1000 Z M 1600 1000 L 1600 860 L 1500 880 L 1420 930 L 1340 1000 Z" fill="#2a0c08" />
        </g>
      );
    },
  },
  {
    id: 'campfire',
    name: 'Campfire',
    quip: 'Scary stories, burnt marshmallows and at least one kid who wants to go home.',
    groundY: 930,
    render: () => {
      const rnd = seeded(9);
      return (
        <g>
          {sky('#18235a')}
          {Array.from({ length: 70 }, (_, i) => (
            <circle key={i} cx={rnd() * 1600} cy={rnd() * 500} r={rnd() * 2.2 + 0.5} fill="#fff" />
          ))}
          <circle cx={1320} cy={170} r={70} fill="#fff6c4" stroke={O} strokeWidth={3} />
          <circle cx={1296} cy={150} r={12} fill="#e9dfa8" />
          <circle cx={1350} cy={196} r={8} fill="#e9dfa8" />
          {/* Night-time camp, after the show's campgrounds: tall layered pines in dark teal-green. */}
          {[0, 120, 240, 360, 1240, 1360, 1480, 1600].map((x, i) => pine(x, 700, 2.4 + (i % 3) * 0.35, false, 0.6, i % 2 ? '#163a30' : '#1d4a40'))}
          <path className="nat" d="M 0 680 Q 400 650 800 680 T 1600 670 L 1600 1000 L 0 1000 Z" fill="#1c2a24" />
          <g>
            <path d="M 556 700 L 574 698 L 578 392 L 560 394 Z" {...f('#6a4a23')} />
            <path d="M 1026 698 L 1044 700 L 1040 394 L 1022 392 Z" {...f('#6a4a23')} />
            {woodSign(800, 400, 560, 90, ['CAMP NO WI-FI'], 46)}
          </g>
          <rect x={300} y={880} width={240} height={40} rx={20} {...f('#6a4a23')} />
          <rect x={1060} y={880} width={240} height={40} rx={20} {...f('#5a3e1e')} />
          <circle cx={800} cy={820} r={300} fill="#ff9a3c" opacity={0.18} />
          <g>
            <path d="M 300 760 L 420 560 L 540 760 Z" {...f('#d33b2c')} />
            <path d="M 420 560 L 400 760 L 440 760 Z" fill="#8a1f2b" stroke={O} strokeWidth={2} />
            <path d="M 1080 760 L 1220 540 L 1360 760 Z" {...f('#2e8b47')} />
            <path d="M 1220 540 L 1200 760 L 1240 760 Z" fill="#1d5a2e" stroke={O} strokeWidth={2} />
          </g>
          <g>
            <rect x={700} y={840} width={200} height={26} rx={12} transform="rotate(12 800 853)" {...f('#7a4a2a')} />
            <rect x={700} y={840} width={200} height={26} rx={12} transform="rotate(-12 800 853)" {...f('#8a5530')} />
            <path d="M 740 850 Q 730 760 780 720 Q 780 780 800 770 Q 800 700 840 660 Q 840 760 860 760 Q 880 800 860 850 Z" {...f('#f0742a')} />
            <path d="M 770 850 Q 770 800 800 780 Q 810 810 820 800 Q 840 830 830 850 Z" fill="#f2c230" />
          </g>
        </g>
      );
    },
    seats: [
      { id: 'log-1', x: 420, y: 920, h: 40, w: 240 },
      { id: 'log-2', x: 1180, y: 920, h: 40, w: 240 },
    ],
  },
  {
    id: 'news',
    name: 'News Desk',
    quip: 'Live at five: local kid does something. Full story at eleven. Possibly.',
    groundY: 880,
    // After the show's TV news set: a blue studio backdrop, dark pillars and a wooden desk out front.
    render: (o) => (
      <g>
        <defs>
          <linearGradient id="news-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4c749d" />
            <stop offset="0.45" stopColor="#334a97" />
            <stop offset="1" stopColor="#192090" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={1600} height={1000} fill="url(#news-bg)" />
        {[60, 240, 1240, 1420].map((x) => (
          <g key={x}>
            <rect x={x} y={0} width={120} height={1000} {...f('#0e2050')} />
            <rect x={x + 14} y={0} width={10} height={1000} fill="#2c4a8a" />
          </g>
        ))}
        <rect x={560} y={130} width={480} height={270} {...f('#0e2050')} />
        <rect x={576} y={146} width={448} height={238} fill="#5a8ac8" />
        <text x={800} y={252} textAnchor="middle" fontFamily={DISPLAY} fontSize={56} fill="#fff">
          LIVE
        </text>
        <text x={800} y={322} textAnchor="middle" fontFamily={DISPLAY} fontSize={30} fill="#f2c230">
          {(o.townName || 'Paper Town').toUpperCase().slice(0, 18)}
        </text>
      </g>
    ),
    front: (o) => (
      <g>
        <path d="M 120 816 L 1480 816 L 1500 1000 L 100 1000 Z" {...f('#3d2c15')} />
        <rect x={110} y={800} width={1380} height={22} {...f('#5a4028')} />
        <rect x={420} y={788} width={150} height={14} fill="#dbd9d9" transform="rotate(-3 495 795)" />
        <rect x={1040} y={788} width={150} height={14} fill="#dbd9d9" transform="rotate(4 1115 795)" />
        <rect x={560} y={860} width={480} height={100} {...f('#192090')} />
        <text x={800} y={925} textAnchor="middle" fontFamily={DISPLAY} fontSize={40} fill="#fff">
          {`${(o.townName || 'Paper Town').toUpperCase().slice(0, 14)} NEWS`}
        </text>
      </g>
    ),
    // Anchors' chairs are hidden behind the desk.
    seats: [{ id: 'desk', x: 800, y: 880, h: 130, w: 900 }],
  },
  {
    id: 'studio',
    name: 'Photo Studio',
    quip: 'Professional headshots. Pick any backdrop colour. Say cheese.',
    groundY: 930,
    // The show has no photo studio, so this follows the rule every one of its stills shows:
    // flat colour, no spotlight gradient and no shadows. A paper sweep in a darker shade is the floor.
    render: (o) => (
      <g>
        <rect x={0} y={0} width={1600} height={1000} fill={o.studioColor} />
        <path className="nat" d="M 0 860 Q 800 820 1600 860 L 1600 1000 L 0 1000 Z" fill={shade(o.studioColor, -0.18)} />
      </g>
    ),
  },
];

/** Calm backdrop for the creator stage, drawn in character coordinates (ground at y = 480). */
export function StageBackdrop() {
  return (
    <g className="sp-scene">
      <rect x={-200} y={-200} width={900} height={900} fill={DAY_SKY} />
      <g transform="translate(-160 120) scale(0.5)">{mountains(600)}</g>
      <path className="nat" d="M -200 420 Q 0 395 200 420 T 700 418 L 700 700 L -200 700 Z" {...f(SNOW)} />
      <g transform="translate(-30 30) scale(0.55)">{pine(0, 760)}</g>
      <g transform="translate(400 50) scale(0.48)">{pine(0, 760)}</g>
    </g>
  );
}

export function getScene(id: string): SceneDef {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

/* ------------------------------------------------------------ overlays */

export type Weather = 'none' | 'snow' | 'confetti' | 'hearts' | 'cheesy';

export const WEATHERS: { id: Weather; label: string }[] = [
  { id: 'none', label: 'Clear' },
  { id: 'snow', label: '❄️ Snow' },
  { id: 'confetti', label: '🎉 Confetti' },
  { id: 'hearts', label: '💖 Hearts' },
  { id: 'cheesy', label: '🧀 Snack Storm' },
];

export function WeatherLayer({ weather }: { weather: Weather }) {
  if (weather === 'none') return null;
  const rnd = seeded(weather.length * 97 + 13);
  const n = weather === 'snow' ? 110 : 70;
  const items = Array.from({ length: n }, () => ({ x: rnd() * 1600, y: rnd() * 1000, r: rnd(), rot: rnd() * 360 }));
  const colors = ['#d33b2c', '#f2c230', '#3b6fd8', '#7fbf3f', '#e86fb0', '#2ec4c4'];
  return (
    <g pointerEvents="none">
      {items.map((p, i) => {
        if (weather === 'snow') return <circle key={i} cx={p.x} cy={p.y} r={3 + p.r * 7} fill="#fff" opacity={0.85} stroke="#c9dcf2" strokeWidth={1} />;
        if (weather === 'confetti')
          return <rect key={i} x={p.x} y={p.y} width={10} height={18} fill={colors[i % colors.length]} transform={`rotate(${p.rot} ${p.x + 5} ${p.y + 9})`} />;
        if (weather === 'hearts')
          return (
            <path
              key={i}
              d={`M ${p.x} ${p.y + 10} C ${p.x - 16} ${p.y} ${p.x - 10} ${p.y - 12} ${p.x} ${p.y - 4} C ${p.x + 10} ${p.y - 12} ${p.x + 16} ${p.y} ${p.x} ${p.y + 10} Z`}
              fill={i % 2 ? '#e5322d' : '#f27bb4'}
              stroke={O}
              strokeWidth={1.5}
            />
          );
        return (
          <path
            key={i}
            d={`M ${p.x - 14} ${p.y} q 6 -10 14 -4 q 10 -6 14 4 q 4 10 -8 10 q -12 4 -20 -10 Z`}
            fill="#f0742a"
            stroke={O}
            strokeWidth={1.5}
            transform={`rotate(${p.rot} ${p.x} ${p.y})`}
          />
        );
      })}
    </g>
  );
}
