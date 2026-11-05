import type { ItemBase, Render } from '../../types';
import { accent, shade } from '../../lib/color';
import { edge, ink, Mirror, O, pale, scallop, scallopEdge, starPath } from './common';

export interface HatDef extends ItemBase {
  back?: Render;
  front?: Render;
  /** Hair above this y (head coordinates) is hidden under the hat. */
  clipHairAbove?: number;
  hidesHair?: boolean;
  /** Covers the whole face; skip drawing eyes/mouth/etc. */
  hidesFace?: boolean;
  /** Speech comes out as "mmmph". */
  muffles?: boolean;
  /** Eyes (and brows and glasses) are drawn over the hat, like eyes peeking out over a hood's fur. */
  eyesOver?: boolean;
}

const f = (color: string) => ({ fill: color, ...ink });

const DOME = (y: number, top = -136, w = 132) =>
  `M ${-w} ${y} C ${-w - 4} ${top + 24} -72 ${top} 0 ${top} C 72 ${top} ${w + 4} ${top + 24} ${w} ${y} Z`;

/*
 * The show's knit beanie, measured from a reference still: the crown is barely taller than the
 * head, the band is about a fifth of the head tall, arches up in the middle and sits right on
 * the eyes, and the pom-pom overlaps the top of the crown.
 */
const KNIT_CROWN = 'M -130 -34 C -134 -82 -78 -120 0 -120 C 78 -120 134 -82 130 -34 Z';
const KNIT_BAND = 'M -134 -41 Q 0 -67 134 -41 Q 140 -29 134 -17 Q 0 -43 -134 -17 Q -140 -29 -134 -41 Z';

function pomPom(color: string, cy = -124) {
  return (
    <g>
      <ellipse cx={0} cy={cy} rx={25} ry={21} {...f(color)} />
      <g stroke={shade(color, -0.3)} strokeWidth={2.2} strokeLinecap="round">
        {[-60, -25, 0, 25, 60, 150, 200, 340].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={Math.cos(r) * 6} y1={cy + Math.sin(r) * 5} x2={Math.cos(r) * 20} y2={cy + Math.sin(r) * 16} />;
        })}
      </g>
    </g>
  );
}

export const HATS: HatDef[] = [
  { id: 'none', name: 'No Hat', quip: 'Brain fully exposed to the elements. Bold.' },
  {
    id: 'pom',
    name: 'Pom-Pom Beanie',
    quip: 'The classic. Keeps the brain from freezing. Mostly.',
    defaultColor: '#3b6fd8',
    clipHairAbove: -30,
    front: (c) => (
      <g>
        <path d={KNIT_CROWN} {...f(c.color)} />
        <path d={KNIT_BAND} {...f(accent(c.color))} />
        {pomPom(accent(c.color))}
      </g>
    ),
  },
  {
    id: 'trapper',
    name: 'Trapper Toque',
    quip: 'For when your ears have frostbite feelings. Pom-pom included at no extra charge.',
    defaultColor: '#2ec4c4',
    clipHairAbove: -30,
    front: (c) => (
      <g>
        <Mirror>
          <path d="M -136 -30 L -138 34 Q -122 54 -104 34 L -104 -30 Z" {...f(c.color)} />
          <path d="M -121 44 L -124 78" fill="none" stroke={accent(c.color)} strokeWidth={4} />
          <circle cx={-124} cy={82} r={6} {...f(accent(c.color))} strokeWidth={2} />
        </Mirror>
        <path d={KNIT_CROWN} {...f(c.color)} />
        <path d={KNIT_BAND} {...f(accent(c.color))} />
        {pomPom(accent(c.color))}
      </g>
    ),
  },
  {
    id: 'beanie',
    name: 'Slouchy Beanie',
    quip: 'Says "I play guitar". Does not play guitar.',
    defaultColor: '#55555a',
    clipHairAbove: -36,
    front: (c) => (
      <g>
        <path d="M -132 -36 C -140 -120 -60 -150 20 -146 C 90 -142 150 -110 132 -36 Z" {...f(c.color)} />
        <path d="M -136 -58 Q 0 -70 136 -58 L 136 -30 Q 0 -42 -136 -30 Z" {...f(shade(c.color, -0.15))} />
        <g stroke={shade(c.color, -0.35)} strokeWidth={2}>
          {[-110, -80, -50, -20, 10, 40, 70, 100].map((x) => (
            <line key={x} x1={x} y1={-60} x2={x} y2={-34} />
          ))}
        </g>
      </g>
    ),
  },
  {
    id: 'cap',
    name: 'Baseball Cap',
    quip: 'Has never played baseball. Has strong opinions about baseball.',
    defaultColor: '#d33b2c',
    clipHairAbove: -40,
    front: (c) => (
      <g>
        <path d={DOME(-40, -132, 124)} {...f(c.color)} />
        <path d="M 0 -132 L 0 -44 M -60 -124 Q -44 -80 -46 -44 M 60 -124 Q 44 -80 46 -44" fill="none" stroke={shade(c.color, -0.3)} strokeWidth={2} />
        <path d="M -128 -44 Q 0 -62 128 -44 Q 134 -26 114 -20 Q 0 -38 -114 -20 Q -134 -26 -128 -44 Z" {...f(shade(c.color, -0.2))} />
        <circle cx={0} cy={-132} r={7} {...f(shade(c.color, -0.2))} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'backcap',
    name: 'Backwards Cap',
    quip: 'Too cool for forwards. Walks into doors a lot.',
    defaultColor: '#26367a',
    clipHairAbove: -40,
    front: (c) => (
      <g>
        <path d={DOME(-40, -132, 124)} {...f(c.color)} />
        <path d="M -30 -42 Q 0 -86 30 -42 Z" fill={c.c.skin} {...ink} />
        <path d="M -24 -52 L 24 -52" stroke={shade(c.color, -0.35)} strokeWidth={4} />
        <circle cx={0} cy={-132} r={7} {...f(shade(c.color, -0.2))} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'tophat',
    name: 'Top Hat',
    quip: 'Fancy. Monocle sold separately. Opinions about the poor included.',
    defaultColor: '#1f1f22',
    clipHairAbove: -60,
    front: (c) => (
      <g>
        <ellipse cx={0} cy={-62} rx={146} ry={20} {...f(c.color)} />
        <path d="M -84 -66 L -80 -214 Q 0 -226 80 -214 L 84 -66 Q 0 -54 -84 -66 Z" {...f(c.color)} />
        <path d="M -83 -98 Q 0 -88 83 -98 L 84 -72 Q 0 -60 -84 -72 Z" {...f(accent(c.color))} />
        <path d="M -60 -200 L -62 -110" stroke={shade(c.color, 0.25)} strokeWidth={5} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'cowboy',
    name: 'Cowboy Hat',
    quip: 'Howdy, partner. Has never seen a horse. Is afraid of horses.',
    defaultColor: '#a5713d',
    clipHairAbove: -48,
    front: (c) => (
      <g>
        <path d="M -88 -50 C -96 -120 -80 -170 -40 -166 Q 0 -150 40 -166 C 80 -170 96 -120 88 -50 Z" {...f(c.color)} />
        <path d="M -90 -84 Q 0 -96 90 -84 L 90 -66 Q 0 -78 -90 -66 Z" {...f(shade(c.color, -0.4))} />
        <path d="M -196 -66 Q -170 -40 -120 -48 Q 0 -64 120 -48 Q 170 -40 196 -66 Q 186 -28 120 -28 Q 0 -36 -120 -28 Q -186 -28 -196 -66 Z" {...f(shade(c.color, -0.08))} />
      </g>
    ),
  },
  {
    id: 'wizard',
    name: 'Wizard Hat',
    quip: 'Knows exactly one spell: disappointing parents.',
    defaultColor: '#3b2f8f',
    clipHairAbove: -46,
    front: (c) => (
      <g>
        <path d="M -128 -48 Q -40 -110 30 -262 Q 46 -150 128 -48 Z" {...f(c.color)} />
        <ellipse cx={0} cy={-46} rx={150} ry={22} {...f(c.color)} />
        <path d={starPath(-10, -130, 16)} fill="#f2c230" {...ink} strokeWidth={2} />
        <path d={starPath(40, -90, 11)} fill="#f2c230" {...ink} strokeWidth={2} />
        <path d="M 10 -190 a 14 14 0 1 0 14 18 a 10 10 0 1 1 -14 -18 Z" fill="#f2c230" {...ink} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'crown',
    name: 'Crown',
    quip: 'King of the playground. Elected by: self. Votes: one.',
    defaultColor: '#f2c230',
    front: (c) => (
      <g>
        <path d="M -84 -96 L -94 -176 L -52 -130 L -26 -192 L 0 -134 L 26 -192 L 52 -130 L 94 -176 L 84 -96 Q 0 -112 -84 -96 Z" {...f(c.color)} />
        <circle cx={-26} cy={-192} r={7} {...f('#fff')} strokeWidth={2} />
        <circle cx={26} cy={-192} r={7} {...f('#fff')} strokeWidth={2} />
        <circle cx={-46} cy={-112} r={8} {...f('#d33b2c')} strokeWidth={2} />
        <circle cx={0} cy={-114} r={9} {...f('#3b6fd8')} strokeWidth={2} />
        <circle cx={46} cy={-112} r={8} {...f('#2e8b47')} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'party',
    name: 'Party Hat',
    quip: "Every day is somebody's birthday. Today it's... Gerald's? Who's Gerald?",
    defaultColor: '#e86fb0',
    front: (c) => (
      <g transform="rotate(-12 0 -100)">
        <path d="M -54 -98 L 0 -236 L 54 -98 Q 0 -84 -54 -98 Z" {...f(c.color)} />
        <path d="M -38 -138 L 40 -140 M -22 -180 L 24 -182" stroke={accent(c.color)} strokeWidth={9} strokeLinecap="round" />
        <path d={scallop(0, -240, 16, 14, 7, 0.18)} {...f('#f2c230')} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'beret',
    name: 'Beret',
    quip: 'Oui oui. Paints sad clowns. Sells zero sad clowns.',
    defaultColor: '#d33b2c',
    // A beret sits on top of the hair (no clipping), wide and tilted, so hair stays rounded around it.
    front: (c) => (
      <g>
        <ellipse cx={14} cy={-104} rx={150} ry={44} transform="rotate(-8 14 -104)" {...f(c.color)} />
        <path d="M 22 -146 L 26 -162" stroke={O} strokeWidth={7} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'hardhat',
    name: 'Hard Hat',
    quip: 'Builds forts. Destroys forts. Charges by the hour.',
    defaultColor: '#f2c230',
    clipHairAbove: -40,
    front: (c) => (
      <g>
        <path d={DOME(-44, -146, 128)} {...f(c.color)} />
        <path d="M -16 -146 Q -18 -96 -16 -46 L 16 -46 Q 18 -96 16 -146 Z" {...f(shade(c.color, 0.2))} strokeWidth={2} />
        <path d="M -154 -42 Q 0 -62 154 -42 L 152 -26 Q 0 -46 -152 -26 Z" {...f(shade(c.color, -0.1))} />
      </g>
    ),
  },
  {
    id: 'chef',
    name: 'Chef Hat',
    quip: 'Kiss the cook. Please do not actually kiss the cook. The cook is nine.',
    defaultColor: '#ffffff',
    clipHairAbove: -40,
    front: (c) => (
      <g>
        <path d={scallop(0, -160, 108, 66, 9, 0.1)} {...pale(c.color)} />
        <path d="M -104 -96 L -104 -40 Q 0 -54 104 -40 L 104 -96 Q 0 -110 -104 -96 Z" {...pale(c.color)} />
        <path d="M -50 -100 L -50 -46 M 0 -104 L 0 -48 M 50 -100 L 50 -46" stroke={shade(c.color, -0.2)} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'viking',
    name: 'Viking Helmet',
    quip: 'Pillages lunch boxes. Raids the teachers\' lounge.',
    defaultColor: '#9aa3ad',
    clipHairAbove: -40,
    front: (c) => (
      <g>
        <Mirror>
          <path d="M -110 -86 Q -188 -96 -176 -196 Q -150 -128 -96 -116 Z" {...f('#f4ecc8')} />
        </Mirror>
        <path d={DOME(-40, -140, 130)} {...f(c.color)} />
        <path d="M -134 -62 Q 0 -78 134 -62 L 134 -38 Q 0 -54 -134 -38 Z" {...f(shade(c.color, -0.2))} />
        <path d="M -12 -140 L -12 -62 L 12 -62 L 12 -140" {...f(shade(c.color, -0.2))} strokeWidth={2} />
        {[-100, -60, 60, 100].map((x) => (
          <circle key={x} cx={x} cy={-50} r={4} fill={shade(c.color, 0.4)} stroke={O} strokeWidth={1.5} />
        ))}
      </g>
    ),
  },
  {
    id: 'football',
    name: 'Football Helmet',
    quip: 'Concussion protocol: optional. Brain cells: also optional.',
    defaultColor: '#8a1f2b',
    clipHairAbove: -30,
    front: (c) => (
      <g>
        <path d="M -144 44 C -152 -112 -72 -152 0 -152 C 72 -152 152 -112 144 44 L 114 44 L 114 -28 Q 0 -52 -114 -28 L -114 44 Z" {...f(c.color)} />
        <path d="M -14 -151 L -14 -44 M 14 -151 L 14 -44" stroke="#fff" strokeWidth={8} />
        <circle cx={-128} cy={6} r={12} {...f(shade(c.color, -0.3))} strokeWidth={2} />
        <circle cx={128} cy={6} r={12} {...f(shade(c.color, -0.3))} strokeWidth={2} />
        <g fill="none" stroke="#9aa3ad" strokeWidth={7} strokeLinecap="round">
          <path d="M -118 26 Q 0 58 118 26 M -110 60 Q 0 96 110 60 M -40 36 L -40 92 M 40 36 L 40 92" />
        </g>
        <g fill="none" stroke={O} strokeWidth={1.5} opacity={0.6}>
          <path d="M -118 26 Q 0 58 118 26 M -110 60 Q 0 96 110 60" />
        </g>
      </g>
    ),
  },
  {
    id: 'tinfoil',
    name: 'Tin Foil Hat',
    quip: "They can't read my thoughts now. My thoughts are mostly about nachos.",
    colorable: false,
    clipHairAbove: -70,
    front: () => (
      <g>
        <path d="M -116 -60 L -96 -140 L -46 -166 L 0 -214 L 44 -160 L 94 -152 L 116 -60 Q 0 -84 -116 -60 Z" {...f('#cfd6dd')} />
        <path d="M -96 -140 L -40 -110 L 0 -214 L 40 -110 L 94 -152 M -40 -110 L -60 -70 M 40 -110 L 60 -70 M -40 -110 L 40 -110" fill="none" stroke="#8a949e" strokeWidth={2} />
        <path d="M -46 -166 L -40 -110 L 0 -214 Z" fill="#eef2f6" opacity={0.8} />
      </g>
    ),
  },
  {
    id: 'propeller',
    name: 'Propeller Beanie',
    quip: 'Pre-flight check complete. Has never achieved liftoff. Never stops trying.',
    defaultColor: '#f2c230',
    clipHairAbove: -40,
    front: (c) => (
      <g>
        <path d={DOME(-40, -134, 128)} {...f(c.color)} />
        <path d="M -60 -126 Q -64 -80 -60 -42 L 0 -46 L 0 -134 Z M 60 -126 Q 64 -80 60 -42 L 128 -40 Q 120 -100 60 -126 Z" fill={accent(c.color)} {...ink} strokeWidth={2} />
        <path d="M 0 -134 L 0 -160" stroke={O} strokeWidth={5} />
        <g className="sp-propeller">
          <path d="M 0 -160 Q -40 -176 -76 -164 Q -40 -150 0 -160 Z M 0 -160 Q 40 -144 76 -156 Q 40 -170 0 -160 Z" {...f('#d33b2c')} strokeWidth={2} />
        </g>
        <circle cx={0} cy={-160} r={6} {...f('#3b6fd8')} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'headband',
    name: 'Sweatband',
    quip: 'Sweaty champion of the sit-and-reach. Has never broken a sweat.',
    defaultColor: '#ffffff',
    front: (c) => (
      <g>
        <path d="M -132 -66 Q 0 -90 132 -66 L 134 -40 Q 0 -64 -134 -40 Z" {...f(c.color)} />
        <path d="M -133 -54 Q 0 -78 133 -54" fill="none" stroke={accent(c.color)} strokeWidth={6} />
      </g>
    ),
  },
  {
    id: 'bow',
    name: 'Giant Bow',
    quip: 'Cute. Dangerous. Do not touch the bow.',
    defaultColor: '#e86fb0',
    front: (c) => (
      <g transform="rotate(-18 -70 -112)">
        <path d="M -70 -112 L -128 -150 Q -140 -112 -128 -76 Z" {...f(c.color)} />
        <path d="M -70 -112 L -12 -150 Q 0 -112 -12 -76 Z" {...f(c.color)} />
        <ellipse cx={-70} cy={-112} rx={14} ry={16} {...f(shade(c.color, -0.15))} />
      </g>
    ),
  },
  {
    id: 'tiara',
    name: 'Tiara',
    quip: 'Royalty. Allegedly. The paperwork is pending.',
    defaultColor: '#cfd6dd',
    front: (c) => (
      <g>
        <path d="M -96 -88 L -90 -132 L -56 -108 L -30 -156 L 0 -114 L 30 -156 L 56 -108 L 90 -132 L 96 -88 Q 0 -112 -96 -88 Z" {...f(c.color)} />
        <path d="M -96 -88 Q 0 -112 96 -88 L 95 -98 Q 0 -122 -95 -98 Z" fill={shade(c.color, -0.25)} />
        {[-90, -30, 30, 90].map((x) => (
          <circle key={x} cx={x} cy={x * x > 2000 ? -136 : -160} r={6} {...f('#fff')} strokeWidth={2} />
        ))}
        <path d="M 0 -146 L 13 -124 L 0 -106 L -13 -124 Z" {...f('#e86fb0')} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'halo',
    name: 'Halo',
    quip: 'Totally innocent. Totally. Please ignore the smoke behind the gym.',
    colorable: false,
    front: () => (
      <g>
        <ellipse cx={0} cy={-164} rx={72} ry={17} fill="none" stroke={O} strokeWidth={15} />
        <ellipse cx={0} cy={-164} rx={72} ry={17} fill="none" stroke="#ffe25c" strokeWidth={9} />
      </g>
    ),
  },
  {
    id: 'horns',
    name: 'Devil Horns',
    quip: 'Mischief managed. Badly. Detention: managed well.',
    defaultColor: '#d33b2c',
    front: (c) => (
      <Mirror>
        <path d="M -78 -88 Q -104 -150 -70 -184 Q -76 -136 -42 -100 Z" {...f(c.color)} />
      </Mirror>
    ),
  },
  {
    id: 'bunny',
    name: 'Bunny Ears',
    quip: 'Hops to conclusions. All of them. At once.',
    defaultColor: '#ffffff',
    front: (c) => (
      <Mirror>
        <path d="M -58 -98 C -98 -200 -66 -258 -40 -248 C -18 -210 -22 -140 -24 -102 Z" {...pale(c.color)} />
        <path d="M -48 -110 C -74 -190 -60 -232 -44 -228 C -32 -200 -34 -150 -34 -112 Z" fill="#f6a5b4" />
      </Mirror>
    ),
  },
  {
    id: 'pirate',
    name: 'Pirate Hat',
    quip: 'Arrr. Says "arrr" a lot. Has been asked to stop saying "arrr".',
    defaultColor: '#1f1f22',
    clipHairAbove: -52,
    front: (c) => (
      <g>
        <path d="M -156 -50 Q -124 -176 0 -152 Q 124 -176 156 -50 Q 0 -92 -156 -50 Z" {...f(c.color)} />
        <path d="M -150 -58 Q 0 -100 150 -58" fill="none" stroke="#f2c230" strokeWidth={5} />
        <circle cx={0} cy={-118} r={16} {...f('#fff')} strokeWidth={2} />
        <circle cx={-6} cy={-120} r={3.5} fill={O} />
        <circle cx={6} cy={-120} r={3.5} fill={O} />
        <path d="M -24 -94 L 24 -82 M 24 -94 L -24 -82" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'hood',
    name: 'Cinched Parka Hood',
    quip: 'Mmmph mmph mmmmph! (Translation: "I can\'t hear anything in here.")',
    defaultColor: '#3f7d6b',
    hidesHair: true,
    muffles: true,
    eyesOver: true,
    front: (c) => (
      <g>
        {/* Measured from the show: a round hood wider than it is tall, an upright face opening ringed by
            a wide brown fur rim, and the cinch strings hanging below. */}
        <path
          d="M -164 40 C -168 -96 -92 -136 0 -136 C 92 -136 168 -96 164 40 C 162 96 100 122 0 122 C -100 122 -162 96 -164 40 Z M 50 4 A 50 66 0 1 0 -50 4 A 50 66 0 1 0 50 4 Z"
          fill={c.color}
          fillRule="evenodd"
          {...ink}
        />
        <ellipse cx={0} cy={4} rx={62} ry={78} fill="none" stroke="#6b4226" strokeWidth={22} />
        <ellipse cx={0} cy={4} rx={74} ry={90} fill="none" stroke={shade(c.color, -0.18)} strokeWidth={4} />
        <path d="M -9 78 Q -12 100 -16 112 M 9 78 Q 12 100 16 112" fill="none" stroke="#4a2c17" strokeWidth={4} strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'fez',
    name: 'Fez',
    quip: 'Fezzes are cool. This is a scientific fact. Do not look it up.',
    defaultColor: '#d33b2c',
    front: (c) => (
      <g>
        <path d="M -42 -100 L -34 -176 Q 0 -184 34 -176 L 42 -100 Q 0 -90 -42 -100 Z" {...f(c.color)} />
        <path d="M 0 -180 Q 40 -176 50 -140" fill="none" stroke={O} strokeWidth={3} />
        <path d="M 44 -142 L 56 -142 L 60 -112 L 40 -112 Z" {...f('#1f1f22')} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'grad',
    name: 'Graduation Cap',
    quip: 'Graduated kindergarten. Barely. There was a recount.',
    defaultColor: '#1f1f22',
    clipHairAbove: -60,
    front: (c) => (
      <g>
        <path d="M -86 -100 L -86 -60 Q 0 -40 86 -60 L 86 -100 Z" {...f(c.color)} />
        <path d="M -140 -110 L 0 -150 L 140 -110 L 0 -78 Z" {...f(c.color)} />
        <path d="M 0 -114 L 100 -100 L 104 -50" fill="none" stroke="#f2c230" strokeWidth={4} />
        <path d="M 96 -54 L 112 -54 L 116 -24 L 92 -24 Z" fill="#f2c230" {...ink} strokeWidth={2} />
        <circle cx={0} cy={-114} r={6} fill="#f2c230" {...ink} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'police',
    name: 'Cop Hat',
    quip: 'Respect the authority. Authority pending. Please hold.',
    defaultColor: '#26367a',
    clipHairAbove: -52,
    front: (c) => (
      <g>
        <path d="M -128 -62 C -140 -134 -60 -156 0 -156 C 60 -156 140 -134 128 -62 Z" {...f(c.color)} />
        <path d="M -118 -80 L 118 -80 L 120 -52 L -120 -52 Z" {...f('#1f1f22')} />
        <path d="M -112 -54 Q 0 -72 112 -54 Q 100 -28 0 -34 Q -100 -28 -112 -54 Z" {...f('#1f1f22')} />
        <path d={starPath(0, -104, 18)} fill="#f2c230" {...ink} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'headphones',
    name: 'Headphones',
    quip: "Can't hear you. Doesn't want to hear you. Listening to whale sounds.",
    defaultColor: '#1f1f22',
    front: (c) => (
      <g>
        <path d="M -134 -6 C -144 -170 144 -170 134 -6" fill="none" stroke={O} strokeWidth={20} />
        <path d="M -134 -6 C -144 -170 144 -170 134 -6" fill="none" stroke={c.color} strokeWidth={13} />
        <rect x={-152} y={-40} width={34} height={62} rx={14} {...f(c.color)} />
        <rect x={118} y={-40} width={34} height={62} rx={14} {...f(c.color)} />
        <rect x={-146} y={-30} width={12} height={42} rx={6} fill={accent(c.color)} />
        <rect x={134} y={-30} width={12} height={42} rx={6} fill={accent(c.color)} />
      </g>
    ),
  },
  {
    id: 'santa',
    name: 'Santa Hat',
    quip: 'Ho ho... no. Naughty list since 2019. Proudly.',
    defaultColor: '#d33b2c',
    clipHairAbove: -44,
    front: (c) => (
      <g>
        <path d="M -134 -48 C -130 -132 -40 -172 40 -152 Q 120 -140 176 -62 L 156 -52 Q 116 -108 66 -110 Q 124 -66 134 -48 Z" {...f(c.color)} />
        <path d={`M -142 -66 ${scallopEdge(-142, -66, 142, -66, 10, -10)} L 142 -34 ${scallopEdge(142, -34, -142, -34, 10, -10)} Z`} {...pale('#ffffff')} />
        <path d={scallop(168, -58, 20, 20, 8, 0.12)} {...pale('#ffffff')} />
      </g>
    ),
  },
  {
    id: 'antlers',
    name: 'Reindeer Antlers',
    quip: 'Festive. Also mildly stabby. Has been banned from group photos.',
    colorable: false,
    front: () => (
      <Mirror>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -54 -100 L -78 -170 M -70 -148 L -110 -168 M -76 -164 L -64 -204 M -66 -124 L -40 -160" stroke={O} strokeWidth={17} />
          <path d="M -54 -100 L -78 -170 M -70 -148 L -110 -168 M -76 -164 L -64 -204 M -66 -124 L -40 -160" stroke="#8a5530" strokeWidth={11} />
        </g>
      </Mirror>
    ),
  },
  {
    id: 'antennae',
    name: 'Antennae',
    quip: 'Bzzt. Receiving signals from Uranus. Yes, that one. Grow up.',
    defaultColor: '#7fbf3f',
    front: (c) => (
      <Mirror>
        <path d="M -40 -104 Q -60 -150 -48 -170 Q -36 -190 -62 -206" fill="none" stroke={O} strokeWidth={5} />
        <circle cx={-64} cy={-210} r={14} {...f(c.color)} />
        <circle cx={-68} cy={-214} r={4} fill="#fff" opacity={0.8} />
      </Mirror>
    ),
  },
  {
    id: 'catears',
    name: 'Cat Ears',
    quip: 'Meow. Has knocked three things off a table today. On purpose.',
    defaultColor: '#1f1f22',
    front: (c) => (
      <g>
        <path d="M -118 -54 Q 0 -152 118 -54" fill="none" stroke={O} strokeWidth={12} />
        <path d="M -118 -54 Q 0 -152 118 -54" fill="none" stroke={c.color} strokeWidth={7} />
        <Mirror>
          <path d="M -96 -88 L -84 -160 L -40 -110 Z" {...f(c.color)} />
          <path d="M -86 -100 L -80 -140 L -54 -110 Z" fill="#f6a5b4" />
        </Mirror>
      </g>
    ),
  },
  {
    id: 'flowers',
    name: 'Flower Crown',
    quip: 'At one with nature. Allergic to nature.',
    defaultColor: '#e86fb0',
    front: (c) => (
      <g>
        <path d="M -124 -60 Q 0 -128 124 -60" fill="none" stroke="#2e8b47" strokeWidth={6} />
        {[-110, -66, -22, 22, 66, 110].map((x, i) => {
          const y = -60 - (1 - (x / 124) ** 2) * 34;
          const col = i % 2 ? '#f2c230' : c.color;
          return (
            <g key={x}>
              <path d={scallop(x, y, 13, 13, 5, 0.3)} {...f(col)} strokeWidth={2} />
              <circle cx={x} cy={y} r={5} fill={i % 2 ? '#d33b2c' : '#f2c230'} />
            </g>
          );
        })}
      </g>
    ),
  },
  {
    id: 'bucket',
    name: 'Bucket Hat',
    quip: 'Gone fishin\'. Caught nothing. Lost the boat. Kept the hat.',
    defaultColor: '#c9a77a',
    clipHairAbove: -50,
    front: (c) => (
      <g>
        <path d="M -96 -60 C -100 -140 -50 -152 0 -152 C 50 -152 100 -140 96 -60 Z" {...f(c.color)} />
        <path d="M -150 -30 Q -120 -70 -96 -66 Q 0 -78 96 -66 Q 120 -70 150 -30 Q 0 -56 -150 -30 Z" {...f(shade(c.color, -0.1))} />
        <path d="M 60 -110 L 70 -90 M 70 -90 q 8 2 4 10" fill="none" stroke="#d33b2c" strokeWidth={3} />
        <circle cx={60} cy={-112} r={5} fill="#f2c230" {...ink} strokeWidth={1.5} />
      </g>
    ),
  },
  {
    id: 'cone',
    name: 'Traffic Cone',
    quip: 'Found it. It is mine now. The city has been notified.',
    colorable: false,
    clipHairAbove: -60,
    front: () => (
      <g>
        <path d="M -78 -84 L -26 -236 L 26 -236 L 78 -84 Z" {...f('#f0742a')} />
        <path d="M -60 -136 L 60 -136 L 50 -168 L -50 -168 Z" fill="#fff" />
        <path d="M -40 -196 L 40 -196 L 34 -214 L -34 -214 Z" fill="#fff" />
        <path d="M -104 -84 L 104 -84 L 104 -64 L -104 -64 Z" {...f('#f0742a')} />
        <path d="M -78 -84 L -26 -236 L 26 -236 L 78 -84 Z" {...edge} />
      </g>
    ),
  },
  {
    id: 'bag',
    name: 'Paper Bag',
    quip: 'For days when you are too embarrassed to exist. So, most days.',
    colorable: false,
    hidesHair: true,
    hidesFace: true,
    front: () => (
      <g>
        <path d="M -140 -150 L 140 -150 L 150 130 L -150 130 Z" {...f('#c9a07a')} />
        <path d={`M -140 -150 ${scallopEdge(-140, -150, 140, -150, 9, 12)}`} fill="none" stroke={O} strokeWidth={3} />
        <path d="M -150 130 L -120 108 L -90 130 L -60 108 L -30 130 L 0 108 L 30 130 L 60 108 L 90 130 L 120 108 L 150 130" fill="none" stroke="#9a744f" strokeWidth={2} />
        <ellipse cx={-40} cy={-6} rx={20} ry={26} fill={O} />
        <ellipse cx={40} cy={-6} rx={20} ry={26} fill={O} />
        <path d="M -30 66 Q 0 82 30 66" fill="none" stroke={O} strokeWidth={4} strokeLinecap="round" />
        <path d="M -120 -110 L -100 120 M 110 -120 L 128 110" stroke="#b28b62" strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'bubble',
    name: 'Fishbowl Helmet',
    quip: 'Space-rated. Fogs up when you lie. Very foggy in there.',
    colorable: false,
    front: () => (
      <g>
        <circle cx={0} cy={-6} r={170} fill="#bfe6ff" opacity={0.25} />
        <circle cx={0} cy={-6} r={170} fill="none" stroke={O} strokeWidth={4} />
        <path d="M -120 -90 Q -100 -130 -60 -150" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={0.8} />
        <path d="M -140 120 Q 0 190 140 120 L 130 160 Q 0 214 -130 160 Z" {...f('#d8dde3')} />
      </g>
    ),
  },
];
