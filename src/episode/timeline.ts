import type { CharacterState } from '../types';
import type { ActionId, Beat, CastMember, Episode, GestureId, MoodId, Move, Scene, SetSpec, Shot, Vehicle, VehicleType, Weather } from './types';
import { getGeo, GROUND_Y, seatedGeo } from '../character/geometry';
import { handOverArms, lerpArms, poseArms, restArms, runArms, type ArmsPose } from '../character/pose';
import { MOODS } from '../character/parts/face';
import { HELD } from '../character/parts/held';
import { getScene, SCENE_H, SCENE_W } from '../scenes/backgrounds';
import { kitGroundY } from '../sets/kit';
import { getVehicleDef } from '../sets/vehicles';
import { seeded } from '../character/parts/common';
import { findSeat, pickSlot, seatSlots, seatsOf, type SeatSpot } from './seats';

/*
 * The timeline turns an episode into time-stamped tracks, then samples them into frames.
 * Everything here is pure: the player and the video exporter call the same functions,
 * so what you see while editing is exactly what gets exported.
 */

/** Lip-sync envelopes are sampled this many times a second. */
export const ENV_FPS = 60;
/** The show runs at 24 frames a second and moves its characters and props every second frame. */
export const FPS = 24;
export const POSE_FPS = FPS / 2;
export const FRAME_W = 1600;
export const FRAME_H = 900;
const TITLE_SECONDS = 3.25;
const WALK_SPEED = 380; // scene units per second
/** Hops last a whole number of poses, so every step looks the same. */
const HOP_PERIOD = 5 / POSE_FPS;
const OFF_LEFT = -260;
const OFF_RIGHT = SCENE_W + 260;
const BASE_SCALE = 1.15;
const GESTURE_BLEND = 0.12;
const RUN_SPEED = 880;
const RUN_HOP = 3 / POSE_FPS;
/** Sitting down or getting up. */
const SIT_TIME = 0.22;
const DRIVE_SPEED = 760;
/** A hand-over: both reach out and the prop changes hands halfway through. */
const HANDOFF = 0.9;
/** Vehicles in the back lane park this far behind the front row; the front lane is this far in front of it. */
const LANE_BACK = 40;
const LANE_FRONT = 70;
/** Passengers are drawn smaller, a little further away, so their heads fit the windows. */
export const PASSENGER_SCALE = 0.62;
/** A pan from one shot to the next. */
const PAN_TIME = 1;
const FADE_TIME = 12 / FPS;
const DISSOLVE_TIME = 20 / FPS;
/** How far the pupils slide toward someone the head is already turned to. */
const GAZE_LOOK = 0.6;

/** A hair of slack keeps float error from losing a tick. */
const stepDown = (t: number, fps: number) => Math.floor(t * fps + 1e-6) / fps;
/** The frame showing at time t. */
export const frameTime = (t: number) => stepDown(t, FPS);
/** The pose showing at time t. */
export const poseTime = (t: number) => stepDown(t, POSE_FPS);
/** The first pose at or after t. Beats start on one, so lines, cuts and actions land the moment the picture changes. */
const nextPose = (t: number) => Math.ceil(t * POSE_FPS - 1e-6) / POSE_FPS;

/** Audio for one line: how long it runs and how loud it is over time (for the mouth). */
export interface LineClip {
  duration: number;
  /** Mouth openness 0..1 at ENV_FPS. */
  env: Float32Array;
}

export type ClipMap = ReadonlyMap<string, LineClip>;

export interface CompiledBeat {
  beat: Beat;
  index: number;
  /** Scene time the beat starts. */
  start: number;
  /** When its line / action is over. */
  end: number;
  /** When the next beat starts. */
  next: number;
}

interface MoveSeg {
  t0: number;
  t1: number;
  x0: number;
  x1: number;
  /** Feet line at the start and the end: walking back to a couch moves up the floor. */
  y0: number;
  y1: number;
  kind: Move['kind'];
  run: boolean;
}

/** Sitting from `t` on (hips `h` above the feet, maybe behind a table), or standing again (null). */
interface Posture {
  t: number;
  seat: { h: number; cover?: string } | null;
}

interface ActorTrack {
  castId: string;
  depth: number;
  flip: boolean;
  startX: number;
  startY: number;
  startVisible: boolean;
  /** Their own line on the floor, where they stand when they aren't sitting. */
  baseY: number;
  startSeat: Posture['seat'];
  moves: MoveSeg[];
  postures: Posture[];
  rides: { t0: number; t1: number; vehicle: string; slot: number }[];
  holds: { t: number; item: string; color: string }[];
  handoffs: { t0: number; t1: number; toward: string }[];
  moods: { t: number; mood: MoodId }[];
  gestures: { t0: number; t1: number; gesture: GestureId }[];
  actions: { t: number; action: ActionId }[];
  talks: { t0: number; t1: number; beatId: string; lookAt?: string }[];
  blinks: number[];
  /** Silent beats where only the eyes slide over to someone. */
  sideEyes: { t0: number; t1: number; at: string }[];
  /** Idle moments when the eyes wander off. */
  glances: { t0: number; t1: number; x: number; y: number }[];
}

interface VehicleTrack {
  vehicle: Vehicle;
  /** Ground line of its lane. */
  y: number;
  moves: MoveSeg[];
}

export interface CompiledScene {
  scene: Scene;
  index: number;
  /** Episode time the scene starts. */
  start: number;
  duration: number;
  groundY: number;
  beats: CompiledBeat[];
  tracks: ActorTrack[];
  vehicles: VehicleTrack[];
  shots: { t: number; shot: Shot; beat?: CompiledBeat }[];
}

export interface CompiledEpisode {
  episode: Episode;
  cast: Map<string, CastMember>;
  titleDuration: number;
  scenes: CompiledScene[];
  duration: number;
}

/* ---------------------------------------------------------------- helpers */

export function groundYOf(set: SetSpec): number {
  return set.kind === 'kit' ? kitGroundY(set) : getScene(set.preset).groundY;
}

/** Rough speaking time when there's no audio yet. */
export function estimateLineSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.9, 0.3 + words * 0.34 + (text.match(/[,.!?;:]/g)?.length ?? 0) * 0.08);
}

/** A stand-in mouth track: one flap per syllable-ish vowel group. */
export function syntheticEnvelope(text: string, duration: number): Float32Array {
  const n = Math.max(1, Math.round(duration * ENV_FPS));
  const env = new Float32Array(n);
  const syllables = Math.max(1, (text.match(/[aeiouy]+/gi) ?? []).length);
  const per = n / syllables;
  for (let i = 0; i < n; i++) {
    const p = (i % per) / per;
    env[i] = p < 0.55 ? Math.sin((p / 0.55) * Math.PI) : 0;
  }
  return env;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));

function beatLength(beat: Beat, clips: ClipMap, moveTime: number): number {
  if (beat.text?.trim()) return clips.get(beat.id)?.duration ?? estimateLineSeconds(beat.text);
  if (beat.duration !== undefined) return Math.max(0.1, beat.duration);
  let d = 0.8;
  if (beat.caption) d = Math.max(d, 2.2);
  if (beat.action === 'faint') d = Math.max(d, 1.1);
  if (beat.action) d = Math.max(d, 0.9);
  if (beat.give) d = Math.max(d, HANDOFF);
  if (beat.shot?.pan) d = Math.max(d, PAN_TIME);
  return Math.max(d, moveTime);
}

/** Where someone or something is at time t, from its moves. Vehicles ease in and out of their drives. */
function placeOn(moves: MoveSeg[], x: number, y: number, visible: boolean, t: number, smooth = false) {
  let dir = 0;
  for (const m of moves) {
    if (t < m.t0) break;
    if (t < m.t1) {
      let k = (t - m.t0) / (m.t1 - m.t0);
      if (smooth) k = ease(k);
      return { x: m.x0 + (m.x1 - m.x0) * k, y: m.y0 + (m.y1 - m.y0) * k, visible: true, moving: true, dir: Math.sign(m.x1 - m.x0) || dir || 1, moveT: t - m.t0, run: m.run };
    }
    x = m.x1;
    y = m.y1;
    visible = m.kind !== 'exit' && m.kind !== 'vanish';
    if (m.x1 !== m.x0) dir = Math.sign(m.x1 - m.x0);
  }
  return { x, y, visible, moving: false, dir, moveT: 0, run: false };
}

const vehicleAt = (vt: VehicleTrack, t: number) => placeOn(vt.moves, vt.vehicle.x, vt.y, !vt.vehicle.offstage, t, true);
/** +1 facing right, -1 facing left: the way it last drove, else how it was parked. */
const facingOf = (vt: VehicleTrack, t: number): 1 | -1 => {
  const d = vehicleAt(vt, t).dir;
  return d ? (d > 0 ? 1 : -1) : vt.vehicle.flip ? -1 : 1;
};

/** Colour of a prop picked up fresh: the look's own colour if it's their usual prop, else the prop's default. */
function propColor(look: CharacterState, item: string): string {
  if (look.held === item) return look.heldColor;
  return HELD.find((h) => h.id === item)?.defaultColor ?? look.heldColor;
}

function holdAt(tr: ActorTrack, look: CharacterState, t: number): { item: string; color: string } {
  let h = { item: look.held, color: look.heldColor };
  for (const x of tr.holds) if (x.t <= t) h = x;
  return h;
}

/* ---------------------------------------------------------------- compile */

export function compileScene(scene: Scene, index: number, start: number, cast: Map<string, CastMember>, clips: ClipMap): CompiledScene {
  const groundY = groundYOf(scene.set);
  const spots = seatsOf(scene.set);
  // How many people end up on each seat, so a crowded one squeezes them up instead of stacking them.
  const sitters = new Map<string, Set<string>>();
  const willSit = (who: string, spot: SeatSpot | null) => {
    if (!spot) return;
    if (!sitters.has(spot.id)) sitters.set(spot.id, new Set());
    sitters.get(spot.id)!.add(who);
  };
  const blockedX = (who: string) => scene.blocking.find((b) => b.who === who)?.x ?? SCENE_W / 2;
  for (const b of scene.blocking) if (b.sit) willSit(b.who, findSeat(spots, b.sit, b.x));
  for (const beat of scene.beats) for (const m of beat.moves ?? []) if (m.kind === 'sit') willSit(m.who, findSeat(spots, m.on, m.x ?? blockedX(m.who)));
  const crowd = (spot: SeatSpot) => sitters.get(spot.id)?.size ?? 0;

  // Everyone who is blocked, moves, speaks or is handed something gets a track. Unblocked speakers are spread across the stage.
  const tracks = new Map<string, ActorTrack>();
  const ensure = (id: string): ActorTrack | null => {
    const member = cast.get(id);
    if (!member) return null;
    let tr = tracks.get(id);
    if (!tr) {
      const b = scene.blocking.find((x) => x.who === id);
      const depth = clamp(b?.depth ?? 0, 0, 1);
      const baseY = groundY - depth * 90;
      tr = {
        castId: id,
        depth,
        flip: !!b?.flip,
        startX: b ? clamp(b.x, -400, SCENE_W + 400) : NaN,
        startY: baseY,
        startVisible: b ? !b.offstage : true,
        baseY,
        startSeat: null,
        moves: [],
        postures: [],
        rides: [],
        holds: b?.hold ? [{ t: 0, item: b.hold, color: propColor(member.look, b.hold) }] : [],
        handoffs: [],
        moods: [{ t: 0, mood: b?.mood ?? 'happy' }],
        gestures: [],
        actions: [],
        talks: [],
        blinks: [],
        sideEyes: [],
        glances: [],
      };
      tracks.set(id, tr);
    }
    return tr;
  };
  scene.blocking.forEach((b) => ensure(b.who));
  for (const beat of scene.beats) {
    if (beat.who) ensure(beat.who);
    if (beat.give) ensure(beat.give);
    beat.moves?.forEach((m) => ensure(m.who));
  }
  // Characters whose first appearance is an entrance start off stage.
  for (const tr of tracks.values()) {
    if (scene.blocking.some((b) => b.who === tr.castId)) continue;
    for (const beat of scene.beats) {
      const m = beat.moves?.find((mv) => mv.who === tr.castId);
      if (m && (m.kind === 'enter' || m.kind === 'appear')) {
        tr.startVisible = false;
        break;
      }
      if (beat.who === tr.castId || m) break;
    }
  }
  const unplaced = [...tracks.values()].filter((t) => Number.isNaN(t.startX));
  const used = [...tracks.values()].filter((t) => !Number.isNaN(t.startX)).map((t) => t.startX);
  unplaced.forEach((tr, i) => {
    const slots = [800, 520, 1080, 300, 1300, 660, 940];
    tr.startX = slots.find((x) => used.every((u) => Math.abs(u - x) > 180)) ?? slots[i % slots.length];
    used.push(tr.startX);
  });

  const vehicles = new Map<string, VehicleTrack>();
  for (const v of scene.vehicles ?? []) vehicles.set(v.id, { vehicle: v, y: v.lane === 'front' ? Math.min(990, groundY + LANE_FRONT) : groundY - LANE_BACK, moves: [] });

  // Who sits where and who rides in what, while laying out the beats.
  const seatTaken = new Map<string, Set<number>>();
  const takenOn = (id: string) => {
    let s = seatTaken.get(id);
    if (!s) seatTaken.set(id, (s = new Set()));
    return s;
  };
  const rideTaken = new Map<string, Set<number>>();
  const rideSlot = (vehicleId: string) => {
    let s = rideTaken.get(vehicleId);
    if (!s) rideTaken.set(vehicleId, (s = new Set()));
    let slot = 0;
    while (s.has(slot)) slot++;
    s.add(slot);
    return slot;
  };

  // Running state of each actor and vehicle.
  type Ride = ActorTrack['rides'][number];
  interface Pos {
    x: number;
    y: number;
    visible: boolean;
    busyUntil: number;
    seat: { spot: SeatSpot; slot: number } | 'floor' | null;
    riding: Ride | null;
  }
  const pos = new Map<string, Pos>();
  for (const tr of tracks.values()) {
    const p: Pos = { x: tr.startX, y: tr.startY, visible: tr.startVisible, busyUntil: 0, seat: null, riding: null };
    const b = scene.blocking.find((x) => x.who === tr.castId);
    if (b?.in && vehicles.has(b.in)) {
      const ride = { t0: -1, t1: Infinity, vehicle: b.in, slot: rideSlot(b.in) };
      tr.rides.push(ride);
      p.riding = ride;
    } else if (b?.sit) {
      const spot = findSeat(spots, b.sit, tr.startX);
      if (spot) {
        const slot = pickSlot(spot, takenOn(spot.id), tr.startX, crowd(spot));
        takenOn(spot.id).add(slot);
        tr.startX = p.x = seatSlots(spot, crowd(spot))[slot];
        tr.startY = p.y = spot.y;
        tr.startSeat = { h: spot.h, ...(spot.cover ? { cover: spot.id } : {}) };
        p.seat = { spot, slot };
      } else {
        tr.startSeat = { h: 0 };
        p.seat = 'floor';
      }
    }
    pos.set(tr.castId, p);
  }
  const vbusy = new Map<string, number>([...vehicles.keys()].map((id) => [id, 0]));
  const gotOut = new Map<string, number>();

  const drive = (vt: VehicleTrack, m: Move, t: number): number => {
    const t0 = Math.max(t, vbusy.get(vt.vehicle.id) ?? 0);
    const now = vehicleAt(vt, t0);
    const half = getVehicleDef(vt.vehicle.type).w / 2;
    const facing = facingOf(vt, t0);
    let x0 = now.x;
    let x1 = now.x;
    if (m.kind === 'enter') {
      x1 = clamp(m.x ?? now.x, 0, SCENE_W);
      // A car facing right comes in from the left.
      const side = m.side ?? (facing > 0 ? 'left' : 'right');
      x0 = side === 'left' ? -half - 80 : SCENE_W + half + 80;
    } else if (m.kind === 'exit') {
      const side = m.side ?? (facing > 0 ? 'right' : 'left');
      x1 = side === 'left' ? -half - 80 : SCENE_W + half + 80;
    } else if (m.kind === 'walk') {
      x1 = clamp(m.x ?? now.x, 0, SCENE_W);
    } else if (m.kind === 'appear') {
      x0 = x1 = clamp(m.x ?? now.x, 0, SCENE_W);
    } else if (m.kind !== 'vanish') {
      return t0;
    }
    const dur = m.kind === 'appear' || m.kind === 'vanish' ? 0 : Math.max(0.7, (Math.abs(x1 - x0) / DRIVE_SPEED) * 1.3);
    vt.moves.push({ t0, t1: t0 + dur, x0, x1, y0: vt.y, y1: vt.y, kind: m.kind, run: false });
    vbusy.set(vt.vehicle.id, t0 + dur);
    return t0 + dur;
  };

  const act = (tr: ActorTrack, p: Pos, m: Move, t: number): number => {
    let t0 = Math.max(t, p.busyUntil);
    const speed = m.run ? RUN_SPEED : WALK_SPEED;
    const walkTo = (x1: number, y1: number) => {
      const d = Math.hypot(x1 - p.x, y1 - p.y);
      if (d < 4) return;
      const dur = Math.max(0.35, d / speed);
      tr.moves.push({ t0, t1: t0 + dur, x0: p.x, x1, y0: p.y, y1, kind: 'walk', run: !!m.run });
      t0 += dur;
      p.x = x1;
      p.y = y1;
    };
    const getUp = (animate: boolean) => {
      if (!p.seat) return;
      tr.postures.push({ t: t0, seat: null });
      if (p.seat !== 'floor') seatTaken.get(p.seat.spot.id)?.delete(p.seat.slot);
      p.seat = null;
      if (animate) t0 += SIT_TIME;
    };
    const done = () => (p.busyUntil = t0);

    // While riding, the vehicle does the moving.
    if (p.riding && m.kind !== 'getOut') return t0;
    switch (m.kind) {
      case 'getOut': {
        const ride = p.riding;
        const vt = ride && vehicles.get(ride.vehicle);
        if (!ride || !vt) return t0;
        t0 = Math.max(t0, vbusy.get(vt.vehicle.id) ?? 0);
        ride.t1 = t0;
        rideTaken.get(vt.vehicle.id)?.delete(ride.slot);
        // People climbing out at the same moment spread out around the door.
        const key = `${vt.vehicle.id}@${t0}`;
        const n = gotOut.get(key) ?? 0;
        gotOut.set(key, n + 1);
        const facing = facingOf(vt, t0);
        const x = clamp(vehicleAt(vt, t0).x + facing * getVehicleDef(vt.vehicle.type).door + (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 170, 140, 1460);
        tr.moves.push({ t0, t1: t0, x0: x, x1: x, y0: tr.baseY, y1: tr.baseY, kind: 'appear', run: false });
        Object.assign(p, { x, y: tr.baseY, visible: true, riding: null });
        return done();
      }
      case 'getIn': {
        const visibleAt = (vt: VehicleTrack) => vehicleAt(vt, t0).visible;
        const vt = (m.on && vehicles.get(m.on)) || [...vehicles.values()].filter(visibleAt).sort((a, b) => Math.abs(vehicleAt(a, t0).x - p.x) - Math.abs(vehicleAt(b, t0).x - p.x))[0];
        if (!vt) return t0;
        // Wait for it to pull up, walk to the door, climb in; it waits for them before driving on.
        t0 = Math.max(t0, vbusy.get(vt.vehicle.id) ?? 0);
        getUp(true);
        walkTo(clamp(vehicleAt(vt, t0).x + facingOf(vt, t0) * getVehicleDef(vt.vehicle.type).door, 140, 1460), tr.baseY);
        const ride = { t0, t1: Infinity, vehicle: vt.vehicle.id, slot: rideSlot(vt.vehicle.id) };
        tr.rides.push(ride);
        p.riding = ride;
        vbusy.set(vt.vehicle.id, Math.max(vbusy.get(vt.vehicle.id) ?? 0, t0));
        return done();
      }
      case 'sit': {
        const spot = findSeat(spots, m.on, m.x ?? p.x);
        if (p.seat && (spot ? p.seat !== 'floor' && p.seat.spot.id === spot.id : p.seat === 'floor')) return t0;
        getUp(true);
        if (spot) {
          const slot = pickSlot(spot, takenOn(spot.id), m.x ?? p.x, crowd(spot));
          takenOn(spot.id).add(slot);
          walkTo(seatSlots(spot, crowd(spot))[slot], spot.y);
          tr.postures.push({ t: t0, seat: { h: spot.h, ...(spot.cover ? { cover: spot.id } : {}) } });
          p.seat = { spot, slot };
        } else {
          if (m.x !== undefined) walkTo(clamp(m.x, 140, 1460), p.y);
          tr.postures.push({ t: t0, seat: { h: 0 } });
          p.seat = 'floor';
        }
        t0 += SIT_TIME;
        return done();
      }
      case 'stand':
        getUp(true);
        return done();
      default: {
        // walk / enter / exit / appear / vanish. Anyone sitting gets up first.
        getUp(m.kind !== 'appear' && m.kind !== 'vanish');
        let x0 = p.x;
        let x1 = p.x;
        let y0 = p.y;
        let y1 = tr.baseY;
        if (m.kind === 'enter') {
          x1 = clamp(m.x ?? p.x, 140, 1460);
          const side = m.side ?? (x1 < SCENE_W / 2 ? 'left' : 'right');
          x0 = side === 'left' ? OFF_LEFT : OFF_RIGHT;
          y0 = y1;
        } else if (m.kind === 'exit') {
          const side = m.side ?? (p.x < SCENE_W / 2 ? 'left' : 'right');
          x1 = side === 'left' ? OFF_LEFT : OFF_RIGHT;
        } else if (m.kind === 'walk') {
          x1 = clamp(m.x ?? p.x, 140, 1460);
        } else if (m.kind === 'appear') {
          x0 = x1 = clamp(m.x ?? p.x, 140, 1460);
          y0 = y1;
        } else {
          y1 = y0;
        }
        const dur = m.kind === 'appear' || m.kind === 'vanish' ? 0 : Math.max(0.35, Math.hypot(x1 - x0, y1 - y0) / speed);
        tr.moves.push({ t0, t1: t0 + dur, x0, x1, y0, y1, kind: m.kind, run: !!m.run });
        Object.assign(p, { x: x1, y: y1, visible: m.kind !== 'exit' && m.kind !== 'vanish' });
        t0 += dur;
        return done();
      }
    }
  };

  const beats: CompiledBeat[] = [];
  const shots: CompiledScene['shots'] = [{ t: 0, shot: { type: 'wide' } }];
  let t = nextPose(Math.max(0, scene.hold));
  scene.beats.forEach((beat, i) => {
    let moveTime = 0;
    for (const m of beat.moves ?? []) {
      const vt = vehicles.get(m.who);
      const tr = tracks.get(m.who);
      const p = pos.get(m.who);
      const until = vt ? drive(vt, m, t) : tr && p ? act(tr, p, m, t) : t;
      moveTime = Math.max(moveTime, until - t);
    }
    const len = beatLength(beat, clips, moveTime);
    const end = t + len;
    const gap = beat.pauseAfter ?? (beat.text ? 0.24 : 0.12);
    const cb: CompiledBeat = { beat, index: i, start: t, end, next: nextPose(end + Math.max(0, gap)) };
    beats.push(cb);

    const who = beat.who ? tracks.get(beat.who) : undefined;
    const look = beat.who ? cast.get(beat.who)?.look : undefined;
    if (who && look) {
      if (beat.mood) who.moods.push({ t, mood: beat.mood });
      if (beat.gesture && beat.gesture !== 'none') who.gestures.push({ t0: t, t1: Math.max(end, t + 0.9), gesture: beat.gesture });
      if (beat.action) who.actions.push({ t, action: beat.action });
      if (beat.text?.trim()) who.talks.push({ t0: t, t1: end, beatId: beat.id, lookAt: beat.lookAt });
      else if (beat.lookAt) who.sideEyes.push({ t0: t, t1: cb.next, at: beat.lookAt });
      if (beat.hold) who.holds.push({ t, item: beat.hold, color: propColor(look, beat.hold) });
      const to = beat.give ? tracks.get(beat.give) : undefined;
      if (to && to !== who) {
        // Both reach out; the prop jumps from hand to hand halfway through.
        const prop = holdAt(who, look, t);
        who.handoffs.push({ t0: t, t1: t + HANDOFF, toward: to.castId });
        to.handoffs.push({ t0: t + 0.12, t1: t + HANDOFF, toward: who.castId });
        if (prop.item !== 'none') {
          who.holds.push({ t: t + HANDOFF / 2, item: 'none', color: prop.color });
          to.holds.push({ t: t + HANDOFF / 2, item: prop.item, color: prop.color });
        }
      }
    }
    for (const [id, mood] of Object.entries(beat.reactions ?? {})) tracks.get(id)?.moods.push({ t, mood });
    if (beat.shot) shots.push({ t, shot: beat.shot, beat: cb });
    t = cb.next;
  });
  const duration = nextPose(Math.max(t, ...[...vbusy.values()].map((b) => b + 0.3)) + 0.5);

  for (const tr of tracks.values()) {
    tr.holds.sort((a, b) => a.t - b.t);
    // Blinks and glances every few seconds, at times that stay put between renders.
    let h = 0;
    for (const ch of tr.castId + scene.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = seeded(h);
    for (let bt = 0.6 + rnd() * 2.4; bt < duration; bt += 2.2 + rnd() * 3.2) tr.blinks.push(bt);
    for (let gt = 1.2 + rnd() * 3; gt < duration; gt += 2.8 + rnd() * 4) {
      const t1 = gt + 0.5 + rnd() * 0.7;
      tr.glances.push({ t0: gt, t1, x: rnd() < 0.5 ? -1 : 1, y: (rnd() - 0.6) * 0.8 });
    }
  }

  return { scene, index, start, duration, groundY, beats, tracks: [...tracks.values()], vehicles: [...vehicles.values()], shots };
}

export function compileEpisode(episode: Episode, clips: ClipMap): CompiledEpisode {
  const cast = new Map(episode.cast.map((c) => [c.id, c]));
  const titleDuration = episode.titleCard ? TITLE_SECONDS : 0;
  let t = titleDuration;
  const scenes = episode.scenes.map((s, i) => {
    const cs = compileScene(s, i, t, cast, clips);
    t = nextPose(t + cs.duration);
    return cs;
  });
  return { episode, cast, titleDuration, scenes, duration: t };
}

/* ---------------------------------------------------------------- sampling */

export interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ActorFrame {
  castId: string;
  name: string;
  c: CharacterState;
  /** Feet position in scene coordinates. */
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  turn: number;
  talk: number;
  blink: boolean;
  /** Where the pupils point, -1..1 across and down. */
  gazeX: number;
  gazeY: number;
  arms: ArmsPose | undefined;
  /** Extra transform for jumps, spins and faints, in character coordinates. */
  lift: number;
  rotate: number;
  squash: number;
  jitter: number;
  depth: number;
  /** Sitting: where the hips are, in character coordinates. */
  hipY?: number;
  /** Seat id of the table or desk they sit behind, drawn again over them. */
  cover?: string;
  /** Riding in this vehicle: drawn inside it, through the windows. */
  riding?: string;
}

export interface VehicleFrame {
  id: string;
  type: VehicleType;
  color: string;
  /** Centre of the vehicle on its lane's ground line. */
  x: number;
  y: number;
  flip: boolean;
  /** Judder while driving (scene units, up is negative). */
  bounce: number;
  /** Wheel turn, in degrees. */
  spin: number;
  /** Police lights on. */
  lights: boolean;
}

export interface SceneFrame {
  kind: 'scene';
  scene: CompiledScene;
  /** Time inside the scene. */
  t: number;
  camera: Camera;
  /** Everyone on stage, passengers included (they carry `riding`). */
  actors: ActorFrame[];
  vehicles: VehicleFrame[];
  beat: CompiledBeat | null;
  caption: string | null;
  subtitle: { who: string; text: string } | null;
  flash: number;
  /** Black over the picture, 0..1. */
  fade: number;
  /** The scene this one is dissolving out of, drawn on top of it. */
  under?: { frame: SceneFrame; opacity: number };
  weather: Weather;
}

export interface TitleFrame {
  kind: 'title';
  title: string;
  t: number;
  fade: number;
}

export type Frame = SceneFrame | TitleFrame;

const moodCache = new WeakMap<CharacterState, Map<MoodId, CharacterState>>();

/** The character's own face is their "content" look; other moods swap eyes, brows and mouth. */
export function withMood(c: CharacterState, mood: MoodId): CharacterState {
  if (mood === 'happy') return c;
  let m = moodCache.get(c);
  if (!m) moodCache.set(c, (m = new Map()));
  let out = m.get(mood);
  if (!out) {
    const def = MOODS.find((x) => x.id === mood);
    out = def ? { ...c, ...def.set } : c;
    m.set(mood, out);
  }
  return out;
}

const heldCache = new WeakMap<CharacterState, Map<string, CharacterState>>();

/** The look with a different prop in hand. */
function withHeld(c: CharacterState, item: string, color: string): CharacterState {
  if (c.held === item && c.heldColor === color) return c;
  let m = heldCache.get(c);
  if (!m) heldCache.set(c, (m = new Map()));
  const key = `${item}|${color}`;
  let out = m.get(key);
  if (!out) m.set(key, (out = { ...c, held: item, heldColor: color }));
  return out;
}

function lastAt<T extends { t: number }>(list: T[], t: number): T | undefined {
  let found: T | undefined;
  for (const e of list) if (e.t <= t) found = e;
  return found;
}

const rideAt = (tr: ActorTrack, t: number) => tr.rides.find((r) => t >= r.t0 && t < r.t1);

/** Hips above the feet (character units) at time t, easing in and out of seats; null when standing. */
function seatAt(tr: ActorTrack, t: number, standHip: number, scale: number): { hip: number | null; cover?: string } {
  let cur = tr.startSeat;
  let from = tr.startSeat;
  let since = -Infinity;
  for (const p of tr.postures) {
    if (p.t > t) break;
    from = cur;
    cur = p.seat;
    since = p.t;
  }
  const k = clamp((t - since) / SIT_TIME, 0, 1);
  if (!cur && k >= 1) return { hip: null };
  const hipOf = (s: Posture['seat']) => (s ? seatHip(s.h / scale, standHip) : standHip);
  return { hip: hipOf(from) + (hipOf(cur) - hipOf(from)) * k, cover: (cur ?? from)?.cover };
}

/**
 * Hip height on a seat `h` high, for someone whose hips stand `legs` high. Paper furniture is big
 * next to these short legs, so grown-ups sink into it (hips at most 60% of leg height, feet on the
 * floor, legs bent toward the camera) while little kids sit on top of it with their legs dangling.
 */
function seatHip(h: number, legs: number): number {
  return legs >= h * 0.6 ? Math.min(h, legs * 0.6) : h;
}

/** Where the pupils point at time t: a silent side-eye, then whoever they're facing, then wandering when nothing's going on. */
function gazeAt(tr: ActorTrack, t: number, lookDir: number, here: number, where: Map<string, number>, talking: boolean): { x: number; y: number } {
  const side = tr.sideEyes.find((e) => t >= e.t0 && t < e.t1);
  const target = side && where.get(side.at);
  if (target !== undefined && Math.abs(target - here) > 30) return { x: Math.sign(target - here), y: 0 };
  if (lookDir) return { x: lookDir * GAZE_LOOK, y: 0 };
  const idle = talking ? undefined : tr.glances.find((e) => t >= e.t0 && t < e.t1);
  return idle ?? { x: 0, y: 0 };
}

/** Where everyone is at time t (x of whoever is on stage), passengers riding with their vehicle. */
function whereabouts(sc: CompiledScene, vehicles: VehicleFrame[], t: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const tr of sc.tracks) {
    const ride = rideAt(tr, t);
    if (ride) {
      const v = vehicles.find((x) => x.id === ride.vehicle);
      if (v) out.set(tr.castId, v.x);
      continue;
    }
    const p = placeOn(tr.moves, tr.startX, tr.startY, tr.startVisible, t);
    if (p.visible) out.set(tr.castId, p.x);
  }
  return out;
}

function talkLevel(tr: ActorTrack, t: number, clips: ClipMap): { level: number; talk: ActorTrack['talks'][number] | null } {
  for (const tk of tr.talks) {
    if (t >= tk.t0 && t < tk.t1) {
      const clip = clips.get(tk.beatId);
      const env = clip?.env;
      const i = Math.floor((t - tk.t0) * ENV_FPS + 1e-6);
      // A pose stands for the whole stretch of sound until the next one, or quick syllables would fall between poses.
      const span = env?.subarray(Math.min(i, env.length - 1), i + ENV_FPS / POSE_FPS);
      const raw = span?.length ? span.reduce((a, b) => a + b, 0) / span.length : 0.5 + 0.5 * Math.sin((t - tk.t0) * 16);
      // Cut-out mouths snap between a few shapes rather than easing.
      const level = raw < 0.14 ? 0 : raw < 0.5 ? 0.5 : 1;
      return { level, talk: tk };
    }
  }
  return { level: 0, talk: null };
}

function gestureAt(tr: ActorTrack, t: number): { gesture: GestureId; t0: number; t1: number } | null {
  let g: ActorTrack['gestures'][number] | null = null;
  for (const x of tr.gestures) if (t >= x.t0 && t < x.t1 + GESTURE_BLEND) g = x;
  return g;
}

function actionAt(tr: ActorTrack, t: number) {
  let lift = 0;
  let rotate = 0;
  let squash = 1;
  let jitter = 0;
  for (const a of tr.actions) {
    const dt = t - a.t;
    if (dt < 0) continue;
    if (a.action === 'faint') {
      // Tips over backwards like a cardboard cut-out and stays down until they next do something.
      const up = Math.min(...tr.actions.filter((b) => b.t > a.t).map((b) => b.t), ...tr.moves.filter((m) => m.t0 > a.t).map((m) => m.t0), ...tr.postures.filter((p) => p.t > a.t).map((p) => p.t));
      if (t >= up) continue;
      const k = Math.min(1, dt / 0.28);
      rotate = -90 * k * k;
    } else if (a.action === 'jump' && dt < 0.55) {
      const p = dt / 0.55;
      lift = Math.round(4 * p * (1 - p) * 4) / 4 * 150;
    } else if (a.action === 'bounce' && dt < 1.05) {
      const p = (dt % 0.35) / 0.35;
      lift = Math.round(4 * p * (1 - p) * 3) / 3 * 60;
    } else if (a.action === 'spin' && dt < 0.6) {
      squash = Math.cos((dt / 0.6) * Math.PI * 2);
    } else if (a.action === 'shake' && dt < 1) {
      // Side to side on every pose.
      jitter = Math.round(dt * POSE_FPS) % 2 ? 5 : -5;
    }
  }
  return { lift, rotate, squash, jitter };
}

function headBox(af: Pick<ActorFrame, 'x' | 'y' | 'scale' | 'c' | 'lift' | 'hipY'>) {
  const g = seatedGeo(getGeo(af.c.body, af.c.headShape), af.hipY);
  const y = af.y - af.lift * af.scale;
  return {
    cx: af.x + (g.headCx - 200) * af.scale,
    cy: y + (g.headCy - GROUND_Y) * af.scale,
    r: Math.max(g.headRx, g.headRy) * af.scale,
    top: y + (g.headCy - g.headRy * 1.6 - GROUND_Y) * af.scale,
  };
}

function fitCamera(cx: number, cy: number, w: number): Camera {
  const ww = clamp(w, 360, SCENE_W);
  const h = (ww * FRAME_H) / FRAME_W;
  return { x: clamp(cx - ww / 2, 0, SCENE_W - ww), y: clamp(cy - h / 2, 0, SCENE_H - h), w: ww, h };
}

export const WIDE: Camera = { x: 0, y: SCENE_H - FRAME_H, w: FRAME_W, h: FRAME_H };

const mixCamera = (a: Camera, b: Camera, k: number): Camera => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });

export function cameraFor(shot: Shot, actors: ActorFrame[], speaker: string | undefined): Camera {
  if (shot.type === 'wide') return WIDE;
  const pickIds = shot.on?.length ? shot.on : shot.type === 'close' && speaker ? [speaker] : actors.map((a) => a.castId);
  const picked = actors.filter((a) => pickIds.includes(a.castId));
  if (!picked.length) return WIDE;
  if (shot.type === 'close') {
    const h = headBox(picked[0]);
    // Head and shoulders, like the show's reaction shots.
    return fitCamera(h.cx, h.cy + h.r * 0.42, h.r * 2 * 2.55 * (FRAME_W / FRAME_H) * 0.62);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const a of picked) {
    const h = headBox(a);
    minX = Math.min(minX, h.cx - h.r * 1.3);
    maxX = Math.max(maxX, h.cx + h.r * 1.3);
    top = Math.min(top, h.top);
    bottom = Math.max(bottom, a.y + 20);
  }
  const w = Math.max((maxX - minX) * 1.25, ((bottom - top) * 1.12 * FRAME_W) / FRAME_H, 640);
  return fitCamera((minX + maxX) / 2, (top + bottom) / 2, w);
}

/** Blend a pose in and out over GESTURE_BLEND, cut-out quick. */
function blendIn(g: ReturnType<typeof getGeo>, target: ArmsPose, t: number, t0: number, t1: number): ArmsPose {
  const kin = Math.min(1, (t - t0) / GESTURE_BLEND);
  const kout = t > t1 ? 1 - (t - t1) / GESTURE_BLEND : 1;
  const k = Math.max(0, Math.min(kin, kout));
  return k >= 1 ? target : lerpArms(restArms(g), target, k);
}

function sampleVehicles(sc: CompiledScene, t: number): VehicleFrame[] {
  const out: VehicleFrame[] = [];
  for (const vt of sc.vehicles) {
    const def = getVehicleDef(vt.vehicle.type);
    const p = vehicleAt(vt, t);
    if (!p.visible) continue;
    const flip = facingOf(vt, t) < 0;
    out.push({
      id: vt.vehicle.id,
      type: def.id,
      color: vt.vehicle.color ?? def.defaultColor,
      x: p.x,
      y: vt.y,
      flip,
      // A paper car judders along rather than gliding.
      bounce: p.moving ? -Math.round(Math.abs(Math.sin(p.moveT * 13))) * 3 : 0,
      spin: (((flip ? -p.x : p.x) / def.wheelR) * 180) / Math.PI,
      lights: def.id === 'police' && p.moving && Math.floor(p.moveT * 4) % 2 === 0,
    });
  }
  return out;
}

function sampleActors(sc: CompiledScene, ep: CompiledEpisode, t: number, clips: ClipMap, vehicles: VehicleFrame[]): ActorFrame[] {
  const out: ActorFrame[] = [];
  const where = whereabouts(sc, vehicles, t);
  // Who is talking right now (everyone else looks at them).
  let speaker: { id: string; x: number } | null = null;
  for (const tr of sc.tracks) {
    if (tr.talks.some((tk) => t >= tk.t0 && t < tk.t1)) {
      const x = where.get(tr.castId);
      if (x !== undefined) speaker = { id: tr.castId, x };
    }
  }
  for (const tr of sc.tracks) {
    const member = ep.cast.get(tr.castId);
    if (!member) continue;
    const ride = rideAt(tr, t);
    const vehicle = ride && vehicles.find((v) => v.id === ride.vehicle);
    if (ride && !vehicle) continue;
    const place = placeOn(tr.moves, tr.startX, tr.startY, tr.startVisible, t);
    if (!ride && !place.visible) continue;
    const mood = lastAt(tr.moods, t)?.mood ?? 'happy';
    const prop = holdAt(tr, member.look, t);
    const c = withHeld(withMood(member.look, mood), prop.item, prop.color);
    const g0 = getGeo(c.body, c.headShape);
    const { level, talk } = talkLevel(tr, t, clips);
    let scale = BASE_SCALE * (1 - tr.depth * 0.28);
    let x = place.x;
    let y = place.y;
    const walking = !ride && place.moving;

    // Sitting: hips drop to the seat. Someone too small for it is lifted onto it instead, legs dangling.
    let hipY: number | undefined;
    let raise = 0;
    const sit = ride ? { hip: null } : seatAt(tr, t, GROUND_Y - g0.legTop, scale);
    if (sit.hip !== null) {
      const hy = GROUND_Y - sit.hip;
      if (hy < g0.legTop) raise = g0.legTop - hy;
      else hipY = hy;
    }
    const g = seatedGeo(g0, hipY);

    // Passengers sit in the vehicle with their heads in the windows.
    if (ride && vehicle) {
      const def = getVehicleDef(vehicle.type);
      scale *= PASSENGER_SCALE;
      x = vehicle.x + def.slots[Math.min(ride.slot, def.slots.length - 1)] * (vehicle.flip ? -1 : 1);
      y = vehicle.y + vehicle.bounce + def.headY - (g0.headCy - GROUND_Y) * scale;
    }
    const here = ride ? x : place.x;

    // Facing: walkers face where they're going; talkers look at their target; listeners look at the talker; passengers face the road.
    const handoff = tr.handoffs.find((h) => t >= h.t0 && t < h.t1 + GESTURE_BLEND);
    let lookDir = 0;
    if (walking) lookDir = place.dir;
    else {
      let targetX: number | null = null;
      if (handoff) targetX = where.get(handoff.toward) ?? null;
      else if (talk) {
        if (talk.lookAt) targetX = where.get(talk.lookAt) ?? null;
        if (targetX === null) {
          let best = Infinity;
          for (const [id, ox] of where) {
            if (id === tr.castId) continue;
            if (Math.abs(ox - here) < best) {
              best = Math.abs(ox - here);
              targetX = ox;
            }
          }
        }
      } else if (speaker && speaker.id !== tr.castId) targetX = speaker.x;
      if (targetX !== null && Math.abs(targetX - here) > 30) lookDir = Math.sign(targetX - here);
      else if (vehicle) lookDir = vehicle.flip ? -1 : 1;
    }
    const turn = walking ? lookDir : lookDir * (talk ? 0.55 : 0.42);
    const gaze = gazeAt(tr, t, lookDir, here, where, !!talk);

    // Arms: hand-overs, then gestures, then pumping while running.
    const lead = (lookDir || 1) as -1 | 1;
    const charLead = (tr.flip ? -lead : lead) as -1 | 1;
    let arms: ArmsPose | undefined;
    const gs = gestureAt(tr, t);
    if (handoff) arms = blendIn(g, handOverArms(g, charLead), t, handoff.t0, handoff.t1);
    else if (gs) arms = blendIn(g, poseArms(g, gs.gesture, charLead, t - gs.t0, level), t, gs.t0, gs.t1);
    else if (walking && place.run) arms = runArms(g, place.moveT);

    const act = actionAt(tr, t);
    const period = place.run ? RUN_HOP : HOP_PERIOD;
    const hop = walking ? Math.round((1 - Math.abs(2 * ((place.moveT / period) % 1) - 1)) * 2) / 2 : 0;
    const blink = !talk && mood !== 'love' && tr.blinks.some((b) => t >= b && t < b + 0.13);
    out.push({
      castId: tr.castId,
      name: member.name,
      c,
      x: x + act.jitter,
      y,
      scale,
      flip: tr.flip,
      turn: tr.flip ? -turn : turn,
      talk: level,
      blink,
      gazeX: tr.flip ? -gaze.x : gaze.x,
      gazeY: gaze.y,
      arms,
      lift: hop * (place.run ? 34 : 26) + act.lift + level * 3 + raise,
      // Runners lean into it.
      rotate: act.rotate || (walking && place.run ? place.dir * 7 : 0),
      squash: act.squash,
      jitter: act.jitter,
      depth: tr.depth,
      ...(hipY !== undefined ? { hipY } : {}),
      ...(sit.hip !== null && 'cover' in sit && sit.cover ? { cover: sit.cover } : {}),
      ...(ride ? { riding: ride.vehicle } : {}),
    });
  }
  // Furthest back first (couches sit behind the front row); on the same line, whoever's talking ends up on top.
  return out.sort((a, b) => a.y - b.y || a.talk - b.talk);
}

/** `t` is the pose on screen; `frameT` is the frame, which camera moves and fades run on. */
export function sampleScene(sc: CompiledScene, ep: CompiledEpisode, t: number, clips: ClipMap, frameT = t): SceneFrame {
  const vehicles = sampleVehicles(sc, t);
  const actors = sampleActors(sc, ep, t, clips, vehicles);
  let beat: CompiledBeat | null = null;
  for (const b of sc.beats) if (b.start <= t) beat = b;

  // What a shot shows at time `at`: framed on where everyone stood when it started, or on them as they go if it follows them.
  const shotCamera = (i: number, at: number): Camera => {
    const { t: t0, shot, beat: from } = sc.shots[i];
    let framing: ActorFrame[] = [];
    if (shot.follow) {
      // On the pose, so the character holds still in the frame while the set moves behind them. Their hops don't shake it.
      // Once they've left there's nobody to frame, and it cuts back to wide for whoever's still there.
      const p = poseTime(at);
      framing = sampleActors(sc, ep, p, clips, sampleVehicles(sc, p)).map((a) => ({ ...a, lift: 0 }));
    } else if (shot.type !== 'wide') framing = t0 === t ? actors : sampleActors(sc, ep, t0 + 1e-3, clips, sampleVehicles(sc, t0 + 1e-3));
    let cam = cameraFor(shot, framing, from?.beat.who);
    if (shot.push && from) {
      const k = clamp((at - from.start) / Math.max(0.5, from.end - from.start), 0, 1);
      cam = fitCamera(cam.x + cam.w / 2, cam.y + cam.h / 2, cam.w * (1 - 0.1 * k));
    }
    const k = (at - t0) / PAN_TIME;
    return shot.pan && i > 0 && k < 1 ? mixCamera(shotCamera(i - 1, t0), cam, ease(Math.max(0, k))) : cam;
  };
  let camera = shotCamera(sc.shots.indexOf(lastAt(sc.shots, t) ?? sc.shots[0]), frameT);

  // Screen effects.
  let flash = 0;
  for (const b of sc.beats) {
    const dt = t - b.start;
    if (dt < 0) break;
    if (b.beat.effect === 'shake' && dt < 0.6) {
      const amp = (1 - dt / 0.6) * camera.w * 0.012;
      const k = Math.round(dt * POSE_FPS);
      camera = { ...camera, x: camera.x + (k % 2 ? amp : -amp), y: camera.y + (k % 4 < 2 ? amp : -amp) * 0.7 };
    }
    if (b.beat.effect === 'flash' && frameT - b.start < 0.45) flash = Math.max(flash, 1 - (frameT - b.start) / 0.45);
  }

  let caption: string | null = null;
  for (const b of sc.beats) if (b.beat.caption && t >= b.start && t < Math.max(b.next, b.start + 2.2)) caption = b.beat.caption;

  let subtitle: SceneFrame['subtitle'] = null;
  if (beat?.beat.text && t < beat.end) subtitle = { who: ep.cast.get(beat.beat.who ?? '')?.name ?? '', text: beat.beat.text };

  return { kind: 'scene', scene: sc, t, camera, actors, vehicles, beat, caption, subtitle, flash, fade: 0, weather: sc.scene.weather };
}

const fadeLength = (sc: CompiledScene) => Math.min(FADE_TIME, sc.duration / 2);

/** How long a scene takes to come into view. The editor skips this, so a scene isn't picked on a black frame. */
export function transitionTime(sc: CompiledScene): number {
  if (sc.scene.transition === 'fade') return fadeLength(sc);
  return sc.scene.transition === 'dissolve' ? Math.min(DISSOLVE_TIME, sc.duration) : 0;
}

/** Scene changes are overlays: fades and dissolves use the hold and the tail each scene already has, so nothing moves in time. */
function transition(frame: SceneFrame, ep: CompiledEpisode, local: number, clips: ClipMap): SceneFrame {
  const sc = frame.scene;
  const t = frameTime(local);
  const time = transitionTime(sc);
  const up = sc.scene.transition === 'fade' ? 1 - t / time : 0;
  const down = ep.scenes[sc.index + 1]?.scene.transition === 'fade' ? 1 - (sc.duration - t) / fadeLength(sc) : 0;
  frame.fade = clamp(Math.max(up, down), 0, 1);
  const prev = ep.scenes[sc.index - 1];
  if (sc.scene.transition === 'dissolve' && prev && t < time) {
    frame.under = { frame: sampleScene(prev, ep, prev.duration + poseTime(local), clips, prev.duration + t), opacity: 1 - t / time };
  }
  return frame;
}

/** The picture at time t, held on the current frame and pose. */
export function sampleEpisode(ep: CompiledEpisode, t: number, clips: ClipMap): Frame | null {
  if (t < ep.titleDuration) {
    const fade = ep.scenes[0]?.scene.transition === 'fade' ? clamp(1 - (ep.titleDuration - frameTime(t)) / FADE_TIME, 0, 1) : 0;
    return { kind: 'title', title: ep.episode.title, t: poseTime(t), fade };
  }
  const sc = ep.scenes.find((s) => t < s.start + s.duration);
  if (sc) {
    const local = Math.max(0, t - sc.start);
    return transition(sampleScene(sc, ep, poseTime(local), clips, frameTime(local)), ep, local, clips);
  }
  const last = ep.scenes[ep.scenes.length - 1];
  return last ? transition(sampleScene(last, ep, last.duration, clips), ep, last.duration, clips) : null;
}

/** Which scene (index) and beat is playing at episode time t. */
export function locate(ep: CompiledEpisode, t: number): { scene: number; beat: number } {
  for (const sc of ep.scenes) {
    if (t < sc.start + sc.duration) {
      let beat = -1;
      for (const b of sc.beats) if (sc.start + b.start <= t) beat = b.index;
      return { scene: sc.index, beat };
    }
  }
  return { scene: Math.max(0, ep.scenes.length - 1), beat: -1 };
}

/** Everything that makes a sound, in episode time. Used by the player and the exporter. */
export interface AudioCue {
  t: number;
  kind: 'line' | 'sfx';
  beatId: string;
  sfx?: string;
}

export function audioCues(ep: CompiledEpisode): AudioCue[] {
  const cues: AudioCue[] = [];
  if (ep.titleDuration > 0) cues.push({ t: 0.15, kind: 'sfx', beatId: 'title', sfx: 'sting' });
  for (const sc of ep.scenes) {
    if (sc.scene.sting) cues.push({ t: sc.start, kind: 'sfx', beatId: sc.scene.id, sfx: 'sting' });
    for (const b of sc.beats) {
      if (b.beat.text?.trim()) cues.push({ t: sc.start + b.start, kind: 'line', beatId: b.beat.id });
      if (b.beat.sfx) cues.push({ t: sc.start + b.start, kind: 'sfx', beatId: b.beat.id, sfx: b.beat.sfx });
      if (b.beat.action === 'faint' && !b.beat.sfx) cues.push({ t: sc.start + b.start + 0.28, kind: 'sfx', beatId: b.beat.id, sfx: 'thud' });
    }
  }
  return cues.sort((a, b) => a.t - b.t);
}
