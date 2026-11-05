import type { ReactNode } from 'react';
import type { BodyGeo, ItemBase, Render, RenderCtx } from '../../types';
import { accent, inkOn, shade } from '../../lib/color';
import { torsoHalfWidthAt, torsoPath } from '../geometry';
import { edge, heartPath, ink, O, pale, scallop, scallopEdge, starPath } from './common';

export const chinY = (g: BodyGeo) => g.headCy + g.headRy * 0.97;

const f = (color: string) => ({ fill: color, ...ink });

function torsoClip(c: RenderCtx, children: ReactNode, key = 'torso') {
  const id = c.uid(key);
  return (
    <>
      <clipPath id={id}>
        <path d={torsoPath(c.g)} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

const base = (c: RenderCtx, color = c.color) => <path d={torsoPath(c.g)} {...f(color)} />;
const outline = (c: RenderCtx) => <path d={torsoPath(c.g)} {...edge} />;

function hem(c: RenderCtx, color: string, h = 14) {
  const { g } = c;
  return torsoClip(c, <rect x={g.cx - 200} y={g.torsoBottom - h} width={400} height={h + 10} fill={color} stroke={O} strokeWidth={2} />, 'hem');
}

function buttons(c: RenderCtx, x: number, from: number, to: number, n: number, color = shade(c.color, -0.35)) {
  return Array.from({ length: n }, (_, i) => (
    <circle key={i} cx={x} cy={from + ((to - from) * i) / Math.max(1, n - 1)} r={3.6} fill={color} stroke={O} strokeWidth={1.2} />
  ));
}

/* ------------------------------------------------------------------ tops */

export interface TopDef extends ItemBase {
  sleeves: 'long' | 'short' | 'bare' | 'hidden';
  sleeveColor?: (c: RenderCtx) => string;
  mittens?: (c: RenderCtx) => string;
  torso: Render;
  over?: Render;
  back?: Render;
  skirt?: Render;
  /** Legs take the top's colour (overalls, onesies). */
  legsMatch?: boolean;
}

export const TOPS: TopDef[] = [
  {
    id: 'tshirt',
    name: 'T-Shirt',
    quip: 'Plain. Like your personality. Kidding! (Not kidding.)',
    defaultColor: '#7fbf3f',
    sleeves: 'short',
    torso: (c) => base(c),
  },
  {
    id: 'graphic',
    name: 'Poop Emoji Tee',
    quip: 'Wore it on school picture day. Iconic. Grounded for a week.',
    defaultColor: '#5aaeea',
    sleeves: 'short',
    torso: (c) => {
      const { g } = c;
      const x = g.cx;
      const y = chinY(g) + (g.torsoBottom - chinY(g)) * 0.5;
      return (
        <g>
          {base(c)}
          <path
            d={`M ${x - 30} ${y + 20} Q ${x - 34} ${y + 4} ${x - 18} ${y} Q ${x - 22} ${y - 14} ${x - 6} ${y - 16} Q ${x - 6} ${y - 30} ${x + 6} ${y - 34} Q ${x + 4} ${y - 22} ${x + 10} ${y - 16} Q ${x + 24} ${y - 14} ${x + 18} ${y} Q ${x + 34} ${y + 4} ${x + 30} ${y + 20} Z`}
            fill="#8a5530"
            {...ink}
            strokeWidth={2}
          />
          <circle cx={x - 8} cy={y - 4} r={4} fill="#fff" />
          <circle cx={x + 8} cy={y - 4} r={4} fill="#fff" />
          <circle cx={x - 7} cy={y - 3} r={1.8} fill={O} />
          <circle cx={x + 9} cy={y - 3} r={1.8} fill={O} />
          <path d={`M ${x - 10} ${y + 8} Q ${x} ${y + 15} ${x + 10} ${y + 8}`} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'coat',
    name: 'Winter Coat',
    quip: 'Standard issue in a town that is 90% snow. The other 10% is also snow.',
    defaultColor: '#d33b2c',
    sleeves: 'long',
    mittens: (c) => accent(c.color),
    // The show's kid coat: a centre seam, a row of buttons down one side and a collar band
    // peeking out under the chin in the same colour as the mittens.
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const n = Math.max(2, Math.round((g.torsoBottom - ch) / 28));
      return (
        <g>
          {base(c)}
          {torsoClip(c, <path d={`M ${g.cx - 220} ${ch - 4} Q ${g.cx} ${ch + 24} ${g.cx + 220} ${ch - 4} L ${g.cx + 220} ${ch - 80} L ${g.cx - 220} ${ch - 80} Z`} fill={accent(c.color)} />, 'collar')}
          <path d={`M ${g.cx} ${ch + 6} L ${g.cx} ${g.torsoBottom + 3}`} stroke={O} strokeWidth={2.5} />
          {buttons(c, g.cx - 10, ch + 22, g.torsoBottom - 14, n, O)}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'puffy',
    name: 'Puffy Coat',
    quip: 'Rated for -40°. Also muffles crying. Very handy around here.',
    defaultColor: '#d33b2c',
    sleeves: 'long',
    mittens: (c) => accent(c.color),
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const lines: number[] = [];
      for (let y = ch + 26; y < g.torsoBottom - 10; y += 30) lines.push(y);
      return (
        <g>
          {base(c)}
          {torsoClip(
            c,
            <g fill="none" stroke={shade(c.color, -0.3)} strokeWidth={2}>
              {lines.map((y) => (
                <path key={y} d={`M ${g.cx - 200} ${y} Q ${g.cx} ${y + 12} ${g.cx + 200} ${y}`} />
              ))}
            </g>,
          )}
          <path d={`M ${g.cx} ${ch - 10} L ${g.cx} ${g.torsoBottom + 3}`} stroke={O} strokeWidth={2.5} />
          <rect x={g.cx - 4} y={ch + 8} width={8} height={14} rx={2} fill="#d0d5da" stroke={O} strokeWidth={1.5} />
          {hem(c, shade(c.color, -0.15), 12)}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    quip: 'Hood up means do not talk to me. Hood down means also do not talk to me.',
    defaultColor: '#7fbf3f',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const py = g.torsoBottom - 56;
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 44} ${py} L ${g.cx + 44} ${py} L ${g.cx + 58} ${g.torsoBottom - 16} L ${g.cx - 58} ${g.torsoBottom - 16} Z`} fill={shade(c.color, -0.08)} {...ink} strokeWidth={2.4} />
          <path d={`M ${g.cx - 16} ${ch - 8} L ${g.cx - 20} ${ch + 44} M ${g.cx + 16} ${ch - 8} L ${g.cx + 20} ${ch + 44}`} stroke="#f4f4f4" strokeWidth={4} strokeLinecap="round" />
          <circle cx={g.cx - 20} cy={ch + 46} r={3.5} fill="#bbb" stroke={O} strokeWidth={1} />
          <circle cx={g.cx + 20} cy={ch + 46} r={3.5} fill="#bbb" stroke={O} strokeWidth={1} />
          {hem(c, shade(c.color, -0.12), 14)}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'sweater',
    name: "Grandma's Sweater",
    quip: 'Grandma knitted it. Itchy with love. Mostly itchy.',
    defaultColor: '#26367a',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const y = chinY(g) + 30;
      let zz = `M ${g.cx - 200} ${y}`;
      for (let x = g.cx - 200; x < g.cx + 200; x += 16) zz += ` L ${x + 8} ${y + 14} L ${x + 16} ${y}`;
      return (
        <g>
          {base(c)}
          {torsoClip(
            c,
            <g>
              <rect x={g.cx - 200} y={y - 8} width={400} height={30} fill={accent(c.color)} />
              <path d={zz} fill="none" stroke="#fff" strokeWidth={4} />
              {[-60, -20, 20, 60].map((dx) => (
                <path key={dx} d={starPath(g.cx + dx, y + 46, 7)} fill="#fff" />
              ))}
            </g>,
          )}
          {torsoClip(
            c,
            <g stroke={shade(c.color, -0.35)} strokeWidth={2}>
              <rect x={g.cx - 200} y={g.torsoBottom - 14} width={400} height={20} fill={shade(c.color, -0.12)} />
              {Array.from({ length: 30 }, (_, i) => (
                <line key={i} x1={g.cx - 150 + i * 10} y1={g.torsoBottom - 14} x2={g.cx - 150 + i * 10} y2={g.torsoBottom + 4} />
              ))}
            </g>,
            'rib',
          )}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'polo',
    name: 'Polo Shirt',
    quip: 'Future middle manager. Already says "circle back".',
    defaultColor: '#2ec4c4',
    sleeves: 'short',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx} ${ch + 34} L ${g.cx} ${ch - 6}`} stroke={shade(c.color, -0.35)} strokeWidth={2} />
          {buttons(c, g.cx + 6, ch + 8, ch + 28, 2, '#fff')}
          <path d={`M ${g.cx - 2} ${ch - 6} L ${g.cx - 40} ${ch - 12} L ${g.cx - 26} ${ch + 14} Z`} {...f(shade(c.color, 0.15))} strokeWidth={2.4} />
          <path d={`M ${g.cx + 2} ${ch - 6} L ${g.cx + 40} ${ch - 12} L ${g.cx + 26} ${ch + 14} Z`} {...f(shade(c.color, 0.15))} strokeWidth={2.4} />
        </g>
      );
    },
  },
  {
    id: 'dressshirt',
    name: 'Dress Shirt',
    quip: 'Dressed for the job you want: substitute teacher.',
    defaultColor: '#ffffff',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx} ${ch - 6} L ${g.cx} ${g.torsoBottom}`} stroke={shade(c.color, -0.25)} strokeWidth={2} />
          {buttons(c, g.cx + 6, ch + 14, g.torsoBottom - 16, 4, shade(c.color, -0.2))}
          <path d={`M ${g.cx - 2} ${ch - 8} L ${g.cx - 34} ${ch - 12} L ${g.cx - 22} ${ch + 18} Z`} {...f(c.color)} strokeWidth={2.4} />
          <path d={`M ${g.cx + 2} ${ch - 8} L ${g.cx + 34} ${ch - 12} L ${g.cx + 22} ${ch + 18} Z`} {...f(c.color)} strokeWidth={2.4} />
        </g>
      );
    },
  },
  {
    id: 'suit',
    name: 'Suit Jacket',
    quip: 'Mayor material. Corruption sold separately.',
    defaultColor: '#26367a',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const vy = ch + (g.torsoBottom - ch) * 0.55;
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 34} ${ch - 14} L ${g.cx} ${vy} L ${g.cx + 34} ${ch - 14} Z`} fill="#f7f7f7" {...ink} strokeWidth={2.2} />
          <path d={`M ${g.cx - 36} ${ch - 14} L ${g.cx - 2} ${vy} L ${g.cx - 30} ${vy - 30} L ${g.cx - 52} ${ch + 10} Z`} {...f(shade(c.color, -0.2))} strokeWidth={2.2} />
          <path d={`M ${g.cx + 36} ${ch - 14} L ${g.cx + 2} ${vy} L ${g.cx + 30} ${vy - 30} L ${g.cx + 52} ${ch + 10} Z`} {...f(shade(c.color, -0.2))} strokeWidth={2.2} />
          <path d={`M ${g.cx} ${vy} L ${g.cx} ${g.torsoBottom}`} stroke={shade(c.color, -0.4)} strokeWidth={2} />
          {buttons(c, g.cx + 8, vy + 14, vy + 34, 2, shade(c.color, -0.45))}
          <path d={`M ${g.cx - 60} ${vy + 30} L ${g.cx - 30} ${vy + 30}`} stroke={shade(c.color, -0.4)} strokeWidth={3} />
          <path d={`M ${g.cx + 34} ${ch + 30} l 10 -6 l 4 8 l -10 4 Z`} fill="#d33b2c" />
        </g>
      );
    },
  },
  {
    id: 'tank',
    name: 'Tank Top',
    quip: 'Welcome to the gun show. Tickets are free. The show is short.',
    defaultColor: '#ffffff',
    sleeves: 'bare',
    torso: (c) => {
      const { g } = c;
      const sh = g.shoulder;
      const top = g.torsoTop;
      const ch = chinY(g);
      const d = `M ${g.cx - 220} ${top + 92} Q ${g.cx - sh * 0.75} ${top + 74} ${g.cx - sh * 0.58} ${top} L ${g.cx - sh * 0.3} ${top} Q ${g.cx} ${ch + 46} ${g.cx + sh * 0.3} ${top} L ${g.cx + sh * 0.58} ${top} Q ${g.cx + sh * 0.75} ${top + 74} ${g.cx + 220} ${top + 92} L ${g.cx + 220} ${g.torsoBottom + 30} L ${g.cx - 220} ${g.torsoBottom + 30} Z`;
      return (
        <g>
          {base(c, c.c.skin)}
          {torsoClip(c, <path d={d} {...f(c.color)} />)}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'varsity',
    name: 'Varsity Jacket',
    quip: 'Peaked in fourth grade. Will tell you about it. At length.',
    defaultColor: '#8a1f2b',
    sleeves: 'long',
    sleeveColor: () => '#f4f1e6',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const letter = (c.c.name.trim()[0] || 'A').toUpperCase();
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx} ${ch - 8} L ${g.cx} ${g.torsoBottom}`} stroke={O} strokeWidth={2} />
          {buttons(c, g.cx - 7, ch + 12, g.torsoBottom - 22, 4, '#f4f1e6')}
          {torsoClip(
            c,
            <g>
              <rect x={g.cx - 200} y={g.torsoBottom - 16} width={400} height={30} fill={shade(c.color, -0.2)} />
              <path d={`M ${g.cx - 200} ${g.torsoBottom - 10} L ${g.cx + 200} ${g.torsoBottom - 10}`} stroke="#f4f1e6" strokeWidth={3} />
            </g>,
          )}
          <text
            x={g.cx - g.shoulder * 0.45}
            y={ch + 46}
            textAnchor="middle"
            fontFamily="'Luckiest Guy', 'Arial Black', Impact, sans-serif"
            fontSize={34}
            fill="#f4f1e6"
            stroke={O}
            strokeWidth={1.5}
          >
            {letter}
          </text>
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'overalls',
    name: 'Overalls',
    quip: 'Farm-to-table chic. Has never seen a farm. Has seen a table.',
    defaultColor: '#3b6fd8',
    sleeves: 'short',
    sleeveColor: () => '#f2c230',
    legsMatch: true,
    torso: (c) => {
      const { g } = c;
      const by = g.torsoTop + (g.torsoBottom - g.torsoTop) * 0.42;
      const bw = g.shoulder * 0.62;
      return (
        <g>
          {base(c, '#f2c230')}
          {torsoClip(c, <rect x={g.cx - 200} y={g.torsoBottom - 34} width={400} height={60} {...f(c.color)} />)}
          <path d={`M ${g.cx - bw} ${by} L ${g.cx + bw} ${by} L ${g.cx + bw + 6} ${g.torsoBottom - 30} L ${g.cx - bw - 6} ${g.torsoBottom - 30} Z`} {...f(c.color)} />
          <path d={`M ${g.cx - bw + 4} ${by + 2} L ${g.cx - g.shoulder * 0.55} ${g.torsoTop} M ${g.cx + bw - 4} ${by + 2} L ${g.cx + g.shoulder * 0.55} ${g.torsoTop}`} stroke={O} strokeWidth={16} strokeLinecap="round" />
          <path d={`M ${g.cx - bw + 4} ${by + 2} L ${g.cx - g.shoulder * 0.55} ${g.torsoTop} M ${g.cx + bw - 4} ${by + 2} L ${g.cx + g.shoulder * 0.55} ${g.torsoTop}`} stroke={c.color} strokeWidth={11} strokeLinecap="round" />
          <circle cx={g.cx - bw + 8} cy={by + 10} r={5} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <circle cx={g.cx + bw - 8} cy={by + 10} r={5} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <rect x={g.cx - 18} y={by + 16} width={36} height={24} rx={4} fill="none" stroke={shade(c.color, -0.35)} strokeWidth={2} strokeDasharray="4 3" />
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'stripes',
    name: 'Striped Shirt',
    quip: 'Somewhere, a guy in a bobble hat is very upset about this.',
    defaultColor: '#d33b2c',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ys: number[] = [];
      for (let y = g.torsoTop; y < g.torsoBottom + 10; y += 26) ys.push(y);
      return (
        <g>
          {base(c)}
          {torsoClip(
            c,
            <g fill="#ffffff">
              {ys.map((y) => (
                <rect key={y} x={g.cx - 200} y={y} width={400} height={12} />
              ))}
            </g>,
          )}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'flannel',
    name: 'Flannel',
    quip: 'Chops wood. Emotionally. Has never seen an axe.',
    defaultColor: '#d33b2c',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const dark = shade(c.color, -0.45);
      return (
        <g>
          {base(c)}
          {torsoClip(
            c,
            <g opacity={0.55}>
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={`v${i}`} x={g.cx - 170 + i * 30} y={g.torsoTop} width={12} height={g.torsoBottom - g.torsoTop + 10} fill={dark} />
              ))}
              {Array.from({ length: 7 }, (_, i) => (
                <rect key={`h${i}`} x={g.cx - 200} y={g.torsoTop + i * 30} width={400} height={12} fill={dark} />
              ))}
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={`t${i}`} x={g.cx - 158 + i * 30} y={g.torsoTop} width={2} height={g.torsoBottom - g.torsoTop + 10} fill="#fff" />
              ))}
            </g>,
          )}
          <path d={`M ${g.cx} ${ch - 8} L ${g.cx} ${g.torsoBottom}`} stroke={O} strokeWidth={2} />
          {buttons(c, g.cx + 7, ch + 14, g.torsoBottom - 16, 4, '#f4f1e6')}
          <path d={`M ${g.cx - 2} ${ch - 8} L ${g.cx - 36} ${ch - 12} L ${g.cx - 22} ${ch + 18} Z`} {...f(c.color)} strokeWidth={2.4} />
          <path d={`M ${g.cx + 2} ${ch - 8} L ${g.cx + 36} ${ch - 12} L ${g.cx + 22} ${ch + 18} Z`} {...f(c.color)} strokeWidth={2.4} />
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'labcoat',
    name: 'Lab Coat',
    quip: 'Not a real doctor. Has a real lab. In the garage. Mom does not know.',
    defaultColor: '#2ec4c4',
    sleeves: 'long',
    sleeveColor: () => '#f7f7f7',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <path d={torsoPath(g)} {...pale('#f7f7f7')} />
          <path d={`M ${g.cx - 26} ${ch - 14} L ${g.cx - 10} ${g.torsoBottom + 4} L ${g.cx + 10} ${g.torsoBottom + 4} L ${g.cx + 26} ${ch - 14} Z`} {...f(c.color)} strokeWidth={2.2} />
          <path d={`M ${g.cx - 28} ${ch - 14} L ${g.cx - 12} ${ch + 50} L ${g.cx - 46} ${ch + 18} Z M ${g.cx + 28} ${ch - 14} L ${g.cx + 12} ${ch + 50} L ${g.cx + 46} ${ch + 18} Z`} {...f('#ececec')} strokeWidth={2.2} />
          <rect x={g.cx + 30} y={ch + 40} width={28} height={30} fill="#ececec" {...ink} strokeWidth={2} />
          <path d={`M ${g.cx + 38} ${ch + 42} L ${g.cx + 38} ${ch + 26} M ${g.cx + 48} ${ch + 42} L ${g.cx + 48} ${ch + 30}`} stroke="#3b6fd8" strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    },
    skirt: (c) => {
      const { g } = c;
      const y0 = g.torsoBottom - 14;
      const y1 = g.legTop + (g.legBottom - g.legTop) * 0.6;
      const w = torsoHalfWidthAt(g, g.torsoBottom - 14);
      return (
        <g>
          <path d={`M ${g.cx - w} ${y0} L ${g.cx - w - 10} ${y1} L ${g.cx - 8} ${y1} L ${g.cx - 4} ${y0} Z`} {...pale('#f7f7f7')} />
          <path d={`M ${g.cx + w} ${y0} L ${g.cx + w + 10} ${y1} L ${g.cx + 8} ${y1} L ${g.cx + 4} ${y0} Z`} {...pale('#f7f7f7')} />
        </g>
      );
    },
  },
  {
    id: 'hero',
    name: 'Superhero Suit',
    quip: 'Superpowers pending approval. Has filed the paperwork. Twice.',
    defaultColor: '#3b6fd8',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const ey = ch + (g.torsoBottom - ch) * 0.38;
      return (
        <g>
          {base(c)}
          <circle cx={g.cx} cy={ey} r={26} {...f(accent(c.color))} />
          <path d={`M ${g.cx + 6} ${ey - 20} L ${g.cx - 10} ${ey + 2} L ${g.cx + 2} ${ey + 2} L ${g.cx - 6} ${ey + 20} L ${g.cx + 12} ${ey - 4} L ${g.cx} ${ey - 4} Z`} fill="#fff" {...ink} strokeWidth={1.8} />
          {torsoClip(c, <rect x={g.cx - 200} y={g.torsoBottom - 26} width={400} height={14} {...f('#f2c230')} strokeWidth={2} />)}
          <rect x={g.cx - 12} y={g.torsoBottom - 30} width={24} height={22} rx={4} {...f('#f2c230')} strokeWidth={2} />
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'dress',
    name: 'Party Dress',
    quip: 'Twirl-certified. Has twirled until throwing up. Twice.',
    defaultColor: '#e86fb0',
    sleeves: 'short',
    torso: (c) => {
      const { g } = c;
      return (
        <g>
          {base(c)}
          {torsoClip(c, <path d={`M ${g.cx - 200} ${g.torsoBottom - 30} L ${g.cx + 200} ${g.torsoBottom - 30}`} stroke={shade(c.color, -0.3)} strokeWidth={6} />)}
          <path d={heartPath(g.cx, g.torsoBottom - 54, 9)} fill="#fff" opacity={0.85} />
        </g>
      );
    },
    skirt: (c) => {
      const { g } = c;
      const y0 = g.torsoBottom - 30;
      const y1 = g.legTop + (g.legBottom - g.legTop) * 0.62;
      const w = torsoHalfWidthAt(g, y0);
      return (
        <path
          d={`M ${g.cx - w} ${y0} L ${g.cx - w - 30} ${y1} ${scallopEdge(g.cx - w - 30, y1, g.cx + w + 30, y1, 8, 8)} L ${g.cx + w} ${y0} Z`}
          {...f(c.color)}
        />
      );
    },
  },
  {
    id: 'gothcoat',
    name: 'Goth Trench',
    quip: 'Darkness, but make it fashion. Thinks everyone else is a conformist.',
    defaultColor: '#1f1f22',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx} ${ch - 6} L ${g.cx} ${g.torsoBottom}`} stroke="#555" strokeWidth={2} />
          {buttons(c, g.cx - 14, ch + 18, g.torsoBottom - 10, 4, '#9aa3ad')}
          {buttons(c, g.cx + 14, ch + 18, g.torsoBottom - 10, 4, '#9aa3ad')}
          <path d={`M ${g.cx - 60} ${ch - 20} L ${g.cx - 40} ${ch + 26} L ${g.cx} ${ch - 2} L ${g.cx + 40} ${ch + 26} L ${g.cx + 60} ${ch - 20}`} {...f(shade(c.color, 0.15))} strokeWidth={2.2} />
        </g>
      );
    },
    skirt: (c) => {
      const { g } = c;
      const y0 = g.torsoBottom - 14;
      const y1 = g.legBottom - 6;
      const w = torsoHalfWidthAt(g, y0);
      return (
        <g>
          <path d={`M ${g.cx - w} ${y0} L ${g.cx - w - 16} ${y1} L ${g.cx + w + 16} ${y1} L ${g.cx + w} ${y0} Z`} {...f(c.color)} />
          <path d={`M ${g.cx} ${y0} L ${g.cx} ${y1}`} stroke="#555" strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'jersey',
    name: 'Sports Jersey',
    quip: 'Number one. In participation trophies.',
    defaultColor: '#f0742a',
    sleeves: 'short',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const num = String((c.c.name.length * 7 + 3) % 99);
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 34} ${ch - 12} L ${g.cx} ${ch + 22} L ${g.cx + 34} ${ch - 12}`} fill="none" stroke="#fff" strokeWidth={7} />
          <text
            x={g.cx}
            y={ch + (g.torsoBottom - ch) * 0.78}
            textAnchor="middle"
            fontFamily="'Luckiest Guy', 'Arial Black', Impact, sans-serif"
            fontSize={52}
            fill="#fff"
            stroke={O}
            strokeWidth={2}
          >
            {num}
          </text>
        </g>
      );
    },
  },
  {
    id: 'hawaiian',
    name: 'Hawaiian Shirt',
    quip: 'On vacation. Mentally. Permanently. Please leave a message.',
    defaultColor: '#2ec4c4',
    sleeves: 'short',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const spots = [
        [-60, 30],
        [10, 10],
        [50, 50],
        [-30, 80],
        [70, 110],
        [-70, 120],
        [0, 130],
        [40, -10],
        [-50, -10],
      ];
      return (
        <g>
          {base(c)}
          {torsoClip(
            c,
            <g>
              {spots.map(([dx, dy], i) => (
                <g key={i}>
                  <path d={scallop(g.cx + dx, ch + dy, 12, 12, 5, 0.32)} fill={i % 2 ? '#f2c230' : '#fff'} stroke={O} strokeWidth={1} />
                  <circle cx={g.cx + dx} cy={ch + dy} r={4} fill="#e5322d" />
                </g>
              ))}
            </g>,
          )}
          <path d={`M ${g.cx} ${ch - 6} L ${g.cx} ${g.torsoBottom}`} stroke={O} strokeWidth={2} />
          <path d={`M ${g.cx - 2} ${ch - 8} L ${g.cx - 40} ${ch - 12} L ${g.cx - 18} ${ch + 26} Z`} {...f(c.color)} strokeWidth={2.4} />
          <path d={`M ${g.cx + 2} ${ch - 8} L ${g.cx + 40} ${ch - 12} L ${g.cx + 18} ${ch + 26} Z`} {...f(c.color)} strokeWidth={2.4} />
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'tux',
    name: 'Tuxedo',
    quip: 'License to chill. Shaken, not stirred. (It is chocolate milk.)',
    defaultColor: '#1f1f22',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const vy = ch + (g.torsoBottom - ch) * 0.7;
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 40} ${ch - 14} L ${g.cx} ${vy} L ${g.cx + 40} ${ch - 14} Z`} fill="#fff" {...ink} strokeWidth={2.2} />
          <path d={`M ${g.cx - 42} ${ch - 14} L ${g.cx - 2} ${vy} L ${g.cx - 36} ${vy - 34} L ${g.cx - 58} ${ch + 10} Z M ${g.cx + 42} ${ch - 14} L ${g.cx + 2} ${vy} L ${g.cx + 36} ${vy - 34} L ${g.cx + 58} ${ch + 10} Z`} {...f(shade(c.color, 0.18))} strokeWidth={2.2} />
          {buttons(c, g.cx, ch + 22, vy - 10, 3, O)}
          <path d={`M ${g.cx} ${ch + 6} L ${g.cx - 18} ${ch - 4} L ${g.cx - 18} ${ch + 16} Z M ${g.cx} ${ch + 6} L ${g.cx + 18} ${ch - 4} L ${g.cx + 18} ${ch + 16} Z`} fill={O} />
        </g>
      );
    },
  },
  {
    id: 'leather',
    name: 'Leather Jacket',
    quip: 'Too cool for school. Still goes to school. Every day. On time.',
    defaultColor: '#1f1f22',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {base(c, '#e5322d')}
          {torsoClip(
            c,
            <g>
              <path d={`M ${g.cx - 220} ${g.torsoTop} L ${g.cx - 22} ${g.torsoTop} L ${g.cx + 10} ${ch + 30} L ${g.cx - 12} ${g.torsoBottom + 10} L ${g.cx - 220} ${g.torsoBottom + 10} Z`} {...f(c.color)} />
              <path d={`M ${g.cx + 220} ${g.torsoTop} L ${g.cx + 34} ${g.torsoTop} L ${g.cx + 26} ${ch + 30} L ${g.cx + 12} ${g.torsoBottom + 10} L ${g.cx + 220} ${g.torsoBottom + 10} Z`} {...f(c.color)} />
            </g>,
          )}
          <path d={`M ${g.cx - 26} ${ch - 16} L ${g.cx + 12} ${ch + 32} L ${g.cx - 44} ${ch + 28} Z M ${g.cx + 36} ${ch - 16} L ${g.cx + 28} ${ch + 32} L ${g.cx + 60} ${ch + 22} Z`} {...f(shade(c.color, 0.15))} strokeWidth={2} />
          <path d={`M ${g.cx - 50} ${ch + 60} L ${g.cx - 30} ${ch + 66}`} stroke="#c9d1d9" strokeWidth={3} />
          <circle cx={g.cx - 52} cy={ch + 36} r={3} fill="#c9d1d9" />
          <circle cx={g.cx + 54} cy={ch + 40} r={3} fill="#c9d1d9" />
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'poncho',
    name: 'Poncho',
    quip: 'Is it a blanket? Is it a shirt? Yes. Yes it is.',
    defaultColor: '#f0742a',
    sleeves: 'hidden',
    torso: (c) => {
      const { g } = c;
      const reach = g.handX + 26;
      const by = g.handY + 6;
      const d = `M ${g.cx - g.shoulder * 0.7} ${g.torsoTop} Q ${g.cx - reach * 0.9} ${g.torsoTop + 40} ${g.cx - reach} ${by} Q ${g.cx} ${g.torsoBottom + 26} ${g.cx + reach} ${by} Q ${g.cx + reach * 0.9} ${g.torsoTop + 40} ${g.cx + g.shoulder * 0.7} ${g.torsoTop} Z`;
      const id = c.uid('poncho');
      return (
        <g>
          {base(c, shade(c.color, -0.3))}
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
          <path d={d} {...f(c.color)} />
          <g clipPath={`url(#${id})`}>
            {[0, 1, 2].map((i) => {
              const y = chinY(g) + 20 + i * 30;
              let zz = `M ${g.cx - 200} ${y}`;
              for (let x = g.cx - 200; x < g.cx + 200; x += 20) zz += ` L ${x + 10} ${y + 10} L ${x + 20} ${y}`;
              return <path key={i} d={zz} fill="none" stroke={['#f2c230', '#2e8b47', '#d33b2c'][i]} strokeWidth={6} />;
            })}
          </g>
          <path d={d} {...edge} />
        </g>
      );
    },
  },
  {
    id: 'robe',
    name: 'Bathrobe',
    quip: 'Gave up at 2 PM. On a Tuesday. In March.',
    defaultColor: '#5aaeea',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const wy = g.torsoBottom - 34;
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 40} ${ch - 16} Q ${g.cx - 30} ${wy - 30} ${g.cx + 10} ${wy} L ${g.cx - 12} ${wy} Q ${g.cx - 50} ${wy - 40} ${g.cx - 58} ${ch} Z`} {...f(shade(c.color, 0.3))} strokeWidth={2.2} />
          <path d={`M ${g.cx + 40} ${ch - 16} Q ${g.cx + 34} ${wy - 40} ${g.cx + 10} ${wy}`} fill="none" stroke={O} strokeWidth={2.2} />
          {torsoClip(c, <rect x={g.cx - 200} y={wy - 6} width={400} height={12} {...f(shade(c.color, -0.2))} strokeWidth={2} />)}
          <path d={`M ${g.cx + 14} ${wy} L ${g.cx + 4} ${wy + 40} M ${g.cx + 18} ${wy} L ${g.cx + 30} ${wy + 36}`} stroke={O} strokeWidth={10} strokeLinecap="round" />
          <path d={`M ${g.cx + 14} ${wy} L ${g.cx + 4} ${wy + 40} M ${g.cx + 18} ${wy} L ${g.cx + 30} ${wy + 36}`} stroke={shade(c.color, -0.2)} strokeWidth={6} strokeLinecap="round" />
          <circle cx={g.cx + 16} cy={wy} r={8} {...f(shade(c.color, -0.2))} strokeWidth={2} />
          {outline(c)}
        </g>
      );
    },
    skirt: (c) => {
      const { g } = c;
      const y0 = g.torsoBottom - 14;
      const y1 = g.legTop + (g.legBottom - g.legTop) * 0.55;
      const w = torsoHalfWidthAt(g, y0);
      return <path d={`M ${g.cx - w} ${y0} L ${g.cx - w - 6} ${y1} L ${g.cx + w + 6} ${y1} L ${g.cx + w} ${y0} Z`} {...f(c.color)} />;
    },
  },
  {
    id: 'astro',
    name: 'Space Suit',
    quip: 'Ground control to Major Snack Time. Houston, we have a sandwich.',
    defaultColor: '#f4f4f4',
    sleeves: 'long',
    legsMatch: true,
    mittens: () => '#9aa3ad',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const py = ch + 22;
      return (
        <g>
          {base(c)}
          <rect x={g.cx - 32} y={py} width={64} height={42} rx={6} {...f('#9aa3ad')} strokeWidth={2.2} />
          <circle cx={g.cx - 18} cy={py + 14} r={6} fill="#e5322d" stroke={O} strokeWidth={1.5} />
          <circle cx={g.cx} cy={py + 14} r={6} fill="#4cf06a" stroke={O} strokeWidth={1.5} />
          <circle cx={g.cx + 18} cy={py + 14} r={6} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <rect x={g.cx - 22} y={py + 26} width={44} height={8} rx={2} fill="#2b3a4a" />
          <circle cx={g.cx - g.shoulder * 0.62} cy={ch + 12} r={12} fill="#3b6fd8" stroke={O} strokeWidth={2} />
          <path d={starPath(g.cx - g.shoulder * 0.62, ch + 12, 7)} fill="#fff" />
          {torsoClip(c, <rect x={g.cx - 200} y={g.torsoBottom - 22} width={400} height={10} {...f('#9aa3ad')} strokeWidth={2} />)}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'santa',
    name: 'Santa Suit',
    quip: 'Ho ho ho. Mall Santa. Paid in candy canes. Hates candy canes.',
    defaultColor: '#d33b2c',
    sleeves: 'long',
    mittens: () => '#1f1f22',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const wy = g.torsoBottom - 32;
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 12} ${ch - 10} L ${g.cx + 12} ${ch - 10} L ${g.cx + 12} ${g.torsoBottom} L ${g.cx - 12} ${g.torsoBottom} Z`} fill="#fff" {...ink} strokeWidth={2} />
          {torsoClip(
            c,
            <g>
              <rect x={g.cx - 200} y={g.torsoBottom - 14} width={400} height={30} fill="#fff" stroke={O} strokeWidth={2} />
              <rect x={g.cx - 200} y={wy - 8} width={400} height={16} {...f('#1f1f22')} strokeWidth={2} />
            </g>,
          )}
          <rect x={g.cx - 14} y={wy - 11} width={28} height={22} rx={3} fill="none" stroke="#f2c230" strokeWidth={5} />
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'turtleneck',
    name: 'Turtleneck',
    quip: 'Deep thinker. Shallow pockets. Says "art" with a long "a".',
    defaultColor: '#1f1f22',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 58} ${ch - 26} Q ${g.cx} ${ch - 6} ${g.cx + 58} ${ch - 26} L ${g.cx + 56} ${ch + 4} Q ${g.cx} ${ch + 22} ${g.cx - 56} ${ch + 4} Z`} {...f(shade(c.color, 0.12))} strokeWidth={2.2} />
          <path d={`M ${g.cx - 50} ${ch - 6} Q ${g.cx} ${ch + 10} ${g.cx + 50} ${ch - 6}`} fill="none" stroke={shade(c.color, -0.3)} strokeWidth={1.5} />
        </g>
      );
    },
  },
  {
    id: 'cardigan',
    name: 'Cardigan',
    quip: 'Won\'t you be my neighbour? No? Fair enough.',
    defaultColor: '#c9a77a',
    sleeves: 'long',
    torso: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {base(c)}
          <path d={`M ${g.cx - 30} ${ch - 14} L ${g.cx - 6} ${g.torsoBottom + 4} L ${g.cx + 6} ${g.torsoBottom + 4} L ${g.cx + 30} ${ch - 14} Z`} fill="#fff" {...ink} strokeWidth={2} />
          {buttons(c, g.cx - 14, ch + 30, g.torsoBottom - 14, 4, shade(c.color, -0.4))}
          <rect x={g.cx - g.shoulder * 0.8} y={g.torsoBottom - 52} width={30} height={26} rx={3} fill="none" stroke={shade(c.color, -0.35)} strokeWidth={2} />
          <rect x={g.cx + g.shoulder * 0.8 - 30} y={g.torsoBottom - 52} width={30} height={26} rx={3} fill="none" stroke={shade(c.color, -0.35)} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'tiedye',
    name: 'Tie-Dye',
    quip: 'Smells like patchouli and questionable decisions. Wants to save the whales.',
    defaultColor: '#8b5cc7',
    sleeves: 'short',
    sleeveColor: () => '#f2c230',
    torso: (c) => {
      const { g } = c;
      const cy = chinY(g) + (g.torsoBottom - chinY(g)) * 0.5;
      const rings = ['#e5322d', '#f0742a', '#f2c230', '#7fbf3f', '#3b6fd8', c.color];
      return (
        <g>
          {base(c, '#f2c230')}
          {torsoClip(
            c,
            <g>
              {rings.map((col, i) => (
                <circle key={i} cx={g.cx} cy={cy} r={150 - i * 24} fill={col} opacity={0.85} />
              ))}
            </g>,
          )}
          {outline(c)}
        </g>
      );
    },
  },
  {
    id: 'gown',
    name: 'Hospital Gown',
    quip: 'Breezy in the back. Do NOT turn around. We are begging you.',
    defaultColor: '#a8d8f0',
    sleeves: 'short',
    torso: (c) => {
      const { g } = c;
      const dots: [number, number][] = [];
      for (let y = g.torsoTop + 20; y < g.torsoBottom; y += 22) for (let x = -120; x < 120; x += 22) dots.push([g.cx + x + ((y / 22) % 2) * 11, y]);
      return (
        <g>
          {base(c)}
          {torsoClip(
            c,
            <g fill={shade(c.color, -0.25)}>
              {dots.map(([x, y]) => (
                <circle key={`${x},${y}`} cx={x} cy={y} r={2.5} />
              ))}
            </g>,
          )}
        </g>
      );
    },
    skirt: (c) => {
      const { g } = c;
      const y0 = g.torsoBottom - 12;
      const y1 = g.legTop + (g.legBottom - g.legTop) * 0.45;
      const w = torsoHalfWidthAt(g, y0);
      return <path d={`M ${g.cx - w} ${y0} L ${g.cx - w - 4} ${y1} L ${g.cx + w + 4} ${y1} L ${g.cx + w} ${y0} Z`} {...f(c.color)} />;
    },
  },
];

/* --------------------------------------------------------------- bottoms */

export interface BottomDef extends ItemBase {
  render: Render;
}

export function legsPath(g: BodyGeo, y0 = g.legTop, y1 = g.legBottom, flare = 0): string {
  const lo = g.cx - g.legSep - g.legW / 2;
  const ro = g.cx + g.legSep + g.legW / 2;
  const il = Math.min(g.cx - g.legSep + g.legW / 2, g.cx - 1.5);
  const ir = Math.max(g.cx + g.legSep - g.legW / 2, g.cx + 1.5);
  const crotch = y0 + (y1 - y0) * 0.3;
  return `M ${lo} ${y0} L ${lo - flare} ${y1} L ${il} ${y1} L ${g.cx} ${crotch} L ${ir} ${y1} L ${ro + flare} ${y1} L ${ro} ${y0} Z`;
}

const skinLegs = (c: RenderCtx) => <path d={legsPath(c.g)} {...f(c.c.skin)} />;

function legClip(c: RenderCtx, children: ReactNode, flare = 0) {
  const id = c.uid('legs');
  return (
    <>
      <clipPath id={id}>
        <path d={legsPath(c.g, c.g.legTop, c.g.legBottom, flare)} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

function skirtShape(c: RenderCtx, len: number, flare: number, bumps = 0): string {
  const { g } = c;
  const y0 = g.legTop - 12;
  const y1 = g.legTop + (g.legBottom - g.legTop) * len;
  const w = g.hip - 6;
  const bottom = bumps ? scallopEdge(g.cx - w - flare, y1, g.cx + w + flare, y1, bumps, 10) : `L ${g.cx + w + flare} ${y1}`;
  return `M ${g.cx - w} ${y0} L ${g.cx - w - flare} ${y1} ${bottom} L ${g.cx + w} ${y0} Z`;
}

export const BOTTOMS: BottomDef[] = [
  {
    id: 'pants',
    name: 'Pants',
    quip: 'Standard-issue leg tubes. Two legs. Both included.',
    defaultColor: '#3b6fd8',
    render: (c) => <path d={legsPath(c.g)} {...f(c.color)} />,
  },
  {
    id: 'jeans',
    name: 'Jeans',
    quip: 'Pre-faded. Pre-ripped. Pre-owned by an older cousin.',
    defaultColor: '#26367a',
    render: (c) => (
      <g>
        <path d={legsPath(c.g)} {...f(c.color)} />
        {legClip(
          c,
          <path
            d={`M ${c.g.cx - c.g.legSep - c.g.legW / 2 + 6} ${c.g.legTop} L ${c.g.cx - c.g.legSep - c.g.legW / 2 + 6} ${c.g.legBottom} M ${c.g.cx + c.g.legSep + c.g.legW / 2 - 6} ${c.g.legTop} L ${c.g.cx + c.g.legSep + c.g.legW / 2 - 6} ${c.g.legBottom}`}
            stroke={shade(c.color, 0.45)}
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />,
        )}
      </g>
    ),
  },
  {
    id: 'shorts',
    name: 'Shorts',
    quip: 'Wears shorts in a blizzard. Respect. Also frostbite.',
    defaultColor: '#c9a77a',
    render: (c) => (
      <g>
        {skinLegs(c)}
        <path d={legsPath(c.g, c.g.legTop, c.g.legTop + (c.g.legBottom - c.g.legTop) * 0.5, 4)} {...f(c.color)} />
      </g>
    ),
  },
  {
    id: 'skirt',
    name: 'Skirt',
    quip: 'Swishy. So swishy. Maximum swish achieved.',
    defaultColor: '#8b5cc7',
    render: (c) => (
      <g>
        {skinLegs(c)}
        <path d={skirtShape(c, 0.55, 18)} {...f(c.color)} />
        <path
          d={`M ${c.g.cx - 30} ${c.g.legTop - 8} L ${c.g.cx - 40} ${c.g.legTop + (c.g.legBottom - c.g.legTop) * 0.55} M ${c.g.cx + 30} ${c.g.legTop - 8} L ${c.g.cx + 40} ${c.g.legTop + (c.g.legBottom - c.g.legTop) * 0.55}`}
          stroke={shade(c.color, -0.3)}
          strokeWidth={2}
        />
      </g>
    ),
  },
  {
    id: 'track',
    name: 'Tracksuit Pants',
    quip: 'Has given up. Comfortably. With racing stripes.',
    defaultColor: '#26367a',
    render: (c) => {
      const { g } = c;
      const lo = g.cx - g.legSep - g.legW / 2 + 5;
      const ro = g.cx + g.legSep + g.legW / 2 - 5;
      return (
        <g>
          <path d={legsPath(g)} {...f(c.color)} />
          {legClip(c, <path d={`M ${lo} ${g.legTop} L ${lo - 1} ${g.legBottom} M ${ro} ${g.legTop} L ${ro + 1} ${g.legBottom}`} stroke="#fff" strokeWidth={5} />)}
        </g>
      );
    },
  },
  {
    id: 'cargo',
    name: 'Cargo Pants',
    quip: 'A pocket for every snack. Currently carrying 14 snacks.',
    defaultColor: '#6b7a3a',
    render: (c) => {
      const { g } = c;
      const py = g.legTop + (g.legBottom - g.legTop) * 0.3;
      const ph = Math.min(26, (g.legBottom - g.legTop) * 0.45);
      return (
        <g>
          <path d={legsPath(g)} {...f(c.color)} />
          <rect x={g.cx - g.legSep - g.legW / 2 - 4} y={py} width={18} height={ph} rx={2} {...f(shade(c.color, -0.12))} strokeWidth={2} />
          <rect x={g.cx + g.legSep + g.legW / 2 - 14} y={py} width={18} height={ph} rx={2} {...f(shade(c.color, -0.12))} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'plaid',
    name: 'Golf Pants',
    quip: 'Golf dad starter kit. Has never golfed. Talks about golf constantly.',
    defaultColor: '#d33b2c',
    render: (c) => {
      const { g } = c;
      return (
        <g>
          <path d={legsPath(g)} {...f(c.color)} />
          {legClip(
            c,
            <g opacity={0.5} fill={shade(c.color, -0.5)}>
              {Array.from({ length: 8 }, (_, i) => (
                <rect key={`v${i}`} x={g.cx - 100 + i * 26} y={g.legTop} width={8} height={120} />
              ))}
              {Array.from({ length: 6 }, (_, i) => (
                <rect key={`h${i}`} x={g.cx - 120} y={g.legTop + i * 22} width={240} height={8} />
              ))}
            </g>,
          )}
          <path d={legsPath(g)} {...edge} />
        </g>
      );
    },
  },
  {
    id: 'tights',
    name: 'Striped Tights',
    quip: 'Witch-in-training. Has turned exactly zero people into toads. So far.',
    defaultColor: '#8b5cc7',
    render: (c) => {
      const { g } = c;
      return (
        <g>
          <path d={legsPath(g)} {...f('#1f1f22')} />
          {legClip(
            c,
            <g fill={c.color}>
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x={g.cx - 120} y={g.legTop + i * 14} width={240} height={7} />
              ))}
            </g>,
          )}
          <path d={legsPath(g)} {...edge} />
        </g>
      );
    },
  },
  {
    id: 'kilt',
    name: 'Kilt',
    quip: 'Breezy. Very breezy. Please do not ask what is under it.',
    defaultColor: '#2e8b47',
    render: (c) => {
      const { g } = c;
      const id = c.uid('kilt');
      const d = skirtShape(c, 0.62, 12);
      return (
        <g>
          {skinLegs(c)}
          <path d={d} {...f(c.color)} />
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
          <g clipPath={`url(#${id})`} opacity={0.55}>
            {Array.from({ length: 10 }, (_, i) => (
              <rect key={`v${i}`} x={g.cx - 130 + i * 26} y={g.legTop - 20} width={8} height={100} fill="#26367a" />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <rect key={`h${i}`} x={g.cx - 140} y={g.legTop - 12 + i * 18} width={280} height={6} fill="#d33b2c" />
            ))}
          </g>
          <path d={d} {...edge} />
        </g>
      );
    },
  },
  {
    id: 'ripped',
    name: 'Ripped Jeans',
    quip: 'Distressed. Like their parents when they saw the price tag.',
    defaultColor: '#5aaeea',
    render: (c) => {
      const { g } = c;
      const ky = g.legTop + (g.legBottom - g.legTop) * 0.55;
      const hole = (x: number) => `M ${x - 10} ${ky} L ${x - 5} ${ky - 6} L ${x} ${ky - 2} L ${x + 6} ${ky - 7} L ${x + 10} ${ky} L ${x + 4} ${ky + 6} L ${x - 3} ${ky + 3} Z`;
      return (
        <g>
          <path d={legsPath(g)} {...f(c.color)} />
          <path d={hole(g.cx - g.legSep)} fill={c.c.skin} stroke="#fff" strokeWidth={2} />
          <path d={hole(g.cx + g.legSep)} fill={c.c.skin} stroke="#fff" strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'tutu',
    name: 'Tutu',
    quip: 'Ballet recital survivor. Fell off the stage. Got a standing ovation anyway.',
    defaultColor: '#f27bb4',
    render: (c) => {
      const { g } = c;
      const y = g.legTop + 4;
      // Two puffy layers of net with scalloped hems.
      const layer = (w: number, drop: number) => {
        const hem = y + drop;
        return `M ${g.cx - g.hip + 6} ${y - 18} L ${g.cx + g.hip - 6} ${y - 18} Q ${g.cx + w + 8} ${y - 8} ${g.cx + w} ${hem} ${scallopEdge(g.cx + w, hem, g.cx - w, hem, Math.round(w / 14), 9)} Q ${g.cx - w - 8} ${y - 8} ${g.cx - g.hip + 6} ${y - 18} Z`;
      };
      return (
        <g>
          <path d={legsPath(g)} {...f(shade(c.color, 0.55))} />
          <path d={layer(g.hip + 44, 16)} {...f(shade(c.color, -0.14))} />
          <path d={layer(g.hip + 30, 6)} {...f(c.color)} />
        </g>
      );
    },
  },
  {
    id: 'bells',
    name: 'Bell-Bottoms',
    quip: 'Groovy, baby. Trips over them constantly. Still groovy.',
    defaultColor: '#f0742a',
    render: (c) => <path d={legsPath(c.g, c.g.legTop, c.g.legBottom, 14)} {...f(c.color)} />,
  },
  {
    id: 'diaper',
    name: 'Diaper',
    quip: 'Big kid? Debatable. Very debatable.',
    colorable: false,
    render: (c) => {
      const { g } = c;
      const y1 = g.legTop + (g.legBottom - g.legTop) * 0.55;
      return (
        <g>
          {skinLegs(c)}
          <path d={`M ${g.cx - g.hip + 4} ${g.legTop - 10} L ${g.cx + g.hip - 4} ${g.legTop - 10} Q ${g.cx + g.hip} ${y1} ${g.cx + g.legSep} ${y1} Q ${g.cx} ${y1 - 10} ${g.cx - g.legSep} ${y1} Q ${g.cx - g.hip} ${y1} ${g.cx - g.hip + 4} ${g.legTop - 10} Z`} {...pale('#fdfdfd')} />
          <rect x={g.cx - g.hip + 6} y={g.legTop - 6} width={16} height={10} rx={2} fill="#7fd4ff" stroke={O} strokeWidth={1.5} />
          <rect x={g.cx + g.hip - 22} y={g.legTop - 6} width={16} height={10} rx={2} fill="#7fd4ff" stroke={O} strokeWidth={1.5} />
        </g>
      );
    },
  },
];

/* ----------------------------------------------------------------- shoes */

export interface ShoeDef extends ItemBase {
  render: Render;
}

function feet(c: RenderCtx, draw: (x: number, y: number, rx: number, ry: number, side: -1 | 1) => ReactNode) {
  const { g } = c;
  return (
    <g>
      {([-1, 1] as const).map((side) => (
        <g key={side}>{draw(g.cx + side * (g.footSep + 4), g.footY, g.footRx, g.footRy, side)}</g>
      ))}
    </g>
  );
}

const footDome = (x: number, y: number, rx: number, ry: number) =>
  `M ${x - rx} ${y + 4} C ${x - rx} ${y - ry * 1.8} ${x + rx} ${y - ry * 1.8} ${x + rx} ${y + 4} Z`;

function bootShaft(c: RenderCtx, x: number, h: number) {
  const { g } = c;
  const w = g.legW / 2 + 3;
  return `M ${x - w} ${g.footY - h} L ${x + w} ${g.footY - h} L ${x + w} ${g.footY - 4} L ${x - w} ${g.footY - 4} Z`;
}

export const SHOES: ShoeDef[] = [
  {
    id: 'plain',
    name: 'Regular Shoes',
    quip: 'Black. Flat. Exactly like every other kid at the bus stop. Blending in is a survival skill.',
    defaultColor: '#1f1f22',
    render: (c) => feet(c, (x, y, rx, ry) => <path d={footDome(x, y, rx, ry)} {...f(c.color)} />),
  },
  {
    id: 'sneakers',
    name: 'Sneakers',
    quip: 'Light-up soles sold separately. Batteries never included.',
    defaultColor: '#1f1f22',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={footDome(x, y, rx, ry)} {...f(c.color)} />
          <path d={`M ${x - rx + 1} ${y - 2} L ${x + rx - 1} ${y - 2} L ${x + rx} ${y + 4} L ${x - rx} ${y + 4} Z`} fill="#fff" stroke={O} strokeWidth={2} />
          <path d={`M ${x - 8} ${y - ry * 0.9} L ${x + 8} ${y - ry * 0.9} M ${x - 9} ${y - ry * 0.5} L ${x + 9} ${y - ry * 0.5}`} stroke="#fff" strokeWidth={2.2} />
        </g>
      )),
  },
  {
    id: 'boots',
    name: 'Snow Boots',
    quip: 'Snow-proof. Puddle-proof. Kid-proof? Absolutely not.',
    defaultColor: '#7a4a2a',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={bootShaft(c, x, 30)} {...f(c.color)} />
          <path d={footDome(x, y, rx + 2, ry)} {...f(c.color)} />
          <path d={`M ${x - c.g.legW / 2 - 4} ${y - 32} L ${x + c.g.legW / 2 + 4} ${y - 32} L ${x + c.g.legW / 2 + 4} ${y - 22} L ${x - c.g.legW / 2 - 4} ${y - 22} Z`} {...f('#f4f1e6')} strokeWidth={2} />
        </g>
      )),
  },
  {
    id: 'dress',
    name: 'Dress Shoes',
    quip: 'Shiny enough to see your regrets in. So many regrets.',
    defaultColor: '#1f1f22',
    render: (c) =>
      feet(c, (x, y, rx, ry, side) => (
        <g>
          <path d={footDome(x + side * 4, y, rx + 4, ry * 0.85)} {...f(c.color)} />
          <path d={`M ${x + side * 4 - 8} ${y - ry * 0.9} Q ${x + side * 4} ${y - ry * 1.2} ${x + side * 4 + 8} ${y - ry * 0.9}`} fill="none" stroke="#fff" strokeWidth={3} opacity={0.7} strokeLinecap="round" />
        </g>
      )),
  },
  {
    id: 'rain',
    name: 'Rain Boots',
    quip: 'Puddle destroyer. Has never met a puddle it did not jump in.',
    defaultColor: '#f2c230',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={bootShaft(c, x, 44)} {...f(c.color)} />
          <path d={footDome(x, y, rx + 2, ry)} {...f(c.color)} />
          <path d={`M ${x - c.g.legW / 2 - 3} ${y - 44} L ${x + c.g.legW / 2 + 3} ${y - 44}`} stroke={shade(c.color, -0.3)} strokeWidth={5} />
        </g>
      )),
  },
  {
    id: 'bare',
    name: 'Bare Feet',
    quip: 'Feet are cold. Spirit is warm. Toes are blue.',
    colorable: false,
    render: (c) =>
      feet(c, (x, y, rx, ry, side) => (
        <g>
          <path d={footDome(x, y, rx, ry)} {...f(c.c.skin)} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M ${x + side * (rx - 6 - i * 8)} ${y - ry * 0.4} L ${x + side * (rx - 6 - i * 8)} ${y + 2}`} stroke={O} strokeWidth={1.6} />
          ))}
        </g>
      )),
  },
  {
    id: 'slippers',
    name: 'Bunny Slippers',
    quip: 'Fierce warrior. Very soft feet. Do not underestimate the bunnies.',
    defaultColor: '#ffffff',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={`M ${x - 10} ${y - ry} Q ${x - 18} ${y - ry * 3.2} ${x - 4} ${y - ry * 1.2} M ${x + 10} ${y - ry} Q ${x + 18} ${y - ry * 3.2} ${x + 4} ${y - ry * 1.2}`} {...pale(c.color)} />
          <path d={footDome(x, y, rx + 3, ry * 1.1)} {...pale(c.color)} />
          <circle cx={x - 6} cy={y - ry * 0.8} r={2.4} fill={O} />
          <circle cx={x + 6} cy={y - ry * 0.8} r={2.4} fill={O} />
          <circle cx={x} cy={y - ry * 0.4} r={2.6} fill="#f27bb4" />
        </g>
      )),
  },
  {
    id: 'hightops',
    name: 'High-Tops',
    quip: 'Ball is life. Has made exactly one basket. It was the wrong basket.',
    defaultColor: '#d33b2c',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={bootShaft(c, x, 26)} {...f(c.color)} />
          <path d={footDome(x, y, rx + 1, ry)} {...f(c.color)} />
          <circle cx={x} cy={y - 16} r={7} fill="#fff" stroke={O} strokeWidth={1.5} />
          <path d={starPath(x, y - 16, 5)} fill={c.color} />
          <path d={`M ${x - rx} ${y - 2} L ${x + rx} ${y - 2} L ${x + rx + 1} ${y + 4} L ${x - rx - 1} ${y + 4} Z`} fill="#fff" stroke={O} strokeWidth={2} />
        </g>
      )),
  },
  {
    id: 'clown',
    name: 'Clown Shoes',
    quip: 'Honk honk. Can never sneak up on anyone. Ever.',
    defaultColor: '#d33b2c',
    render: (c) =>
      feet(c, (x, y, rx, ry, side) => (
        <g>
          <path d={footDome(x + side * 16, y, rx * 1.7, ry * 1.2)} {...f(c.color)} />
          <circle cx={x + side * 4} cy={y - ry * 1.2} r={5} fill="#f2c230" stroke={O} strokeWidth={1.5} />
        </g>
      )),
  },
  {
    id: 'skates',
    name: 'Roller Skates',
    quip: 'Gliding straight into detention. At considerable speed.',
    defaultColor: '#e86fb0',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={bootShaft(c, x, 26)} {...f(c.color)} />
          <path d={footDome(x, y - 6, rx + 1, ry)} {...f(c.color)} />
          {[x - rx + 10, x + rx - 10].map((wx) => (
            <g key={wx}>
              <circle cx={wx} cy={y + 7} r={9} fill="#f2c230" />
              <circle cx={wx} cy={y + 7} r={3} fill="#8a6a10" />
            </g>
          ))}
          <rect x={x - rx} y={y - 5} width={rx * 2} height={8} rx={3} fill="#6b7078" />
        </g>
      )),
  },
  {
    id: 'cowboy',
    name: 'Cowboy Boots',
    quip: 'Yee and, indeed, haw. Spurs jingle-jangle at inappropriate times.',
    defaultColor: '#8a5530',
    render: (c) =>
      feet(c, (x, y, rx, ry, side) => (
        <g>
          <path d={bootShaft(c, x, 40)} {...f(c.color)} />
          <path d={footDome(x + side * 6, y, rx + 4, ry)} {...f(c.color)} />
          <path d={`M ${x - 8} ${y - 36} Q ${x} ${y - 20} ${x + 8} ${y - 36}`} fill="none" stroke="#f2c230" strokeWidth={2} />
          <circle cx={x - side * (c.g.legW / 2 + 6)} cy={y - 8} r={5} fill="none" stroke="#c9d1d9" strokeWidth={2.4} />
        </g>
      )),
  },
  {
    id: 'socks',
    name: 'Socks Only',
    quip: 'Sliding across the kitchen floor at top speed. Mom is not amused.',
    defaultColor: '#ffffff',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={bootShaft(c, x, 24)} {...pale(c.color)} />
          <path d={footDome(x, y, rx, ry)} {...pale(c.color)} />
          <path d={`M ${x - c.g.legW / 2 - 3} ${y - 20} L ${x + c.g.legW / 2 + 3} ${y - 20} M ${x - c.g.legW / 2 - 3} ${y - 14} L ${x + c.g.legW / 2 + 3} ${y - 14}`} stroke={accent(c.color)} strokeWidth={3} />
        </g>
      )),
  },
  {
    id: 'flipflops',
    name: 'Flip-Flops',
    quip: 'In a mountain town. In winter. Bold strategy.',
    defaultColor: '#2ec4c4',
    render: (c) =>
      feet(c, (x, y, rx, ry) => (
        <g>
          <path d={footDome(x, y - 2, rx - 2, ry)} {...f(c.c.skin)} />
          <rect x={x - rx - 2} y={y} width={rx * 2 + 4} height={6} rx={3} {...f(c.color)} strokeWidth={2} />
          <path d={`M ${x - rx + 6} ${y - 2} L ${x} ${y - ry * 1.2} L ${x + rx - 6} ${y - 2}`} fill="none" stroke={c.color} strokeWidth={4} />
        </g>
      )),
  },
];

/* --------------------------------------------------------------- neckwear */

export interface NeckDef extends ItemBase {
  back?: Render;
  front?: Render;
  /** Wraps up under the chin, so it is drawn in front of the head. */
  overHead?: boolean;
}

export const NECKWEAR: NeckDef[] = [
  { id: 'none', name: 'Nothing', quip: 'Neck: unadorned. Vulnerable. Free.' },
  {
    id: 'scarf',
    name: 'Scarf',
    quip: 'Knitted by a nervous aunt. Seven feet long. Tripped on it twice.',
    defaultColor: '#d33b2c',
    overHead: true,
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const w = g.shoulder * 0.95;
      return (
        <g>
          <path d={`M ${g.cx + 18} ${ch + 6} L ${g.cx + 40} ${ch + 6} L ${g.cx + 46} ${ch + 78} L ${g.cx + 20} ${ch + 80} Z`} {...f(c.color)} />
          <path d={`M ${g.cx + 22} ${ch + 44} L ${g.cx + 43} ${ch + 43} M ${g.cx + 22} ${ch + 60} L ${g.cx + 44} ${ch + 59}`} stroke={accent(c.color)} strokeWidth={6} />
          <path d={`M ${g.cx + 20} ${ch + 80} l 2 10 M ${g.cx + 28} ${ch + 80} l 1 10 M ${g.cx + 36} ${ch + 79} l 1 10 M ${g.cx + 44} ${ch + 78} l 1 10`} stroke={c.color} strokeWidth={3} />
          <path d={`M ${g.cx - w} ${ch - 26} Q ${g.cx} ${ch + 6} ${g.cx + w} ${ch - 26} L ${g.cx + w} ${ch} Q ${g.cx} ${ch + 34} ${g.cx - w} ${ch} Z`} {...f(c.color)} />
          <path d={`M ${g.cx - w + 6} ${ch - 12} Q ${g.cx} ${ch + 18} ${g.cx + w - 6} ${ch - 12}`} fill="none" stroke={accent(c.color)} strokeWidth={6} />
        </g>
      );
    },
  },
  {
    id: 'tie',
    name: 'Necktie',
    quip: 'Strangulation, but make it professional.',
    defaultColor: '#d33b2c',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const L = (g.torsoBottom - ch) * 0.62;
      return (
        <g>
          <path d={`M ${g.cx - 9} ${ch - 6} L ${g.cx + 9} ${ch - 6} L ${g.cx + 6} ${ch + 8} L ${g.cx - 6} ${ch + 8} Z`} {...f(shade(c.color, -0.12))} strokeWidth={2.2} />
          <path d={`M ${g.cx - 6} ${ch + 8} L ${g.cx + 6} ${ch + 8} L ${g.cx + 13} ${ch + L - 14} L ${g.cx} ${ch + L} L ${g.cx - 13} ${ch + L - 14} Z`} {...f(c.color)} strokeWidth={2.2} />
          <path d={`M ${g.cx - 8} ${ch + 26} L ${g.cx + 9} ${ch + 18} M ${g.cx - 11} ${ch + 46} L ${g.cx + 11} ${ch + 36}`} stroke={accent(c.color)} strokeWidth={3} />
        </g>
      );
    },
  },
  {
    id: 'bowtie',
    name: 'Bow Tie',
    quip: 'Bow ties are cool. Says no one at recess. Ever.',
    defaultColor: '#d33b2c',
    front: (c) => {
      const { g } = c;
      const y = chinY(g) + 6;
      return (
        <g>
          <path d={`M ${g.cx} ${y} L ${g.cx - 24} ${y - 13} L ${g.cx - 24} ${y + 13} Z M ${g.cx} ${y} L ${g.cx + 24} ${y - 13} L ${g.cx + 24} ${y + 13} Z`} {...f(c.color)} strokeWidth={2.2} />
          <rect x={g.cx - 6} y={y - 7} width={12} height={14} rx={3} {...f(shade(c.color, -0.15))} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'cape',
    name: 'Cape',
    quip: 'Not all heroes wear capes. This one does. Has never saved anyone.',
    defaultColor: '#d33b2c',
    back: (c) => {
      const { g } = c;
      return (
        <path
          d={`M ${g.cx - g.shoulder * 0.8} ${g.torsoTop + 12} L ${g.cx - g.shoulder - 64} ${g.footY - 6} Q ${g.cx} ${g.footY + 10} ${g.cx + g.shoulder + 64} ${g.footY - 6} L ${g.cx + g.shoulder * 0.8} ${g.torsoTop + 12} Z`}
          {...f(c.color)}
        />
      );
    },
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <circle cx={g.cx - 34} cy={ch - 2} r={8} fill="#f2c230" {...ink} strokeWidth={2} />
          <circle cx={g.cx + 34} cy={ch - 2} r={8} fill="#f2c230" {...ink} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'chain',
    name: 'Gold Chain',
    quip: 'Bling level: lunch money. It is spray-painted macaroni.',
    defaultColor: '#f2c230',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <path d={`M ${g.cx - 44} ${ch - 14} Q ${g.cx} ${ch + 56} ${g.cx + 44} ${ch - 14}`} fill="none" stroke={O} strokeWidth={8} />
          <path d={`M ${g.cx - 44} ${ch - 14} Q ${g.cx} ${ch + 56} ${g.cx + 44} ${ch - 14}`} fill="none" stroke={c.color} strokeWidth={5} strokeDasharray="6 2" />
          <circle cx={g.cx} cy={ch + 32} r={14} fill={c.color} {...ink} />
          <text x={g.cx} y={ch + 39} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={20} fill={shade(c.color, -0.5)}>
            $
          </text>
        </g>
      );
    },
  },
  {
    id: 'pearls',
    name: 'Pearls',
    quip: 'Clutches them in shock at least twice a day.',
    defaultColor: '#fbf6ea',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {Array.from({ length: 13 }, (_, i) => {
            const t = i / 12;
            const x = g.cx - 46 + t * 92;
            const y = ch - 14 + Math.sin(t * Math.PI) * 38;
            return <circle key={i} cx={x} cy={y} r={6} fill={c.color} stroke={O} strokeWidth={1.5} />;
          })}
        </g>
      );
    },
  },
  {
    id: 'kerchief',
    name: 'Neckerchief',
    quip: 'Cowpoke chic. Herds cats professionally.',
    defaultColor: '#d33b2c',
    overHead: true,
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <path d={`M ${g.cx - 54} ${ch - 16} Q ${g.cx} ${ch + 4} ${g.cx + 54} ${ch - 16} L ${g.cx} ${ch + 48} Z`} {...f(c.color)} />
          {[
            [-24, 0],
            [0, 6],
            [24, 0],
            [-10, 22],
            [10, 22],
          ].map(([dx, dy]) => (
            <circle key={`${dx}${dy}`} cx={g.cx + dx} cy={ch + dy} r={3} fill="#fff" />
          ))}
        </g>
      );
    },
  },
  {
    id: 'medal',
    name: 'Gold Medal',
    quip: 'Participation award, first place. Participated so hard.',
    defaultColor: '#3b6fd8',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <path d={`M ${g.cx - 40} ${ch - 16} L ${g.cx - 6} ${ch + 40} L ${g.cx + 6} ${ch + 40} L ${g.cx + 40} ${ch - 16} L ${g.cx + 26} ${ch - 18} L ${g.cx} ${ch + 26} L ${g.cx - 26} ${ch - 18} Z`} {...f(c.color)} strokeWidth={2} />
          <circle cx={g.cx} cy={ch + 52} r={17} fill="#f2c230" {...ink} />
          <path d={starPath(g.cx, ch + 52, 10)} fill="#fff6c4" stroke={O} strokeWidth={1.2} />
        </g>
      );
    },
  },
  {
    id: 'bib',
    name: 'Lobster Bib',
    quip: 'Messy eater. Proud of it. Has ketchup on the ceiling.',
    defaultColor: '#ffffff',
    overHead: true,
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <path d={`M ${g.cx - 40} ${ch - 10} Q ${g.cx} ${ch + 4} ${g.cx + 40} ${ch - 10} L ${g.cx + 44} ${ch + 60} Q ${g.cx} ${ch + 80} ${g.cx - 44} ${ch + 60} Z`} {...f(c.color)} />
          <ellipse cx={g.cx} cy={ch + 36} rx={14} ry={10} fill="#e5322d" />
          <path d={`M ${g.cx - 14} ${ch + 30} l -8 -8 M ${g.cx + 14} ${ch + 30} l 8 -8`} stroke="#e5322d" strokeWidth={4} strokeLinecap="round" />
          <circle cx={g.cx + 22} cy={ch + 58} r={5} fill="#d33b2c" opacity={0.7} />
        </g>
      );
    },
  },
  {
    id: 'backpack',
    name: 'Backpack',
    quip: 'Contains homework. Allegedly. Mostly contains a 3-week-old banana.',
    defaultColor: '#7fbf3f',
    back: (c) => {
      const { g } = c;
      return <rect x={g.cx - g.shoulder - 14} y={g.torsoTop + 20} width={(g.shoulder + 14) * 2} height={(g.torsoBottom - g.torsoTop) * 0.7} rx={20} {...f(c.color)} />;
    },
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const x1 = g.cx - g.shoulder * 0.55;
      const x2 = g.cx + g.shoulder * 0.55;
      const y2 = g.torsoBottom - 30;
      return (
        <g strokeLinecap="round">
          <path d={`M ${x1} ${ch - 10} L ${x1 - 4} ${y2} M ${x2} ${ch - 10} L ${x2 + 4} ${y2}`} stroke={O} strokeWidth={15} />
          <path d={`M ${x1} ${ch - 10} L ${x1 - 4} ${y2} M ${x2} ${ch - 10} L ${x2 + 4} ${y2}`} stroke={shade(c.color, -0.2)} strokeWidth={10} />
          <rect x={x1 - 10} y={ch + 30} width={12} height={8} fill="#c9d1d9" stroke={O} strokeWidth={1.2} />
          <rect x={x2 - 2} y={ch + 30} width={12} height={8} fill="#c9d1d9" stroke={O} strokeWidth={1.2} />
        </g>
      );
    },
  },
  {
    id: 'lei',
    name: 'Flower Lei',
    quip: 'Aloha means hello AND goodbye. Very confusing at the door.',
    defaultColor: '#e86fb0',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const t = i / 8;
            const x = g.cx - 52 + t * 104;
            const y = ch - 12 + Math.sin(t * Math.PI) * 44;
            return <path key={i} d={scallop(x, y, 10, 10, 5, 0.3)} fill={i % 2 ? '#f2c230' : c.color} stroke={O} strokeWidth={1.5} />;
          })}
        </g>
      );
    },
  },
  {
    id: 'whistle',
    name: 'Coach Whistle',
    quip: 'Blows it at everything. Pigeons. Clouds. Grandma.',
    defaultColor: '#3b6fd8',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      return (
        <g>
          <path d={`M ${g.cx - 40} ${ch - 14} L ${g.cx + 2} ${ch + 50} L ${g.cx + 40} ${ch - 14}`} fill="none" stroke={c.color} strokeWidth={4} />
          <path d={`M ${g.cx - 8} ${ch + 48} L ${g.cx + 16} ${ch + 48} L ${g.cx + 16} ${ch + 60} L ${g.cx + 2} ${ch + 62} A 9 9 0 1 1 ${g.cx - 8} ${ch + 48} Z`} fill="#c9d1d9" {...ink} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'camera',
    name: 'Tourist Camera',
    quip: 'Takes 400 photos of a single squirrel. Every one is blurry.',
    defaultColor: '#1f1f22',
    front: (c) => {
      const { g } = c;
      const ch = chinY(g);
      const y = ch + 46;
      return (
        <g>
          <path d={`M ${g.cx - 44} ${ch - 14} L ${g.cx - 24} ${y} M ${g.cx + 44} ${ch - 14} L ${g.cx + 24} ${y}`} stroke={O} strokeWidth={3} />
          <rect x={g.cx - 28} y={y - 4} width={56} height={36} rx={6} fill={c.color} {...ink} />
          <circle cx={g.cx} cy={y + 14} r={12} fill="#55555a" stroke="#ddd" strokeWidth={3} />
          <rect x={g.cx + 12} y={y - 9} width={12} height={6} rx={2} fill={c.color} stroke={O} strokeWidth={1.5} />
        </g>
      );
    },
  },
  {
    id: 'nametag',
    name: 'Name Tag',
    quip: 'HELLO my name is... wait, let me check.',
    defaultColor: '#d33b2c',
    front: (c) => {
      const { g } = c;
      const x = g.cx - g.shoulder * 0.1;
      const y = chinY(g) + (g.torsoBottom - chinY(g)) * 0.3;
      const name = (c.c.name || 'NOBODY').slice(0, 10);
      return (
        <g transform={`rotate(-6 ${x} ${y})`}>
          <rect x={x - 38} y={y - 18} width={76} height={44} rx={5} fill="#fff" {...ink} strokeWidth={2} />
          <rect x={x - 38} y={y - 18} width={76} height={15} rx={5} fill={c.color} />
          <text x={x} y={y - 6.5} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={9} fill={inkOn(c.color)}>
            HELLO my name is
          </text>
          <text x={x} y={y + 18} textAnchor="middle" fontFamily="'Comic Sans MS', 'Chalkboard SE', cursive" fontWeight={700} fontSize={name.length > 7 ? 11 : 15} fill={O}>
            {name}
          </text>
        </g>
      );
    },
  },
];
