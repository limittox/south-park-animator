import type { ReactNode } from 'react';
import type { BodyGeo } from '../../types';
import { GROUND_Y } from '../geometry';

/* Things that come out of a character. `step` moves them along: tears loop every 4 steps, vomit counts 1, 2, 3, 4. */

const WATER = { fill: '#9fd8ff', stroke: '#3b8fd8', strokeWidth: 1.6 };

const drop = (x: number, y: number, s = 1) => <path d={`M ${x} ${y - 14 * s} Q ${x - 10 * s} ${y + 4 * s} ${x} ${y + 8 * s} Q ${x + 10 * s} ${y + 4 * s} ${x} ${y - 14 * s} Z`} {...WATER} />;

const loop = (step: number) => ((((step - 1) / 4) % 1) + 1) % 1;

/** One cheek's stream, from the eye to the jaw. A swell runs down it and lets go of a drop that falls and fades. `p` loops 0 to 1. */
function tear(p: number): ReactNode {
  const N = 24;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N;
    return { x: -41 - 9 * u * u, y: 36 + 54 * u, w: Math.min(1, 0.35 + u * 4) * (4 + 0.9 * Math.sin(2 * Math.PI * (u - p))) };
  });
  const edge = (side: -1 | 1) => pts.map((q) => `${(q.x + side * q.w).toFixed(1)} ${q.y.toFixed(1)}`);
  const end = pts[N];
  // The swell reaches the jaw when p is 0.75, and that's when the drop lets go.
  const k = ((p + 0.25) % 1) / 0.75;
  return (
    <>
      {k < 1 && <g opacity={1 - k ** 4}>{drop(end.x, end.y + 4 + 34 * k * k, 0.9)}</g>}
      <path d={`M ${edge(-1).join(' L ')} A ${end.w.toFixed(1)} ${end.w.toFixed(1)} 0 0 0 ${edge(1).reverse().join(' L ')} Z`} strokeLinejoin="round" {...WATER} />
    </>
  );
}

/** A stream of tears down each cheek, a beat apart (head coordinates). */
export function tearsFx(step: number): ReactNode {
  const p = loop(step);
  return (
    <>
      {tear(p)}
      <g transform="scale(-1 1)">{tear((p + 0.4) % 1)}</g>
    </>
  );
}

/** Water welling up in the bottom of each eye, with a ripple across it (eye coordinates, the standard eye pair). `id` names its clips. */
export function wellFx(step: number, id: string): ReactNode {
  const p = loop(step);
  return ([-1, 1] as const).map((side) => {
    const cx = side * 27;
    const top = [-30, -20, -10, 0, 10, 20, 30].map((dx) => `${cx + dx} ${(19 + 1.5 * Math.sin(2 * Math.PI * (p + dx / 30))).toFixed(1)}`);
    return (
      <g key={side}>
        <clipPath id={`${id}${side}`}>
          <ellipse cx={cx} cy={0} rx={28} ry={36} transform={`rotate(${-side * 14} ${cx} 0)`} />
        </clipPath>
        <path d={`M ${cx - 30} 40 L ${top.join(' L ')} L ${cx + 30} 40 Z`} clipPath={`url(#${id}${side})`} {...WATER} />
      </g>
    );
  });
}

/** A green arc from the mouth to a growing puddle, on the side they're facing (character coordinates). */
export function vomitFx(g: BodyGeo, side: -1 | 1, step: number, mouth = 0.3): ReactNode {
  const x0 = g.headCx + side * g.headRx * mouth;
  const y0 = g.headCy + g.headRy * (g.isAdult ? 0.55 : 0.75);
  const x1 = x0 + side * 110;
  const y1 = GROUND_Y - 4;
  const bend = x0 + side * (86 + (step % 2) * 14);
  const lump = (k: number, r: number) => {
    const u = 1 - k;
    return <circle cx={u * u * x0 + 2 * u * k * bend + k * k * x1} cy={u * u * y0 + 2 * u * k * y0 + k * k * y1} r={r} fill="#7f9a2b" />;
  };
  return (
    <g>
      <ellipse cx={x1} cy={y1} rx={30 + step * 12} ry={7 + step * 2} fill="#a9c23f" />
      <path d={`M ${x0} ${y0} Q ${bend} ${y0} ${x1} ${y1}`} fill="none" stroke="#a9c23f" strokeWidth={24} strokeLinecap="round" />
      {lump(((step * 0.23) % 0.8) + 0.1, 7)}
      {lump(((step * 0.23 + 0.45) % 0.8) + 0.1, 5)}
    </g>
  );
}
