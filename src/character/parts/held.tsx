import type { ItemBase, Render, RenderCtx } from '../../types';
import { accent, inkOn, shade } from '../../lib/color';
import { handPos } from '../geometry';
import { ink, O, pale, scallop, starPath } from './common';

export interface HeldDef extends ItemBase {
  render?: Render;
  /** Degrees a kid tilts it away from their big head, so the head doesn't hide it. */
  lean?: number;
}

const f = (color: string) => ({ fill: color, ...ink });
const hand = (c: RenderCtx) => handPos(c.g, 1);

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
      return (
        <g>
          <path d={`M ${x - 2} ${y + 14} L ${bx - 4} ${by + 40}`} stroke={O} strokeWidth={13} strokeLinecap="round" />
          <path d={`M ${x - 2} ${y + 14} L ${bx - 4} ${by + 40}`} stroke="#c9a07a" strokeWidth={8} strokeLinecap="round" />
          <g transform={`rotate(4 ${bx} ${by})`}>
            <rect x={bx - 80} y={by - 44} width={160} height={88} rx={4} {...f(c.color)} />
            {lines.map((l, i) => (
              <text
                key={i}
                x={bx}
                y={by + (i - (lines.length - 1) / 2) * 24 + 9}
                textAnchor="middle"
                fontFamily="'Luckiest Guy', 'Arial Black', Impact, sans-serif"
                fontSize={l.length > 10 ? 18 : 23}
                fill={inkOn(c.color) === '#ffffff' ? '#ffffff' : '#d33b2c'}
              >
                {l}
              </text>
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
      return (
        <g>
          <path d={`M ${x + 2} ${y} L ${x + 24} ${y - 170} L ${x + 34} ${y - 186} L ${x + 36} ${y - 166} L ${x + 16} ${y}`} {...f(c.color)} />
          <rect x={x - 22} y={y - 26} width={58} height={12} rx={4} transform={`rotate(-8 ${x} ${y - 20})`} {...f(shade(c.color, -0.3))} />
          <path d={`M ${x + 8} ${y + 10} L ${x + 9} ${y + 24}`} stroke={O} strokeWidth={10} strokeLinecap="round" />
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
          <path d={`M ${x + 31} ${y - 82} L ${x + 36} ${y - 96}`} stroke="#fff" strokeWidth={6} strokeLinecap="round" />
          <path d={starPath(x + 52, y - 116, 10)} fill="#f2c230" {...ink} strokeWidth={1.5} />
          <path d={starPath(x + 24, y - 128, 7)} fill="#fff6c4" {...ink} strokeWidth={1.5} />
          <path d={starPath(x + 62, y - 88, 6)} fill="#fff6c4" {...ink} strokeWidth={1.5} />
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
          <path d={`M ${bx - 6} ${by + 52} L ${bx + 6} ${by + 52} L ${bx} ${by + 46} Z`} {...f(c.color)} strokeWidth={2} />
          <ellipse cx={bx - 14} cy={by - 18} rx={8} ry={14} fill="#fff" opacity={0.5} transform={`rotate(20 ${bx - 14} ${by - 18})`} />
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
          <path d={`M ${x - 6} ${y - 76} l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 3 6`} fill={c.color} {...ink} strokeWidth={2} />
          <circle cx={x + 22} cy={y - 46} r={14} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <text x={x + 22} y={y - 16} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={11} fill="#fff" stroke={O} strokeWidth={0.6}>
            CRUNCHOS
          </text>
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
          <rect x={x - 10} y={y - 14} width={92} height={20} rx={10} {...f('#c4512b')} />
          <rect x={x - 2} y={y - 6} width={78} height={22} rx={10} {...f('#e9b86b')} />
          <path d={`M ${x + 2} ${y - 6} q 8 -8 16 0 t 16 0 t 16 0 t 16 0`} fill="none" stroke="#f2c230" strokeWidth={4} />
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
          <rect x={x - 8} y={y - 64} width={40} height={72} rx={7} {...f(c.color)} />
          <rect x={x - 4} y={y - 58} width={32} height={56} rx={3} fill="#7fd4ff" />
          <path d={`M ${x} ${y - 48} h 22 M ${x} ${y - 40} h 16 M ${x} ${y - 32} h 20`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
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
      return (
        <g>
          <ellipse cx={bx} cy={by + 22} rx={22} ry={26} {...f(c.color)} />
          <circle cx={bx - 18} cy={by - 30} r={9} {...f(c.color)} />
          <circle cx={bx + 18} cy={by - 30} r={9} {...f(c.color)} />
          <circle cx={bx} cy={by - 14} r={22} {...f(c.color)} />
          <ellipse cx={bx} cy={by - 6} rx={9} ry={7} fill={shade(c.color, 0.35)} />
          <circle cx={bx} cy={by - 9} r={3} fill={O} />
          <circle cx={bx - 8} cy={by - 20} r={2.6} fill={O} />
          <circle cx={bx + 8} cy={by - 20} r={2.6} fill={O} />
          <path d={`M ${bx - 10} ${by + 6} L ${bx + 10} ${by + 6} L ${bx} ${by + 14} Z`} fill="#d33b2c" />
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
          <path d={`M ${x + 6} ${y - 20} h 28 M ${x + 12} ${y - 25} v 10 M ${x + 20} ${y - 25} v 10 M ${x + 28} ${y - 25} v 10`} stroke="#fff" strokeWidth={2.5} />
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
          <rect x={x - 22} y={y - 74} width={48} height={10} rx={4} {...pale('#fff')} />
          <path d={`M ${x - 16} ${y - 44} L ${x + 20} ${y - 44} L ${x + 18} ${y - 18} L ${x - 14} ${y - 18} Z`} {...f(c.color)} strokeWidth={2} />
          <path d={`M ${x - 4} ${y - 80} q 6 -10 0 -20 M ${x + 8} ${y - 80} q 6 -10 0 -20`} fill="none" stroke="#bbb" strokeWidth={3} strokeLinecap="round" />
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
          <path d={`M ${x} ${y - 38} q 8 -9 18 -5`} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
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
          <path d={`M ${x - 8} ${y - 34} L ${x + 18} ${y - 6} M ${x + 24} ${y - 34} L ${x + 2} ${y - 10}`} stroke="#b07a3a" strokeWidth={2} />
          <circle cx={x + 8} cy={y - 56} r={20} {...f(c.color)} />
          <circle cx={x + 8} cy={y - 86} r={18} {...f('#fff6dc')} />
          <circle cx={x + 8} cy={y - 112} r={16} {...f('#7a4a2a')} />
          <circle cx={x + 10} cy={y - 132} r={6} fill="#d33b2c" {...ink} strokeWidth={2} />
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
          <rect x={x + 2} y={y - 26} width={12} height={22} {...f(c.color)} />
          <path d={`M ${x - 18} ${y - 92} L ${x + 34} ${y - 92} Q ${x + 34} ${y - 30} ${x + 8} ${y - 26} Q ${x - 18} ${y - 30} ${x - 18} ${y - 92} Z`} {...f(c.color)} />
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
      return (
        <g>
          <path d={`M ${x + 4} ${y + 6} Q ${x + 16} ${y - 60} ${x + 10} ${y - 110}`} fill="none" stroke="#2e8b47" strokeWidth={5} />
          <path d={`M ${x + 12} ${y - 50} q 18 -10 26 4 q -14 8 -26 -4 Z`} fill="#7fbf3f" {...ink} strokeWidth={1.5} />
          <path d={scallop(x + 10, y - 122, 24, 24, 8, 0.25)} {...pale('#fff')} />
          <circle cx={x + 10} cy={y - 122} r={10} {...f(c.color)} strokeWidth={2} />
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
      return (
        <g transform={`rotate(-14 ${x} ${y})`}>
          <path d={`M ${x - 30} ${y - 36} L ${x + 50} ${y - 36} Q ${x + 66} ${y - 36} ${x + 66} ${y - 18} Q ${x + 66} ${y + 4} ${x + 50} ${y} L ${x - 30} ${y} Q ${x - 46} ${y + 4} ${x - 46} ${y - 18} Q ${x - 46} ${y - 36} ${x - 30} ${y - 36} Z`} {...f(c.color)} />
          <path d={`M ${x - 32} ${y - 18} h 16 M ${x - 24} ${y - 26} v 16`} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
          <circle cx={x + 40} cy={y - 24} r={5} fill="#d33b2c" />
          <circle cx={x + 50} cy={y - 14} r={5} fill="#3b6fd8" />
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
          <path d={`M ${x - 30} ${y - 6} L ${x + 38} ${y - 6} L ${x + 36} ${y + 6} L ${x - 28} ${y + 6} Z`} {...f('#d99a4e')} />
          <circle cx={x + 2} cy={y - 34} r={7} fill="#d33b2c" />
          <circle cx={x + 14} cy={y - 18} r={6} fill="#d33b2c" />
          <circle cx={x - 8} cy={y - 16} r={5} fill="#d33b2c" />
          <circle cx={x + 4} cy={y - 62} r={5} fill="#d33b2c" />
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
      return (
        <g transform={`rotate(-8 ${x} ${y})`}>
          <rect x={x - 10} y={y - 80} width={58} height={80} rx={3} {...f(c.color)} />
          <rect x={x - 10} y={y - 80} width={10} height={80} fill={shade(c.color, -0.3)} stroke={O} strokeWidth={2} />
          <text x={x + 24} y={y - 50} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={11} fill={inkOn(c.color)}>
            HOW TO
          </text>
          <text x={x + 24} y={y - 36} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={11} fill={inkOn(c.color)}>
            BE COOL
          </text>
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
      return (
        <g>
          <path d={`M ${x + 8} ${c.g.footY + 6} L ${x + 8} ${y - 20} Q ${x + 8} ${y - 46} ${x - 14} ${y - 46} Q ${x - 32} ${y - 46} ${x - 32} ${y - 28}`} fill="none" stroke={O} strokeWidth={13} strokeLinecap="round" />
          <path d={`M ${x + 8} ${c.g.footY + 6} L ${x + 8} ${y - 20} Q ${x + 8} ${y - 46} ${x - 14} ${y - 46} Q ${x - 32} ${y - 46} ${x - 32} ${y - 28}`} fill="none" stroke={c.color} strokeWidth={8} strokeLinecap="round" />
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
      return (
        <g transform={`rotate(10 ${x} ${y})`}>
          <path d={`M ${x - 4} ${y - 4} Q ${x - 10} ${y + 60} ${x + 10} ${y + 70} Q ${x + 30} ${y + 60} ${x + 18} ${y - 4} Z`} {...f('#f2d340')} />
          <path d={`M ${x + 6} ${y - 4} L ${x + 4} ${y - 60}`} stroke={O} strokeWidth={12} strokeLinecap="round" />
          <path d={`M ${x + 6} ${y - 4} L ${x + 4} ${y - 60}`} stroke="#f2d340" strokeWidth={8} strokeLinecap="round" />
          <circle cx={x + 4} cy={y - 70} r={13} {...f('#f2d340')} />
          <path d={`M ${x - 4} ${y - 84} q 4 -10 8 0 q 4 -10 8 0`} fill="#e5322d" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 14} ${y - 72} L ${x + 26} ${y - 68} L ${x + 14} ${y - 64} Z`} fill="#f0742a" {...ink} strokeWidth={1.5} />
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
      return (
        <g transform={`rotate(-70 ${x} ${y})`}>
          <path d={`M ${x - 10} ${y - 4} Q ${x + 30} ${y - 34} ${x + 74} ${y - 4} Q ${x + 30} ${y + 26} ${x - 10} ${y - 4} Z`} {...f(c.color)} />
          <path d={`M ${x - 10} ${y - 4} L ${x - 30} ${y - 22} L ${x - 30} ${y + 14} Z`} {...f(shade(c.color, -0.2))} />
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
          <path d={`M ${x + 4} ${y - 112} Q ${x - 30} ${y - 128} ${x - 34} ${y - 168} L ${x + 62} ${y - 168} Q ${x + 58} ${y - 128} ${x + 24} ${y - 112} Z`} {...f(c.color)} />
          <ellipse cx={x + 14} cy={y - 168} rx={48} ry={11} {...f(shade(c.color, -0.5))} />
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
          <ellipse cx={x + 16} cy={y - 22} rx={7} ry={9} fill="#c9a07a" stroke={O} strokeWidth={1.5} />
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
          <path d={`M ${x + 10} ${y - 120} L ${x + 120} ${y - 96} L ${x + 9} ${y - 66} Z`} {...f(c.color)} />
          <text x={x + 50} y={y - 85} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={15} fill={accent(c.color)} transform={`rotate(7 ${x + 50} ${y - 90})`}>
            GO TEAM
          </text>
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
      return (
        <g transform={`rotate(-14 ${x} ${y})`}>
          {[-16, 0, 16].map((a) => (
            <g key={a} transform={`rotate(${a} ${x + 6} ${y + 4})`}>
              <rect x={x - 12} y={y - 62} width={40} height={66} rx={3} {...f(c.color)} strokeWidth={2} />
              <circle cx={x + 8} cy={y - 29} r={10} fill="none" stroke={shade(c.color, -0.35)} strokeWidth={2} />
              <text x={x + 8} y={y - 22} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={18} fill={shade(c.color, -0.45)}>
                $
              </text>
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
      return (
        <g>
          <rect x={x - 12} y={y - 62} width={64} height={66} rx={3} {...f(c.color)} />
          <rect x={x + 14} y={y - 62} width={12} height={66} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <rect x={x - 12} y={y - 36} width={64} height={12} fill="#f2c230" stroke={O} strokeWidth={1.5} />
          <path d={`M ${x + 20} ${y - 62} q -26 -26 -30 -4 q 4 10 30 4 q 26 -26 30 -4 q -4 10 -30 4 Z`} fill="#f2c230" {...ink} strokeWidth={2} />
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
      return (
        <g transform={`rotate(-12 ${x} ${y})`}>
          <rect x={x - 14} y={y - 52} width={76} height={50} rx={3} {...pale(c.color)} />
          <path d={`M ${x - 14} ${y - 52} L ${x + 24} ${y - 22} L ${x + 62} ${y - 52}`} fill="none" stroke={O} strokeWidth={2} />
          <path d={`M ${x + 24} ${y - 18} C ${x + 10} ${y - 28} ${x + 16} ${y - 40} ${x + 24} ${y - 32} C ${x + 32} ${y - 40} ${x + 38} ${y - 28} ${x + 24} ${y - 18} Z`} fill="#e5322d" stroke={O} strokeWidth={1.5} />
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
          <circle cx={x + 11} cy={y - 70} r={5} fill="#d33b2c" />
          {[0, 1, 2].map((r) =>
            [0, 1].map((col) => <rect key={`${r},${col}`} x={x + 2 + col * 12} y={y - 54 + r * 14} width={7} height={7} rx={2} fill="#c9c9c9" />),
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
          <path d={`M ${x - 18} ${y - 92} L ${x + 34} ${y - 92} L ${x + 26} ${y + 8} L ${x - 10} ${y + 8} Z`} {...f(c.color)} />
          <path d={`M ${x - 14} ${y - 62} L ${x + 30} ${y - 62} L ${x + 28} ${y - 40} L ${x - 12} ${y - 40} Z`} fill="#fff" />
          <rect x={x - 22} y={y - 102} width={60} height={12} rx={5} {...f('#f4f4f4')} />
          <path d={`M ${x + 12} ${y - 100} L ${x + 22} ${y - 144} L ${x + 34} ${y - 146}`} fill="none" stroke={O} strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${x + 12} ${y - 100} L ${x + 22} ${y - 144} L ${x + 34} ${y - 146}`} fill="none" stroke="#f2c230" strokeWidth={4} strokeLinecap="round" />
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
          <path d={`M ${x - 6} ${y - 78} q -6 -34 10 -40 q 6 22 2 40 Z`} fill="#7fbf3f" {...ink} strokeWidth={2} />
          <path d={`M ${x - 22} ${y - 80} L ${x + 50} ${y - 80} L ${x + 46} ${y + 16} L ${x - 18} ${y + 16} Z`} {...f(c.color)} />
          <path d={`M ${x - 22} ${y - 80} l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8`} fill="none" stroke={shade(c.color, -0.3)} strokeWidth={2} />
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
          <rect x={x - 10} y={y - 42} width={30} height={26} fill="#f2e2b8" stroke={O} strokeWidth={1.5} />
          <rect x={x - 4} y={y - 100} width={22} height={8} rx={2} fill="#c9c9c9" stroke={O} strokeWidth={1.5} />
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
          <path d={`M ${x - 52} ${y - 104} Q ${x + 10} ${y - 168} ${x + 72} ${y - 104} L ${x + 64} ${y - 96} Q ${x + 10} ${y - 140} ${x - 44} ${y - 96} Z`} {...f(c.color)} />
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
          <ellipse cx={x + 38} cy={y - 118} rx={14} ry={21} transform={`rotate(17 ${x + 38} ${y - 118})`} {...pale('#fdfdfd')} />
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
          <rect x={x - 4} y={y - 66} width={16} height={78} rx={6} {...f('#3d3d44')} />
          <circle cx={x + 4} cy={y - 106} r={23} {...f('#9aa3ad')} />
          <path d={`M ${x - 14} ${y - 118} L ${x + 22} ${y - 94} M ${x - 14} ${y - 96} L ${x + 22} ${y - 118} M ${x - 19} ${y - 106} L ${x + 27} ${y - 106}`} stroke="#6b7078" strokeWidth={2} />
          <rect x={x - 20} y={y - 88} width={48} height={32} rx={4} {...f(c.color)} strokeWidth={2} />
          <text x={x + 4} y={y - 65} textAnchor="middle" fontFamily="'Luckiest Guy', 'Arial Black', sans-serif" fontSize={19} fill="#fff">
            TV
          </text>
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
  // Things that are rarely anybody's: they blow past, roll by or fall.
  {
    id: 'mask',
    name: 'Face Mask',
    quip: 'Worn under the nose. Has never stopped anything.',
    defaultColor: '#bfe0ee',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <path d={`M ${x - 34} ${y - 30} q -18 10 0 22 M ${x + 34} ${y - 30} q 18 10 0 22`} fill="none" stroke="#f4f4f4" strokeWidth={3} />
          <rect x={x - 34} y={y - 38} width={68} height={38} rx={8} {...f(c.color)} />
          <path d={`M ${x - 28} ${y - 26} L ${x + 28} ${y - 26} M ${x - 28} ${y - 18} L ${x + 28} ${y - 18} M ${x - 28} ${y - 10} L ${x + 28} ${y - 10}`} stroke={shade(c.color, -0.18)} strokeWidth={2.5} />
        </g>
      );
    },
  },
  {
    id: 'newspaper',
    name: 'Newspaper',
    quip: 'Yesterday\'s news. Today\'s puppy pad.',
    defaultColor: '#efe9dc',
    render: (c) => {
      const [x, y] = hand(c);
      return (
        <g>
          <rect x={x - 44} y={y - 68} width={88} height={68} {...f(c.color)} />
          <rect x={x - 36} y={y - 60} width={72} height={12} fill={O} />
          <path d={`M ${x - 36} ${y - 40} L ${x - 4} ${y - 40} M ${x - 36} ${y - 30} L ${x - 4} ${y - 30} M ${x - 36} ${y - 20} L ${x - 4} ${y - 20} M ${x - 36} ${y - 10} L ${x - 4} ${y - 10}`} stroke={shade(c.color, -0.4)} strokeWidth={3} />
          <rect x={x + 6} y={y - 42} width={30} height={32} fill={shade(c.color, -0.25)} />
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
      return (
        <g>
          <path d={`M ${x + 40} ${y - 48} q 26 -20 24 -40`} fill="none" stroke={O} strokeWidth={9} strokeLinecap="round" />
          <path d={`M ${x + 40} ${y - 48} q 26 -20 24 -40`} fill="none" stroke={c.color} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={x + 10} cy={y - 34} rx={40} ry={26} {...f(c.color)} />
          {[-22, -8, 24, 36].map((dx) => (
            <rect key={dx} x={x + dx - 6} y={y - 16} width={12} height={16} rx={5} {...f(c.color)} strokeWidth={2} />
          ))}
          <circle cx={x - 30} cy={y - 66} r={28} {...f(c.color)} />
          <ellipse cx={x - 54} cy={y - 62} rx={10} ry={20} {...f(shade(c.color, -0.3))} />
          <ellipse cx={x - 6} cy={y - 62} rx={10} ry={20} {...f(shade(c.color, -0.3))} />
          <circle cx={x - 38} cy={y - 70} r={4} fill={O} />
          <circle cx={x - 22} cy={y - 70} r={4} fill={O} />
          <ellipse cx={x - 30} cy={y - 56} rx={7} ry={5} fill={O} />
          <path d={`M ${x - 46} ${y - 42} q 16 8 32 0`} stroke="#d33b2c" strokeWidth={6} fill="none" />
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
      return (
        <g>
          <path d={`M ${x + 26} ${y - 20} Q ${x + 60} ${y - 30} ${x + 50} ${y - 90}`} fill="none" stroke={O} strokeWidth={10} strokeLinecap="round" />
          <path d={`M ${x + 26} ${y - 20} Q ${x + 60} ${y - 30} ${x + 50} ${y - 90}`} fill="none" stroke={c.color} strokeWidth={6} strokeLinecap="round" />
          <ellipse cx={x} cy={y - 30} rx={30} ry={32} {...f(c.color)} />
          <path d={`M ${x - 28} ${y - 72} L ${x - 24} ${y - 104} L ${x - 6} ${y - 82} Z M ${x + 28} ${y - 72} L ${x + 24} ${y - 104} L ${x + 6} ${y - 82} Z`} {...f(c.color)} />
          <circle cx={x} cy={y - 72} r={28} {...f(c.color)} />
          <ellipse cx={x - 10} cy={y - 74} rx={5} ry={7} fill="#c8e86a" stroke={O} strokeWidth={1.5} />
          <ellipse cx={x + 10} cy={y - 74} rx={5} ry={7} fill="#c8e86a" stroke={O} strokeWidth={1.5} />
          <path d={`M ${x - 12} ${y - 80} L ${x - 6} ${y - 78} M ${x + 12} ${y - 80} L ${x + 6} ${y - 78}`} stroke={O} strokeWidth={2.5} />
          <path d={`M ${x - 4} ${y - 62} L ${x + 4} ${y - 62} L ${x} ${y - 58} Z`} fill="#f27bb4" />
          <path d={`M ${x - 10} ${y - 30} q 10 -6 20 0 M ${x - 12} ${y - 18} q 12 -6 24 0`} stroke={shade(c.color, -0.3)} strokeWidth={3} fill="none" />
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
      return (
        <g>
          <path d={`M ${x + 44} ${y - 40} q 14 -4 10 -14 q -4 -8 -10 0`} fill="none" stroke={O} strokeWidth={3} />
          <ellipse cx={x + 6} cy={y - 34} rx={44} ry={30} {...f(c.color)} />
          {[-24, -8, 20, 34].map((dx) => (
            <rect key={dx} x={x + dx - 6} y={y - 12} width={12} height={12} rx={3} {...f(shade(c.color, -0.1))} strokeWidth={2} />
          ))}
          <path d={`M ${x - 40} ${y - 66} L ${x - 46} ${y - 86} L ${x - 28} ${y - 74} Z`} {...f(c.color)} strokeWidth={2} />
          <circle cx={x - 30} cy={y - 50} r={20} {...f(c.color)} />
          <ellipse cx={x - 46} cy={y - 46} rx={9} ry={8} {...f(shade(c.color, -0.12))} strokeWidth={2} />
          <circle cx={x - 49} cy={y - 46} r={2} fill={O} />
          <circle cx={x - 43} cy={y - 46} r={2} fill={O} />
          <circle cx={x - 30} cy={y - 58} r={3} fill={O} />
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
      return (
        <g>
          <path d={scallop(x, y - 26, 38, 24, 14, 0.06)} {...f(c.color)} />
          <ellipse cx={x + 10} cy={y - 30} rx={16} ry={14} fill="#fff" />
          <circle cx={x - 26} cy={y - 32} r={3.5} fill={O} />
          <ellipse cx={x - 36} cy={y - 26} rx={3} ry={2} fill="#f27bb4" />
          <ellipse cx={x - 18} cy={y - 46} rx={7} ry={5} {...f(shade(c.color, -0.2))} strokeWidth={1.5} />
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
      return (
        <g>
          <ellipse cx={x - 40} cy={y - 18} rx={14} ry={11} {...f('#9bd36a')} />
          <circle cx={x - 44} cy={y - 21} r={2.5} fill={O} />
          {[-20, 26].map((dx) => (
            <ellipse key={dx} cx={x + dx} cy={y - 4} rx={9} ry={6} {...f('#9bd36a')} strokeWidth={2} />
          ))}
          <path d={`M ${x - 32} ${y - 6} Q ${x} ${y - 66} ${x + 36} ${y - 6} Z`} {...f(c.color)} />
          <path d={`M ${x - 10} ${y - 20} l 10 -14 l 10 14 Z M ${x - 24} ${y - 12} l 8 -10 M ${x + 24} ${y - 12} l -8 -10`} fill="none" stroke={shade(c.color, -0.35)} strokeWidth={2.5} />
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
      return (
        <g>
          <path d={`M ${x - 6} ${y} L ${x - 6} ${y - 14} M ${x + 8} ${y} L ${x + 8} ${y - 14}`} stroke="#f0742a" strokeWidth={4} />
          <path d={`M ${x - 30} ${y - 40} Q ${x - 30} ${y - 14} ${x} ${y - 14} Q ${x + 36} ${y - 14} ${x + 40} ${y - 50} Q ${x + 20} ${y - 40} ${x + 10} ${y - 44} Z`} {...pale(c.color)} />
          <circle cx={x - 24} cy={y - 56} r={16} {...pale(c.color)} />
          <path d={`M ${x - 32} ${y - 70} q 4 -10 8 -2 q 4 -10 8 -2 q 4 -8 6 2`} fill="#e5322d" {...ink} strokeWidth={1.5} />
          <path d={`M ${x - 40} ${y - 58} L ${x - 50} ${y - 54} L ${x - 40} ${y - 50} Z`} fill="#f2c230" {...ink} strokeWidth={1.5} />
          <circle cx={x - 28} cy={y - 60} r={2.5} fill={O} />
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
          <path d={`M ${x - 30} ${y - 10} L ${x - 30} ${y - 70} Q ${x} ${y - 120} ${x + 30} ${y - 70} L ${x + 30} ${y - 10} l -10 -10 l -10 10 l -10 -10 l -10 10 l -10 -10 l -10 10 Z`} fill="#fff" stroke="#a9b8c6" strokeWidth={3} strokeDasharray="6 4" />
          <ellipse cx={x - 10} cy={y - 70} rx={5} ry={7} fill={O} />
          <ellipse cx={x + 10} cy={y - 70} rx={5} ry={7} fill={O} />
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
      return (
        <g>
          <path d={`M ${x} ${y - 100} L ${x} ${y - 116}`} stroke={O} strokeWidth={3} />
          <circle cx={x} cy={y - 120} r={6} fill="#e5322d" {...ink} strokeWidth={2} />
          <rect x={x - 26} y={y - 100} width={52} height={38} rx={8} {...f(c.color)} />
          <circle cx={x - 11} cy={y - 82} r={7} fill="#7fd4ff" {...ink} strokeWidth={2} />
          <circle cx={x + 11} cy={y - 82} r={7} fill="#7fd4ff" {...ink} strokeWidth={2} />
          <rect x={x - 22} y={y - 60} width={44} height={42} rx={6} {...f(shade(c.color, -0.12))} />
          <rect x={x - 12} y={y - 50} width={24} height={14} rx={3} fill="#2b3a4a" />
          <rect x={x - 20} y={y - 18} width={14} height={18} rx={3} {...f('#55555a')} strokeWidth={2} />
          <rect x={x + 6} y={y - 18} width={14} height={18} rx={3} {...f('#55555a')} strokeWidth={2} />
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
      return (
        <g>
          <path d={`M ${x - 14} ${y - 4} L ${x - 10} ${y - 40} L ${x + 10} ${y - 40} L ${x + 14} ${y - 4}`} {...f(c.color)} />
          <path d={`M ${x - 34} ${y - 82} Q ${x - 40} ${y - 130} ${x} ${y - 130} Q ${x + 40} ${y - 130} ${x + 34} ${y - 82} Q ${x + 20} ${y - 38} ${x} ${y - 38} Q ${x - 20} ${y - 38} ${x - 34} ${y - 82} Z`} {...f(c.color)} />
          <ellipse cx={x - 14} cy={y - 84} rx={10} ry={16} transform={`rotate(30 ${x - 14} ${y - 84})`} fill={O} />
          <ellipse cx={x + 14} cy={y - 84} rx={10} ry={16} transform={`rotate(-30 ${x + 14} ${y - 84})`} fill={O} />
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
      return (
        <g>
          <circle cx={x} cy={y - 44} r={44} fill="#bfe6ff" fillOpacity={0.45} stroke="#6fa8d0" strokeWidth={4} />
          <ellipse cx={x} cy={y - 26} rx={22} ry={16} {...f(c.color)} />
          <circle cx={x - 14} cy={y - 34} r={3} fill={O} />
          <circle cx={x - 18} cy={y - 44} r={6} {...f(shade(c.color, 0.25))} strokeWidth={1.5} />
          <path d={`M ${x - 26} ${y - 70} Q ${x - 10} ${y - 84} ${x + 10} ${y - 80}`} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
        </g>
      );
    },
  },
  {
    id: 'bat',
    name: 'Cave Bat',
    quip: 'Sleeps upside down. Has opinions about the local fruit.',
    defaultColor: '#3d3a46',
    render: (c) => {
      const { x, y } = spot(c);
      const by = y - 64;
      const wing = (s: number) => `M ${x + s * 12} ${by - 14} Q ${x + s * 54} ${by - 62} ${x + s * 118} ${by - 40} Q ${x + s * 100} ${by - 18} ${x + s * 104} ${by + 8} Q ${x + s * 82} ${by - 10} ${x + s * 68} ${by + 16} Q ${x + s * 50} ${by} ${x + s * 12} ${by + 22} Z`;
      return (
        <g>
          <path d={wing(-1)} {...f(c.color)} />
          <path d={wing(1)} {...f(c.color)} />
          <path d={`M ${x - 22} ${by - 22} L ${x - 26} ${by - 60} L ${x - 4} ${by - 34} Z M ${x + 22} ${by - 22} L ${x + 26} ${by - 60} L ${x + 4} ${by - 34} Z`} {...f(c.color)} />
          <ellipse cx={x} cy={by} rx={26} ry={36} {...f(c.color)} />
          <circle cx={x - 10} cy={by - 12} r={7} fill="#fff" />
          <circle cx={x + 10} cy={by - 12} r={7} fill="#fff" />
          <circle cx={x - 9} cy={by - 11} r={2.6} fill={O} />
          <circle cx={x + 11} cy={by - 11} r={2.6} fill={O} />
          <path d={`M ${x - 9} ${by + 6} l 4 9 l 4 -8 l 2 0 l 4 8 l 4 -9`} fill="#fff" stroke={O} strokeWidth={1.5} />
        </g>
      );
    },
  },
  {
    id: 'frog',
    name: 'Pond Frog',
    quip: 'Used to be somebody. Will not say who.',
    defaultColor: '#6fae3f',
    render: (c) => {
      const { x, y } = spot(c);
      return (
        <g>
          <ellipse cx={x - 40} cy={y - 8} rx={30} ry={10} {...f(shade(c.color, -0.15))} />
          <ellipse cx={x + 40} cy={y - 8} rx={30} ry={10} {...f(shade(c.color, -0.15))} />
          <ellipse cx={x} cy={y - 40} rx={52} ry={36} {...f(c.color)} />
          <circle cx={x - 26} cy={y - 76} r={16} {...f(c.color)} />
          <circle cx={x + 26} cy={y - 76} r={16} {...f(c.color)} />
          <circle cx={x - 26} cy={y - 78} r={9} fill="#fff" />
          <circle cx={x + 26} cy={y - 78} r={9} fill="#fff" />
          <circle cx={x - 26} cy={y - 76} r={4} fill={O} />
          <circle cx={x + 26} cy={y - 76} r={4} fill={O} />
          <path d={`M ${x - 34} ${y - 36} Q ${x} ${y - 16} ${x + 34} ${y - 36}`} fill="none" stroke={O} strokeWidth={3.5} />
        </g>
      );
    },
  },
];
