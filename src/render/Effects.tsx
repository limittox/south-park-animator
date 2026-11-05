import type { ReactNode } from 'react';
import type { BurstFrame } from '../episode/timeline';
import { scallop, seeded, starPath } from '../character/parts/common';

/*
 * Smoke, fire and things going wrong, as paper shapes. Each is drawn around (0, 0) at the foot of
 * the effect, from its age in seconds. Time steps on the pose, so flames flicker like cut-outs.
 */

const flame = (x: number, w: number, h: number, lean: number, fill: string) => <path d={`M ${x - w} 0 Q ${x - w * 1.15} ${-h * 0.5} ${x + lean} ${-h} Q ${x + w * 1.15} ${-h * 0.5} ${x + w} 0 Z`} fill={fill} />;

function fire(step: number): ReactNode {
  const lean = (k: number) => [-14, 10, 18, -8][(step + k) % 4];
  const tall = (k: number) => [1, 0.86, 1.08, 0.92][(step + k) % 4];
  return (
    <g>
      {flame(-70, 62, 170 * tall(1), lean(0), '#d33b2c')}
      {flame(66, 64, 190 * tall(3), lean(2), '#d33b2c')}
      {flame(0, 86, 260 * tall(0), lean(1), '#e8641e')}
      {flame(-34, 46, 150 * tall(2), lean(3), '#f2a122')}
      {flame(38, 44, 170 * tall(1), lean(0), '#f2a122')}
      {flame(0, 34, 110 * tall(3), lean(2), '#f7dd5a')}
    </g>
  );
}

function smoke(age: number, seed: number): ReactNode {
  const rnd = seeded(seed);
  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => {
        const side = rnd() - 0.5;
        const k = (age * 0.45 + i / 6) % 1;
        return <path key={i} d={scallop(side * 90 * k * 2, -40 - k * 320, 34 + k * 56, 30 + k * 50, 7, 0.1)} fill={i % 2 ? '#8d8d94' : '#6f6f76'} opacity={0.85 * (1 - k * k)} />;
      })}
    </g>
  );
}

function explosion(age: number, seed: number): ReactNode {
  const k = Math.min(1, age / 0.34);
  const fading = Math.max(0, 1 - (age - 0.34) / 0.5);
  return (
    <g transform="translate(0 -110)">
      {age > 0.3 && <g transform="translate(0 110)">{smoke(age - 0.3, seed)}</g>}
      {fading > 0 && (
        <g opacity={fading}>
          <path d={starPath(0, 0, 80 + 210 * k, 0.62, 12)} fill="#d33b2c" />
          <path d={starPath(0, 0, 56 + 150 * k, 0.6, 10, 0.3)} fill="#f2a122" />
          <path d={starPath(0, 0, 30 + 90 * k, 0.58, 8, 0.6)} fill="#f7dd5a" />
        </g>
      )}
    </g>
  );
}

function poof(age: number, life: number): ReactNode {
  const r = 50 + 90 * Math.min(1, age / 0.3);
  return (
    <g transform="translate(0 -120)" opacity={1 - life * life}>
      <path d={scallop(0, 0, r, r * 0.8, 9, 0.14)} fill="#e9e9ee" />
      <path d={scallop(-r * 0.34, -r * 0.18, r * 0.42, r * 0.36, 7, 0.12)} fill="#ffffff" />
      <path d={scallop(r * 0.36, r * 0.12, r * 0.38, r * 0.3, 7, 0.12)} fill="#ffffff" />
    </g>
  );
}

const SHARDS = ['#a5713d', '#8a8378', '#c9bfae', '#6b4226', '#d7dbdd'];

function debris(age: number, seed: number): ReactNode {
  const rnd = seeded(seed);
  return (
    <g>
      {Array.from({ length: 16 }, (_, i) => {
        const vx = (rnd() - 0.5) * 900;
        const vy = -260 - rnd() * 620;
        const spin = (rnd() - 0.5) * 1400;
        const size = 14 + rnd() * 30;
        const y = Math.min(20, -80 + vy * age + 620 * age * age);
        return <rect key={i} x={-size / 2} y={-size / 3} width={size} height={(size * 2) / 3} fill={SHARDS[i % SHARDS.length]} transform={`translate(${(vx * age).toFixed(1)} ${y.toFixed(1)}) rotate(${(spin * age).toFixed(0)})`} />;
      })}
    </g>
  );
}

export function BurstShape({ b }: { b: BurstFrame }) {
  const art = b.kind === 'fire' ? fire(b.step) : b.kind === 'smoke' ? smoke(b.age, b.seed) : b.kind === 'explosion' ? explosion(b.age, b.seed) : b.kind === 'poof' ? poof(b.age, b.life) : debris(b.age, b.seed);
  return (
    <g pointerEvents="none" transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${b.size})`}>
      {art}
    </g>
  );
}

/** A ragged hole torn through the back of the set, showing what's behind it. */
export function WallHole({ x, y, r, behind, seed }: { x: number; y: number; r: number; behind: string; seed: number }) {
  const rnd = seeded(seed);
  const edge = (scale: number) =>
    Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      const d = scale * (i % 2 ? 0.74 + rnd() * 0.12 : 1 + rnd() * 0.16);
      return `${i ? 'L' : 'M'} ${(x + Math.cos(a) * r * d).toFixed(1)} ${(y + Math.sin(a) * r * 0.62 * d).toFixed(1)}`;
    }).join(' ') + ' Z';
  return (
    <g pointerEvents="none">
      <path d={edge(1.06)} fill="#e9dfc9" />
      <path d={edge(1)} fill={behind} />
    </g>
  );
}
