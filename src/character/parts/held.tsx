import type { ItemBase, Render, RenderCtx } from '../../types';
import { accent, inkOn, shade } from '../../lib/color';
import { handPos } from '../geometry';
import { dots, ink, O, pale, PartText, scallop, starPath } from './common';

export interface HeldDef extends ItemBase {
  render?: Render;
  /** Degrees a kid tilts it away from their big head, so the head doesn't hide it. */
  lean?: number;
}

const f = (color: string) => ({ fill: color, ...ink });
const hand = (c: RenderCtx) => handPos(c.g, 1);
/** The soft ruffle under a scoop of ice cream: lobes hanging from a line, the scoop hides the top. */
const drape = (cx: number, cy: number, r: number) => {
  const w = (r * 2) / 5;
  return `M ${cx - r} ${cy - 5} ${`q ${w / 2} 13 ${w} 0 `.repeat(5)}Z`;
};

/** Splits sign text into at most 3 short lines. */
export function wrapSign(text: string, max = 12): string[] {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export const HELD: HeldDef[] = [
  { id: 'none', name: 'Empty Hands', quip: 'Hands free for high-fives. Nobody has offered one. Yet.' },
  {
    id: 'sign',
    name: 'Protest Sign',
    lean: 8,
    quip: 'Fighting the power. The power is bedtime. Edit the slogan below!',
    defaultColor: '#ffffff',
    render: (c) => {
      const [x, y] = hand(c);
      const lines = wrapSign(c.c.signText || 'WE WANT RECESS');
      const bx = x + 72;
      const by = y - 210;
      const paint = inkOn(c.color) === '#ffffff' ? '#ffffff' : '#d33b2c';
      return (
        <g>
          <path d={`M ${x - 2} ${y + 14} L ${bx - 4} ${by + 40}`} stroke={O} strokeWidth={13} strokeLinecap="round" />
          <path d={`M ${x - 2} ${y + 14} L ${bx - 4} ${by + 40}`} stroke="#c9a07a" strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 14} ${y - 26} L ${x + 32} ${y - 76} M ${x + 42} ${y - 100} L ${x + 56} ${y - 138}`} stroke="#a67f5b" strokeWidth={2} strokeLinecap="round" />
          <g transform={`rotate(4 ${bx} ${by})`}>
            <rect x={bx - 80} y={by - 44} width={160} height={88} rx={4} {...f(c.color)} />
            <rect x={bx - 72} y={by - 36} width={144} height={72} rx={3} fill="none" stroke={paint} strokeWidth={3} opacity={0.75} />
            <path d={`M ${bx + 80} ${by + 26} L ${bx + 62} ${by + 44} L ${bx + 80} ${by + 44} Z`} fill={shade(c.color, -0.16)} />
            <path d={`M ${bx - 16} ${by + 30} h 18 M ${bx - 14} ${by + 38} h 18`} stroke="#8d939b" strokeWidth={3} strokeLinecap="round" />
            {lines.map((l, i) => (
              <PartText
                key={i}
                x={bx}
                y={by + (i - (lines.length - 1) / 2) * 24 + 9}
                textAnchor="middle"
                fontFamily="'Luckiest Guy', 'Arial Black', Impact, sans-serif"
                fontSize={l.length > 10 ? 18 : 23}
                fill={paint}
              >
                {l}
              </PartText>
            ))}
          </g>
        </g>
      );
    },
  },
  {
    id: 'sword',
    name: 'Wooden Sword',
    lean: 8,
    quip: 'Knight of the playground. Has slain three dragons (shrubs).',
    defaultColor: '#c9a07a',
    render: (c) => {
      const [x, y] = hand(c);
      const dark = shade(c.color, -0.3);
      return (
        <g>
          <path d={`M ${x + 2} ${y} L ${x + 24} ${y - 170} L ${x + 34} ${y - 186} L ${x + 36} ${y - 166} L ${x + 16} ${y}`} {...f(c.color)} />
          <path d={`M ${x + 9} ${y} L ${x + 30} ${y - 170} L ${x + 34} ${y - 186} L ${x + 36} ${y - 166} L ${x + 16} ${y} Z`} fill={shade(c.color, -0.16)} />
          <path d={`M ${x + 11} ${y - 50} l 5 -44 M ${x + 19} ${y - 112} l 4 -36 M ${x + 20} ${y - 58} l 4 -38`} stroke={dark} strokeWidth={1.8} strokeLinecap="round" />
          <ellipse cx={x + 22} cy={y - 104} rx={2.4} ry={4.5} transform={`rotate(8 ${x + 22} ${y - 104})`} fill={dark} />
          <g transform={`rotate(-8 ${x} ${y - 20})`}>
            <rect x={x - 22} y={y - 26} width={58} height={12} rx={4} {...f(dark)} />
            <path d={dots([[x - 15, y - 20], [x + 29, y - 20]])} stroke="#e8d9b8" strokeWidth={4} strokeLinecap="round" />
          </g>
          <path d={`M ${x + 2} ${y - 36} L ${x + 19} ${y - 12} M ${x + 21} ${y - 36} L ${x + 1} ${y - 12}`} stroke="#efe2c4" strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x + 8} ${y + 8} L ${x + 9} ${y + 24}`} stroke="#7a4a2a" strokeWidth={10} strokeLinecap="round" />
          <path d={`M ${x + 3} ${y + 15} l 11 -3 M ${x + 3} ${y + 22} l 11 -3`} stroke="#54331c" strokeWidth={2.2} />
          <circle cx={x + 9} cy={y + 30} r={6.5} fill={dark} />
        </g>
      );
    },
  },
  {
    id: 'wand',
    name: 'Magic Wand',
    quip: 'Spell level: party trick. Can make a quarter disappear. Forever.',
    defaultColor: '#1f1f22',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x} ${y + 8} L ${x + 36} ${y - 96}`} stroke={O} strokeWidth={10} strokeLinecap="round" />
          <path d={`M ${x} ${y + 8} L ${x + 36} ${y - 96}`} stroke={c.color} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${x + 13} ${y - 36} L ${x + 29} ${y - 82}`} stroke={shade(c.color, 0.32)} strokeWidth={1.6} strokeLinecap="round" />
          <path d={`M ${x + 31} ${y - 82} L ${x + 36} ${y - 96}`} stroke="#fff" strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${x + 9} ${y - 18} L ${x + 12} ${y - 27}`} stroke="#f2c230" strokeWidth={6} />
          <path d={`M ${x + 37} ${y - 102} q 2 -16 15 -14`} fill="none" stroke="#f2c230" strokeWidth={2} strokeLinecap="round" />
          <path d={starPath(x + 52, y - 116, 10)} fill="#f2c230" {...ink} strokeWidth={1.5} />
          <path d={starPath(x + 24, y - 128, 7)} fill="#fff6c4" {...ink} strokeWidth={1.5} />
          <path d={starPath(x + 62, y - 88, 6)} fill="#fff6c4" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 42} ${y - 150} Q ${x + 42} ${y - 141} ${x + 51} ${y - 141} Q ${x + 42} ${y - 141} ${x + 42} ${y - 132} Q ${x + 42} ${y - 141} ${x + 33} ${y - 141} Q ${x + 42} ${y - 141} ${x + 42} ${y - 150} Z`} fill="#fff" />
          <path d={dots([[x + 70, y - 110], [x + 16, y - 106], [x + 54, y - 70], [x + 66, y - 134]])} stroke="#ffe58a" strokeWidth={3.5} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'balloon',
    name: 'Balloon',
    quip: 'It will float away eventually. Like all dreams. Enjoy it now.',
    defaultColor: '#d33b2c',
    render: (c) => {
      const [x, y] = hand(c);
      const bx = x + 56;
      const by = y - 260;
      return (
        <g>
          <path d={`M ${x} ${y} Q ${x + 40} ${y - 100} ${x + 20} ${y - 160} Q ${x + 10} ${y - 200} ${bx} ${by + 50}`} fill="none" stroke={O} strokeWidth={2} />
          <ellipse cx={bx} cy={by} rx={40} ry={48} {...f(c.color)} />
          <path d={`M ${bx + 30} ${by - 30} Q ${bx + 52} ${by + 14} ${bx + 6} ${by + 46} Q ${bx + 30} ${by + 14} ${bx + 30} ${by - 30} Z`} fill={shade(c.color, -0.16)} />
          <path d={`M ${bx - 5} ${by + 45} l -3 -9 M ${bx + 5} ${by + 45} l 3 -9 M ${bx} ${by + 46} l 0 -10`} stroke={shade(c.color, -0.28)} strokeWidth={2} strokeLinecap="round" />
          <path d={`M ${bx - 7} ${by + 54} L ${bx + 7} ${by + 54} L ${bx} ${by + 46} Z`} {...f(shade(c.color, -0.12))} strokeWidth={2} />
          <rect x={bx - 3.5} y={by + 50} width={7} height={3.5} rx={1.5} fill={shade(c.color, -0.4)} />
          <ellipse cx={bx - 14} cy={by - 18} rx={8} ry={14} fill="#fff" opacity={0.5} transform={`rotate(20 ${bx - 14} ${by - 18})`} />
          <circle cx={bx - 26} cy={by + 6} r={3.5} fill="#fff" opacity={0.45} />
        </g>
      );
    },
  },
  {
    id: 'snack',
    name: 'Snack Bag',
    lean: 6,
    quip: 'Breakfast of champions. Lunch of champions. Dinner of champions.',
    defaultColor: '#f0742a',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(12 ${x} ${y})`}>
          <path d={`M ${x - 6} ${y - 76} L ${x + 50} ${y - 76} L ${x + 46} ${y + 6} L ${x - 2} ${y + 6} Z`} {...f(c.color)} />
          <path d={`M ${x + 36} ${y - 70} L ${x + 50} ${y - 76} L ${x + 46} ${y + 6} L ${x + 38} ${y + 6} Z`} fill={shade(c.color, -0.14)} />
          <path d={`M ${x + 3} ${y - 66} L ${x + 5} ${y - 2}`} stroke={shade(c.color, 0.42)} strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${x - 6} ${y - 76} l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 3 6`} fill={c.color} {...ink} strokeWidth={2} />
          <path d={`M ${x - 6} ${y - 76} L ${x + 50} ${y - 76} L ${x + 49.5} ${y - 69} L ${x - 5.5} ${y - 69} Z`} fill={shade(c.color, -0.24)} />
          <path d={`M ${x - 2} ${y + 6} l 6 5 l 6 -5 l 6 5 l 6 -5 l 6 5 l 6 -5 l 6 5 l 6 -5 Z`} fill={shade(c.color, -0.24)} />
          <circle cx={x + 22} cy={y - 46} r={15} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <path d={`M ${x + 11} ${y - 40} Q ${x + 22} ${y - 62} ${x + 34} ${y - 42} Q ${x + 22} ${y - 34} ${x + 11} ${y - 40} Z`} fill="#e8963a" />
          <path d={dots([[x + 18, y - 44], [x + 24, y - 48], [x + 26, y - 41]])} stroke="#b9651c" strokeWidth={2.4} strokeLinecap="round" />
          <PartText x={x + 22} y={y - 16} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={11} fill="#fff" stroke={O} strokeWidth={0.6}>
            CRUNCHOS
          </PartText>
        </g>
      );
    },
  },
  {
    id: 'hotdog',
    name: 'Hot Dog',
    quip: 'Mystery meat in a bun. Do not ask which mystery.',
    colorable: false,
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-58 ${x} ${y})`}>
          <rect x={x - 4} y={y - 22} width={82} height={20} rx={10} {...f('#d6a05c')} />
          <rect x={x - 10} y={y - 15} width={92} height={20} rx={10} {...f('#c4512b')} />
          <path d={`M ${x - 3} ${y - 11} h 78`} stroke="#e58a62" strokeWidth={2.5} strokeLinecap="round" />
          <path d={`M ${x + 2} ${y - 7} q 6 -9 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0`} fill="none" stroke="#f2c230" strokeWidth={4} strokeLinecap="round" />
          <path d={dots([[x + 10, y - 2], [x + 25, y - 3], [x + 38, y - 2], [x + 52, y - 3], [x + 66, y - 2]])} stroke="#6fae3a" strokeWidth={3.5} strokeLinecap="round" />
          <rect x={x - 2} y={y - 1} width={78} height={20} rx={10} {...f('#e9b86b')} />
          <path d={`M ${x + 4} ${y + 14} q 34 6 66 0 l 0 3 q -34 6 -66 0 Z`} fill="#c98a45" />
          <path d={`M ${x + 8} ${y + 5} h 54`} stroke="#f6d59c" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'phone',
    name: 'Smartphone',
    lean: 6,
    quip: 'Doomscrolling since age six. Has 4,000 unread notifications.',
    defaultColor: '#1f1f22',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-10 ${x} ${y})`}>
          <rect x={x + 31} y={y - 50} width={4} height={15} rx={1.5} fill={shade(c.color, 0.25)} />
          <rect x={x - 8} y={y - 64} width={40} height={72} rx={7} {...f(c.color)} />
          <rect x={x - 4} y={y - 58} width={32} height={56} rx={3} fill="#7fd4ff" />
          <rect x={x + 5} y={y - 58} width={14} height={4.5} rx={2.2} fill={c.color} />
          <rect x={x} y={y - 50} width={19} height={9} rx={4} fill="#fff" />
          <rect x={x + 7} y={y - 38} width={18} height={9} rx={4} fill="#62d07a" />
          <rect x={x} y={y - 26} width={15} height={9} rx={4} fill="#fff" />
          <path d={`M ${x + 5} ${y - 6} h 14`} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
          <circle cx={x + 30} cy={y - 62} r={9} fill="#e5322d" />
          <PartText x={x + 30} y={y - 59} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={8} fill="#fff">
            99+
          </PartText>
        </g>
      );
    },
  },
  {
    id: 'teddy',
    name: 'Teddy Bear',
    quip: 'His name is Mr. Snuggleworth. Do NOT touch Mr. Snuggleworth.',
    defaultColor: '#a5713d',
    render: (c) => {
      const [x, y] = hand(c);
      const bx = x + 26;
      const by = y - 24;
      const light = shade(c.color, 0.35);
      return (
        <g>
          <ellipse cx={bx - 22} cy={by + 12} rx={7} ry={13} transform={`rotate(24 ${bx - 22} ${by + 12})`} {...f(shade(c.color, -0.12))} />
          <ellipse cx={bx + 22} cy={by + 12} rx={7} ry={13} transform={`rotate(-24 ${bx + 22} ${by + 12})`} {...f(shade(c.color, -0.12))} />
          <ellipse cx={bx} cy={by + 22} rx={22} ry={26} {...f(c.color)} />
          <ellipse cx={bx} cy={by + 26} rx={13} ry={16} fill={light} />
          <rect x={bx + 2} y={by + 26} width={10} height={10} rx={1} transform={`rotate(10 ${bx + 7} ${by + 31})`} fill="#7fbf3f" />
          <path d={`M ${bx + 1} ${by + 28} l 3 1 M ${bx + 11} ${by + 37} l 3 1`} stroke={O} strokeWidth={1.2} />
          <ellipse cx={bx - 14} cy={by + 45} rx={10} ry={8} {...f(shade(c.color, -0.12))} />
          <ellipse cx={bx + 14} cy={by + 45} rx={10} ry={8} {...f(shade(c.color, -0.12))} />
          <ellipse cx={bx - 14} cy={by + 45} rx={6} ry={4.5} fill={light} />
          <ellipse cx={bx + 14} cy={by + 45} rx={6} ry={4.5} fill={light} />
          <circle cx={bx - 18} cy={by - 30} r={9} {...f(c.color)} />
          <circle cx={bx + 18} cy={by - 30} r={9} {...f(c.color)} />
          <circle cx={bx - 18} cy={by - 30} r={5} fill={light} />
          <circle cx={bx + 18} cy={by - 30} r={5} fill={light} />
          <circle cx={bx} cy={by - 14} r={22} {...f(c.color)} />
          <ellipse cx={bx} cy={by - 6} rx={9} ry={7} fill={light} />
          <circle cx={bx} cy={by - 9} r={3} fill={O} />
          <path d={`M ${bx} ${by - 7} v 3 M ${bx - 4} ${by - 3} q 4 3 8 0`} fill="none" stroke={O} strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={bx - 8} cy={by - 20} r={2.6} fill={O} />
          <circle cx={bx + 8} cy={by - 20} r={2.6} fill={O} />
          <path d={`M ${bx} ${by + 9} L ${bx - 14} ${by + 3} L ${bx - 14} ${by + 15} Z M ${bx} ${by + 9} L ${bx + 14} ${by + 3} L ${bx + 14} ${by + 15} Z`} fill="#d33b2c" />
          <circle cx={bx} cy={by + 9} r={3.5} fill="#a32a20" />
        </g>
      );
    },
  },
  {
    id: 'football',
    name: 'Football',
    quip: 'Throws a perfect spiral. Into the neighbour\'s window. Every time.',
    colorable: false,
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-30 ${x + 20} ${y - 20})`}>
          <ellipse cx={x + 20} cy={y - 20} rx={36} ry={22} {...f('#8a4a24')} />
          <path d={`M ${x - 16} ${y - 20} Q ${x + 20} ${y - 28} ${x + 56} ${y - 20} Q ${x + 20} ${y + 16} ${x - 16} ${y - 20} Z`} fill="#7a3f1d" />
          <path d={`M ${x - 16} ${y - 20} Q ${x + 20} ${y - 52} ${x + 56} ${y - 20} M ${x - 16} ${y - 20} Q ${x + 20} ${y + 12} ${x + 56} ${y - 20}`} fill="none" stroke="#552a12" strokeWidth={2} />
          <path d={`M ${x - 5} ${y - 35} Q ${x - 11} ${y - 20} ${x - 5} ${y - 5} M ${x + 45} ${y - 35} Q ${x + 51} ${y - 20} ${x + 45} ${y - 5}`} fill="none" stroke="#fff" strokeWidth={4} />
          <path d={`M ${x + 4} ${y - 33} Q ${x + 20} ${y - 40} ${x + 36} ${y - 33}`} fill="none" stroke="#b5703f" strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x + 5} ${y - 20} h 30 M ${x + 9} ${y - 25} v 10 M ${x + 16} ${y - 25} v 10 M ${x + 23} ${y - 25} v 10 M ${x + 30} ${y - 25} v 10`} stroke="#fff" strokeWidth={2.5} />
        </g>
      );
    },
  },
  {
    id: 'coffee',
    name: 'Coffee',
    lean: 12,
    quip: 'Kids should not drink coffee. This one does. Now vibrates at a frequency only dogs can hear.',
    defaultColor: '#2e8b47',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x - 18} ${y - 66} L ${x + 22} ${y - 66} L ${x + 16} ${y + 6} L ${x - 12} ${y + 6} Z`} {...pale('#fff')} />
          <path d={`M ${x - 16} ${y - 74} Q ${x + 2} ${y - 90} ${x + 20} ${y - 74} Z`} {...pale('#f1f1f1')} />
          <rect x={x - 22} y={y - 74} width={48} height={10} rx={4} {...pale('#fff')} />
          <rect x={x + 6} y={y - 82} width={9} height={3} rx={1.5} fill="#7a8791" />
          <path d={`M ${x - 16} ${y - 44} L ${x + 20} ${y - 44} L ${x + 18} ${y - 18} L ${x - 14} ${y - 18} Z`} {...f(c.color)} strokeWidth={2} />
          <path d={`M ${x - 10} ${y - 43} v 24 M ${x + 14} ${y - 43} v 24`} stroke={shade(c.color, -0.2)} strokeWidth={2} />
          <circle cx={x + 2} cy={y - 31} r={8.5} fill="#fff" />
          <ellipse cx={x + 2} cy={y - 31} rx={3.4} ry={5.4} transform={`rotate(24 ${x + 2} ${y - 31})`} fill={c.color} />
          <path d={`M ${x - 4} ${y - 90} q 6 -10 0 -20 M ${x + 8} ${y - 90} q 6 -10 0 -20`} fill="none" stroke="#bbb" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'snowball',
    name: 'Snowball',
    quip: 'Pre-packed with ice. And a rock. Pure evil in sphere form.',
    colorable: false,
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={scallop(x + 14, y - 26, 27, 27, 9, 0.05)} {...pale('#f2f7ff')} stroke="#9fbcd8" />
          <path d={`M ${x + 28} ${y - 42} q 16 14 4 32 q -14 12 -32 4 q 22 -2 28 -36 Z`} fill="#cfe0f2" />
          <path d={`M ${x + 8} ${y - 26} l 7 -8 l 10 1 l 4 8 l -6 7 l -11 -1 Z`} fill="#8e8c92" />
          <path d={`M ${x + 15} ${y - 34} l 10 1 l -4 5 Z`} fill="#b4b2b8" />
          <path d={`M ${x} ${y - 38} q 8 -9 18 -5`} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
          <path d={dots([[x + 2, y - 16], [x + 30, y - 40], [x + 32, y - 22]])} stroke="#b5cde4" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'icecream',
    name: 'Ice Cream',
    lean: 24,
    quip: 'Three scoops. In a blizzard. Commitment.',
    defaultColor: '#f27bb4',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x - 14} ${y - 42} L ${x + 30} ${y - 42} L ${x + 8} ${y + 10} Z`} {...f('#e9b86b')} />
          <path d={`M ${x - 6} ${y - 40} L ${x + 15} ${y - 6} M ${x + 6} ${y - 40} L ${x + 20} ${y - 16} M ${x + 22} ${y - 40} L ${x + 1} ${y - 6} M ${x + 10} ${y - 40} L ${x - 3} ${y - 18}`} stroke="#b07a3a" strokeWidth={2} />
          <path d={`M ${x - 14} ${y - 42} L ${x + 30} ${y - 42} L ${x + 27} ${y - 35} L ${x - 11} ${y - 35} Z`} fill="#d99a4e" />
          <path d={drape(x + 8, y - 44, 23)} fill={shade(c.color, -0.1)} />
          <path d={`M ${x + 14} ${y - 42} q 0 14 4 14 q 4 0 4 -14 Z`} fill={shade(c.color, -0.1)} />
          <circle cx={x + 8} cy={y - 56} r={20} {...f(c.color)} />
          <ellipse cx={x + 1} cy={y - 63} rx={5} ry={7} transform={`rotate(30 ${x + 1} ${y - 63})`} fill="#fff" opacity={0.45} />
          <path d={drape(x + 8, y - 73, 20)} fill="#f0e2bb" />
          <circle cx={x + 8} cy={y - 86} r={18} {...f('#fff6dc')} />
          <path d={dots([[x + 14, y - 92], [x + 18, y - 82], [x + 8, y - 78], [x, y - 88]])} stroke="#c9a56a" strokeWidth={2} strokeLinecap="round" />
          <path d={drape(x + 8, y - 100, 18)} fill="#5e3820" />
          <circle cx={x + 8} cy={y - 112} r={16} {...f('#7a4a2a')} />
          <path d={`M ${x + 2} ${y - 118} l 4 -3 M ${x + 16} ${y - 112} l 3 4 M ${x + 4} ${y - 104} l 5 1`} stroke="#f2c230" strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x + 12} ${y - 120} l 4 2 M ${x - 2} ${y - 110} l 2 4 M ${x + 14} ${y - 102} l 4 -2`} stroke="#7fd4ff" strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x + 10} ${y - 136} q 2 -10 10 -12`} fill="none" stroke="#3f7d3a" strokeWidth={2} strokeLinecap="round" />
          <circle cx={x + 10} cy={y - 132} r={6} fill="#d33b2c" {...ink} strokeWidth={2} />
          <circle cx={x + 8} cy={y - 134} r={1.8} fill="#fff" opacity={0.8} />
        </g>
      );
    },
  },
  {
    id: 'trophy',
    name: 'Trophy',
    lean: 14,
    quip: 'Participation trophy. Very shiny. Says "You Tried!" on the bottom.',
    defaultColor: '#f2c230',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <rect x={x - 16} y={y - 6} width={48} height={16} rx={3} {...f('#7a4a2a')} />
          <rect x={x - 3} y={y - 3} width={22} height={9} rx={1} fill="#f2e2b8" />
          <path d={`M ${x + 1} ${y + 1.5} h 14`} stroke="#8a6a3a" strokeWidth={2} />
          <rect x={x - 8} y={y - 12} width={32} height={7} rx={2} fill="#5e3820" />
          <rect x={x + 2} y={y - 26} width={12} height={16} {...f(c.color)} />
          <ellipse cx={x + 8} cy={y - 24} rx={10} ry={4} fill={shade(c.color, -0.18)} />
          <path d={`M ${x - 18} ${y - 92} L ${x + 34} ${y - 92} Q ${x + 34} ${y - 30} ${x + 8} ${y - 26} Q ${x - 18} ${y - 30} ${x - 18} ${y - 92} Z`} {...f(c.color)} />
          <path d={`M ${x + 20} ${y - 92} L ${x + 34} ${y - 92} Q ${x + 34} ${y - 30} ${x + 8} ${y - 26} Q ${x + 22} ${y - 42} ${x + 20} ${y - 92} Z`} fill={shade(c.color, -0.18)} />
          <path d={`M ${x - 11} ${y - 84} Q ${x - 11} ${y - 54} ${x - 2} ${y - 42}`} fill="none" stroke={shade(c.color, 0.55)} strokeWidth={4} strokeLinecap="round" />
          <rect x={x - 22} y={y - 97} width={60} height={8} rx={3} fill={shade(c.color, 0.22)} />
          <path d={`M ${x - 18} ${y - 82} q -20 4 -14 22 q 4 10 16 8 M ${x + 34} ${y - 82} q 20 4 14 22 q -4 10 -16 8`} fill="none" stroke={O} strokeWidth={6} />
          <path d={`M ${x - 18} ${y - 82} q -20 4 -14 22 q 4 10 16 8 M ${x + 34} ${y - 82} q 20 4 14 22 q -4 10 -16 8`} fill="none" stroke={c.color} strokeWidth={3} />
          <path d={starPath(x + 8, y - 66, 12)} fill="#fff6c4" stroke={O} strokeWidth={1.2} />
        </g>
      );
    },
  },
  {
    id: 'flower',
    name: 'Flower',
    lean: 22,
    quip: 'For you. Or for the teacher. Fine, it is for the teacher.',
    defaultColor: '#f2c230',
    render: (c) => {
      const [x, y] = hand(c);
      const fx = x + 10;
      const fy = y - 122;
      const ticks = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4 + 0.39;
        return `M ${fx + Math.cos(a) * 13} ${fy + Math.sin(a) * 13} L ${fx + Math.cos(a) * 20} ${fy + Math.sin(a) * 20}`;
      }).join(' ');
      return (
        <g>
          <path d={`M ${x + 4} ${y + 6} Q ${x + 16} ${y - 60} ${x + 10} ${y - 110}`} fill="none" stroke="#2e8b47" strokeWidth={5} />
          <path d={`M ${x + 12} ${y - 50} q 18 -10 26 4 q -14 8 -26 -4 Z`} fill="#7fbf3f" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 11} ${y - 76} q -18 -8 -24 7 q 14 7 24 -7 Z`} fill="#7fbf3f" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 15} ${y - 49} q 10 -2 20 3 M ${x + 8} ${y - 75} q -8 -1 -18 6`} fill="none" stroke="#4f9a2b" strokeWidth={1.6} />
          <path d={scallop(fx, fy, 24, 24, 8, 0.25)} {...pale('#fff')} />
          <path d={ticks} stroke="#d5dbe2" strokeWidth={2} strokeLinecap="round" />
          <circle cx={fx} cy={fy} r={10} {...f(c.color)} strokeWidth={2} />
          <path d={dots([[fx - 4, fy - 3], [fx + 3, fy - 4], [fx, fy + 1], [fx - 3, fy + 5], [fx + 5, fy + 3]])} stroke={shade(c.color, -0.3)} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'controller',
    name: 'Game Controller',
    quip: 'Gamer. Has opinions. Has screamed at a twelve-year-old online. Is eleven.',
    defaultColor: '#55555a',
    render: (c) => {
      const [x, y] = hand(c);
      const dark = shade(c.color, -0.36);
      return (
        <g transform={`rotate(-14 ${x} ${y})`}>
          <rect x={x - 36} y={y - 42} width={28} height={10} rx={4} fill={dark} />
          <rect x={x + 28} y={y - 42} width={28} height={10} rx={4} fill={dark} />
          <path d={`M ${x - 30} ${y - 36} L ${x + 50} ${y - 36} Q ${x + 66} ${y - 36} ${x + 66} ${y - 18} Q ${x + 66} ${y + 4} ${x + 50} ${y} L ${x - 30} ${y} Q ${x - 46} ${y + 4} ${x - 46} ${y - 18} Q ${x - 46} ${y - 36} ${x - 30} ${y - 36} Z`} {...f(c.color)} />
          <path d={`M ${x - 44} ${y - 10} Q ${x - 44} ${y + 3} ${x - 30} ${y} L ${x + 50} ${y} Q ${x + 64} ${y + 3} ${x + 64} ${y - 10} Q ${x + 10} ${y - 2} ${x - 44} ${y - 10} Z`} fill={shade(c.color, -0.16)} />
          <path d={`M ${x - 32} ${y - 18} h 16 M ${x - 24} ${y - 26} v 16`} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${x - 6} ${y - 28} h 7 M ${x + 10} ${y - 28} h 7`} stroke="#c9c9c9" strokeWidth={3} strokeLinecap="round" />
          <circle cx={x + 16} cy={y - 13} r={8} fill={dark} />
          <circle cx={x + 16} cy={y - 13} r={4.5} fill={shade(c.color, 0.3)} />
          <circle cx={x + 40} cy={y - 28} r={4.5} fill="#f2c230" />
          <circle cx={x + 50} cy={y - 19} r={4.5} fill="#d33b2c" />
          <circle cx={x + 40} cy={y - 10} r={4.5} fill="#7fbf3f" />
          <circle cx={x + 30} cy={y - 19} r={4.5} fill="#3b6fd8" />
        </g>
      );
    },
  },
  {
    id: 'pizza',
    name: 'Pizza Slice',
    lean: 16,
    quip: 'Cold pizza for breakfast. A balanced diet, technically.',
    colorable: false,
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-20 ${x} ${y})`}>
          <path d={`M ${x - 26} ${y - 6} L ${x + 34} ${y - 6} L ${x + 4} ${y - 100} Z`} {...f('#f2c230')} />
          <path d={`M ${x - 18} ${y - 10} Q ${x - 2} ${y - 22} ${x + 24} ${y - 10} L ${x + 10} ${y - 54} Q ${x + 4} ${y - 40} ${x - 2} ${y - 58} Z`} fill="#f7dc6e" />
          <path d={`M ${x + 18} ${y - 54} q 12 18 9 34 q -2 7 -6 1 q -2 -11 -10 -24 Z`} fill="#f2c230" />
          <path d={`M ${x - 30} ${y - 6} L ${x + 38} ${y - 6} L ${x + 36} ${y + 6} L ${x - 28} ${y + 6} Z`} {...f('#d99a4e')} />
          <path d={`M ${x - 30} ${y - 6} L ${x + 38} ${y - 6} L ${x + 37.4} ${y - 3} L ${x - 29.4} ${y - 3} Z`} fill="#b5742f" />
          <path d={`M ${x + 14} ${y + 1} h 16`} stroke="#eabf80" strokeWidth={3} strokeLinecap="round" />
          <circle cx={x + 2} cy={y - 34} r={7} fill="#d33b2c" />
          <circle cx={x + 14} cy={y - 18} r={6} fill="#d33b2c" />
          <circle cx={x - 8} cy={y - 16} r={5} fill="#d33b2c" />
          <circle cx={x + 4} cy={y - 62} r={5} fill="#d33b2c" />
          <path d={dots([[x, y - 36], [x + 4, y - 32], [x + 12, y - 20], [x + 16, y - 16], [x - 9, y - 17], [x + 3, y - 63]])} stroke="#9c2319" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={x + 14} cy={y - 36} r={3} fill="none" stroke="#3d3d44" strokeWidth={2.2} />
          <circle cx={x - 7} cy={y - 28} r={3} fill="none" stroke="#3d3d44" strokeWidth={2.2} />
          <path d={`M ${x + 2} ${y - 18} q 4 -5 8 -1 M ${x + 2} ${y - 48} q 5 -3 7 2`} fill="none" stroke="#3f9a3a" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'megaphone',
    name: 'Megaphone',
    lean: 6,
    quip: 'Indoor voice? Never heard of her.',
    defaultColor: '#f2c230',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-14 ${x} ${y})`}>
          <rect x={x - 3} y={y - 16} width={14} height={30} rx={4} {...f('#55555a')} />
          <path d={`M ${x - 18} ${y - 34} L ${x + 66} ${y - 66} L ${x + 66} ${y + 14} L ${x - 18} ${y - 18} Z`} {...f(c.color)} />
          <path d={`M ${x + 18} ${y - 48} L ${x + 34} ${y - 54} L ${x + 34} ${y - 1} L ${x + 18} ${y - 5} Z`} fill="#fff" />
          <rect x={x - 32} y={y - 36} width={16} height={20} rx={4} {...f('#55555a')} />
          <ellipse cx={x + 66} cy={y - 26} rx={15} ry={41} {...f(shade(c.color, -0.2))} />
          <ellipse cx={x + 68} cy={y - 26} rx={9} ry={30} fill={shade(c.color, -0.55)} />
        </g>
      );
    },
  },
  {
    id: 'book',
    name: 'Book',
    lean: 12,
    quip: '"How to Be Cool, Vol. 1". Has read it 14 times. Still not cool.',
    defaultColor: '#3b6fd8',
    render: (c) => {
      const [x, y] = hand(c);
      const onCover = inkOn(c.color);
      const trim = shade(c.color, 0.42);
      return (
        <g transform={`rotate(-8 ${x} ${y})`}>
          <rect x={x + 28} y={y} width={8} height={15} fill="#d33b2c" />
          <path d={`M ${x + 28} ${y + 15} l 4 -4 l 4 4 Z`} fill="#fff" />
          <rect x={x + 46} y={y - 77} width={7} height={74} fill="#f7f1df" />
          <path d={`M ${x + 49} ${y - 75} v 70 M ${x + 51.5} ${y - 75} v 70`} stroke="#cfc7ae" strokeWidth={1} />
          <rect x={x - 10} y={y - 80} width={58} height={80} rx={3} {...f(c.color)} />
          <rect x={x - 10} y={y - 80} width={10} height={80} fill={shade(c.color, -0.3)} stroke={O} strokeWidth={2} />
          <path d={`M ${x - 9} ${y - 70} h 8 M ${x - 9} ${y - 66} h 8 M ${x - 9} ${y - 14} h 8 M ${x - 9} ${y - 10} h 8`} stroke="#f2c230" strokeWidth={2} />
          <rect x={x + 4} y={y - 75} width={40} height={70} rx={1} fill="none" stroke={trim} strokeWidth={1.8} />
          <PartText x={x + 24} y={y - 57} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={11} fill={onCover}>
            HOW TO
          </PartText>
          <PartText x={x + 24} y={y - 43} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={11} fill={onCover}>
            BE COOL
          </PartText>
          <path d={`M ${x + 10} ${y - 32} h 28 M ${x + 11} ${y - 32} q 0 9 6 9 q 6 0 6 -9 Z M ${x + 25} ${y - 32} q 0 9 6 9 q 6 0 6 -9 Z`} fill={onCover} stroke={onCover} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      );
    },
  },
  {
    id: 'cane',
    name: 'Walking Cane',
    quip: 'Get off my lawn. You. Yes, you. And your little dog too.',
    defaultColor: '#7a4a2a',
    render: (c) => {
      const [x, y] = hand(c);
      const line = `M ${x + 8} ${c.g.footY + 6} L ${x + 8} ${y - 20} Q ${x + 8} ${y - 46} ${x - 14} ${y - 46} Q ${x - 32} ${y - 46} ${x - 32} ${y - 28}`;
      return (
        <g>
          <path d={line} fill="none" stroke={O} strokeWidth={13} strokeLinecap="round" />
          <path d={line} fill="none" stroke={c.color} strokeWidth={8} strokeLinecap="round" />
          <path d={line} fill="none" stroke={shade(c.color, 0.26)} strokeWidth={1.8} strokeDasharray="22 13" />
          <path d={`M ${x + 8} ${c.g.footY - 12} L ${x + 8} ${c.g.footY + 6}`} stroke="#2b2b2f" strokeWidth={11} strokeLinecap="round" />
          <path d={`M ${x + 3} ${c.g.footY - 15} h 10`} stroke="#c9c9c9" strokeWidth={5} />
          <path d={`M ${x + 2} ${y - 24} h 12`} stroke="#f2c230" strokeWidth={6} />
          <circle cx={x - 32} cy={y - 27} r={7} fill="#f2c230" />
        </g>
      );
    },
  },
  {
    id: 'chicken',
    name: 'Rubber Chicken',
    lean: 16,
    quip: 'Comedy gold. Squeaks when squeezed. Squeezed 400 times a day.',
    colorable: false,
    render: (c) => {
      const [x, y] = hand(c);
      const yellow = '#f2d340';
      const deep = '#d9b82a';
      return (
        <g transform={`rotate(10 ${x} ${y})`}>
          <path d={`M ${x + 5} ${y + 66} l -8 18 m 8 -18 l 0 20 m 0 -20 l 8 18 M ${x + 15} ${y + 66} l -4 18 m 4 -18 l 4 20 m -4 -20 l 10 16`} fill="none" stroke="#f0742a" strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x - 4} ${y - 4} Q ${x - 10} ${y + 60} ${x + 10} ${y + 70} Q ${x + 30} ${y + 60} ${x + 18} ${y - 4} Z`} {...f(yellow)} />
          <path d={`M ${x - 5} ${y + 16} q -18 6 -15 28 q 10 -4 17 -12 Z M ${x + 22} ${y + 16} q 18 6 15 28 q -10 -4 -17 -12 Z`} fill={deep} />
          <path d={dots([[x + 2, y + 24], [x + 12, y + 22], [x + 7, y + 34], [x + 16, y + 40], [x, y + 44], [x + 9, y + 52], [x + 18, y + 54]])} stroke={deep} strokeWidth={2.6} strokeLinecap="round" />
          <path d={`M ${x + 6} ${y - 4} L ${x + 4} ${y - 60}`} stroke={O} strokeWidth={12} strokeLinecap="round" />
          <path d={`M ${x + 6} ${y - 4} L ${x + 4} ${y - 60}`} stroke={yellow} strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 1} ${y - 46} h 7 M ${x + 1} ${y - 38} h 7 M ${x + 1} ${y - 30} h 7`} stroke={deep} strokeWidth={2} />
          <circle cx={x + 4} cy={y - 70} r={13} {...f(yellow)} />
          <path d={`M ${x - 4} ${y - 84} q 4 -10 8 0 q 4 -10 8 0`} fill="#e5322d" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 14} ${y - 74} L ${x + 28} ${y - 70} L ${x + 14} ${y - 66} Z`} fill="#f0742a" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 14} ${y - 66} L ${x + 24} ${y - 60} L ${x + 11} ${y - 60} Z`} fill="#c95a18" />
          <path d={`M ${x + 8} ${y - 60} q 6 8 0 12 q -7 -4 0 -12 Z`} fill="#e5322d" />
          <path d={`M ${x - 2} ${y - 74} l 6 6 M ${x + 4} ${y - 74} l -6 6`} stroke={O} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'fish',
    name: 'Fresh Fish',
    quip: 'Smells like victory. And fish. Mostly fish.',
    defaultColor: '#5aaeea',
    render: (c) => {
      const [x, y] = hand(c);
      const dark = shade(c.color, -0.2);
      return (
        <g transform={`rotate(-70 ${x} ${y})`}>
          <path d={`M ${x + 8} ${y - 15} q 16 -22 40 -6 Z`} fill={dark} />
          <path d={`M ${x - 10} ${y - 4} L ${x - 30} ${y - 22} L ${x - 30} ${y + 14} Z`} {...f(dark)} />
          <path d={`M ${x - 14} ${y - 6} l -12 -9 M ${x - 14} ${y - 4} l -13 0 M ${x - 14} ${y - 2} l -12 9`} stroke={shade(c.color, -0.38)} strokeWidth={1.8} />
          <path d={`M ${x - 10} ${y - 4} Q ${x + 30} ${y - 34} ${x + 74} ${y - 4} Q ${x + 30} ${y + 26} ${x - 10} ${y - 4} Z`} {...f(c.color)} />
          <path d={`M ${x - 10} ${y - 4} Q ${x + 30} ${y + 26} ${x + 74} ${y - 4} Q ${x + 30} ${y + 2} ${x - 10} ${y - 4} Z`} fill={shade(c.color, 0.55)} />
          <path d={`M ${x + 8} ${y - 12} q 5 4 0 8 M ${x + 18} ${y - 15} q 5 4 0 8 M ${x + 28} ${y - 17} q 5 4 0 8 M ${x + 38} ${y - 16} q 5 4 0 8 M ${x + 13} ${y - 7} q 5 3 0 6 M ${x + 23} ${y - 8} q 5 3 0 6 M ${x + 33} ${y - 8} q 5 3 0 6`} fill="none" stroke={shade(c.color, -0.22)} strokeWidth={1.8} />
          <path d={`M ${x + 48} ${y - 16} q 8 12 0 24`} fill="none" stroke={shade(c.color, -0.34)} strokeWidth={2.4} />
          <path d={`M ${x + 30} ${y + 2} q 14 4 2 14 q -8 -4 -2 -14 Z`} fill={dark} />
          <path d={`M ${x + 74} ${y - 4} l -9 3`} stroke={shade(c.color, -0.45)} strokeWidth={2} />
          <circle cx={x + 58} cy={y - 8} r={4} fill="#fff" stroke={O} strokeWidth={1.5} />
          <path d={`M ${x + 56} ${y - 10} l 4 4 M ${x + 60} ${y - 10} l -4 4`} stroke={O} strokeWidth={1.2} />
        </g>
      );
    },
  },
  {
    id: 'plunger',
    name: 'Plunger',
    lean: 16,
    quip: "Don't ask. Seriously. Just don't.",
    defaultColor: '#d33b2c',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x + 6} ${y + 10} L ${x + 14} ${y - 120}`} stroke={O} strokeWidth={12} strokeLinecap="round" />
          <path d={`M ${x + 6} ${y + 10} L ${x + 14} ${y - 120}`} stroke="#c9a07a" strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 10} ${y - 20} L ${x + 13} ${y - 70} M ${x + 11} ${y - 80} L ${x + 13} ${y - 104}`} stroke="#a67f5b" strokeWidth={1.8} strokeLinecap="round" />
          <path d={`M ${x + 4} ${y - 112} Q ${x - 30} ${y - 128} ${x - 34} ${y - 168} L ${x + 62} ${y - 168} Q ${x + 58} ${y - 128} ${x + 24} ${y - 112} Z`} {...f(c.color)} />
          <path d={`M ${x + 34} ${y - 168} L ${x + 62} ${y - 168} Q ${x + 58} ${y - 128} ${x + 24} ${y - 112} L ${x + 14} ${y - 112} Q ${x + 36} ${y - 134} ${x + 34} ${y - 168} Z`} fill={shade(c.color, -0.16)} />
          <path d={`M ${x - 22} ${y - 148} Q ${x + 14} ${y - 136} ${x + 50} ${y - 148} M ${x - 12} ${y - 132} Q ${x + 14} ${y - 122} ${x + 40} ${y - 132}`} fill="none" stroke={shade(c.color, -0.32)} strokeWidth={3} />
          <rect x={x + 3} y={y - 116} width={22} height={8} rx={3} fill={shade(c.color, -0.34)} />
          <ellipse cx={x + 14} cy={y - 168} rx={48} ry={11} {...f(shade(c.color, -0.5))} />
          <ellipse cx={x + 14} cy={y - 168} rx={34} ry={6} fill={shade(c.color, -0.68)} />
        </g>
      );
    },
  },
  {
    id: 'tp',
    name: 'Toilet Paper',
    quip: "For TP-ing the principal's house. Allegedly. No further comment.",
    colorable: false,
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x + 30} ${y - 10} Q ${x + 70} ${y + 30} ${x + 50} ${y + 80} Q ${x + 40} ${y + 110} ${x + 70} ${y + 120}`} fill="none" stroke="#c4d0dc" strokeWidth={16} />
          <path d={`M ${x + 30} ${y - 10} Q ${x + 70} ${y + 30} ${x + 50} ${y + 80} Q ${x + 40} ${y + 110} ${x + 70} ${y + 120}`} fill="none" stroke="#fdfdfd" strokeWidth={12} />
          <path d={`M ${x + 30} ${y - 10} Q ${x + 70} ${y + 30} ${x + 50} ${y + 80} Q ${x + 40} ${y + 110} ${x + 70} ${y + 120}`} fill="none" stroke={O} strokeWidth={1.5} strokeDasharray="1 7" />
          <ellipse cx={x + 16} cy={y - 22} rx={22} ry={26} {...pale('#fdfdfd')} />
          <path d={`M ${x + 16} ${y - 40} a 13 16 0 1 1 -2 0 M ${x + 16} ${y - 44} a 18 21 0 0 1 16 16`} fill="none" stroke="#d5dde5" strokeWidth={2} />
          <ellipse cx={x + 16} cy={y - 22} rx={7} ry={9} fill="#c9a07a" stroke={O} strokeWidth={1.5} />
          <ellipse cx={x + 16} cy={y - 22} rx={4} ry={5.5} fill="#8a6a44" />
        </g>
      );
    },
  },
  {
    id: 'pennant',
    name: 'Team Pennant',
    lean: 12,
    quip: 'Go team! Which team? Does it matter? GO TEAM!',
    defaultColor: '#8a1f2b',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x + 6} ${y + 8} L ${x + 10} ${y - 120}`} stroke={O} strokeWidth={8} strokeLinecap="round" />
          <circle cx={x + 10} cy={y - 125} r={6.5} fill="#f2c230" />
          <path d={`M ${x + 10} ${y - 120} L ${x + 120} ${y - 96} L ${x + 9} ${y - 66} Z`} {...f(c.color)} />
          <path d={`M ${x + 10} ${y - 120} L ${x + 28} ${y - 116} L ${x + 27} ${y - 71} L ${x + 9} ${y - 66} Z`} fill={accent(c.color)} />
          <path d={starPath(x + 18, y - 93, 7)} fill={c.color} />
          <PartText x={x + 62} y={y - 89} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={13} fill={accent(c.color)}>
            GO TEAM
          </PartText>
        </g>
      );
    },
  },
  {
    id: 'cash',
    name: 'Wad of Cash',
    quip: 'Forty-three dollars. In ones. Earned honestly. Mostly.',
    defaultColor: '#7fbf3f',
    render: (c) => {
      const [x, y] = hand(c);
      const line = shade(c.color, -0.35);
      const dollar = { textAnchor: 'middle', fontFamily: "'Luckiest Guy', 'Arial Black', sans-serif", fill: shade(c.color, -0.45) } as const;
      return (
        <g transform={`rotate(-14 ${x} ${y})`}>
          {[-16, 0, 16].map((a) => (
            <g key={a} transform={`rotate(${a} ${x + 6} ${y + 4})`}>
              <rect x={x - 12} y={y - 62} width={40} height={66} rx={3} {...f(c.color)} strokeWidth={2} />
              <rect x={x - 8} y={y - 58} width={32} height={58} rx={2} fill="none" stroke={line} strokeWidth={1.5} />
              <ellipse cx={x + 8} cy={y - 29} rx={10} ry={13} fill={shade(c.color, 0.32)} stroke={line} strokeWidth={2} />
              <PartText x={x + 8} y={y - 22} fontSize={18} {...dollar}>
                $
              </PartText>
              <PartText x={x - 3} y={y - 47} fontSize={9} {...dollar}>
                1
              </PartText>
              <PartText x={x + 19} y={y - 4} fontSize={9} {...dollar}>
                1
              </PartText>
            </g>
          ))}
        </g>
      );
    },
  },
  {
    id: 'gift',
    name: 'Gift Box',
    quip: 'It is socks. It is always socks.',
    defaultColor: '#d33b2c',
    render: (c) => {
      const [x, y] = hand(c);
      const ribbon = '#f2c230';
      const crease = '#c99a1a';
      return (
        <g>
          <path d={`M ${x + 46} ${y - 46} q 14 2 16 14`} fill="none" stroke="#8a8a8a" strokeWidth={1.8} />
          <rect x={x - 12} y={y - 62} width={64} height={66} rx={3} {...f(c.color)} />
          <path d={dots([[x - 2, y - 44], [x + 40, y - 44], [x + 2, y - 10], [x + 42, y - 12], [x + 34, y - 4]])} stroke={shade(c.color, 0.32)} strokeWidth={7} strokeLinecap="round" />
          <rect x={x + 14} y={y - 62} width={12} height={66} fill={ribbon} stroke={O} strokeWidth={1.5} />
          <rect x={x - 12} y={y - 36} width={64} height={12} fill={ribbon} stroke={O} strokeWidth={1.5} />
          <path d={`M ${x + 20} ${y - 48} v 52 M ${x - 12} ${y - 30} h 64`} stroke={crease} strokeWidth={1.6} />
          <rect x={x - 16} y={y - 66} width={72} height={18} rx={3} fill={shade(c.color, 0.12)} />
          <rect x={x - 16} y={y - 51} width={72} height={3} fill={shade(c.color, -0.26)} />
          <rect x={x + 13} y={y - 66} width={14} height={18} fill={ribbon} />
          <path d={`M ${x + 20} ${y - 66} l -11 17 l 7 -2 l 3 6 Z M ${x + 20} ${y - 66} l 11 17 l -7 -2 l -3 6 Z`} fill={crease} />
          <path d={`M ${x + 20} ${y - 66} q -26 -26 -30 -4 q 4 10 30 4 q 26 -26 30 -4 q -4 10 -30 4 Z`} fill={ribbon} {...ink} strokeWidth={2} />
          <path d={`M ${x + 15} ${y - 68} q -14 -12 -19 -3 q 6 5 19 3 Z M ${x + 25} ${y - 68} q 14 -12 19 -3 q -6 5 -19 3 Z`} fill={crease} />
          <circle cx={x + 20} cy={y - 66} r={6} fill={ribbon} />
          <g transform={`rotate(12 ${x + 62} ${y - 28})`}>
            <path d={`M ${x + 55} ${y - 32} l 7 -5 l 7 5 l 0 18 l -14 0 Z`} fill="#fff" stroke="#b9c2cc" strokeWidth={1.5} />
            <circle cx={x + 62} cy={y - 31} r={1.8} fill="#8a8a8a" />
            <path d={`M ${x + 58} ${y - 25} h 8 M ${x + 58} ${y - 20} h 6`} stroke="#d33b2c" strokeWidth={1.6} />
          </g>
        </g>
      );
    },
  },
  {
    id: 'letter',
    name: 'Love Letter',
    quip: 'Do you like me? Check yes or no. Has been carried around for six weeks.',
    defaultColor: '#ffffff',
    render: (c) => {
      const [x, y] = hand(c);
      const fold = shade(c.color, -0.2);
      return (
        <g transform={`rotate(-12 ${x} ${y})`}>
          <rect x={x - 14} y={y - 52} width={76} height={50} rx={3} {...pale(c.color)} />
          <path d={`M ${x - 13} ${y - 3} L ${x + 13} ${y - 29} M ${x + 61} ${y - 3} L ${x + 35} ${y - 29}`} stroke={fold} strokeWidth={1.6} />
          <path d={`M ${x - 14} ${y - 52} L ${x + 24} ${y - 22} L ${x + 62} ${y - 52} Z`} fill={shade(c.color, -0.07)} />
          <path d={`M ${x - 14} ${y - 52} L ${x + 24} ${y - 22} L ${x + 62} ${y - 52}`} fill="none" stroke={O} strokeWidth={2} />
          <path d={`M ${x + 24} ${y - 14} C ${x + 6} ${y - 27} ${x + 13} ${y - 42} ${x + 24} ${y - 32} C ${x + 35} ${y - 42} ${x + 42} ${y - 27} ${x + 24} ${y - 14} Z`} fill="#e5322d" stroke={O} strokeWidth={1.5} />
          <path d={`M ${x + 17} ${y - 32} q 2 -3 4 -1`} fill="none" stroke="#ff9a94" strokeWidth={2} strokeLinecap="round" />
          <path d={`M ${x + 70} ${y - 58} C ${x + 63} ${y - 63} ${x + 66} ${y - 69} ${x + 70} ${y - 65} C ${x + 74} ${y - 69} ${x + 77} ${y - 63} ${x + 70} ${y - 58} Z M ${x + 55} ${y - 66} C ${x + 50} ${y - 70} ${x + 52} ${y - 74} ${x + 55} ${y - 71} C ${x + 58} ${y - 74} ${x + 60} ${y - 70} ${x + 55} ${y - 66} Z`} fill="#f27bb4" />
        </g>
      );
    },
  },
  {
    id: 'remote',
    name: 'TV Remote',
    quip: 'Holder of the remote. Ruler of the living room. Do not challenge the remote.',
    defaultColor: '#3d3d44',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-24 ${x} ${y})`}>
          <rect x={x - 4} y={y - 84} width={30} height={92} rx={8} {...f(c.color)} />
          <rect x={x + 2} y={y - 84} width={18} height={5} rx={2} fill="#7a1f1a" />
          <circle cx={x + 11} cy={y - 71} r={5} fill="#d33b2c" />
          <circle cx={x + 11} cy={y - 53} r={10} fill={shade(c.color, 0.28)} />
          <circle cx={x + 11} cy={y - 53} r={4.5} fill="#c9c9c9" />
          {['#d33b2c', '#7fbf3f', '#f2c230', '#3b6fd8'].map((color, i) => (
            <rect key={color} x={x + 1 + i * 6} y={y - 39} width={4.5} height={4} rx={1} fill={color} />
          ))}
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((col) => <rect key={`${r},${col}`} x={x + 1 + col * 8} y={y - 31 + r * 9} width={6} height={6} rx={1.5} fill="#c9c9c9" />),
          )}
        </g>
      );
    },
  },
  {
    id: 'soda',
    name: 'Giant Soda',
    lean: 14,
    quip: 'The 64-ounce Thirst Destroyer. Nobody has ever finished one. Nobody.',
    defaultColor: '#d33b2c',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x - 14} ${y - 102} Q ${x + 8} ${y - 120} ${x + 30} ${y - 102} Z`} {...f('#e4e4e4')} />
          <path d={`M ${x - 18} ${y - 92} L ${x + 34} ${y - 92} L ${x + 26} ${y + 8} L ${x - 10} ${y + 8} Z`} {...f(c.color)} />
          <path d={`M ${x + 22} ${y - 90} L ${x + 34} ${y - 92} L ${x + 26} ${y + 8} L ${x + 16} ${y + 8} Z`} fill={shade(c.color, -0.16)} />
          <path d={`M ${x - 17.4} ${y - 84} L ${x + 33.4} ${y - 84} L ${x + 32.8} ${y - 77} L ${x - 16.8} ${y - 77} Z M ${x - 11.6} ${y - 14} L ${x + 27.6} ${y - 14} L ${x + 27} ${y - 7} L ${x - 11} ${y - 7} Z`} fill="#f2c230" />
          <path d={`M ${x - 14} ${y - 66} L ${x + 30} ${y - 66} L ${x + 28} ${y - 38} L ${x - 12} ${y - 38} Z`} fill="#fff" />
          <PartText x={x + 8} y={y - 46} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={15} fill={c.color}>
            64 OZ
          </PartText>
          <path d={dots([[x + 25, y - 30], [x + 20, y - 22], [x - 8, y - 28], [x - 6, y - 70], [x + 26, y - 70]])} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />
          <rect x={x - 22} y={y - 102} width={60} height={12} rx={5} {...f('#f4f4f4')} />
          <path d={`M ${x + 12} ${y - 108} L ${x + 22} ${y - 144} L ${x + 34} ${y - 146}`} fill="none" stroke={O} strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 12} ${y - 108} L ${x + 22} ${y - 144} L ${x + 34} ${y - 146}`} fill="none" stroke="#f2c230" strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${x + 12} ${y - 108} L ${x + 22} ${y - 144}`} fill="none" stroke="#d33b2c" strokeWidth={4} strokeDasharray="5 6" />
        </g>
      );
    },
  },
  {
    id: 'bag',
    name: 'Grocery Bag',
    lean: 12,
    quip: 'Milk, eggs and nineteen bags of chips. Mom said "groceries". These are groceries.',
    defaultColor: '#c9a07a',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x + 20} ${y - 76} L ${x + 34} ${y - 130} L ${x + 44} ${y - 128} L ${x + 34} ${y - 76} Z`} {...f('#f2d38a')} strokeWidth={2} />
          <path d={`M ${x + 31} ${y - 118} l 8 3 M ${x + 28} ${y - 106} l 8 3 M ${x + 25} ${y - 94} l 8 3`} stroke="#c9a25c" strokeWidth={2.4} strokeLinecap="round" />
          <path d={`M ${x + 2} ${y - 78} L ${x + 2} ${y - 106} L ${x + 8} ${y - 118} L ${x + 20} ${y - 118} L ${x + 26} ${y - 106} L ${x + 26} ${y - 78} Z`} {...pale('#fdfdfd')} />
          <path d={`M ${x + 2} ${y - 106} L ${x + 26} ${y - 106} L ${x + 26} ${y - 96} L ${x + 2} ${y - 96} Z M ${x + 8} ${y - 122} h 12 v 4 h -12 Z`} fill="#3b6fd8" />
          <path d={`M ${x - 6} ${y - 78} q -6 -34 10 -40 q 6 22 2 40 Z`} fill="#7fbf3f" {...ink} strokeWidth={2} />
          <path d={`M ${x - 3} ${y - 80} q -2 -20 5 -32`} fill="none" stroke="#4f9a2b" strokeWidth={2} />
          <path d={`M ${x - 22} ${y - 80} L ${x + 50} ${y - 80} L ${x + 46} ${y + 16} L ${x - 18} ${y + 16} Z`} {...f(c.color)} />
          <path d={`M ${x + 34} ${y - 74} L ${x + 50} ${y - 80} L ${x + 46} ${y + 16} L ${x + 34} ${y + 16} Z`} fill={shade(c.color, -0.14)} />
          <path d={`M ${x - 22} ${y - 80} l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8`} fill="none" stroke={shade(c.color, -0.3)} strokeWidth={2} />
          <path d={`M ${x - 19} ${y + 4} L ${x + 34} ${y + 4}`} stroke={shade(c.color, -0.22)} strokeWidth={2} />
          <circle cx={x + 10} cy={y - 40} r={15} fill="none" stroke={shade(c.color, -0.42)} strokeWidth={2.2} />
          <PartText x={x + 10} y={y - 35} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={12} fill={shade(c.color, -0.42)}>
            FOOD
          </PartText>
        </g>
      );
    },
  },
  {
    id: 'beer',
    name: 'Beer Bottle',
    lean: 10,
    quip: 'Grown-ups only. Smells like a garage on a Sunday.',
    defaultColor: '#7a4a1e',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-8 ${x} ${y}) translate(${x} ${y}) scale(1.25) translate(${-x} ${-y})`}>
          <path d={`M ${x - 10} ${y + 8} L ${x - 10} ${y - 50} Q ${x - 10} ${y - 62} ${x - 2} ${y - 70} L ${x - 2} ${y - 94} L ${x + 12} ${y - 94} L ${x + 12} ${y - 70} Q ${x + 20} ${y - 62} ${x + 20} ${y - 50} L ${x + 20} ${y + 8} Z`} {...f(c.color)} />
          <path d={`M ${x + 13} ${y + 8} L ${x + 13} ${y - 62} L ${x + 12} ${y - 70} Q ${x + 20} ${y - 62} ${x + 20} ${y - 50} L ${x + 20} ${y + 8} Z`} fill={shade(c.color, -0.22)} />
          <path d={`M ${x + 1} ${y - 92} L ${x + 1} ${y - 70} Q ${x - 5} ${y - 62} ${x - 6} ${y - 48}`} fill="none" stroke={shade(c.color, 0.34)} strokeWidth={2.4} strokeLinecap="round" />
          <rect x={x - 2} y={y - 86} width={14} height={9} fill="#d33b2c" />
          <rect x={x - 10} y={y - 42} width={30} height={26} fill="#f2e2b8" stroke={O} strokeWidth={1.5} />
          <rect x={x - 10} y={y - 42} width={30} height={5} fill="#d33b2c" />
          <PartText x={x + 5} y={y - 25} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={9.5} fill="#5a3a22">
            BEER
          </PartText>
          <path d={`M ${x - 6} ${y - 19} h 22`} stroke="#d33b2c" strokeWidth={1.4} />
          <rect x={x - 4} y={y - 100} width={22} height={8} rx={2} fill="#c9c9c9" stroke={O} strokeWidth={1.5} />
          <path d={`M ${x} ${y - 99} v 6 M ${x + 5} ${y - 99} v 6 M ${x + 10} ${y - 99} v 6 M ${x + 15} ${y - 99} v 6`} stroke="#8d939b" strokeWidth={1.4} />
        </g>
      );
    },
  },
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    quip: 'For mining. Or for a dance craze. Mostly a dance craze.',
    defaultColor: '#9aa3ad',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        // Tilted out to the side, so the head clears a kid's big round head.
        <g transform={`rotate(32 ${x} ${y})`}>
          <path d={`M ${x + 4} ${y + 16} L ${x + 10} ${y - 132}`} stroke={O} strokeWidth={13} strokeLinecap="round" />
          <path d={`M ${x + 4} ${y + 16} L ${x + 10} ${y - 132}`} stroke="#a5713d" strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 6} ${y - 22} L ${x + 8} ${y - 66} M ${x + 9} ${y - 76} L ${x + 10} ${y - 112}`} stroke="#7a4e24" strokeWidth={1.8} strokeLinecap="round" />
          <path d={`M ${x - 1} ${y + 18} l 10 2 M ${x - 1} ${y + 12} l 10 2`} stroke="#3d3d44" strokeWidth={3.5} />
          <path d={`M ${x - 52} ${y - 104} Q ${x + 10} ${y - 168} ${x + 72} ${y - 104} L ${x + 64} ${y - 96} Q ${x + 10} ${y - 140} ${x - 44} ${y - 96} Z`} {...f(c.color)} />
          <path d={`M ${x - 44} ${y - 96} Q ${x + 10} ${y - 140} ${x + 64} ${y - 96} L ${x + 68} ${y - 100} Q ${x + 10} ${y - 150} ${x - 48} ${y - 100} Z`} fill={shade(c.color, -0.2)} />
          <path d={`M ${x - 30} ${y - 118} Q ${x + 10} ${y - 150} ${x + 50} ${y - 118}`} fill="none" stroke={shade(c.color, 0.5)} strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x - 52} ${y - 104} L ${x - 44} ${y - 96} L ${x - 36} ${y - 104} L ${x - 42} ${y - 112} Z M ${x + 72} ${y - 104} L ${x + 64} ${y - 96} L ${x + 56} ${y - 104} L ${x + 62} ${y - 112} Z`} fill={shade(c.color, 0.45)} />
          <rect x={x} y={y - 148} width={20} height={32} rx={4} fill="#55555a" />
          <path d={dots([[x + 6, y - 132], [x + 14, y - 132]])} stroke="#b9bec6" strokeWidth={3.5} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'swab',
    name: 'Cotton Swab',
    lean: 8,
    quip: 'A very long cotton swab. Goes all the way up. Do not ask how far.',
    defaultColor: '#ffffff',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x + 2} ${y + 4} L ${x + 34} ${y - 104}`} stroke="#9fb0c0" strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 2} ${y + 4} L ${x + 34} ${y - 104}`} stroke={c.color} strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${x + 15} ${y - 57} L ${x + 24} ${y - 54}`} stroke="#6f93b5" strokeWidth={3} />
          <path d={`M ${x + 9} ${y - 32} L ${x + 12} ${y - 42}`} stroke="#6f93b5" strokeWidth={5} />
          <g transform={`rotate(17 ${x + 38} ${y - 118})`}>
            <path d={scallop(x + 38, y - 118, 15, 22, 11, 0.09)} {...pale('#fdfdfd')} />
            <path d={`M ${x + 30} ${y - 124} l 5 -3 M ${x + 39} ${y - 130} l 5 2 M ${x + 33} ${y - 112} l 6 1 M ${x + 41} ${y - 118} l 4 -3 M ${x + 37} ${y - 102} l 4 -2`} stroke="#d5dde5" strokeWidth={2} strokeLinecap="round" />
          </g>
        </g>
      );
    },
  },
  {
    id: 'microphone',
    name: 'News Microphone',
    lean: 16,
    quip: 'Live at five. Asks the hard questions. Mostly "how do you feel?"',
    defaultColor: '#3b6fd8',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g transform={`rotate(-12 ${x} ${y})`}>
          <path d={`M ${x + 4} ${y + 12} q 8 22 -6 38`} fill="none" stroke="#2b2b2f" strokeWidth={3.5} strokeLinecap="round" />
          <rect x={x - 4} y={y - 66} width={16} height={78} rx={6} {...f('#3d3d44')} />
          <rect x={x - 4} y={y - 48} width={16} height={5} fill="#9aa3ad" />
          <circle cx={x + 8} cy={y - 34} r={2.5} fill="#e5322d" />
          <circle cx={x + 4} cy={y - 106} r={23} {...f('#9aa3ad')} />
          <path d={`M ${x - 14} ${y - 118} L ${x + 22} ${y - 94} M ${x - 14} ${y - 96} L ${x + 22} ${y - 118} M ${x - 19} ${y - 106} L ${x + 27} ${y - 106}`} stroke="#6b7078" strokeWidth={2} />
          <rect x={x - 20} y={y - 88} width={48} height={32} rx={4} {...f(c.color)} strokeWidth={2} />
          <path d={`M ${x - 16} ${y - 84} h 40`} stroke={shade(c.color, 0.4)} strokeWidth={2} strokeLinecap="round" />
          <PartText x={x + 4} y={y - 65} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={19} fill="#fff">
            TV
          </PartText>
        </g>
      );
    },
  },
  {
    id: 'net',
    name: 'Butterfly Net',
    lean: 18,
    quip: 'Has caught zero butterflies. One sandwich. Two regrets.',
    defaultColor: '#a5713d',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x + 2} ${y + 14} L ${x + 34} ${y - 150}`} stroke={O} strokeWidth={11} strokeLinecap="round" />
          <path d={`M ${x + 2} ${y + 14} L ${x + 34} ${y - 150}`} stroke={c.color} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${x + 14} ${y - 168} C ${x + 26} ${y - 110} ${x + 66} ${y - 84} ${x + 92} ${y - 92} C ${x + 104} ${y - 124} ${x + 104} ${y - 170} ${x + 92} ${y - 206} Z`} fill="#fff" fillOpacity={0.6} stroke="#8fa1b3" strokeWidth={2.5} />
          <path d={`M ${x + 36} ${y - 168} Q ${x + 58} ${y - 120} ${x + 90} ${y - 104} M ${x + 58} ${y - 182} Q ${x + 76} ${y - 136} ${x + 94} ${y - 118} M ${x + 76} ${y - 196} Q ${x + 92} ${y - 160} ${x + 98} ${y - 138} M ${x + 22} ${y - 140} Q ${x + 62} ${y - 146} ${x + 100} ${y - 170} M ${x + 38} ${y - 116} Q ${x + 72} ${y - 118} ${x + 100} ${y - 134}`} fill="none" stroke="#8fa1b3" strokeWidth={2} />
          <ellipse cx={x + 52} cy={y - 186} rx={46} ry={26} transform={`rotate(-22 ${x + 52} ${y - 186})`} fill="none" stroke="#55555a" strokeWidth={6} />
        </g>
      );
    },
  },
];

/* --------------------------------------------------------------- sidekicks */

export interface SidekickDef extends ItemBase {
  render?: Render;
}

/** Sidekicks stand on the ground to the character's right (viewer's left). */
const spot = (c: RenderCtx) => ({ x: c.g.cx - 186, y: 480 });

export const SIDEKICKS: SidekickDef[] = [
  { id: 'none', name: 'Lone Wolf', quip: 'Needs no one. Talks to the fridge sometimes.' },
  {
    id: 'dog',
    name: 'Good Boy',
    quip: 'The best boy. Has eaten two homeworks and a couch.',
    defaultColor: '#a5713d',
    render: (c) => {
      const { x, y } = spot(c);
      const dark = shade(c.color, -0.3);
      const light = shade(c.color, 0.4);
      return (
        <g>
          <path d={`M ${x + 40} ${y - 48} q 26 -20 24 -40`} fill="none" stroke={O} strokeWidth={9} strokeLinecap="round" />
          <path d={`M ${x + 40} ${y - 48} q 26 -20 24 -40`} fill="none" stroke={c.color} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={x + 10} cy={y - 34} rx={40} ry={26} {...f(c.color)} />
          <ellipse cx={x + 22} cy={y - 42} rx={16} ry={11} fill={dark} />
          <ellipse cx={x + 2} cy={y - 18} rx={22} ry={8} fill={light} />
          {[-22, -8, 24, 36].map((dx) => (
            <rect key={dx} x={x + dx - 6} y={y - 16} width={12} height={16} rx={5} {...f(c.color)} strokeWidth={2} />
          ))}
          <path d={`M ${x - 26} ${y - 1} v -5 M ${x - 22} ${y - 1} v -5 M ${x - 12} ${y - 1} v -5 M ${x - 8} ${y - 1} v -5 M ${x + 20} ${y - 1} v -5 M ${x + 24} ${y - 1} v -5 M ${x + 32} ${y - 1} v -5 M ${x + 36} ${y - 1} v -5`} stroke={dark} strokeWidth={1.6} />
          <circle cx={x - 30} cy={y - 66} r={28} {...f(c.color)} />
          <ellipse cx={x - 30} cy={y - 52} rx={15} ry={11} fill={light} />
          <ellipse cx={x - 54} cy={y - 62} rx={10} ry={20} {...f(dark)} />
          <ellipse cx={x - 6} cy={y - 62} rx={10} ry={20} {...f(dark)} />
          <circle cx={x - 38} cy={y - 70} r={4} fill={O} />
          <circle cx={x - 22} cy={y - 70} r={4} fill={O} />
          <path d={dots([[x - 39, y - 71.5], [x - 23, y - 71.5]])} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
          <ellipse cx={x - 30} cy={y - 56} rx={7} ry={5} fill={O} />
          <path d={`M ${x - 30} ${y - 51} v 4 M ${x - 38} ${y - 47} q 8 4 16 0`} fill="none" stroke={O} strokeWidth={1.8} strokeLinecap="round" />
          <path d={`M ${x - 46} ${y - 42} q 16 8 32 0`} stroke="#d33b2c" strokeWidth={6} fill="none" />
          <circle cx={x - 30} cy={y - 33} r={5.5} fill="#f2c230" />
        </g>
      );
    },
  },
  {
    id: 'cat',
    name: 'Judgy Cat',
    quip: 'Judges you silently. Sometimes not silently.',
    defaultColor: '#9a9a9a',
    render: (c) => {
      const { x, y } = spot(c);
      const stripe = shade(c.color, -0.3);
      const tail = `M ${x + 26} ${y - 20} Q ${x + 60} ${y - 30} ${x + 50} ${y - 90}`;
      return (
        <g>
          <path d={tail} fill="none" stroke={O} strokeWidth={10} strokeLinecap="round" />
          <path d={tail} fill="none" stroke={c.color} strokeWidth={6} strokeLinecap="round" />
          <path d={tail} fill="none" stroke={stripe} strokeWidth={6} strokeDasharray="7 14" />
          <ellipse cx={x} cy={y - 30} rx={30} ry={32} {...f(c.color)} />
          <ellipse cx={x} cy={y - 34} rx={15} ry={18} fill={shade(c.color, 0.42)} />
          <path d={`M ${x - 28} ${y - 72} L ${x - 24} ${y - 104} L ${x - 6} ${y - 82} Z M ${x + 28} ${y - 72} L ${x + 24} ${y - 104} L ${x + 6} ${y - 82} Z`} {...f(c.color)} />
          <path d={`M ${x - 24} ${y - 80} L ${x - 22} ${y - 96} L ${x - 12} ${y - 84} Z M ${x + 24} ${y - 80} L ${x + 22} ${y - 96} L ${x + 12} ${y - 84} Z`} fill="#f6a5b4" />
          <circle cx={x} cy={y - 72} r={28} {...f(c.color)} />
          <path d={`M ${x - 7} ${y - 99} v 9 M ${x} ${y - 100} v 11 M ${x + 7} ${y - 99} v 9`} stroke={stripe} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={x - 10} cy={y - 74} rx={5} ry={7} fill="#c8e86a" stroke={O} strokeWidth={1.5} />
          <ellipse cx={x + 10} cy={y - 74} rx={5} ry={7} fill="#c8e86a" stroke={O} strokeWidth={1.5} />
          <ellipse cx={x - 10} cy={y - 74} rx={1.6} ry={5} fill={O} />
          <ellipse cx={x + 10} cy={y - 74} rx={1.6} ry={5} fill={O} />
          <path d={`M ${x - 12} ${y - 80} L ${x - 6} ${y - 78} M ${x + 12} ${y - 80} L ${x + 6} ${y - 78}`} stroke={O} strokeWidth={2.5} />
          <path d={`M ${x - 4} ${y - 62} L ${x + 4} ${y - 62} L ${x} ${y - 58} Z`} fill="#f27bb4" />
          <path d={`M ${x} ${y - 58} q -4 5 -8 2 M ${x} ${y - 58} q 4 5 8 2`} fill="none" stroke={O} strokeWidth={1.6} strokeLinecap="round" />
          <path d={`M ${x - 15} ${y - 64} l -17 -3 M ${x - 15} ${y - 60} l -17 3 M ${x + 15} ${y - 64} l 17 -3 M ${x + 15} ${y - 60} l 17 3`} stroke={O} strokeWidth={1.3} />
          <path d={`M ${x - 10} ${y - 30} q 10 -6 20 0 M ${x - 12} ${y - 18} q 12 -6 24 0`} stroke={stripe} strokeWidth={3} fill="none" />
          <ellipse cx={x - 12} cy={y - 4} rx={10} ry={5.5} fill={shade(c.color, 0.42)} />
          <ellipse cx={x + 12} cy={y - 4} rx={10} ry={5.5} fill={shade(c.color, 0.42)} />
        </g>
      );
    },
  },
  {
    id: 'pig',
    name: 'Pot-Bellied Pig',
    quip: 'Smarter than most of the class. Has a 4.0 GPA.',
    defaultColor: '#f6a5b4',
    render: (c) => {
      const { x, y } = spot(c);
      const deep = shade(c.color, -0.16);
      return (
        <g>
          <path d={`M ${x + 44} ${y - 40} q 14 -4 10 -14 q -4 -8 -10 0`} fill="none" stroke={O} strokeWidth={3} />
          <ellipse cx={x + 6} cy={y - 34} rx={44} ry={30} {...f(c.color)} />
          <ellipse cx={x + 20} cy={y - 48} rx={12} ry={8} fill={deep} />
          <ellipse cx={x + 34} cy={y - 28} rx={7} ry={5} fill={deep} />
          <ellipse cx={x + 2} cy={y - 16} rx={24} ry={8} fill={shade(c.color, 0.3)} />
          {[-24, -8, 20, 34].map((dx) => (
            <g key={dx}>
              <rect x={x + dx - 6} y={y - 12} width={12} height={12} rx={3} {...f(shade(c.color, -0.1))} strokeWidth={2} />
              <path d={`M ${x + dx - 6} ${y - 5} h 12 v 2 q 0 3 -3 3 h -6 q -3 0 -3 -3 Z M ${x + dx} ${y - 5} v 5`} fill="#7a4a4a" stroke={shade(c.color, -0.1)} strokeWidth={1} />
            </g>
          ))}
          <path d={`M ${x - 40} ${y - 66} L ${x - 46} ${y - 86} L ${x - 28} ${y - 74} Z`} {...f(c.color)} strokeWidth={2} />
          <path d={`M ${x - 40} ${y - 70} L ${x - 43} ${y - 81} L ${x - 33} ${y - 74} Z`} fill={shade(c.color, -0.2)} />
          <path d={`M ${x - 20} ${y - 66} L ${x - 10} ${y - 84} L ${x - 8} ${y - 62} Z`} {...f(c.color)} strokeWidth={2} />
          <circle cx={x - 30} cy={y - 50} r={20} {...f(c.color)} />
          <circle cx={x - 20} cy={y - 42} r={6} fill="#f27b9a" opacity={0.5} />
          <ellipse cx={x - 46} cy={y - 46} rx={9} ry={8} {...f(shade(c.color, -0.12))} strokeWidth={2} />
          <circle cx={x - 49} cy={y - 46} r={2} fill={O} />
          <circle cx={x - 43} cy={y - 46} r={2} fill={O} />
          <circle cx={x - 30} cy={y - 58} r={3} fill={O} />
          <circle cx={x - 31} cy={y - 59} r={1} fill="#fff" />
          <path d={`M ${x - 44} ${y - 36} q 8 6 15 -1`} fill="none" stroke={O} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: 'guinea',
    name: 'Guinea Pig',
    quip: 'Has seen things. Terrible things. Will not elaborate.',
    defaultColor: '#c68a56',
    render: (c) => {
      const { x, y } = spot(c);
      const dark = shade(c.color, -0.28);
      return (
        <g>
          <ellipse cx={x - 22} cy={y - 3} rx={8} ry={4} fill="#f6a5b4" />
          <ellipse cx={x + 20} cy={y - 3} rx={9} ry={4} fill="#f6a5b4" />
          <path d={scallop(x, y - 26, 38, 24, 14, 0.06)} {...f(c.color)} />
          <path d={`M ${x + 8} ${y - 46} Q ${x + 36} ${y - 44} ${x + 34} ${y - 20} Q ${x + 24} ${y - 8} ${x + 12} ${y - 14} Q ${x + 26} ${y - 30} ${x + 8} ${y - 46} Z`} fill={dark} />
          <ellipse cx={x + 8} cy={y - 28} rx={15} ry={13} fill="#fff" />
          <path d={`M ${x - 4} ${y - 46} q 4 -8 8 -1 q 4 -7 7 2`} fill={c.color} />
          <path d={`M ${x - 8} ${y - 18} q 4 -3 8 0 M ${x - 12} ${y - 10} q 4 -3 8 0 M ${x + 2} ${y - 8} q 3 -2 6 0`} fill="none" stroke={dark} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={x - 26} cy={y - 32} r={3.5} fill={O} />
          <circle cx={x - 27} cy={y - 33} r={1.1} fill="#fff" />
          <ellipse cx={x - 36} cy={y - 26} rx={3} ry={2} fill="#f27bb4" />
          <path d={`M ${x - 36} ${y - 24} q 2 3 5 1`} fill="none" stroke={O} strokeWidth={1.2} />
          <path d={`M ${x - 32} ${y - 25} l 12 -3 M ${x - 32} ${y - 23} l 12 2`} stroke={O} strokeWidth={1} />
          <ellipse cx={x - 18} cy={y - 46} rx={7} ry={5} {...f(shade(c.color, -0.2))} strokeWidth={1.5} />
          <ellipse cx={x - 18} cy={y - 46} rx={3.6} ry={2.6} fill="#f6a5b4" />
        </g>
      );
    },
  },
  {
    id: 'turtle',
    name: 'Turtle',
    quip: 'Slow and steady wins the race. Has never entered a race.',
    defaultColor: '#2e8b47',
    render: (c) => {
      const { x, y } = spot(c);
      const skin = '#9bd36a';
      const line = shade(c.color, -0.35);
      return (
        <g>
          <path d={`M ${x + 34} ${y - 10} l 15 5 l -15 3 Z`} fill={skin} />
          <ellipse cx={x - 40} cy={y - 18} rx={14} ry={11} {...f(skin)} />
          <circle cx={x - 44} cy={y - 21} r={2.5} fill={O} />
          <circle cx={x - 44.7} cy={y - 21.7} r={0.8} fill="#fff" />
          <path d={`M ${x - 53} ${y - 15} q 6 4 11 1`} fill="none" stroke={O} strokeWidth={1.5} strokeLinecap="round" />
          <path d={`M ${x - 28} ${y - 14} l 3 10 l -10 0 Z`} fill={skin} />
          {[-20, 26].map((dx) => (
            <ellipse key={dx} cx={x + dx} cy={y - 4} rx={9} ry={6} {...f(skin)} strokeWidth={2} />
          ))}
          <path d={`M ${x - 24} ${y - 1} v -3 M ${x - 20} ${y - 1} v -3 M ${x - 16} ${y - 1} v -3 M ${x + 22} ${y - 1} v -3 M ${x + 26} ${y - 1} v -3 M ${x + 30} ${y - 1} v -3`} stroke="#6fae3a" strokeWidth={1.5} />
          <path d={`M ${x - 32} ${y - 6} Q ${x} ${y - 66} ${x + 36} ${y - 6} Z`} {...f(c.color)} />
          <path d={`M ${x - 8} ${y - 13} L ${x - 13} ${y - 23} L ${x - 4} ${y - 31} L ${x + 8} ${y - 31} L ${x + 17} ${y - 23} L ${x + 12} ${y - 13} Z`} fill={shade(c.color, 0.2)} stroke={line} strokeWidth={2.2} />
          <path d={`M ${x - 8} ${y - 13} L ${x - 15} ${y - 7} M ${x - 13} ${y - 23} L ${x - 24} ${y - 15} M ${x + 17} ${y - 23} L ${x + 28} ${y - 15} M ${x + 12} ${y - 13} L ${x + 19} ${y - 7}`} stroke={line} strokeWidth={2.2} />
          <path d={`M ${x - 38} ${y - 6} Q ${x + 2} ${y - 12} ${x + 42} ${y - 6} Q ${x + 42} ${y - 2} ${x + 36} ${y - 2} L ${x - 32} ${y - 2} Q ${x - 38} ${y - 2} ${x - 38} ${y - 6} Z`} fill={shade(c.color, 0.32)} />
        </g>
      );
    },
  },
  {
    id: 'hen',
    name: 'Pet Chicken',
    quip: 'Crosses the road constantly. Nobody knows why.',
    defaultColor: '#ffffff',
    render: (c) => {
      const { x, y } = spot(c);
      const feather = shade(c.color, -0.1);
      const quill = shade(c.color, -0.24);
      return (
        <g>
          <path d={`M ${x - 6} ${y} L ${x - 6} ${y - 14} M ${x + 8} ${y} L ${x + 8} ${y - 14} M ${x - 12} ${y - 1} h 8 M ${x + 4} ${y - 1} h 8`} stroke="#f0742a" strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${x + 22} ${y - 42} q 8 -24 24 -30 q 2 22 -8 36 Z M ${x + 28} ${y - 40} q 14 -14 30 -12 q -6 18 -22 22 Z`} {...pale(feather)} />
          <path d={`M ${x - 30} ${y - 40} Q ${x - 30} ${y - 14} ${x} ${y - 14} Q ${x + 36} ${y - 14} ${x + 40} ${y - 50} Q ${x + 20} ${y - 40} ${x + 10} ${y - 44} Z`} {...pale(c.color)} />
          <path d={`M ${x - 12} ${y - 38} q 16 -10 30 -4 q 2 8 -5 12 q -4 6 -10 3 q -6 4 -10 -2 q -6 -2 -5 -9 Z`} fill={feather} />
          <path d={`M ${x + 4} ${y - 38} q 6 2 8 8 M ${x - 4} ${y - 36} q 4 4 4 9`} fill="none" stroke={quill} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={x - 24} cy={y - 56} r={16} {...pale(c.color)} />
          <path d={`M ${x - 32} ${y - 70} q 4 -10 8 -2 q 4 -10 8 -2 q 4 -8 6 2`} fill="#e5322d" {...ink} strokeWidth={1.5} />
          <path d={`M ${x - 38} ${y - 48} q -3 11 3 11 q 5 -4 2 -11 Z`} fill="#e5322d" />
          <path d={`M ${x - 40} ${y - 58} L ${x - 50} ${y - 54} L ${x - 40} ${y - 50} Z`} fill="#f2c230" {...ink} strokeWidth={1.5} />
          <path d={`M ${x - 49} ${y - 54} h 9`} stroke="#b98a12" strokeWidth={1.2} />
          <circle cx={x - 28} cy={y - 60} r={2.5} fill={O} />
          <circle cx={x - 28.8} cy={y - 60.8} r={0.8} fill="#fff" />
        </g>
      );
    },
  },
  {
    id: 'ghost',
    name: 'Imaginary Friend',
    quip: 'Only you can see him. He thinks your outfit is weird.',
    colorable: false,
    render: (c) => {
      const { x, y } = spot(c);
      return (
        <g opacity={0.75}>
          <path d={`M ${x - 28} ${y - 64} Q ${x - 46} ${y - 68} ${x - 48} ${y - 52} Q ${x - 38} ${y - 44} ${x - 28} ${y - 48} Z M ${x + 28} ${y - 64} Q ${x + 46} ${y - 68} ${x + 48} ${y - 52} Q ${x + 38} ${y - 44} ${x + 28} ${y - 48} Z`} fill="#fff" stroke="#a9b8c6" strokeWidth={3} strokeDasharray="6 4" />
          <path d={`M ${x - 30} ${y - 10} L ${x - 30} ${y - 70} Q ${x} ${y - 120} ${x + 30} ${y - 70} L ${x + 30} ${y - 10} l -10 -10 l -10 10 l -10 -10 l -10 10 l -10 -10 l -10 10 Z`} fill="#fff" stroke="#a9b8c6" strokeWidth={3} strokeDasharray="6 4" />
          <path d={`M ${x - 18} ${y - 22} v -12 M ${x + 2} ${y - 24} v -8 M ${x + 20} ${y - 22} v -12`} stroke="#dbe3ea" strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={x - 10} cy={y - 70} rx={5} ry={7} fill={O} />
          <ellipse cx={x + 10} cy={y - 70} rx={5} ry={7} fill={O} />
          <path d={dots([[x - 11.5, y - 73], [x + 8.5, y - 73]])} stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={x - 21} cy={y - 57} r={5} fill="#f6a5b4" opacity={0.7} />
          <circle cx={x + 21} cy={y - 57} r={5} fill="#f6a5b4" opacity={0.7} />
          <ellipse cx={x} cy={y - 50} rx={6} ry={8} fill={O} />
        </g>
      );
    },
  },
  {
    id: 'robot',
    name: 'Robo-Buddy',
    quip: 'Does your homework. Badly. Got a D-minus in spelling.',
    defaultColor: '#9aa3ad',
    render: (c) => {
      const { x, y } = spot(c);
      const shell = shade(c.color, -0.12);
      const joint = '#55555a';
      return (
        <g>
          <path d={`M ${x - 22} ${y - 52} L ${x - 34} ${y - 40} L ${x - 34} ${y - 26} M ${x + 22} ${y - 52} L ${x + 34} ${y - 40} L ${x + 34} ${y - 26}`} fill="none" stroke={joint} strokeWidth={6} strokeLinejoin="round" />
          <path d={`M ${x - 42} ${y - 18} q 0 -11 8 -11 q 8 0 8 11 M ${x + 26} ${y - 18} q 0 -11 8 -11 q 8 0 8 11`} fill="none" stroke={c.color} strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${x} ${y - 100} L ${x} ${y - 116}`} stroke={O} strokeWidth={3} />
          <circle cx={x} cy={y - 120} r={6} fill="#e5322d" {...ink} strokeWidth={2} />
          <circle cx={x - 1.5} cy={y - 122} r={1.6} fill="#fff" />
          <rect x={x - 7} y={y - 104} width={14} height={5} rx={1.5} fill={joint} />
          <rect x={x - 31} y={y - 88} width={6} height={14} rx={2} fill={joint} />
          <rect x={x + 25} y={y - 88} width={6} height={14} rx={2} fill={joint} />
          <rect x={x - 26} y={y - 100} width={52} height={38} rx={8} {...f(c.color)} />
          <circle cx={x - 11} cy={y - 84} r={7} fill="#7fd4ff" {...ink} strokeWidth={2} />
          <circle cx={x + 11} cy={y - 84} r={7} fill="#7fd4ff" {...ink} strokeWidth={2} />
          <circle cx={x - 11} cy={y - 84} r={2.6} fill="#1f3a55" />
          <circle cx={x + 11} cy={y - 84} r={2.6} fill="#1f3a55" />
          <path d={`M ${x - 12} ${y - 70} h 24 M ${x - 12} ${y - 70} v -2 h 24 v 2 M ${x - 6} ${y - 72} v 3 M ${x} ${y - 72} v 3 M ${x + 6} ${y - 72} v 3`} fill="none" stroke="#2b3a4a" strokeWidth={1.6} />
          <path d={dots([[x - 21, y - 95], [x + 21, y - 95], [x - 21, y - 67], [x + 21, y - 67]])} stroke={shade(c.color, -0.34)} strokeWidth={2.6} strokeLinecap="round" />
          <rect x={x - 8} y={y - 63} width={16} height={5} fill={joint} />
          <rect x={x - 22} y={y - 60} width={44} height={42} rx={6} {...f(shell)} />
          <rect x={x - 15} y={y - 54} width={30} height={15} rx={3} fill="#2b3a4a" />
          <path d={`M ${x - 13} ${y - 46} h 6 l 3 -5 l 4 9 l 3 -4 h 10`} fill="none" stroke="#7fe08a" strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={x - 10} cy={y - 29} r={3.2} fill="#e5322d" />
          <circle cx={x} cy={y - 29} r={3.2} fill="#f2c230" />
          <circle cx={x + 10} cy={y - 29} r={3.2} fill="#7fbf3f" />
          <rect x={x - 20} y={y - 18} width={14} height={18} rx={3} {...f(joint)} strokeWidth={2} />
          <rect x={x + 6} y={y - 18} width={14} height={18} rx={3} {...f(joint)} strokeWidth={2} />
          <rect x={x - 23} y={y - 6} width={20} height={6} rx={2} fill="#3d3d44" />
          <rect x={x + 3} y={y - 6} width={20} height={6} rx={2} fill="#3d3d44" />
        </g>
      );
    },
  },
  {
    id: 'alien',
    name: 'Exchange Student',
    quip: 'From a galaxy far, far away. Okay, it was Ohio.',
    defaultColor: '#9bd36a',
    render: (c) => {
      const { x, y } = spot(c);
      const deep = shade(c.color, -0.2);
      return (
        <g>
          <path d={`M ${x - 11} ${y - 32} q -14 6 -17 20 M ${x + 11} ${y - 32} q 14 6 17 20`} fill="none" stroke={c.color} strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${x - 28} ${y - 12} l -5 6 M ${x - 28} ${y - 12} l 0 8 M ${x - 28} ${y - 12} l 5 6 M ${x + 28} ${y - 12} l -5 6 M ${x + 28} ${y - 12} l 0 8 M ${x + 28} ${y - 12} l 5 6`} stroke={c.color} strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${x - 14} ${y - 4} L ${x - 10} ${y - 40} L ${x + 10} ${y - 40} L ${x + 14} ${y - 4}`} {...f(c.color)} />
          <ellipse cx={x - 12} cy={y - 3} rx={10} ry={4.5} fill={deep} />
          <ellipse cx={x + 12} cy={y - 3} rx={10} ry={4.5} fill={deep} />
          <rect x={x - 10} y={y - 29} width={20} height={13} rx={1.5} fill="#fff" />
          <rect x={x - 10} y={y - 29} width={20} height={5} rx={1.5} fill="#d33b2c" />
          <path d={`M ${x - 6} ${y - 19} q 3 -3 6 0 q 3 3 6 0`} fill="none" stroke="#3b6fd8" strokeWidth={1.4} />
          <path d={`M ${x - 34} ${y - 82} Q ${x - 40} ${y - 130} ${x} ${y - 130} Q ${x + 40} ${y - 130} ${x + 34} ${y - 82} Q ${x + 20} ${y - 38} ${x} ${y - 38} Q ${x - 20} ${y - 38} ${x - 34} ${y - 82} Z`} {...f(c.color)} />
          <path d={`M ${x - 10} ${y - 122} q 10 -5 20 0 M ${x - 6} ${y - 114} q 6 -3 12 0`} fill="none" stroke={deep} strokeWidth={2} strokeLinecap="round" />
          <ellipse cx={x - 14} cy={y - 84} rx={10} ry={16} transform={`rotate(30 ${x - 14} ${y - 84})`} fill={O} />
          <ellipse cx={x + 14} cy={y - 84} rx={10} ry={16} transform={`rotate(-30 ${x + 14} ${y - 84})`} fill={O} />
          <ellipse cx={x - 18} cy={y - 91} rx={2.6} ry={4} transform={`rotate(30 ${x - 18} ${y - 91})`} fill="#fff" />
          <ellipse cx={x + 10} cy={y - 91} rx={2.6} ry={4} transform={`rotate(-30 ${x + 10} ${y - 91})`} fill="#fff" />
          <path d={dots([[x - 2.5, y - 64], [x + 2.5, y - 64]])} stroke={deep} strokeWidth={2.2} strokeLinecap="round" />
          <path d={`M ${x - 4} ${y - 54} Q ${x} ${y - 50} ${x + 4} ${y - 54}`} fill="none" stroke={O} strokeWidth={2} />
        </g>
      );
    },
  },
  {
    id: 'hamster',
    name: 'Hamster Ball',
    quip: 'Rolling with it. Down the stairs. Again.',
    defaultColor: '#e9b86b',
    render: (c) => {
      const { x, y } = spot(c);
      const belly = shade(c.color, 0.5);
      return (
        <g>
          <circle cx={x} cy={y - 44} r={44} fill="#bfe6ff" fillOpacity={0.45} stroke="#6fa8d0" strokeWidth={4} />
          <path d={`M ${x - 43} ${y - 36} Q ${x} ${y - 22} ${x + 43} ${y - 36}`} fill="none" stroke="#6fa8d0" strokeWidth={2} />
          <path d={`M ${x + 14} ${y - 78} l 7 4 M ${x + 22} ${y - 72} l 6 5 M ${x + 29} ${y - 64} l 5 6`} stroke="#6fa8d0" strokeWidth={3.5} strokeLinecap="round" />
          <ellipse cx={x - 12} cy={y - 7} rx={7} ry={3.5} fill="#f6a5b4" />
          <ellipse cx={x + 12} cy={y - 7} rx={7} ry={3.5} fill="#f6a5b4" />
          <ellipse cx={x} cy={y - 26} rx={22} ry={16} {...f(c.color)} />
          <ellipse cx={x + 2} cy={y - 21} rx={13} ry={9} fill={belly} />
          <circle cx={x - 22} cy={y - 24} r={7.5} fill={c.color} />
          <circle cx={x - 8} cy={y - 42} r={5} {...f(shade(c.color, -0.12))} strokeWidth={1.5} />
          <circle cx={x - 18} cy={y - 40} r={6} {...f(shade(c.color, 0.25))} strokeWidth={1.5} />
          <circle cx={x - 18} cy={y - 40} r={3} fill="#f6a5b4" />
          <circle cx={x - 14} cy={y - 34} r={3} fill={O} />
          <circle cx={x - 15} cy={y - 35} r={1} fill="#fff" />
          <ellipse cx={x - 25} cy={y - 28} rx={2.4} ry={1.8} fill="#f27bb4" />
          <path d={`M ${x - 24} ${y - 26} l 10 -2 M ${x - 24} ${y - 25} l 10 2`} stroke={O} strokeWidth={1} />
          <path d={`M ${x - 26} ${y - 70} Q ${x - 10} ${y - 84} ${x + 10} ${y - 80}`} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
          <circle cx={x - 34} cy={y - 52} r={3} fill="#fff" opacity={0.8} />
        </g>
      );
    },
  },
];
