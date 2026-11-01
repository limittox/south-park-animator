import type { ReactNode } from 'react';
import type { ItemBase, Render, RenderCtx } from '../../types';
import { shade } from '../../lib/color';
import { edge, heartPath, ink, Mirror, O, starPath } from './common';
import { HEAD_SHAPES } from '../geometry';

export interface HeadPart extends ItemBase {
  render: Render;
}

/* ------------------------------------------------------------------ eyes */

type Lid = 'none' | 'sleepy' | 'half' | 'angry' | 'sad';

interface EyeOpts {
  lid?: Lid;
  scale?: number;
  white?: string;
  pupil?: (side: -1 | 1, cx: number) => ReactNode;
  extra?: (side: -1 | 1, cx: number) => ReactNode;
  only?: -1 | 1;
}

const LID_LEFT: Record<Exclude<Lid, 'none'>, string> = {
  sleepy: 'M -80 -70 L 80 -70 L 80 -3 L -80 -3 Z',
  half: 'M -80 -70 L 80 -70 L 80 -14 L -80 -14 Z',
  angry: 'M -80 -70 L 12 -70 L 12 1 L -80 -32 Z',
  sad: 'M -80 -70 L 12 -70 L 12 -34 L -80 -4 Z',
};

/**
 * The show's eyes: two big white ovals with no outline, leaning in at the top and
 * meeting in the middle, with tiny dot pupils. A faint seam shows where they overlap.
 */
function eyePair(ctx: RenderCtx, o: EyeOpts = {}): ReactNode {
  const s = o.scale ?? 1;
  const lid = o.lid ?? 'none';
  const sides: (-1 | 1)[] = o.only ? [o.only] : [-1, 1];
  const shape = (side: -1 | 1) => ({ cx: side * 27 * s, cy: 0, rx: 28 * s, ry: 36 * s, transform: `rotate(${-side * 14} ${side * 27 * s} 0)` });
  const clipIds = { [-1]: ctx.uid('eye-1'), [1]: ctx.uid('eye1') } as Record<-1 | 1, string>;
  return (
    <g>
      {sides.map((side) => {
        const { cx } = shape(side);
        const id = clipIds[side];
        return (
          <g key={side}>
            <clipPath id={id}>
              <ellipse {...shape(side)} />
            </clipPath>
            <ellipse {...shape(side)} fill={o.white ?? '#fff'} />
            {side === 1 && sides.length === 2 && (
              <ellipse {...shape(1)} fill="none" stroke="#aaa49c" strokeWidth={1.6} clipPath={`url(#${clipIds[-1]})`} />
            )}
            <g clipPath={`url(#${id})`}>
              {o.pupil ? o.pupil(side, cx) : <circle cx={side * 16.5} cy={2} r={3.4} fill={O} />}
              {o.extra?.(side, cx)}
              {lid !== 'none' && (
                <path d={LID_LEFT[lid]} transform={side === 1 ? 'scale(-1 1)' : undefined} fill={ctx.c.skin} {...ink} className="keep" />
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

const dot = (x: number, y: number, r = 3.6) => <circle cx={x} cy={y} r={r} fill={O} />;

export const EYES: HeadPart[] = [
  { id: 'classic', name: 'Classic', quip: 'Two big ovals, two tiny dots. Timeless. Like a dinner plate with opinions.', render: (c) => eyePair(c) },
  {
    id: 'wide',
    name: 'Wide Awake',
    quip: 'Has had four coffees. It is 7 AM. It is a child.',
    render: (c) => eyePair(c, { scale: 1.1, pupil: (s) => dot(s * 8, 0, 3) }),
  },
  {
    id: 'sleepy',
    name: 'Sleepy',
    quip: 'Woke up like this. Then went back to sleep. Then woke up like this again.',
    render: (c) => eyePair(c, { lid: 'sleepy', pupil: (s) => dot(s * 16, 12) }),
  },
  {
    id: 'shifty',
    name: 'Shifty',
    quip: "Definitely didn't eat the last pudding cup. Why do you ask?",
    render: (c) => eyePair(c, { lid: 'half', pupil: (_s, cx) => dot(cx - 16, 4) }),
  },
  { id: 'angry', name: 'Angry', quip: 'Mad at everything. Especially Tuesdays. And hippies.', render: (c) => eyePair(c, { lid: 'angry' }) },
  {
    id: 'sad',
    name: 'Sad',
    quip: 'Just found out the ice-cream truck plays music when it is OUT of ice cream.',
    render: (c) => eyePair(c, { lid: 'sad', pupil: (s) => dot(s * 16, 8) }),
  },
  {
    id: 'crazy',
    name: 'Unhinged',
    quip: 'Talks to the hall monitor. The hall monitor is a mop.',
    render: (c) => eyePair(c, { pupil: (s) => (s === -1 ? dot(-24, 4, 10) : dot(22, -10, 2.5)) }),
  },
  {
    id: 'lashes',
    name: 'Fabulous Lashes',
    quip: 'Fabulous and knows it. Bats eyelashes for extra recess.',
    render: (c) => (
      <g>
        {eyePair(c)}
        <Mirror>
          <path d="M -47 -24 L -60 -32 M -40 -31 L -50 -42 M -31 -35 L -37 -48" fill="none" {...ink} strokeWidth={3.5} />
        </Mirror>
      </g>
    ),
  },
  {
    id: 'beady',
    name: 'Beady',
    quip: 'Sees everything. Judges everything. Blinks never.',
    render: () => (
      <g>
        {dot(-17, 4, 6)}
        {dot(17, 4, 6)}
        <circle cx={-15} cy={2} r={1.6} fill="#fff" />
        <circle cx={19} cy={2} r={1.6} fill="#fff" />
      </g>
    ),
  },
  {
    id: 'bloodshot',
    name: 'All-Nighter',
    quip: 'Stayed up all night beating a video game. Worth it. Totally worth it.',
    render: (c) =>
      eyePair(c, {
        white: '#fff1ee',
        lid: 'half',
        extra: (_s, cx) => (
          <path
            d={`M ${cx - 26} 6 l 8 -2 l 4 4 M ${cx + 24} 12 l -8 -1 l -3 5 M ${cx - 20} 20 l 8 -4 M ${cx + 18} -4 l -8 2`}
            fill="none"
            stroke="#e0352b"
            strokeWidth={1.6}
          />
        ),
      }),
  },
  {
    id: 'dead',
    name: 'Dead',
    quip: "Oh no, you killed them! Relax. They'll be back next episode.",
    render: (c) =>
      eyePair(c, {
        pupil: (_s, cx) => (
          <path d={`M ${cx - 11} -11 L ${cx + 11} 11 M ${cx + 11} -11 L ${cx - 11} 11`} {...ink} strokeWidth={4.5} />
        ),
      }),
  },
  {
    id: 'starry',
    name: 'Starstruck',
    quip: 'Just saw a celebrity at the mall. It was a guy who was once in a mattress ad.',
    render: (c) =>
      eyePair(c, {
        pupil: (s) => <path d={starPath(s * 13, 2, 11)} fill="#f2c230" {...ink} strokeWidth={2} />,
      }),
  },
  {
    id: 'hearts',
    name: 'Smitten',
    quip: 'In love with the new kid. Or a burrito. Unclear.',
    render: (c) => eyePair(c, { pupil: (s) => <path d={heartPath(s * 13, 2, 10)} fill="#e5322d" {...ink} strokeWidth={2} /> }),
  },
  {
    id: 'happy',
    name: 'Blissful',
    quip: 'Eyes closed, vibing, blissfully unaware of the pop quiz.',
    render: () => (
      <Mirror>
        <path d="M -46 8 Q -27 -16 -8 8" fill="none" {...ink} strokeWidth={4.5} />
      </Mirror>
    ),
  },
  {
    id: 'tired',
    name: 'Baggy',
    quip: 'Remembers when this was all fields. Was born in 2017.',
    render: (c) => (
      <g>
        {eyePair(c, { lid: 'half', pupil: (s) => dot(s * 12, 6) })}
        <Mirror>
          <path d="M -46 40 Q -28 50 -10 42" fill="none" {...ink} strokeWidth={2.4} />
        </Mirror>
      </g>
    ),
  },
  {
    id: 'crossed',
    name: 'Cross-Eyed',
    quip: 'Looked at their own nose for too long. Committed to the bit.',
    render: (c) => eyePair(c, { pupil: (s) => dot(s * 3, 4, 5) }),
  },
  {
    id: 'hypno',
    name: 'Hypnotized',
    quip: 'You are getting sleepy... you will buy more snacks...',
    render: (c) =>
      eyePair(c, {
        pupil: (_s, cx) => (
          <path
            d={`M ${cx} 0 m 0 -2 a 2 2 0 1 1 -2 2 a 5 5 0 1 1 5 5 a 9 9 0 1 1 -9 -9 a 13 13 0 1 1 13 13 a 18 18 0 1 1 -18 -18`}
            fill="none"
            stroke={O}
            strokeWidth={2.2}
          />
        ),
      }),
  },
  {
    id: 'wink',
    name: 'Wink',
    quip: "Knows something you don't. It's about your mom. She's lovely.",
    render: (c) => (
      <g>
        {eyePair(c, { only: -1 })}
        <path d="M 6 6 Q 26 -10 46 6" fill="none" {...ink} strokeWidth={4.5} />
      </g>
    ),
  },
  {
    id: 'demon',
    name: 'Demonic',
    quip: 'Sold soul for a hall pass. Would do it again.',
    render: (c) =>
      eyePair(c, {
        white: '#ffd83d',
        lid: 'angry',
        pupil: (_s, cx) => <ellipse cx={cx + 2} cy={4} rx={3.5} ry={15} fill={O} />,
      }),
  },
];

/* ---------------------------------------------------------------- brows */

const browInk = (color: string, w = 6) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Brows sit on head skin; when hair is very pale give them a little more contrast. */
export function browColor(hairColor: string): string {
  return shade(hairColor, -0.18);
}

export const BROWS: HeadPart[] = [
  { id: 'none', name: 'None', quip: 'Eyebrows are a social construct.', render: () => null },
  {
    id: 'thin',
    name: 'Thin',
    quip: 'Low-maintenance. Like a cactus. A cactus with brows.',
    render: (c) => (
      <Mirror>
        <path d="M -50 -46 Q -32 -56 -12 -49" {...browInk(browColor(c.color), 5)} />
      </Mirror>
    ),
  },
  {
    id: 'thick',
    name: 'Thick',
    quip: 'Can bench-press 200 pounds. Each.',
    render: (c) => (
      <Mirror>
        <path d="M -54 -42 Q -34 -62 -8 -52 L -10 -42 Q -32 -50 -50 -36 Z" fill={browColor(c.color)} {...ink} strokeWidth={2} />
      </Mirror>
    ),
  },
  {
    id: 'angry',
    name: 'Angry',
    quip: 'Resting rage face. Rage is resting. For now.',
    render: (c) => (
      <Mirror>
        <path d="M -52 -60 L -8 -42" {...browInk(browColor(c.color), 8)} />
      </Mirror>
    ),
  },
  {
    id: 'worried',
    name: 'Worried',
    quip: "Thinks they left the oven on. Doesn't own an oven. Lives in an apartment.",
    render: (c) => (
      <Mirror>
        <path d="M -52 -42 Q -30 -46 -10 -60" {...browInk(browColor(c.color), 6)} />
      </Mirror>
    ),
  },
  {
    id: 'unibrow',
    name: 'Unibrow',
    quip: 'One brow to rule them all.',
    render: (c) => <path d="M -54 -46 Q -28 -62 0 -50 Q 28 -62 54 -46" {...browInk(browColor(c.color), 9)} />,
  },
  {
    id: 'raised',
    name: 'Skeptical',
    quip: 'Skeptical of everything since the second grade. Mostly of the tooth fairy.',
    render: (c) => (
      <g>
        <path d="M -50 -46 Q -32 -52 -12 -47" {...browInk(browColor(c.color), 6)} />
        <path d="M 12 -60 Q 32 -76 52 -60" {...browInk(browColor(c.color), 6)} />
      </g>
    ),
  },
  {
    id: 'bushy',
    name: 'Bushy',
    quip: 'Grandpa-grade. A small bird lives in the left one.',
    render: (c) => (
      <Mirror>
        <path
          d="M -56 -40 q 2 -10 10 -12 q 2 -8 12 -8 q 6 -6 14 -2 q 8 -2 12 6 q 4 6 -2 10 q -8 -4 -16 -2 q -10 0 -18 4 q -8 2 -12 4 Z"
          fill={browColor(c.color)}
          {...ink}
          strokeWidth={2}
        />
      </Mirror>
    ),
  },
  {
    id: 'sad',
    name: 'Droopy',
    quip: 'Permanently disappointed. Mostly in you. Sorry.',
    render: (c) => (
      <Mirror>
        <path d="M -54 -40 Q -36 -58 -12 -56" {...browInk(browColor(c.color), 6)} />
      </Mirror>
    ),
  },
];

/* --------------------------------------------------------------- mouths */

// The show's mouths are near-black inside, with a hint of plum.
const MOUTH_DARK = '#2b1b22';
const TONGUE = '#ef7a86';

export const MOUTHS: HeadPart[] = [
  { id: 'smile', name: 'Smile', quip: "A polite little smile. Hides a mischievous little brain.", render: () => <path d="M -17 57 Q 0 70 17 57" fill="none" {...ink} strokeWidth={3.5} /> },
  {
    id: 'grin',
    name: 'Big Grin',
    quip: 'Just heard the word "butt" in class. Will be laughing until Thursday.',
    render: () => (
      <g>
        <path d="M -24 52 Q 0 56 24 52 Q 20 82 0 84 Q -20 82 -24 52 Z" fill={MOUTH_DARK} {...ink} />
        <path d="M -21 55 Q 0 58 21 55 L 20 62 Q 0 64 -20 62 Z" fill="#fff" />
        <path d="M -12 78 Q 0 70 12 78 Q 6 83 0 83 Q -6 83 -12 78 Z" fill={TONGUE} />
        <path d="M -24 52 Q 0 56 24 52 Q 20 82 0 84 Q -20 82 -24 52 Z" {...edge} />
      </g>
    ),
  },
  { id: 'frown', name: 'Frown', quip: 'Was promised a pony. Got a pamphlet about ponies.', render: () => <path d="M -17 68 Q 0 55 17 68" fill="none" {...ink} strokeWidth={3.5} /> },
  { id: 'flat', name: 'Unimpressed', quip: "Has seen it all. Wasn't impressed by any of it.", render: () => <path d="M -15 62 L 15 62" fill="none" {...ink} strokeWidth={3.5} /> },
  {
    id: 'shout',
    name: 'Shouting',
    quip: 'Has one volume setting: SCREAMING AT GRANDMA.',
    render: () => (
      <g>
        <ellipse cx={0} cy={66} rx={20} ry={22} fill={MOUTH_DARK} />
        <path d="M -16 54 Q 0 48 16 54 L 14 58 Q 0 54 -14 58 Z" fill="#fff" />
        <ellipse cx={0} cy={80} rx={12} ry={6} fill={TONGUE} />
        <ellipse cx={0} cy={66} rx={20} ry={22} {...edge} />
      </g>
    ),
  },
  { id: 'oshock', name: 'Shocked', quip: 'Just heard a grown-up say a swear. Taking notes.', render: () => <ellipse cx={0} cy={64} rx={8} ry={11} fill={MOUTH_DARK} {...ink} /> },
  {
    id: 'smug',
    name: 'Smug',
    quip: 'Won an argument in 2021. Still bringing it up.',
    render: () => (
      <g>
        <path d="M -18 62 Q 2 68 20 52" fill="none" {...ink} strokeWidth={3.5} />
        <path d="M 18 48 Q 24 52 22 58" fill="none" {...ink} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'buck',
    name: 'Buck Teeth',
    quip: 'Can eat corn on the cob through a fence.',
    render: () => (
      <g>
        <path d="M -10 58 h 10 v 12 h -10 Z M 0 58 h 10 v 12 h -10 Z" fill="#fff" {...ink} strokeWidth={2.2} />
        <path d="M -18 56 Q 0 62 18 56" fill="none" {...ink} strokeWidth={3.5} />
      </g>
    ),
  },
  {
    id: 'braces',
    name: 'Braces',
    quip: 'Metal mouth. Picks up three radio stations and a trucker named Gary.',
    render: () => (
      <g>
        <path d="M -24 52 Q 0 56 24 52 Q 20 80 0 82 Q -20 80 -24 52 Z" fill={MOUTH_DARK} />
        <path d="M -22 54 Q 0 58 22 54 L 20 66 Q 0 68 -20 66 Z" fill="#fff" />
        <path d="M -21 60 Q 0 63 21 60" fill="none" stroke="#9aa3ad" strokeWidth={3} />
        {[-14, -5, 5, 14].map((x) => (
          <rect key={x} x={x - 2.5} y={58} width={5} height={5} fill="#c9d1d9" stroke="#555" strokeWidth={0.8} />
        ))}
        <path d="M -24 52 Q 0 56 24 52 Q 20 80 0 82 Q -20 80 -24 52 Z" {...edge} />
      </g>
    ),
  },
  {
    id: 'tongue',
    name: 'Raspberry',
    quip: 'Pbbbbbt. That is the whole personality.',
    render: () => (
      <g>
        <path d="M -8 62 Q -8 84 2 84 Q 12 84 10 62 Z" fill={TONGUE} {...ink} strokeWidth={2.5} />
        <path d="M 1 66 L 1 76" stroke="#c4505c" strokeWidth={2} />
        <path d="M -18 58 Q 0 68 18 58" fill="none" {...ink} strokeWidth={3.5} />
      </g>
    ),
  },
  {
    id: 'gap',
    name: 'Gap Tooth',
    quip: 'Lost a tooth to a jawbreaker. Tooth fairy paid in IOUs.',
    render: () => (
      <g>
        <path d="M -22 54 Q 0 58 22 54 Q 18 78 0 80 Q -18 78 -22 54 Z" fill={MOUTH_DARK} />
        <path d="M -20 56 Q -8 58 -4 58 L -4 65 Q -12 65 -19 63 Z M 4 58 Q 8 58 20 56 L 19 63 Q 12 65 4 65 Z" fill="#fff" />
        <path d="M -22 54 Q 0 58 22 54 Q 18 78 0 80 Q -18 78 -22 54 Z" {...edge} />
      </g>
    ),
  },
  {
    id: 'fangs',
    name: 'Fangs',
    quip: "Vampire phase. Mom says it'll pass. It's been six years.",
    render: () => (
      <g>
        <path d="M -12 61 L -8 74 L -4 62 Z M 4 62 L 8 74 L 12 61 Z" fill="#fff" {...ink} strokeWidth={2} />
        <path d="M -18 58 Q 0 66 18 58" fill="none" {...ink} strokeWidth={3.5} />
      </g>
    ),
  },
  { id: 'wavy', name: 'Queasy', quip: 'Ate the cafeteria meatloaf. Twice. On a dare.', render: () => <path d="M -20 62 q 5 -7 10 0 t 10 0 t 10 0 t 10 0" fill="none" {...ink} strokeWidth={3.5} /> },
  {
    id: 'kissy',
    name: 'Smooch',
    quip: 'Mwah! Kisses for everyone. Especially the mirror.',
    render: () => <path d="M -2 54 q 10 2 4 8 q 10 4 -2 10" fill="none" {...ink} strokeWidth={3.5} />,
  },
  {
    id: 'grimace',
    name: 'Awkward Grimace',
    quip: 'Just waved back at someone who was waving at someone else.',
    render: () => (
      <g>
        <rect x={-22} y={54} width={44} height={18} rx={6} fill="#fff" {...ink} />
        <path d="M -22 63 H 22 M -11 54 V 72 M 0 54 V 72 M 11 54 V 72" stroke={O} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'drool',
    name: 'Drooling',
    quip: 'Smelled pizza two zip codes away.',
    render: () => (
      <g>
        <path d="M -18 58 Q 0 70 18 58" fill="none" {...ink} strokeWidth={3.5} />
        <path d="M 12 62 Q 14 74 12 80 Q 10 86 14 86 Q 18 86 16 80 Q 14 74 16 62" fill="#bfe6ff" stroke="#5aaeea" strokeWidth={1.6} />
      </g>
    ),
  },
];

/** Generic open mouth used while a character is talking. */
export function talkingMouth(open: number): ReactNode {
  const ry = 6 + 10 * open;
  return (
    <g>
      <ellipse cx={0} cy={64} rx={15} ry={ry} fill={MOUTH_DARK} />
      <ellipse cx={0} cy={64 + ry * 0.55} rx={9} ry={ry * 0.35} fill={TONGUE} />
      <ellipse cx={0} cy={64} rx={15} ry={ry} {...edge} />
    </g>
  );
}

/* ---------------------------------------------------------------- noses */

export const NOSES: HeadPart[] = [
  { id: 'none', name: 'None', quip: 'Who needs to smell? Not this kid. Lucky, given the locker room.', render: () => null },
  { id: 'button', name: 'Button', quip: 'Cute as a button. Pushed like one too.', render: () => <path d="M -7 34 Q 0 42 7 34" fill="none" {...ink} strokeWidth={2.6} /> },
  { id: 'dot', name: 'Tiny Dot', quip: 'Barely there. Smells only important things.', render: (c) => <ellipse cx={0} cy={36} rx={5} ry={4} fill={shade(c.c.skin, -0.25)} /> },
  {
    id: 'honker',
    name: 'Big Honker',
    quip: 'Can smell fear. And tacos. Mostly tacos.',
    render: (c) => <ellipse cx={0} cy={34} rx={14} ry={17} fill={shade(c.c.skin, -0.08)} {...ink} strokeWidth={2.4} />,
  },
  {
    id: 'clown',
    name: 'Clown Nose',
    quip: 'Honk honk. Union clown. Charges by the honk.',
    render: () => (
      <g>
        <circle cx={0} cy={34} r={13} fill="#e5322d" {...ink} strokeWidth={2.4} />
        <circle cx={-4} cy={29} r={3.5} fill="#ff9a92" />
      </g>
    ),
  },
  {
    id: 'pig',
    name: 'Snout',
    quip: 'Oink. Ate an entire ham at Thanksgiving. Awkward.',
    render: () => (
      <g>
        <ellipse cx={0} cy={36} rx={16} ry={11} fill="#f6a5b4" {...ink} strokeWidth={2.4} />
        <ellipse cx={-5} cy={36} rx={2.6} ry={4} fill="#9b3c4b" />
        <ellipse cx={5} cy={36} rx={2.6} ry={4} fill="#9b3c4b" />
      </g>
    ),
  },
  {
    id: 'pointy',
    name: 'Pointy',
    quip: 'Pokes into everyone\'s business. Literally.',
    render: (c) => <path d="M -4 22 L 18 42 L -4 44 Z" fill={shade(c.c.skin, -0.06)} {...ink} strokeWidth={2.4} />,
  },
  {
    id: 'adult',
    name: 'Grown-Up',
    quip: 'A real nose for real taxpayers.',
    render: () => <path d="M -2 18 Q -8 36 -10 40 Q 0 46 8 40" fill="none" {...ink} strokeWidth={2.6} />,
  },
];

/* --------------------------------------------------------- face details */

export const FACE_DETAILS: HeadPart[] = [
  { id: 'none', name: 'None', quip: 'Clear skin. Suspiciously clear. Witness protection?', render: () => null },
  {
    id: 'freckles',
    name: 'Freckles',
    quip: 'Sun kisses. Or dirt. The jury is still out.',
    render: (c) => (
      <Mirror>
        {[
          [-70, 30],
          [-60, 38],
          [-78, 40],
          [-66, 46],
          [-54, 28],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={2.6} fill={shade(c.c.skin, -0.32)} />
        ))}
      </Mirror>
    ),
  },
  {
    id: 'blush',
    name: 'Rosy Cheeks',
    quip: 'Permanently embarrassed. About what? Everything.',
    render: () => (
      <Mirror>
        <ellipse cx={-66} cy={40} rx={16} ry={9} fill="#ff6f7d" opacity={0.45} />
      </Mirror>
    ),
  },
  {
    id: 'bandaid',
    name: 'Band-Aid',
    quip: 'Lost a fight with a snowball. The snowball had a rock in it.',
    render: () => (
      <g transform="rotate(-25 66 36)">
        <rect x={44} y={28} width={44} height={16} rx={7} fill="#f2c79b" {...ink} strokeWidth={2} />
        <rect x={60} y={30} width={12} height={12} fill="#e9b07c" />
        <circle cx={63} cy={33} r={1} fill="#b57d4b" />
        <circle cx={69} cy={39} r={1} fill="#b57d4b" />
      </g>
    ),
  },
  {
    id: 'scar',
    name: 'Battle Scar',
    quip: 'Says it was a bear. It was a stapler.',
    render: () => <path d="M -78 14 L -48 50 M -72 22 l 8 -5 M -64 32 l 8 -5 M -56 42 l 8 -5" fill="none" stroke="#a33c3c" strokeWidth={3} strokeLinecap="round" />,
  },
  {
    id: 'blackeye',
    name: 'Shiner',
    quip: 'You should see the other kid. He is fine, actually. Totally fine.',
    render: () => <ellipse cx={30} cy={2} rx={40} ry={46} fill="#6a4c93" opacity={0.42} transform="rotate(-12 30 2)" />,
  },
  {
    id: 'dirt',
    name: 'Grubby',
    quip: 'Bath day is Sunday. It is Friday. Which Sunday? Unknown.',
    render: () => (
      <g fill="#7a5a3c" opacity={0.45}>
        <ellipse cx={-72} cy={48} rx={14} ry={8} transform="rotate(-20 -72 48)" />
        <ellipse cx={58} cy={70} rx={10} ry={6} />
        <ellipse cx={80} cy={22} rx={7} ry={5} />
      </g>
    ),
  },
  { id: 'mole', name: 'Beauty Mark', quip: 'Has its own fan club. The club meets Tuesdays.', render: () => <circle cx={30} cy={70} r={4} fill="#3d2314" /> },
  {
    id: 'warpaint',
    name: 'War Paint',
    quip: 'Ready for battle. Or dodgeball. Same thing really.',
    render: () => (
      <Mirror>
        <path d="M -92 24 L -48 30 M -90 40 L -50 44" stroke="#d33b2c" strokeWidth={7} strokeLinecap="round" />
      </Mirror>
    ),
  },
  {
    id: 'lipstick',
    name: "Mom's Lipstick",
    quip: "Borrowed Mom's lipstick. Mom does not know. Mom will know.",
    render: () => <ellipse cx={0} cy={62} rx={24} ry={11} fill="#e2364e" opacity={0.8} />,
  },
  {
    id: 'tears',
    name: 'Tears',
    quip: 'Crying. About everything. The dog. The weather. The concept of Tuesdays.',
    render: () => (
      <Mirror>
        <path d="M -40 34 Q -46 50 -44 70 Q -40 76 -36 70 Q -34 50 -40 34 Z" fill="#9fd8ff" stroke="#3b8fd8" strokeWidth={1.6} />
      </Mirror>
    ),
  },
  {
    id: 'sweat',
    name: 'Nervous Sweat',
    quip: 'Forgot to study. For a test that was yesterday.',
    render: () => (
      <g fill="#9fd8ff" stroke="#3b8fd8" strokeWidth={1.6}>
        <path d="M 92 -40 Q 82 -22 92 -16 Q 102 -22 92 -40 Z" />
        <path d="M 104 -6 Q 97 6 104 10 Q 111 6 104 -6 Z" />
      </g>
    ),
  },
  {
    id: 'wrinkles',
    name: 'Wrinkles',
    quip: 'Wise beyond their years. Or just tired. Mostly tired.',
    render: () => (
      <g fill="none" stroke={O} strokeWidth={1.8} opacity={0.6}>
        <path d="M -30 -72 Q 0 -78 30 -72 M -22 -82 Q 0 -86 22 -82" />
        <path d="M -40 72 Q -36 82 -28 86 M 40 72 Q 36 82 28 86" />
      </g>
    ),
  },
  {
    id: 'zits',
    name: 'Zits',
    quip: 'Puberty showed up early. And brought friends.',
    render: () => (
      <g fill="#e2584f" stroke="#a8322b" strokeWidth={1}>
        <circle cx={-60} cy={52} r={3.5} />
        <circle cx={66} cy={28} r={3} />
        <circle cx={18} cy={86} r={2.8} />
        <circle cx={-20} cy={-62} r={3} />
      </g>
    ),
  },
  {
    id: 'whiskers',
    name: 'Cat Whiskers',
    quip: 'Face-painted at the fair. Refuses to wash it off. Now hisses at dogs.',
    render: () => (
      <g>
        <ellipse cx={0} cy={38} rx={7} ry={5} fill="#333" />
        <Mirror>
          <path d="M -30 40 L -80 30 M -30 46 L -82 48 M -30 52 L -78 64" stroke={O} strokeWidth={2} strokeLinecap="round" />
        </Mirror>
      </g>
    ),
  },
];

/* ---------------------------------------------------------- facial hair */

export interface FacialHairDef extends ItemBase {
  under?: Render;
  over?: Render;
}

const BEARD_FULL =
  'M -124 6 C -124 70 -74 128 0 132 C 74 128 124 70 124 6 C 112 30 96 40 76 40 C 56 56 30 48 0 48 C -30 48 -56 56 -76 40 C -96 40 -112 30 -124 6 Z';

export const FACIAL_HAIR: FacialHairDef[] = [
  { id: 'none', name: 'Clean Shaven', quip: 'Smooth as a freshly zambonied ice rink.' },
  {
    id: 'stubble',
    name: 'Stubble',
    quip: "Hasn't shaved since the divorce. Which divorce? Exactly.",
    under: (c) => {
      // Stubble stays on the face: clip it to the head so it never hangs below the chin.
      const id = c.uid('stubble');
      return (
        <g>
          <clipPath id={id}>
            <path d={(HEAD_SHAPES[c.c.headShape] ?? HEAD_SHAPES.round).path} transform="translate(0 -6)" />
          </clipPath>
          <path d={BEARD_FULL} fill={c.color} opacity={0.3} clipPath={`url(#${id})`} />
        </g>
      );
    },
  },
  {
    id: 'mustache',
    name: 'Mustache',
    quip: 'Trust me, I am a guy with a mustache.',
    over: (c) => <path d="M -30 54 Q -16 40 0 48 Q 16 40 30 54 Q 16 52 0 56 Q -16 52 -30 54 Z" fill={c.color} {...ink} strokeWidth={2.2} />,
  },
  {
    id: 'handlebar',
    name: 'Handlebar',
    quip: 'Rides a penny-farthing. Unironically.',
    over: (c) => (
      <path
        d="M -46 44 Q -50 56 -40 56 Q -24 52 -14 46 Q -6 42 0 48 Q 6 42 14 46 Q 24 52 40 56 Q 50 56 46 44 Q 44 52 38 50 Q 20 38 0 44 Q -20 38 -38 50 Q -44 52 -46 44 Z"
        fill={c.color}
        {...ink}
        strokeWidth={2.2}
      />
    ),
  },
  {
    id: 'beard',
    name: 'Full Beard',
    quip: 'Lumberjack energy. Allergic to wood.',
    under: (c) => <path d={BEARD_FULL} fill={c.color} {...ink} />,
    over: (c) => <path d="M -28 54 Q -14 44 0 50 Q 14 44 28 54 Q 14 52 0 56 Q -14 52 -28 54 Z" fill={c.color} {...ink} strokeWidth={2} />,
  },
  {
    id: 'goatee',
    name: 'Goatee',
    quip: 'Plays bass in a garage band called "Garage Band".',
    under: (c) => <path d="M -20 74 Q 0 70 20 74 Q 18 104 0 108 Q -18 104 -20 74 Z" fill={c.color} {...ink} />,
    over: (c) => <path d="M -24 54 Q -12 46 0 50 Q 12 46 24 54 Q 12 52 0 55 Q -12 52 -24 54 Z" fill={c.color} {...ink} strokeWidth={2} />,
  },
  {
    id: 'chinstrap',
    name: 'Chin Strap',
    quip: 'Peaked in high school. Was in high school for one week.',
    under: (c) => (
      <path
        d="M -126 -6 C -124 70 -74 124 0 128 C 74 124 124 70 126 -6 L 112 -6 C 110 60 66 108 0 110 C -66 108 -110 60 -112 -6 Z"
        fill={c.color}
        {...ink}
        strokeWidth={2.4}
      />
    ),
  },
  {
    id: 'pencil',
    name: 'Pencil Stache',
    quip: 'Sells used cars. Every car has "a little personality".',
    over: (c) => <path d="M -22 50 Q 0 44 22 50" fill="none" stroke={c.color} strokeWidth={4} strokeLinecap="round" />,
  },
  {
    id: 'bushy',
    name: 'Wizard Beard',
    quip: 'Small woodland creatures live in here. They pay rent.',
    under: (c) => (
      <path
        d="M -124 0 C -130 80 -90 170 0 186 C 90 170 130 80 124 0 C 110 30 90 40 70 40 C 50 56 26 50 0 50 C -26 50 -50 56 -70 40 C -90 40 -110 30 -124 0 Z"
        fill={c.color}
        {...ink}
      />
    ),
    over: (c) => <path d="M -34 56 Q -16 40 0 48 Q 16 40 34 56 Q 16 52 0 58 Q -16 52 -34 56 Z" fill={c.color} {...ink} strokeWidth={2} />,
  },
  {
    id: 'soulpatch',
    name: 'Soul Patch',
    quip: 'Writes poetry. Terrible, terrible poetry.',
    under: (c) => <path d="M -5 78 L 5 78 L 3 92 L -3 92 Z" fill={c.color} />,
  },
  {
    id: 'walrus',
    name: 'Walrus',
    quip: 'Eats soup very, very carefully.',
    over: (c) => (
      <path
        d="M -36 46 Q -18 34 0 42 Q 18 34 36 46 L 34 70 L 26 62 L 20 72 L 12 64 L 6 74 L 0 64 L -6 74 L -12 64 L -20 72 L -26 62 L -34 70 Z"
        fill={c.color}
        {...ink}
        strokeWidth={2.2}
      />
    ),
  },
  {
    id: 'sideburns',
    name: 'Mutton Chops',
    quip: 'The king of sideburns. Thank you. Thank you very much.',
    under: (c) => (
      <Mirror>
        <path d="M -127 -20 L -104 -20 L -96 50 Q -110 54 -122 40 Q -128 10 -127 -20 Z" fill={c.color} {...ink} strokeWidth={2.4} />
      </Mirror>
    ),
  },
];

/* ---------------------------------------------------------------- moods */

export interface MoodDef extends ItemBase {
  set: { eyes: string; brows: string; mouth: string };
}

export const MOODS: MoodDef[] = [
  { id: 'happy', name: 'Content', quip: 'All is well. For now.', set: { eyes: 'classic', brows: 'thin', mouth: 'smile' } },
  { id: 'joy', name: 'Overjoyed', quip: 'Snow day! Best day! Never going back!', set: { eyes: 'happy', brows: 'thin', mouth: 'grin' } },
  { id: 'angry', name: 'Furious', quip: 'Somebody touched their stuff.', set: { eyes: 'angry', brows: 'angry', mouth: 'frown' } },
  { id: 'rage', name: 'Screaming', quip: 'Storming off home in a huff. Will be back in five minutes for snacks.', set: { eyes: 'angry', brows: 'angry', mouth: 'shout' } },
  { id: 'sad', name: 'Bummed', quip: 'Dropped their ice cream. On a puppy. Both were sad.', set: { eyes: 'sad', brows: 'worried', mouth: 'frown' } },
  { id: 'shock', name: 'Shocked', quip: 'Did they just say that on network TV?', set: { eyes: 'wide', brows: 'raised', mouth: 'oshock' } },
  { id: 'smug', name: 'Smug', quip: 'Told you so. Told you so. Told you so.', set: { eyes: 'shifty', brows: 'raised', mouth: 'smug' } },
  { id: 'evil', name: 'Evil Plotting', quip: 'Planning revenge on whoever invented homework.', set: { eyes: 'demon', brows: 'angry', mouth: 'fangs' } },
  { id: 'sick', name: 'Green Around the Gills', quip: 'Mystery meat Monday strikes again.', set: { eyes: 'tired', brows: 'worried', mouth: 'wavy' } },
  { id: 'love', name: 'Lovestruck', quip: 'Wrote a love letter. Signed it "anonymous". Wrote their address on it.', set: { eyes: 'hearts', brows: 'thin', mouth: 'kissy' } },
  { id: 'deadpan', name: 'Deadpan', quip: 'Whatever, dude.', set: { eyes: 'sleepy', brows: 'none', mouth: 'flat' } },
  { id: 'crazy', name: 'Unhinged', quip: 'Ate a whole bag of sugar. For science.', set: { eyes: 'crazy', brows: 'raised', mouth: 'grimace' } },
];

