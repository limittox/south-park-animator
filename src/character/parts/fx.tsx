import type { ReactNode } from 'react';
import type { BodyGeo } from '../../types';
import { GROUND_Y } from '../geometry';
import { Mirror } from './common';

/* Things that come out of a character. `step` counts 1, 2, 3, 4 and moves them along. */

const WATER = { fill: '#9fd8ff', stroke: '#3b8fd8', strokeWidth: 1.6 };

const drop = (x: number, y: number, s = 1) => <path d={`M ${x} ${y - 14 * s} Q ${x - 10 * s} ${y + 4 * s} ${x} ${y + 8 * s} Q ${x + 10 * s} ${y + 4 * s} ${x} ${y - 14 * s} Z`} {...WATER} />;

/** Streams down both cheeks with a drop running down them (head coordinates). */
export function tearsFx(step: number): ReactNode {
  return (
    <Mirror>
      <path d="M -41 26 Q -49 52 -46 88 L -36 88 Q -34 52 -41 26 Z" {...WATER} />
      {drop(-41, 40 + step * 14, 0.8)}
    </Mirror>
  );
}

/** Beads flying off the sides of the head (head coordinates). */
export function sweatFx(step: number): ReactNode {
  const bead = (k: number, s: number) => drop(-118 - (k % 4) * 14, -52 + (k % 4) * 22, s);
  return (
    <Mirror>
      {bead(step, 1.7)}
      {bead(step + 2, 1.15)}
    </Mirror>
  );
}

/** A green arc from the mouth to a growing puddle, on the side they're facing (character coordinates). */
export function vomitFx(g: BodyGeo, side: -1 | 1, step: number): ReactNode {
  const x0 = g.headCx + side * g.headRx * 0.3;
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
