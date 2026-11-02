import type { BodyGeo } from '../types';
import type { GestureId } from '../episode/types';
import { armGeo, handPos, type ArmGeo, type Pt } from './geometry';

/** One arm, resolved: the arm curve plus where the hand sits. `over` draws it in front of the head (hand on face). */
export interface ArmState extends ArmGeo {
  hand: Pt;
  over: boolean;
}

/** Index 0 is the viewer's left arm (side -1), index 1 the right (side 1). */
export type ArmsPose = [ArmState, ArmState];

export function restArm(g: BodyGeo, side: -1 | 1): ArmState {
  return { ...armGeo(g, side), hand: handPos(g, side), over: false };
}

export function restArms(g: BodyGeo): ArmsPose {
  return [restArm(g, -1), restArm(g, 1)];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPt = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const TAU = Math.PI * 2;

type Bend = 'out' | 'down';

/**
 * An arm reaching from the shoulder to a hand target. Cut-out arms are one bent strip:
 * the elbow is the curve's control point, pushed `bend` arm-lengths off the straight line.
 */
function reach(g: BodyGeo, side: -1 | 1, target: Pt, bend: number, dir: Bend, over = false): ArmState {
  const rest = armGeo(g, side);
  const s = rest.start;
  const len = dist(s, handPos(g, side));
  // Paper arms stretch a little, never a lot.
  let hand = target;
  const d = dist(s, hand);
  if (d > len * 1.25) hand = lerpPt(s, hand, (len * 1.25) / d);
  const vx = hand[0] - s[0];
  const vy = hand[1] - s[1];
  const vl = Math.hypot(vx, vy) || 1;
  // The arm strip ends a little short of the hand's centre, as at rest.
  const end: Pt = [hand[0] - (vx / vl) * 8, hand[1] - (vy / vl) * 8];
  const mid: Pt = [(s[0] + end[0]) / 2, (s[1] + end[1]) / 2];
  let nx = vy / vl;
  let ny = -vx / vl;
  const flipNormal = dir === 'out' ? Math.sign(nx) !== side && nx !== 0 : ny < 0;
  if (flipNormal) {
    nx = -nx;
    ny = -ny;
  }
  return { side, start: s, ctrl: [mid[0] + nx * bend * len, mid[1] + ny * bend * len], end, hand, over };
}

/** Hand position from an angle at the shoulder: 0° hangs straight down, 90° points out sideways, 180° straight up. */
function swing(g: BodyGeo, side: -1 | 1, deg: number, r: number): Pt {
  const s = armGeo(g, side).start;
  const len = dist(s, handPos(g, side));
  const a = (deg * Math.PI) / 180;
  let x = s[0] + side * Math.sin(a) * len * r;
  const y = s[1] + Math.cos(a) * len * r;
  // Kids' heads are wider than their reach: hands raised beside the head stay outside it.
  if (!g.isAdult && y < g.headCy + g.headRy * 0.7) {
    const edge = g.headCx + side * (g.headRx + g.handR + 6);
    if (side * (x - edge) < 0) x = edge;
  }
  return [x, y];
}

/**
 * Arm pose for a gesture at time `t` seconds after it started. `lead` is the side that does
 * one-armed gestures (waving, pointing), normally the side the character is facing.
 */
export function poseArms(g: BodyGeo, gesture: GestureId, lead: -1 | 1, t: number, talk = 0): ArmsPose {
  const arm = (side: -1 | 1): ArmState => {
    const isLead = side === lead;
    switch (gesture) {
      case 'wave':
        return isLead ? reach(g, side, swing(g, side, 140 + Math.sin(t * TAU * 2.4) * 16, 1), 0.15, 'down') : restArm(g, side);
      case 'point':
        return isLead ? reach(g, side, swing(g, side, 96, 1.12), 0.04, 'down') : restArm(g, side);
      case 'grab':
        return isLead ? reach(g, side, swing(g, side, 78, 1.15), 0.02, 'down') : restArm(g, side);
      case 'armsUp':
        return reach(g, side, swing(g, side, 158 + Math.sin(t * TAU * 6 + side) * 4, 1.05), 0.12, 'out');
      case 'flail': {
        const phase = side === 1 ? 0 : Math.PI;
        return reach(g, side, swing(g, side, 135 + Math.sin(t * TAU * 4.5 + phase) * 35, 1.05), 0.18, 'out');
      }
      case 'shrug':
        return reach(g, side, swing(g, side, 72, 0.82), 0.32, 'down');
      case 'fists':
        return reach(g, side, swing(g, side, 122 + Math.sin(t * TAU * 8 + side) * 5, 0.72), 0.42, 'down');
      // Hand-to-face gestures are drawn over the head, with the elbow kept out to the side so the arm reads as one gentle bend.
      case 'facepalm':
        return isLead ? reach(g, side, [g.headCx + side * g.headRx * 0.1, g.headCy + g.headRy * 0.14], 0.14, 'out', true) : restArm(g, side);
      case 'thinking':
        return isLead ? reach(g, side, [g.headCx + side * g.headRx * 0.3, g.headCy + g.headRy * 0.68], 0.12, 'out', true) : restArm(g, side);
      case 'hipHands':
        return reach(g, side, [g.cx + side * (g.hip + 4), g.torsoBottom - 26], 0.55, 'out');
      case 'explain': {
        if (!isLead) return restArm(g, side);
        const bob = Math.sin(t * TAU * 2.2) * 8 + talk * 10;
        return reach(g, side, swing(g, side, 62 + bob, 0.86), 0.26, 'down');
      }
      case 'cross': {
        // Folded across the chest; on kids that's below the chin, the only bit of chest the head doesn't cover.
        const y = g.isAdult ? g.torsoTop + (g.torsoBottom - g.torsoTop) * 0.38 : g.torsoBottom - 32;
        return reach(g, side, [g.cx - side * g.shoulder * 0.4, y + (side === 1 ? 4 : -4)], 0.32, 'down');
      }
      default:
        return restArm(g, side);
    }
  };
  return [arm(-1), arm(1)];
}

/** Running: both arms bent at the elbow, pumping in turn. */
export function runArms(g: BodyGeo, t: number): ArmsPose {
  const arm = (side: -1 | 1): ArmState => reach(g, side, swing(g, side, 48 + Math.sin(t * TAU * 3.4 + (side === 1 ? 0 : Math.PI)) * 30, 0.8), 0.36, 'down');
  return [arm(-1), arm(1)];
}

/** Handing something over: the prop hand (side 1) reaches out toward `toward`, across the body if need be. */
export function handOverArms(g: BodyGeo, toward: -1 | 1): ArmsPose {
  const s = armGeo(g, 1).start;
  const len = dist(s, handPos(g, 1));
  const target: Pt = [g.cx + toward * (g.shoulder + len * 0.75), g.shoulderY + len * 0.5];
  return [restArm(g, -1), reach(g, 1, target, toward === 1 ? 0.06 : 0.16, 'down')];
}

function lerpArm(a: ArmState, b: ArmState, k: number): ArmState {
  return {
    side: b.side,
    start: lerpPt(a.start, b.start, k),
    ctrl: lerpPt(a.ctrl, b.ctrl, k),
    end: lerpPt(a.end, b.end, k),
    hand: lerpPt(a.hand, b.hand, k),
    over: k < 0.5 ? a.over : b.over,
  };
}

export function lerpArms(a: ArmsPose, b: ArmsPose, k: number): ArmsPose {
  if (k >= 1) return b;
  if (k <= 0) return a;
  return [lerpArm(a[0], b[0], k), lerpArm(a[1], b[1], k)];
}

/** True when the arm sits where it does at rest (so the elbow crease line still fits). */
export function isRest(g: BodyGeo, a: ArmState): boolean {
  const r = handPos(g, a.side);
  return Math.abs(a.hand[0] - r[0]) < 1 && Math.abs(a.hand[1] - r[1]) < 1;
}
