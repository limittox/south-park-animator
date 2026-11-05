import type { ItemBase, Render } from '../../types';
import { luminance, shade } from '../../lib/color';
import { ink, Mirror, scallop, scallopArc, scallopEdge } from './common';

export interface HairDef extends ItemBase {
  back?: Render;
  front?: Render;
  /** How far down the back of the head it comes (head coordinates). */
  nape?: number;
  /** A ring round the sides and back with a bare crown. */
  ring?: boolean;
  /** A strip down the middle of the head and nothing else. */
  strip?: boolean;
  /** Hangs behind the head in one mass, so the head's outline doesn't show through it. */
  mass?: boolean;
  /** The front art has it hanging off one side, which goes to the back side on. */
  tail?: boolean;
  /** Side on, facing right, where the front art won't do. */
  side?: Render;
}

/**
 * The hair that fills the back of the head, which the front art doesn't show. `fill` goes over
 * the head, cut to its shape; `line` is its edge. Side on it stops at a hairline running from the
 * forehead down past the ear.
 */
export function hairCover(def: HairDef, view: 'side' | 'back'): { fill: string; line: string } | null {
  if (!def.front && !def.back) return null;
  const n = def.nape ?? 46;
  if (view === 'back') {
    if (def.strip) return { fill: 'M -30 -300 H 30 V 300 H -30 Z', line: 'M -30 -300 V 300 M 30 -300 V 300' };
    const foot = `M -300 ${n} Q 0 ${n + 28} 300 ${n}`;
    if (def.ring) return { fill: `${foot} V -34 Q 0 -8 -300 -34 Z`, line: `${foot} M 300 -34 Q 0 -8 -300 -34` };
    return { fill: `${foot} V -300 H -300 Z`, line: foot };
  }
  if (def.strip) return null;
  const line = `M 34 -50 C 12 -44 8 -30 2 -8 C -6 22 -30 ${n} -66 ${n + 6} C -120 ${n + 14} -200 ${n + 8} -300 ${n}`;
  if (def.ring) return { fill: `${line} V -40 H 34 Z`, line: `${line} M -300 -40 H 34` };
  return { fill: `${line} V -300 H 34 Z`, line };
}

const fill = (color: string) => ({ fill: color, ...ink });

/** Top-of-head dome every cap-style haircut starts from, ending at (±x, y). */
const dome = (x: number, y: number, top = -120) =>
  `M ${-x} ${y} C ${-x - 8} ${top + 34} ${-72} ${top} 0 ${top} C 72 ${top} ${x + 8} ${top + 34} ${x} ${y}`;

/**
 * One loc: a flat rope of hair with darker twist bands across it every so often, ending in a
 * rounded tip. Drawn as a thick round-capped stroke so it stays outline-free in the show style.
 */
function loc(key: string | number, x0: number, y0: number, x1: number, y1: number, bend: number, w: number, color: string, phase = 0) {
  // A gentle S: out at the top, back in towards the tip, the way heavy locs hang.
  const len = y1 - y0;
  const d = `M ${x0} ${y0} C ${x0 + bend} ${y0 + len * 0.35} ${x1 - bend * 0.5} ${y1 - len * 0.4} ${x1} ${y1}`;
  return (
    <g key={key} fill="none">
      <path d={d} stroke={color} strokeWidth={w} strokeLinecap="round" />
      {/* Staggered from loc to loc so the bands never line up into stripes across the hair. */}
      <path d={d} stroke={luminance(color) < 0.2 ? shade(color, 0.22) : shade(color, -0.24)} strokeWidth={w * 0.86} strokeDasharray={`2.2 ${(w * 1.55).toFixed(1)}`} strokeDashoffset={-(w + phase * w * 0.6)} />
    </g>
  );
}

/** Where each loc behind the head starts and ends, for one side (mirrored for the other). */
const LOCS_BACK = [
  { x0: 44, y0: -104, x1: 104, y1: 150, bend: 10, w: 22 },
  { x0: 62, y0: -96, x1: 118, y1: 182, bend: 16, w: 21 },
  { x0: 80, y0: -86, x1: 128, y1: 160, bend: 12, w: 23 },
  { x0: 96, y0: -72, x1: 142, y1: 190, bend: 20, w: 21 },
  { x0: 110, y0: -56, x1: 152, y1: 168, bend: 14, w: 22 },
  { x0: 122, y0: -36, x1: 166, y1: 150, bend: 18, w: 20 },
];

export const HAIR: HairDef[] = [
  {
    id: 'bald',
    name: 'Bald',
    quip: 'Aerodynamic. Reflects sunlight into enemy eyes.',
  },
  {
    id: 'buzz',
    name: 'Buzz Cut',
    nape: 30,
    quip: 'Mom did it in the kitchen with the dog clippers.',
    front: (c) => (
      <path
        d={`${dome(124, -30, -114)} C 110 -48 80 -58 40 -60 C 10 -62 -20 -62 -50 -60 C -85 -58 -112 -48 -124 -30 Z`}
        fill={c.color}
        opacity={0.92}
        {...ink}
        strokeWidth={2}
      />
    ),
  },
  {
    id: 'messy',
    name: 'Messy',
    nape: 58,
    quip: 'Rolled out of bed. Literally. Fell on the floor. Came to school.',
    front: (c) => (
      <path
        d={`${dome(126, -24, -122)} L 102 -46 L 90 -30 L 72 -56 L 54 -36 L 36 -60 L 18 -40 L 0 -62 L -18 -42 L -36 -60 L -54 -38 L -72 -58 L -90 -34 L -104 -50 Z`}
        {...fill(c.color)}
      />
    ),
  },
  {
    id: 'spiky',
    name: 'Spiky',
    quip: 'Uses an entire bottle of gel. Daily. Is legally a fire hazard.',
    front: (c) => (
      <path
        d="M -126 -16 L -142 -70 L -112 -78 L -122 -132 L -82 -112 L -70 -164 L -38 -124 L -8 -172 L 14 -126 L 46 -166 L 62 -118 L 100 -148 L 100 -102 L 140 -110 L 118 -68 L 142 -40 L 126 -16 L 102 -44 L 76 -32 L 50 -54 L 20 -40 L -10 -56 L -40 -38 L -70 -54 L -100 -34 Z"
        {...fill(c.color)}
      />
    ),
  },
  {
    id: 'sidepart',
    name: 'Side Part',
    quip: 'Looks like a tiny accountant. Does your taxes for juice boxes.',
    front: (c) => (
      <g>
        <path
          d={`${dome(126, -20, -122)} C 116 -42 104 -52 88 -56 C 58 -64 18 -66 -14 -50 C -36 -66 -72 -64 -100 -50 C -114 -42 -122 -32 -126 -20 Z`}
          {...fill(c.color)}
        />
        <path d="M -14 -52 Q -26 -90 -34 -116" fill="none" stroke={shade(c.color, -0.35)} strokeWidth={2.4} />
      </g>
    ),
  },
  {
    id: 'afro',
    name: 'Big Afro',
    nape: 84,
    mass: true,
    quip: 'Volume level: maximum. Has lost three pencils and a hamster in there.',
    back: (c) => <path d={scallop(0, -60, 168, 138, 22, 0.05)} {...fill(c.color)} />,
    front: (c) => (
      <path d={`M -130 -20 C -132 -60 -110 -100 -60 -108 C -30 -122 30 -122 60 -108 C 110 -100 132 -60 130 -20 Q 120 -44 100 -52 ${scallopEdge(100, -52, -100, -52, 8, 18)} Q -120 -44 -130 -20 Z`} {...fill(c.color)} />
    ),
  },
  {
    id: 'curly',
    name: 'Curly Mop',
    nape: 70,
    quip: 'Hair so curly it has its own zip code. And a mayor.',
    front: (c) => (
      <path d={`M -140 -20 ${scallopArc(0, -20, 140, 124, Math.PI, Math.PI * 2, 11, 0.06)} Q 126 -40 104 -50 ${scallopEdge(104, -50, -104, -50, 9, 16)} Q -126 -40 -140 -20 Z`} {...fill(c.color)} />
    ),
  },
  {
    id: 'long',
    name: 'Long & Straight',
    nape: 96,
    mass: true,
    // Like the show: the long part hangs behind the round head; only the crown and fringe sit in front.
    quip: 'Washes it with the tears of their enemies. And conditioner.',
    back: (c) => <path d="M -140 -20 C -144 -104 -74 -128 0 -128 C 74 -128 140 -104 136 -20 L 136 100 Q 136 134 110 138 L -110 138 Q -136 134 -136 100 Z" {...fill(shade(c.color, -0.12))} />,
    front: (c) => (
      <path
        d="M -132 14 L -134 -20 C -136 -100 -72 -126 0 -126 C 72 -126 136 -100 134 -20 L 132 14 Q 120 -6 106 -16 C 100 -38 90 -46 80 -46 L -80 -46 C -90 -46 -100 -38 -106 -16 Q -120 -6 -132 14 Z"
        {...fill(c.color)}
      />
    ),
  },
  {
    id: 'wavy',
    name: 'Shampoo Ad',
    nape: 96,
    mass: true,
    quip: 'Flips hair in slow motion. Even in real life. Somehow.',
    back: (c) => (
      <path
        d={`M -140 -20 C -146 -104 -74 -130 0 -130 C 74 -130 146 -104 140 -20 ${scallopEdge(140, -20, 150, 190, 6, 12)} ${scallopEdge(150, 190, -150, 190, 8, 10)} ${scallopEdge(-150, 190, -140, -20, 6, 12)} Z`}
        {...fill(shade(c.color, -0.12))}
      />
    ),
    front: (c) => (
      <path
        d={`M -136 -20 C -140 -100 -72 -126 0 -126 C 72 -126 140 -100 136 -20 C 140 30 118 80 128 140 C 110 120 104 60 110 10 C 96 -30 60 -50 20 -58 C -20 -40 -70 -40 -104 -10 C -106 50 -110 110 -128 140 C -122 80 -140 30 -136 -20 Z`}
        {...fill(c.color)}
      />
    ),
  },
  {
    id: 'pigtails',
    name: 'Pigtails',
    quip: 'Can braid hair faster than you can say "cooties".',
    back: (c) => (
      <g>
        <ellipse cx={-156} cy={10} rx={30} ry={48} transform="rotate(20 -156 10)" {...fill(c.color)} />
        <ellipse cx={156} cy={10} rx={30} ry={48} transform="rotate(-20 156 10)" {...fill(c.color)} />
      </g>
    ),
    front: (c) => (
      <g>
        <path d={`${dome(128, -10, -122)} C 112 -40 60 -56 0 -70 C -60 -56 -112 -40 -128 -10 Z`} {...fill(c.color)} />
        <path d="M 0 -70 L 0 -122" stroke={shade(c.color, -0.35)} strokeWidth={2.4} />
        <circle cx={-128} cy={-24} r={9} fill="#e86fb0" {...ink} />
        <circle cx={128} cy={-24} r={9} fill="#e86fb0" {...ink} />
      </g>
    ),
  },
  {
    id: 'ponytail',
    name: 'Ponytail',
    tail: true,
    quip: 'Means business. The business is recess.',
    back: (c) => (
      <path d="M 70 -100 C 150 -120 200 -60 180 40 C 172 80 150 100 140 90 C 160 40 150 -40 90 -60 Z" {...fill(shade(c.color, -0.06))} />
    ),
    front: (c) => (
      <g>
        <path d={`${dome(126, -20, -122)} C 100 -50 60 -62 0 -62 C -60 -62 -100 -50 -126 -20 Z`} {...fill(c.color)} />
        <path d="M 80 -96 Q 96 -84 104 -96" fill="none" stroke="#3b6fd8" strokeWidth={8} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'bob',
    name: 'The Bob',
    nape: 72,
    mass: true,
    quip: 'Would like to speak to the manager. Is eight years old.',
    back: (c) => <path d="M -142 -20 C -146 -104 -74 -128 0 -128 C 74 -128 146 -104 142 -20 L 146 76 Q 0 92 -146 76 Z" {...fill(shade(c.color, -0.12))} />,
    front: (c) => (
      <path
        d="M -140 76 L -138 -20 C -140 -100 -72 -126 0 -126 C 72 -126 140 -100 138 -20 L 140 76 L 112 76 L 112 -42 L -112 -42 L -112 76 Z"
        {...fill(c.color)}
      />
    ),
  },
  {
    id: 'mohawk',
    name: 'Mohawk',
    strip: true,
    // Side on the fin runs along the top of the head, from the forehead to the neck.
    side: (c) => (
      <g>
        <path d={`${dome(124, -40, -114)} C 80 -70 -80 -70 -124 -40 Z`} fill={c.color} opacity={0.3} />
        <path d="M 92 -72 L 116 -122 L 80 -108 L 84 -172 L 48 -128 L 28 -196 L 2 -132 L -32 -200 L -50 -126 L -92 -172 L -92 -102 L -130 -122 L -122 -44 C -96 -116 50 -128 92 -72 Z" {...fill(c.color)} />
      </g>
    ),
    quip: 'Punk rock forever. Bedtime is 8:30 though.',
    front: (c) => (
      <g>
        <path d={`${dome(124, -40, -114)} C 80 -70 -80 -70 -124 -40 Z`} fill={c.color} opacity={0.3} />
        {/* A proper fin: spikes standing up off a strip that runs down to the forehead. */}
        <path d="M -30 -66 L -36 -102 L -54 -166 L -24 -142 L -18 -204 L 2 -152 L 22 -208 L 28 -144 L 56 -168 L 36 -102 L 30 -66 Q 0 -78 -30 -66 Z" {...fill(c.color)} />
      </g>
    ),
  },
  {
    id: 'mullet',
    name: 'Mullet',
    nape: 96,
    mass: true,
    quip: 'Business in the front, party in the back. Mostly party.',
    back: (c) => <path d="M -130 -40 L -138 150 Q -90 170 -70 130 L 70 130 Q 90 170 138 150 L 130 -40 Z" {...fill(shade(c.color, -0.1))} />,
    front: (c) => (
      <path d={`${dome(126, -28, -120)} L 104 -50 L 84 -38 L 60 -58 L 30 -46 L 0 -62 L -30 -46 L -60 -58 L -84 -38 L -104 -50 Z`} {...fill(c.color)} />
    ),
  },
  {
    id: 'pompadour',
    name: 'Pompadour',
    quip: 'Thank you. Thank you very much. Has never said anything else.',
    front: (c) => (
      <g>
        <path
          d="M -126 -24 C -130 -90 -82 -118 -24 -118 C -16 -152 56 -176 124 -144 C 156 -122 142 -82 126 -24 C 110 -50 80 -62 40 -64 C 0 -66 -60 -62 -126 -24 Z"
          {...fill(c.color)}
        />
        <path d="M -10 -118 Q 50 -150 110 -130 M 0 -96 Q 60 -126 120 -100" fill="none" stroke={shade(c.color, 0.25)} strokeWidth={3} />
      </g>
    ),
  },
  {
    id: 'combover',
    name: 'Comb-Over',
    ring: true,
    nape: 30,
    quip: 'Fooling absolutely no one. Especially not the wind.',
    front: (c) => (
      <g>
        <Mirror>
          <path d="M -130 -50 C -136 -10 -132 20 -122 30 L -110 0 C -112 -20 -114 -40 -118 -56 Z" {...fill(c.color)} strokeWidth={2.2} />
        </Mirror>
        {/* A few long strands fanned out from one low parting, scalp showing between them. */}
        <path d="M -124 -34 C -96 -108 0 -124 90 -98 M -124 -34 C -90 -96 20 -116 112 -74 M -124 -34 C -84 -84 30 -100 120 -56 M -124 -34 C -78 -70 36 -84 124 -40" fill="none" stroke={c.color} strokeWidth={7} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'emo',
    name: 'Emo Fringe',
    nape: 60,
    mass: true,
    quip: "Hates conformity. Dresses exactly like all their friends. You wouldn't understand.",
    back: (c) => <path d="M -138 -20 C -142 -104 -74 -128 0 -128 C 74 -128 142 -104 138 -20 L 140 60 Q 0 74 -140 60 Z" {...fill(shade(c.color, -0.12))} />,
    front: (c) => (
      <path
        d="M -136 50 L -136 -20 C -140 -104 -72 -126 0 -126 C 72 -126 140 -100 136 -20 L 136 50 L 116 30 L 108 -20 C 80 -40 40 -46 20 -40 L 4 30 L -10 10 L -26 46 L -40 16 L -58 50 L -70 18 L -86 50 L -100 14 Z"
        {...fill(c.color)}
      />
    ),
  },
  {
    id: 'buns',
    name: 'Space Buns',
    quip: 'Two buns, zero worries. Receives satellite TV.',
    front: (c) => (
      <g>
        <circle cx={-76} cy={-112} r={34} {...fill(c.color)} />
        <circle cx={76} cy={-112} r={34} {...fill(c.color)} />
        <path d={`${dome(126, -20, -120)} C 100 -50 60 -64 0 -66 C -60 -64 -100 -50 -126 -20 Z`} {...fill(c.color)} />
      </g>
    ),
  },
  {
    id: 'bowl',
    name: 'Bowl Cut',
    quip: 'Mom used an actual bowl. It was a salad bowl. It still had salad in it.',
    front: (c) => <path d="M -132 10 C -138 -90 -70 -126 0 -126 C 70 -126 138 -90 132 10 L 118 10 L 118 -40 L -118 -40 L -118 10 Z" {...fill(c.color)} />,
  },
  {
    id: 'locs',
    name: 'Locs',
    nape: 96,
    quip: 'Effortlessly cool. (It took a lot of effort.)',
    // A curtain of locs hanging behind the head to past the shoulders, a crown of rounded roots,
    // and a few in front framing the face, two of them with gold cuffs.
    back: (c) => (
      <g>
        {[-1, 1].map((side) =>
          LOCS_BACK.map((l, k) => loc(`${side}${k}`, side * l.x0, l.y0, side * l.x1, l.y1, side * l.bend, l.w, shade(c.color, -0.12), (k * 0.37 + (side > 0 ? 0.5 : 0)) % 1)),
        )}
      </g>
    ),
    front: (c) => (
      <g>
        <path
          d={`${dome(130, 8, -124)} ${scallopEdge(130, 8, 104, -34, 2, 7)} ${scallopEdge(104, -34, -104, -34, 6, 9)} ${scallopEdge(-104, -34, -130, 8, 2, 7)} Z`}
          {...fill(c.color)}
        />
        {/* Parting lines between the sections each loc grows from. */}
        <path d="M -86 -40 Q -78 -88 -52 -114 M -52 -46 Q -40 -96 -18 -122 M -17 -48 Q -6 -100 12 -124 M 17 -48 Q 28 -98 46 -118 M 52 -46 Q 66 -92 82 -108 M 86 -40 Q 100 -74 112 -84" fill="none" stroke={luminance(c.color) < 0.2 ? shade(c.color, 0.22) : shade(c.color, -0.3)} strokeWidth={2.4} strokeLinecap="round" />
        {[-1, 1].map((side) => (
          <g key={side}>
            {loc('a', side * 112, -26, side * 124, 146, side * 12, 20, c.color, side > 0 ? 0.2 : 0.7)}
            {loc('b', side * 126, -8, side * 148, 170, side * 14, 20, c.color, side > 0 ? 0.55 : 0.05)}
            <rect x={side * 128 - 12} y={92} width={24} height={9} rx={3} fill="#e3b341" transform={`rotate(${-side * 6} ${side * 128} 96)`} />
          </g>
        ))}
      </g>
    ),
  },
  {
    id: 'beehive',
    name: 'Beehive',
    quip: 'Tall enough to store snacks. And a backup snack.',
    front: (c) => (
      <g>
        <ellipse cx={0} cy={-170} rx={84} ry={96} {...fill(c.color)} />
        <path d="M -60 -200 Q 0 -230 60 -200 M -70 -160 Q 0 -190 70 -160 M -76 -120 Q 0 -150 76 -120" fill="none" stroke={shade(c.color, -0.3)} strokeWidth={2.4} />
        <path d={`${dome(126, -20, -120)} C 100 -50 60 -64 0 -66 C -60 -64 -100 -50 -126 -20 Z`} {...fill(c.color)} />
      </g>
    ),
  },
  {
    id: 'horseshoe',
    name: 'Horseshoe',
    ring: true,
    nape: 30,
    quip: 'Hair said goodbye. The sides did not get the memo.',
    front: (c) => (
      <g>
        <Mirror>
          <path d={`M -130 -46 ${scallopEdge(-130, -46, -116, 32, 4, -6)} L -104 4 C -108 -16 -112 -36 -114 -56 Z`} {...fill(c.color)} strokeWidth={2.2} />
        </Mirror>
      </g>
    ),
  },
  {
    id: 'braids',
    name: 'Long Braids',
    mass: true,
    quip: 'Could use them as jump ropes. Has. Twice.',
    back: (c) => <path d="M -136 -20 C -140 -104 -72 -128 0 -128 C 72 -128 140 -104 136 -20 L 130 40 Q 0 54 -130 40 Z" {...fill(shade(c.color, -0.12))} />,
    front: (c) => (
      <g>
        <path d={`${dome(130, 10, -124)} C 110 -40 60 -60 0 -72 C -60 -60 -110 -40 -130 10 Z`} {...fill(c.color)} />
        <path d="M 0 -72 L 0 -124" stroke={shade(c.color, -0.35)} strokeWidth={2.4} />
        {[-1, 1].map((side) => (
          <g key={side}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <ellipse key={i} cx={side * (124 + i * 2)} cy={20 + i * 26} rx={17} ry={16} {...fill(c.color)} strokeWidth={2.4} />
            ))}
            <circle cx={side * 136} cy={174} r={8} fill="#7fbf3f" {...ink} strokeWidth={2} />
            <path d={`M ${side * 128} 180 L ${side * 122} 206 L ${side * 136} 200 L ${side * 150} 208 L ${side * 144} 182`} {...fill(c.color)} strokeWidth={2.2} />
          </g>
        ))}
      </g>
    ),
  },
  {
    id: 'flattop',
    name: 'Flat Top',
    quip: 'You could land a helicopter on it. Someone tried.',
    front: (c) => (
      <path d="M -126 -16 L -124 -96 Q -122 -150 -80 -152 L 80 -152 Q 122 -150 124 -96 L 126 -16 C 110 -46 80 -54 40 -56 L -40 -56 C -80 -54 -110 -46 -126 -16 Z" {...fill(c.color)} />
    ),
  },
  {
    id: 'pixie',
    name: 'Pixie Cut',
    quip: 'Short, sharp, and probably smarter than you.',
    front: (c) => (
      <path
        d={`${dome(128, -6, -122)} C 120 -30 100 -40 70 -38 C 40 -36 20 -50 0 -64 C -20 -52 -40 -46 -60 -60 C -70 -40 -100 -36 -114 -20 C -120 -14 -126 -10 -128 -6 Z`}
        {...fill(c.color)}
      />
    ),
  },
];
