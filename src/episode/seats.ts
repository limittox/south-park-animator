import type { ReactNode } from 'react';
import type { SetSpec } from './types';
import { getScene } from '../scenes/backgrounds';
import { getPieceDef, kitGroundY, pieceType, renderKitPiece, resolvePiece } from '../sets/kit';

/*
 * Places to sit: seating kit pieces (couch, chair, bench…) or the seats drawn into a preset
 * (the living-room couch, the campfire logs). People sit side by side along a seat's width.
 */

export interface SeatSpot {
  /** Kit piece id or preset seat id ("couch", "log-2"). */
  id: string;
  /** What it is, for "sit on the bench": the kit piece type, or the preset seat id without its number. */
  kind: string;
  /** Centre of the seat. */
  x: number;
  /** Sitters' feet go on this line. */
  y: number;
  /** Seat height above `y`. */
  h: number;
  w: number;
  /** Drawn again over the sitters (they sit behind it). */
  cover: boolean;
}

/** About one kid's head across: how far apart people sit. */
const SLOT_W = 200;
const NEAR_ENOUGH = 520;

export function seatsOf(set: SetSpec): SeatSpot[] {
  if (set.kind === 'preset') {
    return (getScene(set.preset).seats ?? []).map((s) => ({ id: s.id, kind: s.id.replace(/-\d+$/, ''), x: s.x, y: s.y, h: s.h, w: s.w, cover: !!s.cover }));
  }
  const out: SeatSpot[] = [];
  for (const piece of set.pieces) {
    const seat = getPieceDef(piece.type)?.seat;
    if (!seat) continue;
    const p = resolvePiece(set, piece);
    // A seat drawn in front of the cast (a desk out front) is sat behind on the cast's own line, and covers them anyway.
    out.push({ id: p.id, kind: p.type, x: p.x, y: p.front ? kitGroundY(set) : p.y, h: seat.h * p.scale, w: seat.w * p.scale, cover: !p.front && !!seat.cover });
  }
  return out;
}

const nearest = (spots: SeatSpot[], x: number) => spots.reduce<SeatSpot | null>((best, s) => (!best || Math.abs(s.x - x) < Math.abs(best.x - x) ? s : best), null);

/**
 * Which seat "sit on <ref>" means: an exact id, the nearest seat of that kind, or with no ref
 * the nearest seat. Null means the floor (asked for, or nothing to sit on nearby).
 */
export function findSeat(spots: SeatSpot[], ref: string | undefined, nearX: number): SeatSpot | null {
  if (!spots.length) return null;
  if (!ref?.trim()) return nearest(spots, nearX);
  const r = ref.trim().toLowerCase().replace(/^the\s+/, '');
  if (/^(floor|ground|carpet|rug|snow)$/.test(r)) return null;
  const exact = spots.find((s) => s.id.toLowerCase() === r);
  if (exact) return exact;
  const kind = pieceType(r) ?? r.replace(/[\s_]+/g, '-').replace(/e?s$/, '');
  const same = spots.filter((s) => s.kind === kind || s.kind === r);
  if (same.length) return nearest(same, nearX);
  const any = nearest(spots, nearX);
  return any && Math.abs(any.x - nearX) <= NEAR_ENOUGH ? any : null;
}

export interface ScreenSpot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Not part of the set: a big video screen put up for the occasion. */
  panel?: boolean;
}

const BIG_SCREEN: ScreenSpot = { x: 500, y: 170, w: 600, h: 340, panel: true };

/** Where people on a TV or a video call show up: the set's first TV or computer, or else a big screen on the back wall. */
export function screenOf(set: SetSpec): ScreenSpot {
  if (set.kind === 'preset') return getScene(set.preset).screen ?? BIG_SCREEN;
  for (const piece of set.pieces) {
    const s = getPieceDef(piece.type)?.screen;
    if (!s) continue;
    const p = resolvePiece(set, piece);
    return { x: p.x + s.x * p.scale, y: p.y + s.y * p.scale, w: s.w * p.scale, h: s.h * p.scale };
  }
  return BIG_SCREEN;
}

const OUTDOORS = new Set(['busstop', 'mainstreet', 'pond', 'townsign', 'campfire']);

/** Where someone walking away from the camera ends up: the nearest door, or the distance outdoors. Null in a room with no door. */
export function wayOut(set: SetSpec, x: number, groundY: number): { x: number; y: number; shrink: number; time: number } | null {
  if (set.kind === 'kit') {
    const doors = set.pieces.filter((p) => p.type === 'door').map((p) => resolvePiece(set, p));
    if (doors.length) {
      const door = doors.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
      return { x: door.x, y: door.y, shrink: 0.3, time: 1 };
    }
  }
  const outside = set.kind === 'kit' ? set.place === 'exterior' : OUTDOORS.has(set.preset);
  return outside ? { x, y: groundY - 210, shrink: 0.72, time: 2.4 } : null;
}

/** Squeezed up, people sit this close. */
const SQUEEZE_W = 170;

/** Centres of the places along a seat, left to right. With more sitters than it fits, they squeeze up (and past its ends). */
export function seatSlots(spot: SeatSpot, sitters = 0): number[] {
  const n = Math.max(1, Math.floor(spot.w / SLOT_W), sitters);
  const w = Math.max(spot.w, n * SQUEEZE_W);
  return Array.from({ length: n }, (_, i) => spot.x - w / 2 + ((i + 0.5) * w) / n);
}

/** The free place nearest x (or the nearest place at all when the seat is full). */
export function pickSlot(spot: SeatSpot, taken: ReadonlySet<number>, x: number, sitters = 0): number {
  const slots = seatSlots(spot, sitters);
  let best = -1;
  for (let i = 0; i < slots.length; i++) {
    if (taken.has(i)) continue;
    if (best < 0 || Math.abs(slots[i] - x) < Math.abs(slots[best] - x)) best = i;
  }
  if (best >= 0) return best;
  return slots.reduce((b, s, i) => (Math.abs(s - x) < Math.abs(slots[b] - x) ? i : b), 0);
}

/** The table or desk someone sits behind, drawn again over them. */
export function renderSeatCover(set: SetSpec, seatId: string): ReactNode {
  if (set.kind === 'kit') return renderKitPiece(set, seatId);
  return getScene(set.preset).seats?.find((s) => s.id === seatId)?.cover?.() ?? null;
}
