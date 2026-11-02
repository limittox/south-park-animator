import { memo, useId, type ReactNode, type Ref, type SVGProps } from 'react';
import type { SetSpec, Weather } from '../episode/types';
import { FRAME_H, FRAME_W, type ActorFrame, type Frame, type SceneFrame, type VehicleFrame } from '../episode/timeline';
import { CharacterGroup } from '../character/Character';
import { getScene } from '../scenes/backgrounds';
import { renderKitSet } from '../sets/kit';
import { getVehicleDef, wheel } from '../sets/vehicles';
import { renderSeatCover } from '../episode/seats';
import { seeded } from '../character/parts/common';

export const DISPLAY = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
const STUDIO_COLOR = '#5aaeea';

/** Background and foreground of a set. Memoized on the set object, which only changes when edited. */
export const SetLayer = memo(function SetLayer({ set, layer }: { set: SetSpec; layer: 'back' | 'front' }) {
  if (set.kind === 'kit') {
    const r = renderKitSet(set);
    return <>{layer === 'back' ? r.back : r.front}</>;
  }
  const scene = getScene(set.preset);
  const opts = { townName: set.townName ?? 'Snowpine Hollow', studioColor: STUDIO_COLOR };
  if (layer === 'front') return scene.front ? <g className="sp-scene">{scene.front(opts)}</g> : null;
  return <g className="sp-scene">{scene.render(opts)}</g>;
});

export function actorTransform(a: ActorFrame): string {
  const sx = (a.flip ? -1 : 1) * a.scale * a.squash;
  const y = a.y - a.lift * a.scale;
  return `translate(${a.x.toFixed(1)} ${y.toFixed(1)})${a.rotate ? ` rotate(${a.rotate.toFixed(1)})` : ''} scale(${sx.toFixed(4)} ${a.scale.toFixed(4)}) translate(-200 -480)`;
}

export const Actor = memo(function Actor({ a }: { a: ActorFrame }) {
  return (
    <g transform={actorTransform(a)}>
      <CharacterGroup c={a.c} talk={a.talk} turn={a.turn} arms={a.arms} blink={a.blink} hipY={a.hipY} />
    </g>
  );
});

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

export function WeatherLayer({ weather, t }: { weather: Weather; t: number }) {
  if (weather === 'none') return null;
  const colors = ['#d33b2c', '#f2c230', '#3b6fd8', '#7fbf3f', '#e86fb0', '#2ec4c4'];
  const count = weather === 'snow' ? 110 : weather === 'rain' ? 120 : 60;
  return (
    <g pointerEvents="none">
      {FLAKES.slice(0, count).map((f, i) => {
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

/* ---------------------------------------------------------------- overlays (frame space, 1600 × 900) */

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

function Caption({ text }: { text: string }) {
  const lines = wrap(text, 26).slice(0, 3);
  const h = lines.length * 70 + 50;
  return (
    <g transform="rotate(-2 800 450)">
      <rect x={300} y={450 - h / 2} width={1000} height={h} rx={10} fill="#fffaf0" stroke="#1d1d1d" strokeWidth={5} />
      {lines.map((l, i) => (
        <text key={i} x={800} y={450 - h / 2 + 82 + i * 70} textAnchor="middle" fontFamily={DISPLAY} fontSize={60} fill="#1d1d1d">
          {l}
        </text>
      ))}
    </g>
  );
}

function Subtitle({ who, text }: { who: string; text: string }) {
  const lines = wrap(text, 48).slice(-2);
  return (
    <g fontFamily="'Nunito', 'Arial', sans-serif" fontWeight={900} fontSize={40} textAnchor="middle">
      {lines.map((l, i) => (
        <text key={i} x={800} y={900 - 40 - (lines.length - 1 - i) * 50} fill="#fff" stroke="#111" strokeWidth={8} strokeLinejoin="round" paintOrder="stroke">
          {i === 0 && who ? `${who}: ` : ''}
          {l}
        </text>
      ))}
    </g>
  );
}

function TitleCard({ title, t }: { title: string; t: number }) {
  // The card slaps onto the screen: it starts a bit small, overshoots, settles. It's never off screen.
  const k = Math.min(1, t / 0.35);
  const scale = k < 1 ? 0.82 + 0.26 * k : 1 + 0.08 * Math.max(0, 1 - (t - 0.35) / 0.25) * Math.cos((t - 0.35) * 12);
  const lines = wrap(title, 18).slice(0, 3);
  return (
    <g>
      <rect width={FRAME_W} height={FRAME_H} fill="#92d6e6" />
      <path d="M 0 700 Q 300 640 620 690 T 1200 680 T 1600 650 L 1600 900 L 0 900 Z" fill="#f9f9f9" />
      <path d="M 0 610 L 260 330 L 520 610 Z M 420 640 L 760 250 L 1100 640 Z M 980 650 L 1290 300 L 1600 650 Z" fill="#316647" opacity={0.95} />
      <g transform={`translate(800 430) scale(${scale.toFixed(3)}) rotate(-3) translate(-800 -430)`}>
        <rect x={260} y={250} width={1080} height={lines.length * 110 + 110} rx={18} fill="#fffaf0" stroke="#1d1d1d" strokeWidth={6} />
        <text x={800} y={310} textAnchor="middle" fontFamily={DISPLAY} fontSize={34} fill="#d33b2c" letterSpacing={4}>
          PAPER TOWN STUDIOS PRESENTS
        </text>
        {lines.map((l, i) => (
          <text key={i} x={800} y={410 + i * 110} textAnchor="middle" fontFamily={DISPLAY} fontSize={96} fill="#1d1d1d">
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
  svgRef?: Ref<SVGSVGElement>;
}

export function FrameSvg({ frame, subtitles = false, renderActor, sceneOverlay, freeCamera, svgRef, ...rest }: FrameSvgProps) {
  if (!frame) {
    return (
      <svg ref={svgRef} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} {...rest}>
        <rect width={FRAME_W} height={FRAME_H} fill="#1d1d1d" />
      </svg>
    );
  }
  if (frame.kind === 'title') {
    return (
      <svg ref={svgRef} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} {...rest}>
        <TitleCard title={frame.title} t={frame.t} />
      </svg>
    );
  }
  return <SceneSvg frame={frame} subtitles={subtitles} renderActor={renderActor} sceneOverlay={sceneOverlay} freeCamera={freeCamera} svgRef={svgRef} {...rest} />;
}

function SceneSvg({ frame, subtitles, renderActor, sceneOverlay, freeCamera, svgRef, ...rest }: FrameSvgProps & { frame: SceneFrame }) {
  const cam = freeCamera ? { x: 0, y: 100, w: FRAME_W, h: FRAME_H } : frame.camera;
  const set = frame.scene.scene.set;
  const k = cam.w / FRAME_W;
  const actor = (a: ActorFrame) => {
    const node = <Actor key={a.castId} a={a} />;
    return renderActor ? <g key={a.castId}>{renderActor(a, node)}</g> : node;
  };
  // People and vehicles back to front; passengers are drawn inside their vehicle.
  const items: { y: number; node: ReactNode }[] = [
    ...frame.actors
      .filter((a) => !a.riding)
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
    ...frame.vehicles.map((v) => ({ y: v.y, node: <VehicleShape key={`v-${v.id}`} v={v} passengers={frame.actors.filter((a) => a.riding === v.id).map(actor)} /> })),
  ];
  items.sort((a, b) => a.y - b.y);
  return (
    <svg ref={svgRef} viewBox={`${cam.x.toFixed(2)} ${cam.y.toFixed(2)} ${cam.w.toFixed(2)} ${cam.h.toFixed(2)}`} preserveAspectRatio="xMidYMid slice" {...rest}>
      <SetLayer set={set} layer="back" />
      {items.map((i) => i.node)}
      <SetLayer set={set} layer="front" />
      <WeatherLayer weather={frame.weather} t={frame.scene.start + frame.t} />
      {sceneOverlay}
      <g transform={`translate(${cam.x} ${cam.y}) scale(${k})`} pointerEvents="none">
        {frame.caption && <Caption text={frame.caption} />}
        {subtitles && frame.subtitle && <Subtitle who={frame.subtitle.who} text={frame.subtitle.text} />}
        {frame.flash > 0 && <rect width={FRAME_W} height={FRAME_H} fill="#fff" opacity={frame.flash} />}
      </g>
    </svg>
  );
}
