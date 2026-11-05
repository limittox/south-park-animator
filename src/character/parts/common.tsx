import { createContext, useContext, type SVGProps } from 'react';
import { shade } from '../../lib/color';

/** Outline ink + stroke width shared by every construction-paper shape. */
export const O = '#1d1d1d';
export const SW = 3;

export const ink = { stroke: O, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Ink for an outline-only re-stroke; the flat show style hides it. */
export const edge = { ...ink, fill: 'none', className: 'ol' };

/**
 * For white and pale things. The flat style strips ink, which is fine until a white shape stands
 * in front of snow; a soft edge in a darker shade of its own colour keeps it readable.
 */
export const pale = (color: string) => ({ fill: color, stroke: shade(color, -0.2), strokeWidth: 2.5, strokeLinejoin: 'round' as const });

/** Bumpy cloud/afro/beard outline around an ellipse. */
export function scallop(cx: number, cy: number, rx: number, ry: number, bumps: number, depth = 0.12, rot = 0): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / bumps;
  for (let i = 0; i <= bumps; i++) {
    const a = rot + i * step;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) {
      pts.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
      continue;
    }
    const m = a - step / 2;
    const qx = cx + Math.cos(m) * rx * (1 + depth * 2);
    const qy = cy + Math.sin(m) * ry * (1 + depth * 2);
    pts.push(`Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ') + ' Z';
}

/** Scalloped open edge from p0 to p1 (bumps bulge to the left of the direction of travel). */
export function scallopEdge(x0: number, y0: number, x1: number, y1: number, bumps: number, depth: number): string {
  const out: string[] = [];
  const dx = (x1 - x0) / bumps;
  const dy = (y1 - y0) / bumps;
  const len = Math.hypot(dx, dy);
  const nx = (dy / len) * depth;
  const ny = (-dx / len) * depth;
  for (let i = 1; i <= bumps; i++) {
    const mx = x0 + dx * (i - 0.5) + nx;
    const my = y0 + dy * (i - 0.5) + ny;
    out.push(`Q ${mx.toFixed(1)} ${my.toFixed(1)} ${(x0 + dx * i).toFixed(1)} ${(y0 + dy * i).toFixed(1)}`);
  }
  return out.join(' ');
}

/**
 * Scalloped arc along an ellipse from angle a0 to a1 (radians, SVG orientation), as Q segments only:
 * the caller must already be positioned at the a0 point.
 */
export function scallopArc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, bumps: number, depth = 0.1): string {
  const out: string[] = [];
  const step = (a1 - a0) / bumps;
  for (let i = 1; i <= bumps; i++) {
    const a = a0 + i * step;
    const m = a - step / 2;
    out.push(
      `Q ${(cx + Math.cos(m) * rx * (1 + depth * 2)).toFixed(1)} ${(cy + Math.sin(m) * ry * (1 + depth * 2)).toFixed(1)} ${(cx + Math.cos(a) * rx).toFixed(1)} ${(cy + Math.sin(a) * ry).toFixed(1)}`,
    );
  }
  return out.join(' ');
}

export function starPath(cx: number, cy: number, r: number, inner = 0.45, n = 5, rot = -Math.PI / 2): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

export function heartPath(cx: number, cy: number, s: number): string {
  return `M ${cx} ${cy + s * 0.9} C ${cx - s * 1.4} ${cy} ${cx - s * 0.9} ${cy - s * 1.1} ${cx} ${cy - s * 0.35} C ${cx + s * 0.9} ${cy - s * 1.1} ${cx + s * 1.4} ${cy} ${cx} ${cy + s * 0.9} Z`;
}

/** Deterministic pseudo-random numbers so drawings don't jitter between renders. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Mirror a left-side drawing onto the right side (head coordinates are centred on x = 0). */
export function Mirror({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform="scale(-1 1)">{children}</g>
    </>
  );
}

/** A scatter of round dots in one path: stroke it with round caps. */
export const dots = (points: [number, number][]) => points.map(([x, y]) => `M ${x} ${y} h 0.01`).join(' ');

/** True while drawing a character who faces the other way, which mirrors everything on them. */
export const MirroredPart = createContext(false);

/** Centred lettering on a part: it turns itself back round on a mirrored character, so it never reads backwards. */
export function PartText({ x, ...rest }: Omit<SVGProps<SVGTextElement>, 'x' | 'textAnchor'> & { x: number; textAnchor?: 'middle' }) {
  const mirrored = useContext(MirroredPart);
  return <text x={x} textAnchor="middle" transform={mirrored ? `translate(${2 * x} 0) scale(-1 1)` : undefined} {...rest} />;
}
