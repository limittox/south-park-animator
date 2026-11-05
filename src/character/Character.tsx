import { memo, useId, type ReactNode } from 'react';
import type { CategoryId, CharacterState, RenderCtx } from '../types';
import { ADULT_FACE_FIT, armGeo, armPath, CANADIAN_SPLIT_Y, eyeFit, FACE_FIT, frameViewBox, getGeo, HEAD_RX, HEAD_RY, HEAD_SHAPES, handPos, seatedGeo } from './geometry';
import { isRest, restArms, type ArmsPose, type ArmState } from './pose';
import { ink, O } from './parts/common';
import { BROWS, EYES, FACE_DETAILS, FACIAL_HAIR, MOUTHS, NOSES, talkingMouth } from './parts/face';
import { HAIR } from './parts/hair';
import { HATS } from './parts/hats';
import { FACE_GEAR, GLASSES } from './parts/glasses';
import { BOTTOMS, NECKWEAR, SHOES, TOPS, type TopDef } from './parts/clothes';
import { HELD, SIDEKICKS } from './parts/held';

function byId<T extends { id: string }>(list: T[], id: string): T {
  return list.find((x) => x.id === id) ?? list[0];
}

export interface CharacterProps {
  c: CharacterState;
  /** Mouth openness while talking, 0..1. */
  talk?: number;
  /** Three-quarter turn, -1 (facing the viewer's left) to 1 (right). The face slides across the head, like the show. */
  turn?: number;
  /** Posed arms (see pose.ts). Defaults to arms hanging at rest. */
  arms?: ArmsPose;
  /** Eyes shut for a blink. */
  blink?: boolean;
  /** Sitting: where the hips are (character coordinates); see seatedGeo. */
  hipY?: number;
  onPartClick?: (cat: CategoryId) => void;
}

/** A whole character as an SVG <g>, in character coordinates (ground at y = 480). */
export const CharacterGroup = memo(function CharacterGroup({ c, talk = 0, turn = 0, arms: pose, blink = false, hipY, onPartClick }: CharacterProps) {
  const rawId = useId();
  const prefix = 'c' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  let counter = 0;
  const uid = (name: string) => `${prefix}-${name}-${counter++}`;

  const standing = getGeo(c.body, c.headShape);
  const g = seatedGeo(standing, hipY);
  // Sitting with the legs folded: knees toward the camera, a little wider than the hips.
  const folded = g.legTop - standing.legTop > 8;
  const shape = HEAD_SHAPES[c.headShape] ?? HEAD_SHAPES.round;
  const ctx = (color: string): RenderCtx => ({ c, g, color, uid, talk });

  const top = byId(TOPS, c.top);
  const bottom = byId(BOTTOMS, c.bottom);
  const shoes = byId(SHOES, c.shoes);
  const neck = byId(NECKWEAR, c.neck);
  const hat = byId(HATS, c.hat);
  const hair = byId(HAIR, c.hair);
  const eyes = byId(EYES, c.eyes);
  const brows = byId(BROWS, c.brows);
  const mouth = byId(MOUTHS, c.mouth);
  const nose = byId(NOSES, c.nose);
  const detail = byId(FACE_DETAILS, c.faceDetail);
  const fhair = byId(FACIAL_HAIR, c.facialHair);
  const glasses = byId(GLASSES, c.glasses);
  const gear = byId(FACE_GEAR, c.faceGear);
  const held = byId(HELD, c.held);
  const pet = byId(SIDEKICKS, c.sidekick);

  const part = (cat: CategoryId, children: ReactNode, key?: string) =>
    onPartClick ? (
      <g
        key={key}
        className="sp-part"
        data-cat={cat}
        onClick={(e) => {
          e.stopPropagation();
          onPartClick(cat);
        }}
      >
        {children}
      </g>
    ) : (
      <g key={key}>{children}</g>
    );

  const sx = g.headRx / HEAD_RX;
  const sy = g.headRy / HEAD_RY;
  const headT = `translate(${g.headCx} ${g.headCy}) scale(${sx} ${sy})`;

  // In the show hats are pulled right down to the eyes, so crown-covering hats sit a little lower.
  const hatDrop = hat.clipHairAbove !== undefined && !hat.hidesHair && !hat.hidesFace ? Math.min(16, Math.max(0, -30 - hat.clipHairAbove)) : 0;
  const hatT = hatDrop ? `translate(0 ${hatDrop})` : undefined;

  // Hair hidden under hats. Hair behind the head is cut a little lower so it can't peek out past the brim.
  let hairClipId: string | undefined;
  let backClipId: string | undefined;
  let hairClipDef: ReactNode = null;
  if (hat.clipHairAbove !== undefined && !hat.hidesHair) {
    hairClipId = uid('hairclip');
    backClipId = uid('backclip');
    hairClipDef = (
      <>
        <clipPath id={hairClipId}>
          <rect x={-400} y={hat.clipHairAbove + hatDrop} width={800} height={900} />
        </clipPath>
        <clipPath id={backClipId}>
          <rect x={-400} y={hat.clipHairAbove + hatDrop + 14} width={800} height={900} />
        </clipPath>
      </>
    );
  }
  // Glasses arms run back to the ears: anything past the edge of the head is tucked behind it.
  const glassesClipId = uid('glassclip');
  const showHair = !hat.hidesHair && !hat.hidesFace;
  const hairClip = hairClipId ? `url(#${hairClipId})` : undefined;
  const backClip = backClipId ? `url(#${backClipId})` : undefined;

  const photo = c.usePhotoFace && c.photoFace ? c.photoFace : null;
  const canadian = !!shape.canadian;
  const mouthOpen = talk > 0.05;

  /* ---- arms ---- */
  const sleeveColor = top.sleeveColor?.(ctx(c.topColor)) ?? c.topColor;
  const armBase = top.sleeves === 'long' ? sleeveColor : c.skin;
  const armsVisible = top.sleeves !== 'hidden';
  const arms = pose ?? restArms(g);

  // Flat cut-out arms: one colour, no outline, and a single crease where the arm meets the body.
  const armStrip = (a: ArmState) => (
    <g key={a.side}>
      {/* Bare arms start under the short sleeve, or their round end pokes out above the shoulder. */}
      <path d={top.sleeves === 'short' ? armPath(a, 0.4) : armPath(a)} fill="none" stroke={armBase} strokeWidth={g.armW} strokeLinecap="round" />
      {top.sleeves === 'short' && <path d={armPath(a, 0, 0.5)} fill="none" stroke={sleeveColor} strokeWidth={g.armW + 1} strokeLinecap="butt" />}
      {top.sleeves === 'short' && <circle cx={a.start[0]} cy={a.start[1]} r={(g.armW + 1) / 2} fill={sleeveColor} />}
      {isRest(g, a) && (
        <path d={armPath(a, 0.6, 0.92)} transform={`translate(${-a.side * g.armW * 0.42} 0)`} fill="none" stroke={O} strokeWidth={2.4} strokeLinecap="round" />
      )}
    </g>
  );

  const mitten = top.mittens?.(ctx(c.topColor)) ?? c.skin;
  // Hands turn with the forearm: the angle is measured against the arm's resting direction.
  const handOf = (a: ArmState) => {
    const side = a.side;
    const [hx, hy] = a.hand;
    const rest = armGeo(g, side);
    const angle = (p: { ctrl: [number, number]; end: [number, number] }) => Math.atan2(p.end[1] - p.ctrl[1], p.end[0] - p.ctrl[0]);
    const rot = ((angle(a) - angle(rest)) * 180) / Math.PI;
    return (
      <g key={side} transform={Math.abs(rot) > 0.5 ? `rotate(${rot.toFixed(1)} ${hx} ${hy})` : undefined}>
        <ellipse cx={hx} cy={hy} rx={g.handR} ry={g.handR * (g.isAdult ? 1.45 : 1.25)} fill={mitten} {...ink} />
        <ellipse
          cx={hx - side * g.handR * 0.72}
          cy={hy - g.handR * 0.5}
          rx={g.handR * 0.36}
          ry={g.handR * 0.56}
          transform={`rotate(${-side * 28} ${hx - side * g.handR * 0.72} ${hy - g.handR * 0.5})`}
          fill={mitten}
          {...ink}
        />
      </g>
    );
  };
  const under = arms.filter((a) => !a.over);
  const over = arms.filter((a) => a.over);
  const armColor = armsVisible ? under.map(armStrip) : null;
  const hands = under.map(handOf);
  // Held items travel with the right hand.
  const restHand = handPos(g, 1);
  const heldDx = arms[1].hand[0] - restHand[0];
  const heldDy = arms[1].hand[1] - restHand[1];
  const heldMove = Math.abs(heldDx) + Math.abs(heldDy) > 0.5 ? `translate(${heldDx.toFixed(1)} ${heldDy.toFixed(1)})` : '';
  // Kids' heads are huge next to their hands: tall props lean out so the head doesn't hide them.
  const heldLean = held.lean && !g.isAdult ? `rotate(${held.lean} ${restHand[0]} ${restHand[1]})` : '';
  const heldT = `${heldMove} ${heldLean}`.trim() || undefined;

  /* ---- head contents (head coordinates) ---- */
  const fit = (t: string, children: ReactNode) => <g transform={t}>{children}</g>;
  const FIT = g.isAdult ? ADULT_FACE_FIT : FACE_FIT;
  const EYES_FIT = eyeFit(FIT, g);

  // A blink is a pair of skin-coloured lids with a curved closed-eye line, the same shape as the eye pair.
  const eyesNode = (): ReactNode => {
    if (!blink) return eyes.render(ctx(c.hairColor));
    const s = c.eyes === 'wide' ? 1.12 : 1.03;
    return (
      <g>
        {([-1, 1] as const).map((side) => {
          const cx = side * 27 * s;
          return (
            <g key={side} transform={`rotate(${-side * 14} ${cx} 0)`}>
              <ellipse cx={cx} cy={0} rx={28 * s + 1} ry={36 * s + 1} fill={c.skin} />
              <path d={`M ${cx - 21 * s} 3 Q ${cx} ${14 * s} ${cx + 21 * s} 3`} fill="none" stroke={O} strokeWidth={3.2} strokeLinecap="round" />
            </g>
          );
        })}
      </g>
    );
  };

  const faceParts = (): ReactNode[] => {
    if (hat.hidesFace) return [];
    const out: ReactNode[] = [];
    out.push(part('faceDetail', fit(FIT.detail, detail.render(ctx(c.hairColor))), 'detail'));
    if (photo) {
      out.push(part('skin', <PhotoFace src={photo} talk={talk} uid={uid} stretch={sy / sx} />, 'photo'));
    } else {
      out.push(part('nose', fit(FIT.nose, nose.render(ctx(c.hairColor))), 'nose'));
      if (fhair.under) out.push(part('facialHair', fit(FIT.jaw, fhair.under(ctx(c.hairColor))), 'fh-under'));
      if (canadian) {
        // the split line *is* the mouth
      } else {
        out.push(part('mouth', fit(FIT.mouth, mouthOpen ? talkingMouth(talk) : mouth.render(ctx(c.hairColor))), 'mouth'));
      }
      if (fhair.over) out.push(part('facialHair', fit(FIT.mouth, fhair.over(ctx(c.hairColor))), 'fh-over'));
      if (!hat.eyesOver) out.push(part('eyes', fit(EYES_FIT, eyesNode()), 'eyes'));
    }
    if (gear.render) out.push(part('faceGear', fit(FIT.gear, gear.render(ctx(c.hairColor))), 'gear'));
    return out;
  };

  // Turning slides the whole face sideways and squeezes it a little; hair and hats sway along.
  const look = Math.max(-1, Math.min(1, turn));
  const faceT = look ? `translate(${look * 34} 0) scale(${1 - Math.abs(look) * 0.12} 1)` : undefined;
  const swayT = look ? `translate(${look * 6} 0)` : undefined;

  const headFront = (): ReactNode => (
    <>
      {part('skin', <path d={shape.path} fill={c.skin} {...ink} />, 'skin')}
      <g transform={faceT}>{faceParts()}</g>
      {showHair && hair.front && part('hair', <g transform={swayT} clipPath={hairClip}>{hair.front(ctx(c.hairColor))}</g>, 'hairfront')}
      <g transform={faceT}>
        {/* Brows sit on top of fringes so they stay visible; hats still cover them. */}
        {!hat.hidesFace && !photo && c.brows !== 'none' && part('brows', fit(EYES_FIT, <BrowHalo skin={c.skin} uid={uid}>{brows.render(ctx(c.hairColor))}</BrowHalo>), 'brows')}
      </g>
      {!hat.hidesFace && glasses.render && (
        <g clipPath={`url(#${glassesClipId})`}>
          <g transform={faceT}>{part('glasses', fit(EYES_FIT, glasses.render(ctx(c.glassesColor))), 'glasses')}</g>
        </g>
      )}
      {hat.front && part('hat', <g transform={swayT}><g transform={hatT}>{hat.front(ctx(c.hatColor))}</g></g>, 'hat')}
      {hat.eyesOver && !photo && <g transform={faceT}>{part('eyes', fit(EYES_FIT, eyesNode()), 'eyes-over')}</g>}
    </>
  );

  let head: ReactNode;
  if (canadian) {
    const lift = talk * 20;
    const topId = uid('cantop');
    const botId = uid('canbot');
    const gapId = uid('cangap');
    const split = CANADIAN_SPLIT_Y;
    const lineHalf = 128 * Math.sqrt(Math.max(0, 1 - (split / 106) ** 2)) - 2;
    head = (
      <>
        <clipPath id={topId}>
          <rect x={-400} y={-600} width={800} height={600 + split} />
        </clipPath>
        <clipPath id={botId}>
          <rect x={-400} y={split} width={800} height={600} />
        </clipPath>
        <clipPath id={gapId}>
          <rect x={-400} y={split - lift - 2} width={800} height={lift + 4} />
        </clipPath>
        {lift > 0 && <path d={shape.path} fill="#2b1b22" clipPath={`url(#${gapId})`} />}
        <g clipPath={`url(#${botId})`}>{headFront()}</g>
        <path d={`M ${-lineHalf} ${split} Q 0 ${split + 6} ${lineHalf} ${split}`} fill="none" stroke={O} strokeWidth={3.5} />
        <g transform={`translate(0 ${-lift})`}>
          <g clipPath={`url(#${topId})`}>{headFront()}</g>
          {lift > 0 && <path d={`M ${-lineHalf} ${split} Q 0 ${split + 6} ${lineHalf} ${split}`} fill="none" stroke={O} strokeWidth={3} />}
        </g>
      </>
    );
  } else {
    head = headFront();
  }

  const bottomColor = top.legsMatch ? c.topColor : c.bottomColor;

  return (
    <g className="sp-char">
      <defs>
        {hairClipDef}
        <clipPath id={glassesClipId}>
          <path d={shape.path} />
        </clipPath>
      </defs>
      {pet.render && part('sidekick', pet.render(ctx(c.heldColor)))}
      {neck.back && part('neck', neck.back(ctx(c.neckColor)))}
      {showHair && hair.back && (
        <g transform={headT}>{part('hair', <g clipPath={backClip}>{hair.back(ctx(c.hairColor))}</g>)}</g>
      )}
      {hat.back && <g transform={headT}>{part('hat', <g transform={hatT}>{hat.back(ctx(c.hatColor))}</g>)}</g>}
      {part('bottom', bottom.render(ctx(bottomColor)))}
      {part('shoes', shoes.render(ctx(c.shoesColor)))}
      {folded &&
        part(
          'bottom',
          <>
            {([-1, 1] as const).map((side) => (
              <ellipse key={side} cx={g.cx + side * (g.legSep + 6)} cy={g.legTop + 16} rx={g.legW / 2 + 9} ry={Math.min(24, 8 + (g.legBottom - g.legTop) * 0.3)} fill={bottomColor} {...ink} />
            ))}
          </>,
          'lap',
        )}
      {top.skirt && part('top', top.skirt(ctx(c.topColor)))}
      {part(
        'top',
        <>
          {top.torso(ctx(c.topColor))}
          {armColor}
        </>,
      )}
      {held.render && part('held', <g transform={heldT}>{held.render(ctx(c.heldColor))}</g>)}
      {part('top', hands)}
      {top.over && part('top', top.over(ctx(c.topColor)))}
      {neck.front && !neck.overHead && part('neck', neck.front(ctx(c.neckColor)))}
      <g transform={headT}>{head}</g>
      {neck.front && neck.overHead && part('neck', neck.front(ctx(c.neckColor)))}
      {over.length > 0 && part('top', <>{armsVisible && over.map(armStrip)}{over.map(handOf)}</>, 'over-arms')}
    </g>
  );
});

/** Skin-coloured outline so brows read even when they sit on top of dark hair. */
function BrowHalo({ skin, uid, children }: { skin: string; uid: (n: string) => string; children: ReactNode }) {
  const id = uid('browhalo');
  return (
    <>
      <filter id={id} x="-30%" y="-80%" width="160%" height="260%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="spread" />
        <feFlood floodColor={skin} result="flood" />
        <feComposite in="flood" in2="spread" operator="in" result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
}

/** A real face pasted on the paper head. `stretch` undoes the head's vertical stretch so photos keep their shape. */
function PhotoFace({ src, talk, uid, stretch }: { src: string; talk: number; uid: (n: string) => string; stretch: number }) {
  const faceId = uid('face');
  const topId = uid('facetop');
  const botId = uid('facebot');
  const drop = talk * 16;
  const split = 46;
  const img = <image href={src} x={-88} y={-92} width={176} height={196} preserveAspectRatio="xMidYMid slice" />;
  return (
    <g transform={`translate(0 22) scale(1.05 ${1.05 / stretch})`}>
      <clipPath id={faceId}>
        <ellipse cx={0} cy={6} rx={84} ry={94} />
      </clipPath>
      <clipPath id={topId}>
        <rect x={-200} y={-200} width={400} height={200 + split} />
      </clipPath>
      <clipPath id={botId}>
        <rect x={-200} y={split} width={400} height={200} />
      </clipPath>
      <g clipPath={`url(#${faceId})`}>
        {drop > 0 && <rect x={-90} y={split - 2} width={180} height={drop + 4} fill="#2b1b22" />}
        <g clipPath={`url(#${topId})`}>{img}</g>
        <g transform={`translate(0 ${drop})`}>
          <g clipPath={`url(#${botId})`}>{img}</g>
        </g>
      </g>
      <ellipse cx={0} cy={6 + drop / 2} rx={83} ry={93 + drop / 2} fill="none" stroke={O} strokeWidth={2.5} strokeDasharray="7 4" />
    </g>
  );
}

export interface CharacterSvgProps extends CharacterProps {
  viewBox?: string;
  className?: string;
  title?: string;
}

/** A standalone character picture. Without a viewBox it frames the whole character. */
export function CharacterSvg({ viewBox, className, title, ...rest }: CharacterSvgProps) {
  const box = viewBox ?? frameViewBox(getGeo(rest.c.body, rest.c.headShape));
  return (
    <svg viewBox={box} className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title ?? rest.c.name}>
      <CharacterGroup {...rest} />
    </svg>
  );
}

export { byId };
export type { TopDef };
