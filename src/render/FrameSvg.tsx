import { memo, useId, type ReactNode, type Ref, type SVGProps } from 'react';
import type { SetSpec, TimeOfDay, Weather } from '../episode/types';
import { FRAME_H, FRAME_W, PANEL_W, verticalCamera, VFRAME_H, VFRAME_W, type ActorFrame, type Camera, type Frame, type PropFrame, type SceneFrame, type VehicleFrame } from '../episode/timeline';
import { CharacterGroup } from '../character/Character';
import { getGeo, handPos } from '../character/geometry';
import { HELD, SIDEKICKS } from '../character/parts/held';
import { BurstShape, WallHole } from './Effects';
import { DUSK_SKY, getScene, NIGHT_SKY } from '../scenes/backgrounds';
import { renderKitSet, tintDef, tintFilter } from '../sets/kit';
import { getVehicleDef, wheel } from '../sets/vehicles';
import { renderSeatCover } from '../episode/seats';
import { MirroredPart, seeded } from '../character/parts/common';

export const DISPLAY = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
const STUDIO_COLOR = '#5aaeea';

/** Background and foreground of a set. Memoized on the set object, which only changes when edited. */
export const SetLayer = memo(function SetLayer({ set, layer }: { set: SetSpec; layer: 'back' | 'front' }) {
  if (set.kind === 'kit') {
    const r = renderKitSet(set);
    return <>{layer === 'back' ? r.back : r.front}</>;
  }
  const scene = getScene(set.preset);
  const opts = { townName: set.townName ?? 'Snowpine Hollow', studioColor: STUDIO_COLOR, time: set.time };
  const art = layer === 'front' ? scene.front?.(opts) : scene.render(opts);
  if (!art) return null;
  // Outdoors the whole picture darkens, as a built set does. Indoors the lights are on, so only the windows change.
  const time = scene.times === 'outdoors' ? set.time : undefined;
  return (
    <g className="sp-scene">
      {time && tintDef(time)}
      <g filter={time && tintFilter(time)}>{art}</g>
    </g>
  );
});

export function actorTransform(a: ActorFrame): string {
  const sx = (a.flip ? -1 : 1) * a.scale * a.squash;
  const y = a.y - a.lift * a.scale;
  return `translate(${a.x.toFixed(1)} ${y.toFixed(1)})${a.rotate ? ` rotate(${a.rotate.toFixed(1)})` : ''} scale(${sx.toFixed(4)} ${a.scale.toFixed(4)}) translate(-200 -480)`;
}

/** Someone turned into a creature, drawn much bigger than the pet it would otherwise be. */
function Creature({ a }: { a: ActorFrame }) {
  const prefix = `form${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const def = SIDEKICKS.find((s) => s.id === a.form);
  const g = getGeo(a.c.body, a.c.headShape);
  let n = 0;
  const art = def?.render?.({ c: a.c, g, color: def.defaultColor ?? a.c.heldColor, uid: (name) => `${prefix}-${name}-${n++}`, talk: 0 });
  const s = a.scale * 1.7;
  return (
    <g className="sp-char" transform={`translate(${a.x.toFixed(1)} ${(a.y - a.lift * a.scale).toFixed(1)}) scale(${(a.flip ? -s : s).toFixed(3)} ${s.toFixed(3)}) translate(${-(g.cx - 186)} -480)`}>
      <MirroredPart.Provider value={a.flip}>{art}</MirroredPart.Provider>
    </g>
  );
}

export const Actor = memo(function Actor({ a }: { a: ActorFrame }) {
  if (a.form) return <Creature a={a} />;
  return (
    <g transform={actorTransform(a)}>
      <MirroredPart.Provider value={a.flip}>
        <CharacterGroup c={a.c} talk={a.talk} mouthShape={a.mouth} turn={a.turn} view={a.view} stride={a.stride} arms={a.arms} blink={a.blink} gazeX={a.gazeX} gazeY={a.gazeY} tears={a.tears} vomit={a.vomit} hipY={a.hipY} />
      </MirroredPart.Provider>
    </g>
  );
});

/** A prop on its own, drawn as it would be in the hand, with the hand's spot at (x, y). */
function FlyingProp({ p }: { p: PropFrame }) {
  const prefix = `prop${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const g = getGeo(p.look.body, p.look.headShape);
  const [hx, hy] = handPos(g, 1);
  let n = 0;
  const art = HELD.find((h) => h.id === p.item)?.render?.({ c: p.look, g, color: p.color, uid: (name) => `${prefix}-${name}-${n++}`, talk: 0 });
  return (
    <g className="sp-char" transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rotate.toFixed(1)}) scale(${p.scale}) translate(${-hx} ${-hy})`}>
      {art}
    </g>
  );
}

/** The table or desk someone sits behind, drawn again over them. */
const SeatCover = memo(function SeatCover({ set, seat }: { set: SetSpec; seat: string }) {
  return <>{renderSeatCover(set, seat)}</>;
});

/** A car or bus: glass, then the passengers clipped to the cabin, then the body with its windows cut out. */
function VehicleShape({ v, passengers }: { v: VehicleFrame; passengers: ReactNode }) {
  const def = getVehicleDef(v.type);
  const t = `translate(${v.x.toFixed(1)} ${(v.y + v.bounce).toFixed(1)}) scale(${v.flip ? -1 : 1} 1)`;
  // Unique per drawing: a scene thumbnail on the same page draws the same vehicle somewhere else.
  const clip = `veh${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <g className="sp-scene">
      <clipPath id={clip}>
        <path d={def.cabin} transform={t} />
      </clipPath>
      <g transform={t}>
        <path d={def.cabin} fill={def.glass} />
      </g>
      <g clipPath={`url(#${clip})`}>{passengers}</g>
      <g transform={t}>
        {def.body(v.color, { flip: v.flip, lights: v.lights })}
        {def.wheels.map((x) => wheel(x, def.wheelR, v.spin))}
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------- weather */

const FLAKES = (() => {
  const rnd = seeded(4242);
  return Array.from({ length: 120 }, () => ({ x: rnd() * 1700 - 50, y: rnd() * 1100, r: rnd(), p: rnd() * Math.PI * 2 }));
})();

export function WeatherLayer({ weather, t, level = 1 }: { weather: Weather; t: number; level?: number }) {
  if (weather === 'none') return null;
  const colors = ['#d33b2c', '#f2c230', '#3b6fd8', '#7fbf3f', '#e86fb0', '#2ec4c4'];
  const count = weather === 'snow' ? 110 : weather === 'rain' ? 120 : 60;
  return (
    <g pointerEvents="none">
      {FLAKES.slice(0, Math.round(count * level)).map((f, i) => {
        const speed = weather === 'rain' ? 900 + f.r * 300 : weather === 'snow' ? 40 + f.r * 50 : 90 + f.r * 60;
        const y = ((f.y + t * speed) % 1100) - 50;
        const x = f.x + (weather === 'rain' ? 0 : Math.sin(t * (0.6 + f.r) + f.p) * 18);
        if (weather === 'snow') return <circle key={i} cx={x} cy={y} r={3 + f.r * 6} fill="#fff" opacity={0.9} />;
        if (weather === 'rain') return <path key={i} d={`M ${x} ${y} l -6 26`} stroke="#9fc6e8" strokeWidth={3} strokeLinecap="round" opacity={0.7} />;
        const rot = (t * 120 * (f.r - 0.5) + f.p * 57) % 360;
        if (weather === 'confetti')
          return <rect key={i} x={x} y={y} width={10} height={18} fill={colors[i % colors.length]} transform={`rotate(${rot.toFixed(0)} ${x + 5} ${y + 9})`} />;
        if (weather === 'hearts')
          return (
            <path
              key={i}
              d={`M ${x} ${y + 10} C ${x - 16} ${y} ${x - 10} ${y - 12} ${x} ${y - 4} C ${x + 10} ${y - 12} ${x + 16} ${y} ${x} ${y + 10} Z`}
              fill={i % 2 ? '#e5322d' : '#f27bb4'}
            />
          );
        return <path key={i} d={`M ${x - 14} ${y} q 6 -10 14 -4 q 10 -6 14 4 q 4 10 -8 10 q -12 4 -20 -10 Z`} fill="#f0742a" transform={`rotate(${rot.toFixed(0)} ${x} ${y})`} />;
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- overlays (frame space: 1600 × 900, or 900 × 1600 vertical) */

/** The size of the frame space overlays are drawn in. */
interface Size {
  w: number;
  h: number;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function Caption({ text, size: { w, h: fh } }: { text: string; size: Size }) {
  const boxW = Math.min(1000, w - 100);
  const lines = wrap(text, Math.floor(boxW / 38)).slice(0, 3);
  const h = lines.length * 70 + 50;
  const [cx, cy] = [w / 2, fh / 2];
  return (
    <g transform={`rotate(-2 ${cx} ${cy})`}>
      <rect x={cx - boxW / 2} y={cy - h / 2} width={boxW} height={h} rx={10} fill="#fffaf0" stroke="#1d1d1d" strokeWidth={5} />
      {lines.map((l, i) => (
        <text key={i} x={cx} y={cy - h / 2 + 82 + i * 70} textAnchor="middle" fontFamily={DISPLAY} fontSize={60} fill="#1d1d1d">
          {l}
        </text>
      ))}
    </g>
  );
}

function Subtitle({ who, text, size: { w, h } }: { who: string; text: string; size: Size }) {
  const lines = wrap(text, Math.floor(w / 33)).slice(-2);
  // On a phone the app's own caption and buttons cover the bottom quarter.
  const bottom = w < h ? h * 0.26 : 40;
  return (
    <g fontFamily="'Nunito', 'Arial', sans-serif" fontWeight={900} fontSize={40} textAnchor="middle">
      {lines.map((l, i) => (
        <text key={i} x={w / 2} y={h - bottom - (lines.length - 1 - i) * 50} fill="#fff" stroke="#111" strokeWidth={8} strokeLinejoin="round" paintOrder="stroke">
          {i === 0 && who ? `${who}: ` : ''}
          {l}
        </text>
      ))}
    </g>
  );
}

function TitleCard({ title, t, size: { w, h } }: { title: string; t: number; size: Size }) {
  // The card slaps onto the screen: it starts a bit small, overshoots, settles. It's never off screen.
  const k = Math.min(1, t / 0.35);
  const scale = k < 1 ? 0.82 + 0.26 * k : 1 + 0.08 * Math.max(0, 1 - (t - 0.35) / 0.25) * Math.cos((t - 0.35) * 12);
  const cardW = Math.min(1080, w - 80);
  const lines = wrap(title, Math.floor(cardW / 60)).slice(0, 3);
  const [cx, cy] = [w / 2, h * 0.478];
  return (
    <g>
      <rect width={w} height={h} fill="#92d6e6" />
      {/* The hills are drawn for 1600 × 900 and sit along the bottom of whatever shape the frame is. */}
      <svg width={w} height={h} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} preserveAspectRatio="xMidYMax meet">
        <path d="M 0 700 Q 300 640 620 690 T 1200 680 T 1600 650 L 1600 900 L 0 900 Z" fill="#f9f9f9" />
        <path d="M 0 610 L 260 330 L 520 610 Z M 420 640 L 760 250 L 1100 640 Z M 980 650 L 1290 300 L 1600 650 Z" fill="#316647" opacity={0.95} />
      </svg>
      <g transform={`translate(${cx} ${cy}) scale(${scale.toFixed(3)}) rotate(-3) translate(${-cx} ${-cy})`}>
        <rect x={cx - cardW / 2} y={cy - 180} width={cardW} height={lines.length * 110 + 110} rx={18} fill="#fffaf0" stroke="#1d1d1d" strokeWidth={6} />
        <text x={cx} y={cy - 120} textAnchor="middle" fontFamily={DISPLAY} fontSize={34} fill="#d33b2c" letterSpacing={4}>
          PAPER TOWN STUDIOS PRESENTS
        </text>
        {lines.map((l, i) => (
          <text key={i} x={cx} y={cy - 20 + i * 110} textAnchor="middle" fontFamily={DISPLAY} fontSize={96} fill="#1d1d1d">
            {l}
          </text>
        ))}
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------- the frame */

export interface FrameSvgProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  frame: Frame | null;
  subtitles?: boolean;
  /** Wraps each actor, for editing handles. */
  renderActor?: (a: ActorFrame, node: ReactNode) => ReactNode;
  /** Extra content in scene space, drawn over the set (editing overlays). */
  sceneOverlay?: ReactNode;
  /** Ignore the camera and show the whole set (editing). */
  freeCamera?: boolean;
  /** The current picture of the video on the scene's TV, as a data URL (see render/screenVideo.ts). */
  screenImage?: string;
  /** A 9:16 frame for phones instead of 16:9. */
  vertical?: boolean;
  svgRef?: Ref<SVGSVGElement>;
}

export function FrameSvg({ frame, subtitles = false, renderActor, sceneOverlay, freeCamera, screenImage, vertical, svgRef, ...rest }: FrameSvgProps) {
  const size = vertical ? { w: VFRAME_W, h: VFRAME_H } : { w: FRAME_W, h: FRAME_H };
  if (!frame) {
    return (
      <svg ref={svgRef} viewBox={`0 0 ${size.w} ${size.h}`} {...rest}>
        <rect width={size.w} height={size.h} fill="#1d1d1d" />
      </svg>
    );
  }
  if (frame.kind === 'title') {
    return (
      <svg ref={svgRef} viewBox={`0 0 ${size.w} ${size.h}`} {...rest}>
        <TitleCard title={frame.title} t={frame.t} size={size} />
        {frame.fade > 0 && <rect width={size.w} height={size.h} fill="#000" opacity={frame.fade} />}
      </svg>
    );
  }
  return <SceneSvg frame={frame} subtitles={subtitles} renderActor={renderActor} sceneOverlay={sceneOverlay} freeCamera={freeCamera} screenImage={screenImage} vertical={vertical} svgRef={svgRef} {...rest} />;
}

const viewBoxOf = (cam: Camera) => `${cam.x.toFixed(2)} ${cam.y.toFixed(2)} ${cam.w.toFixed(2)} ${cam.h.toFixed(2)}`;

/** What shows through a hole knocked in the back wall of a room. */
const OUTSIDE: Record<TimeOfDay, string> = { day: '#bfe3ee', dusk: DUSK_SKY, night: NIGHT_SKY };
const throughTheWall = (set: SetSpec) => (set.kind === 'kit' && set.place === 'exterior' ? '#26262c' : OUTSIDE[set.time ?? 'day']);

const TILE_COLORS = ['#3a5a8c', '#7a4f8a', '#2f7a6b', '#8a5a3a', '#4f6f46', '#8a3f4f'];

/** The video on the TV, then everyone on the TV or the video call, each cut off at the edges of their own tile. */
function ScreenLayer({ frame, draw, image }: { frame: SceneFrame; draw: (a: ActorFrame) => ReactNode; image?: string }) {
  const prefix = `tile${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const live = frame.actors.filter((a) => a.tile);
  if (!live.length && !image) return null;
  const s = frame.scene.screen;
  return (
    <g>
      {s.panel && <rect x={s.x - 16} y={s.y - 16} width={s.w + 32} height={s.h + 32} rx={12} fill="#26262c" />}
      {image && <image href={image} x={s.x} y={s.y} width={s.w} height={s.h} preserveAspectRatio="xMidYMid slice" />}
      {live.map((a) => {
        const { x, y, w, h } = a.tile!;
        const id = `${prefix}-${a.castId}`;
        return (
          <g key={a.castId}>
            <clipPath id={id}>
              <rect x={x} y={y} width={w} height={h} />
            </clipPath>
            <rect x={x} y={y} width={w} height={h} fill={TILE_COLORS[[...a.castId].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TILE_COLORS.length]} stroke="#111" strokeWidth={2} />
            <g clipPath={`url(#${id})`}>{draw(a)}</g>
          </g>
        );
      })}
    </g>
  );
}

/** Everything that stands in the set, in scene coordinates. `half` draws one side of a split screen. */
function SceneContent({ frame, half, renderActor, sceneOverlay, screenImage }: Pick<FrameSvgProps, 'renderActor' | 'sceneOverlay' | 'screenImage'> & { frame: SceneFrame; half?: 'left' | 'right' }) {
  const right = half === 'right';
  const set = (right && frame.split?.set) || frame.scene.scene.set;
  const actors = half ? frame.actors.filter((a) => !!a.right === right) : frame.actors;
  const here = <T,>(list: T[]) => (right ? [] : list);
  // A prop or a burst belongs in the half of whoever it's on. Crowds, vehicles and TVs are part of the scene's own set.
  const mine = <T extends { right?: boolean }>(list: T[]) => (half ? list.filter((x) => !!x.right === right) : list);
  const actor = (a: ActorFrame) => {
    const node = <Actor key={a.castId} a={a} />;
    return renderActor ? <g key={a.castId}>{renderActor(a, node)}</g> : node;
  };
  // People and vehicles back to front; passengers are drawn inside their vehicle.
  const items: { y: number; node: ReactNode }[] = [
    ...here(frame.crowd).map((a) => ({ y: a.y, node: <Actor key={a.castId} a={a} /> })),
    ...actors
      .filter((a) => !a.riding && !a.tile)
      .map((a) => ({
        y: a.y,
        node: a.cover ? (
          <g key={a.castId}>
            {actor(a)}
            <SeatCover set={set} seat={a.cover} />
          </g>
        ) : (
          actor(a)
        ),
      })),
    ...here(frame.vehicles).map((v) => ({ y: v.y, node: <VehicleShape key={`v-${v.id}`} v={v} passengers={actors.filter((a) => a.riding === v.id).map(actor)} /> })),
  ];
  items.sort((a, b) => a.y - b.y);
  return (
    <>
      <SetLayer set={set} layer="back" />
      {here(frame.holes).map((h) => (
        <WallHole key={h.t} x={h.x} y={h.y} r={h.r} behind={throughTheWall(set)} seed={Math.round(h.t * 100) + 1} />
      ))}
      {!right && <ScreenLayer frame={frame} draw={actor} image={screenImage} />}
      {items.map((i) => i.node)}
      {mine(frame.props).map((p) => (
        <FlyingProp key={p.key} p={p} />
      ))}
      {mine(frame.bursts).map((b) => (
        <BurstShape key={b.key} b={b} />
      ))}
      <SetLayer set={set} layer="front" />
      <WeatherLayer weather={right ? frame.split!.weather : frame.weather} level={right ? 1 : frame.weatherLevel} t={frame.scene.start + frame.t} />
      {sceneOverlay}
    </>
  );
}

function Overlays({ frame, subtitles, freeCamera, size }: Pick<FrameSvgProps, 'subtitles' | 'freeCamera'> & { frame: SceneFrame; size: Size }) {
  return (
    <>
      {frame.caption && <Caption text={frame.caption} size={size} />}
      {subtitles && frame.subtitle && <Subtitle who={frame.subtitle.who} text={frame.subtitle.text} size={size} />}
      {frame.flash > 0 && <rect width={size.w} height={size.h} fill="#fff" opacity={frame.flash} />}
      {frame.fade > 0 && !freeCamera && <rect width={size.w} height={size.h} fill="#000" opacity={frame.fade} />}
    </>
  );
}

/** A phone call: two sets side by side (one above the other when vertical), in the frame's own coordinates. */
function SplitSvg({ frame, split, subtitles, renderActor, screenImage, vertical, svgRef, ...rest }: FrameSvgProps & { frame: SceneFrame; split: NonNullable<SceneFrame['split']> }) {
  const size = vertical ? { w: VFRAME_W, h: VFRAME_H } : { w: FRAME_W, h: FRAME_H };
  const panel = (half: 'left' | 'right', cam: Camera) => {
    const at = half === 'left' ? 0 : (vertical ? size.h : size.w) - PANEL_W;
    const box = vertical ? { y: at, width: size.w, height: PANEL_W } : { x: at, width: PANEL_W, height: size.h };
    return (
      <svg {...box} viewBox={viewBoxOf(cam)} preserveAspectRatio="xMidYMid slice">
        <SceneContent frame={frame} half={half} renderActor={renderActor} screenImage={screenImage} />
      </svg>
    );
  };
  return (
    <svg ref={svgRef} viewBox={`0 0 ${size.w} ${size.h}`} {...rest}>
      <rect width={size.w} height={size.h} fill="#111" />
      {panel('left', split.left)}
      {panel('right', split.right)}
      <g pointerEvents="none">
        <Overlays frame={frame} subtitles={subtitles} size={size} />
      </g>
    </svg>
  );
}

function SceneSvg({ frame, subtitles, renderActor, sceneOverlay, freeCamera, screenImage, vertical, svgRef, ...rest }: FrameSvgProps & { frame: SceneFrame }) {
  if (frame.split && !freeCamera) return <SplitSvg frame={frame} split={frame.split} subtitles={subtitles} renderActor={renderActor} screenImage={screenImage} vertical={vertical} svgRef={svgRef} {...rest} />;
  const tall = vertical && !freeCamera;
  const size = tall ? { w: VFRAME_W, h: VFRAME_H } : { w: FRAME_W, h: FRAME_H };
  const cam = freeCamera ? { x: 0, y: 100, w: FRAME_W, h: FRAME_H } : tall ? verticalCamera(frame) : frame.camera;
  const k = cam.w / size.w;
  // The set editor shows the whole stage, so it leaves out what's only there for the transition.
  const under = freeCamera ? undefined : frame.under;
  return (
    <svg ref={svgRef} viewBox={viewBoxOf(cam)} preserveAspectRatio="xMidYMid slice" {...rest}>
      <SceneContent frame={frame} renderActor={renderActor} sceneOverlay={sceneOverlay} screenImage={screenImage} />
      <g transform={`translate(${cam.x} ${cam.y}) scale(${k})`} pointerEvents="none">
        {under && (
          <g opacity={under.opacity}>
            <svg width={size.w} height={size.h} viewBox={viewBoxOf(tall ? verticalCamera(under.frame) : under.frame.camera)} preserveAspectRatio="xMidYMid slice">
              <SceneContent frame={under.frame} />
            </svg>
          </g>
        )}
        <Overlays frame={frame} subtitles={subtitles} freeCamera={freeCamera} size={size} />
      </g>
    </svg>
  );
}
