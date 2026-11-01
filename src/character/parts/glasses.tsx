import type { ItemBase, Render } from '../../types';
import { shade } from '../../lib/color';
import { heartPath, ink, Mirror, O, scallop, starPath } from './common';

export interface GlassesDef extends ItemBase {
  render?: Render;
}

const frame = (color: string, w = 5) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: w,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
});

const temples = (color: string, y = -6) => (
  <Mirror>
    <path d={`M -66 ${y} L -126 ${y - 8}`} {...frame(color, 4)} />
  </Mirror>
);

export const GLASSES: GlassesDef[] = [
  { id: 'none', name: 'None', quip: '20/20 vision. Sees all your mistakes in high definition.' },
  {
    id: 'round',
    name: 'Round Specs',
    quip: 'Can see your sins clearly. Has read every book in the library. Twice.',
    defaultColor: '#1f1f22',
    render: (c) => (
      <g>
        {temples(c.color)}
        <Mirror>
          <circle cx={-32} cy={0} r={32} fill="#dff3ff" opacity={0.25} />
          <circle cx={-32} cy={0} r={32} {...frame(c.color)} />
        </Mirror>
        <path d="M -3 -6 Q 0 -12 3 -6" {...frame(c.color, 4)} />
      </g>
    ),
  },
  {
    id: 'square',
    name: 'Nerd Frames',
    quip: 'Lunch money: already taken. Spirit: unbroken. Homework: done.',
    defaultColor: '#1f1f22',
    render: (c) => (
      <g>
        {temples(c.color, -10)}
        <Mirror>
          <rect x={-66} y={-30} width={60} height={54} rx={9} fill="#dff3ff" opacity={0.25} />
          <rect x={-66} y={-30} width={60} height={54} rx={9} {...frame(c.color, 7)} />
        </Mirror>
        <path d="M -6 -10 L 6 -10" {...frame(c.color, 6)} />
      </g>
    ),
  },
  {
    id: 'taped',
    name: 'Taped Nerd Frames',
    quip: 'Broke them in dodgeball. Fixed them with tape. Lost at dodgeball again.',
    defaultColor: '#1f1f22',
    render: (c) => (
      <g>
        {temples(c.color, -10)}
        <Mirror>
          <rect x={-66} y={-30} width={60} height={54} rx={9} fill="#dff3ff" opacity={0.25} />
          <rect x={-66} y={-30} width={60} height={54} rx={9} {...frame(c.color, 7)} />
        </Mirror>
        <rect x={-12} y={-20} width={24} height={20} rx={3} fill="#fff" {...ink} strokeWidth={2} />
        <path d="M -8 -16 L 8 -4 M -8 -4 L 8 -16" stroke="#bbb" strokeWidth={1.5} />
      </g>
    ),
  },
  {
    id: 'sunglasses',
    name: 'Shades',
    quip: 'Cool. So cool. Cannot see anything. Has walked into a pole.',
    defaultColor: '#1f1f22',
    render: (c) => (
      <g>
        {temples(c.color, -16)}
        <Mirror>
          <path d="M -72 -24 L -4 -24 L -8 14 Q -38 30 -66 14 Z" {...frame(c.color, 5)} fill="#1d1d1d" />
          <path d="M -58 -14 L -40 -14" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
        </Mirror>
        <path d="M -4 -20 L 4 -20" {...frame(c.color, 6)} />
      </g>
    ),
  },
  {
    id: 'aviators',
    name: 'Aviators',
    quip: 'Feels the need. The need for snacks.',
    defaultColor: '#d9b44a',
    render: (c) => (
      <g>
        {temples(c.color, -16)}
        <Mirror>
          <path d="M -68 -20 Q -36 -30 -6 -20 Q -4 20 -30 30 Q -66 28 -68 -20 Z" fill="#3c5a7a" opacity={0.88} />
          <path d="M -68 -20 Q -36 -30 -6 -20 Q -4 20 -30 30 Q -66 28 -68 -20 Z" {...frame(c.color, 3.5)} />
          <path d="M -56 -12 L -30 -14" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        </Mirror>
        <path d="M -6 -20 Q 0 -26 6 -20 M -8 -12 L 8 -12" {...frame(c.color, 3)} />
      </g>
    ),
  },
  {
    id: 'hearts',
    name: 'Heart Glasses',
    quip: 'Love is blind. These help. A little.',
    defaultColor: '#e5322d',
    render: (c) => (
      <g>
        {temples(c.color)}
        <Mirror>
          <path d={heartPath(-34, 0, 30)} fill={c.color} opacity={0.7} />
          <path d={heartPath(-34, 0, 30)} {...frame(shade(c.color, -0.3), 4)} />
        </Mirror>
        <path d="M -6 -10 L 6 -10" {...frame(shade(c.color, -0.3), 4)} />
      </g>
    ),
  },
  {
    id: 'stars',
    name: 'Star Glasses',
    quip: 'Born to be famous. Currently famous in their own bedroom.',
    defaultColor: '#f2c230',
    render: (c) => (
      <g>
        {temples(shade(c.color, -0.3))}
        <Mirror>
          <path d={starPath(-34, 2, 38, 0.5)} fill={c.color} opacity={0.75} />
          <path d={starPath(-34, 2, 38, 0.5)} {...frame(shade(c.color, -0.35), 4)} />
        </Mirror>
      </g>
    ),
  },
  {
    id: '3d',
    name: '3D Glasses',
    quip: 'Life is better in 3D. Headache included at no extra charge.',
    colorable: false,
    render: () => (
      <g>
        {temples('#fff')}
        <rect x={-74} y={-30} width={148} height={54} rx={8} fill="#fff" {...ink} />
        <rect x={-64} y={-22} width={54} height={38} rx={5} fill="#e5322d" opacity={0.75} />
        <rect x={10} y={-22} width={54} height={38} rx={5} fill="#2ec4c4" opacity={0.75} />
      </g>
    ),
  },
  {
    id: 'monocle',
    name: 'Monocle',
    quip: 'Indubitably. Has never used the word "indubitably" correctly.',
    defaultColor: '#d9b44a',
    render: (c) => (
      <g>
        <circle cx={28} cy={0} r={30} fill="#dff3ff" opacity={0.3} />
        <circle cx={28} cy={0} r={30} {...frame(c.color, 5)} />
        <path d="M 52 18 Q 70 60 60 110 Q 54 130 66 150" fill="none" stroke={c.color} strokeWidth={2.5} strokeDasharray="4 3" />
      </g>
    ),
  },
  {
    id: 'goggles',
    name: 'Ski Goggles',
    quip: 'Shreds the bunny slope. The bunny slope has filed a complaint.',
    defaultColor: '#d33b2c',
    render: (c) => (
      <g>
        <Mirror>
          <path d="M -90 -10 L -132 -20 L -132 8 L -90 10 Z" fill={c.color} {...ink} strokeWidth={2} />
        </Mirror>
        <path d="M -92 -34 Q 0 -48 92 -34 Q 104 0 92 32 Q 30 40 10 26 Q 0 20 -10 26 Q -30 40 -92 32 Q -104 0 -92 -34 Z" fill="#f0742a" {...ink} strokeWidth={5} />
        <path d="M -84 -26 Q 0 -38 84 -26 Q 92 -4 86 8 Q 0 -6 -84 8 Q -92 -4 -84 -26 Z" fill="#ffd36b" opacity={0.65} />
        <path d="M -60 -20 L -20 -24" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
      </g>
    ),
  },
  {
    id: 'vr',
    name: 'VR Headset',
    quip: 'Lives in the metaverse. Visits reality on weekends. Hates it.',
    defaultColor: '#f4f4f4',
    render: (c) => (
      <g>
        <Mirror>
          <path d="M -86 -16 L -132 -26 L -132 4 L -86 10 Z" fill="#333" {...ink} strokeWidth={2} />
        </Mirror>
        <rect x={-90} y={-38} width={180} height={72} rx={22} fill={c.color} {...ink} strokeWidth={4} />
        <rect x={-74} y={-24} width={148} height={44} rx={14} fill="#1d1d1d" />
        <circle cx={60} cy={-28} r={4} fill="#4cf06a" />
      </g>
    ),
  },
  {
    id: 'granny',
    name: 'Granny Glasses',
    quip: 'Reads the fine print. All of it. Out loud. At the movies.',
    defaultColor: '#8e3b1f',
    render: (c) => (
      <g>
        <Mirror>
          <circle cx={-36} cy={6} r={36} fill="#dff3ff" opacity={0.25} />
          <circle cx={-36} cy={6} r={36} {...frame(c.color, 3)} />
          <path d="M -72 10 Q -100 80 -96 140" fill="none" stroke="#c9a77a" strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />
        </Mirror>
        <path d="M -3 0 Q 0 -6 3 0" {...frame(c.color, 3)} />
      </g>
    ),
  },
  {
    id: 'cateye',
    name: 'Cat-Eye',
    quip: 'Retro glam. Judges you from the 1950s.',
    defaultColor: '#e86fb0',
    render: (c) => (
      <g>
        {temples(c.color, -16)}
        <Mirror>
          <path d="M -80 -36 Q -40 -26 -6 -20 Q -2 14 -32 24 Q -62 24 -68 -6 Q -74 -20 -80 -36 Z" fill="#dff3ff" opacity={0.25} />
          <path d="M -80 -36 Q -40 -26 -6 -20 Q -2 14 -32 24 Q -62 24 -68 -6 Q -74 -20 -80 -36 Z" {...frame(c.color, 6)} />
        </Mirror>
        <path d="M -6 -16 L 6 -16" {...frame(c.color, 5)} />
      </g>
    ),
  },
  {
    id: 'shutter',
    name: 'Shutter Shades',
    quip: 'Partying like it\'s a year that ended a long time ago.',
    defaultColor: '#f2c230',
    render: (c) => (
      <g>
        {temples(c.color, -10)}
        <Mirror>
          <rect x={-68} y={-28} width={62} height={50} rx={8} {...frame(c.color, 5)} />
          {[-16, -4, 8].map((y) => (
            <line key={y} x1={-66} y1={y} x2={-8} y2={y} stroke={c.color} strokeWidth={5} />
          ))}
        </Mirror>
        <path d="M -6 -10 L 6 -10" {...frame(c.color, 5)} />
      </g>
    ),
  },
];

/* ------------------------------------------------------------- face gear */

export const FACE_GEAR: GlassesDef[] = [
  { id: 'none', name: 'None', quip: 'Naked face. Brave. Possibly reckless.' },
  {
    id: 'eyepatch',
    name: 'Eye Patch',
    quip: 'Lost an eye in a dodgeball accident. Found it later. Kept the patch.',
    render: () => (
      <g>
        <path d="M 12 -24 L -126 -66 M 50 -10 L 128 -2" stroke={O} strokeWidth={4} />
        <ellipse cx={30} cy={2} rx={30} ry={34} fill="#1d1d1d" {...ink} />
      </g>
    ),
  },
  {
    id: 'mask',
    name: 'Germ Mask',
    quip: 'Germs: zero. Fun: also zero. Breath: minty.',
    render: () => (
      <g>
        <Mirror>
          <path d="M -70 40 Q -110 20 -126 4" fill="none" stroke="#e8f2f8" strokeWidth={4} />
        </Mirror>
        <path d="M -72 30 Q 0 20 72 30 L 66 92 Q 0 112 -66 92 Z" fill="#a8d8f0" {...ink} />
        <path d="M -66 50 Q 0 42 66 50 M -64 70 Q 0 64 64 70" fill="none" stroke="#6aa8c8" strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'disguise',
    name: 'Master of Disguise',
    quip: 'Nobody suspects a thing. Everybody suspects everything.',
    render: () => (
      <g>
        <Mirror>
          <rect x={-66} y={-26} width={60} height={50} rx={14} fill="none" stroke={O} strokeWidth={7} />
          <path d="M -60 -40 Q -36 -58 -8 -44" stroke={O} strokeWidth={12} strokeLinecap="round" fill="none" />
        </Mirror>
        <path d="M -6 -6 L 6 -6" stroke={O} strokeWidth={6} />
        <path d="M -10 4 Q -24 44 -6 50 Q 0 52 6 50 Q 24 44 10 4 Z" fill="#f2a98a" {...ink} />
        <path d="M -40 60 Q -20 44 0 54 Q 20 44 40 60 Q 20 58 0 64 Q -20 58 -40 60 Z" fill={O} />
      </g>
    ),
  },
  {
    id: 'pacifier',
    name: 'Pacifier',
    quip: 'Still in denial about being a big kid. Big kid is in denial too.',
    render: () => (
      <g>
        <ellipse cx={0} cy={64} rx={24} ry={14} fill="#7fd4ff" {...ink} />
        <circle cx={0} cy={68} r={13} fill="none" stroke="#f27bb4" strokeWidth={5} />
        <circle cx={0} cy={64} r={6} fill="#f27bb4" {...ink} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'gum',
    name: 'Bubble Gum',
    quip: 'Pop goes the weasel. And the bubble. All over the face.',
    render: () => (
      <g>
        <circle cx={0} cy={72} r={34} fill="#f7a1c4" {...ink} />
        <path d="M -16 54 Q -8 46 4 46" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
      </g>
    ),
  },
  {
    id: 'bandit',
    name: 'Bandit Mask',
    quip: 'Wanted for stealing third base. And several cookies.',
    render: () => (
      <g>
        <Mirror>
          <path d="M -90 -18 L -134 -36 M -94 -8 L -132 -10" stroke={O} strokeWidth={4} />
        </Mirror>
        <path
          d="M -98 -22 Q -60 -44 0 -26 Q 60 -44 98 -22 Q 100 22 60 28 Q 20 28 0 10 Q -20 28 -60 28 Q -100 22 -98 -22 Z M -12 2 A 18 22 0 1 0 -48 2 A 18 22 0 1 0 -12 2 Z M 48 2 A 18 22 0 1 0 12 2 A 18 22 0 1 0 48 2 Z"
          fill="#1d1d1d"
          fillRule="evenodd"
          {...ink}
        />
      </g>
    ),
  },
  {
    id: 'hockey',
    name: 'Hockey Mask',
    quip: 'Plays hockey. Just hockey. Definitely just hockey. Why are you running?',
    render: () => (
      <g>
        <path
          d="M -86 -40 C -90 -100 90 -100 86 -40 C 90 40 50 108 0 112 C -50 108 -90 40 -86 -40 Z M -14 2 A 20 16 0 1 0 -54 2 A 20 16 0 1 0 -14 2 Z M 54 2 A 20 16 0 1 0 14 2 A 20 16 0 1 0 54 2 Z"
          fill="#f4f1e6"
          fillRule="evenodd"
          {...ink}
        />
        {[
          [-20, 50],
          [0, 56],
          [20, 50],
          [-10, 76],
          [10, 76],
          [0, 94],
          [-50, -50],
          [50, -50],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill={O} />
        ))}
        <path d="M -60 -60 L -40 -80 M 60 -60 L 40 -80" stroke="#d33b2c" strokeWidth={6} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'lollipop',
    name: 'Lollipop',
    quip: 'Sugar rush incoming. Teachers, take cover.',
    render: () => (
      <g>
        <path d="M 8 62 L 64 84" stroke="#fff" strokeWidth={6} strokeLinecap="round" />
        <path d="M 8 62 L 64 84" stroke={O} strokeWidth={1.5} />
        <circle cx={78} cy={90} r={22} fill="#f27bb4" {...ink} />
        <path d="M 78 90 m 0 -3 a 3 3 0 1 1 -3 3 a 7 7 0 1 1 7 7 a 12 12 0 1 1 -12 -12 a 17 17 0 1 1 17 17" fill="none" stroke="#fff" strokeWidth={3} />
      </g>
    ),
  },
  {
    id: 'toothpick',
    name: 'Toothpick',
    quip: 'Tough guy. Very tough. Allergic to cats and feelings.',
    render: () => <path d="M 8 62 L 48 52" stroke="#d9b06b" strokeWidth={4} strokeLinecap="round" />,
  },
  {
    id: 'blower',
    name: 'Party Blower',
    quip: 'Toot toot! Still annoying. Will never be less annoying.',
    render: () => (
      <g>
        <path d="M 4 60 L 30 56 L 100 56 L 100 72 L 30 70 L 4 66 Z" fill="#3b6fd8" {...ink} strokeWidth={2.5} />
        <path d="M 40 56 L 40 72 M 60 56 L 60 72 M 80 56 L 80 72" stroke="#f2c230" strokeWidth={5} />
        <path d="M 100 56 L 100 72" fill="none" {...ink} strokeWidth={2.5} />
      </g>
    ),
  },
  {
    id: 'kiss',
    name: 'Grandma Smooch',
    quip: 'Grandma got you. There is no escape from Grandma.',
    render: () => (
      <g transform="rotate(-20 70 40)" fill="#e2364e">
        <path d="M 56 36 Q 62 28 70 34 Q 78 28 84 36 Q 76 40 70 39 Q 62 40 56 36 Z" />
        <path d="M 56 40 Q 70 52 84 40 Q 76 44 70 44 Q 62 44 56 40 Z" />
      </g>
    ),
  },
  {
    id: 'bandana',
    name: 'Outlaw Bandana',
    quip: 'Robs banks. Piggy banks. Mostly their own.',
    render: () => (
      <g>
        <path d="M -116 16 Q 0 4 116 16 Q 100 80 0 124 Q -100 80 -116 16 Z" fill="#d33b2c" {...ink} />
        {[
          [-60, 40],
          [-20, 34],
          [20, 34],
          [60, 40],
          [-40, 66],
          [0, 64],
          [40, 66],
          [-16, 92],
          [16, 92],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="#fff" />
        ))}
      </g>
    ),
  },
  {
    id: 'cucumber',
    name: 'Spa Day',
    quip: 'Self-care is important. So is not falling asleep in class. Pick one.',
    render: () => (
      <Mirror>
        <circle cx={-27} cy={2} r={30} fill="#7fbf3f" {...ink} />
        <circle cx={-27} cy={2} r={23} fill="#d8f0a8" />
        <path d={scallop(-27, 2, 9, 9, 6, 0.2)} fill="none" stroke="#9fd06a" strokeWidth={2} />
      </Mirror>
    ),
  },
];
