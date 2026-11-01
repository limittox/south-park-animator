import type { CharacterState } from '../types';
import type { ActionId, Beat, CastMember, Episode, GestureId, MoodId, Move, Scene, SetSpec, Shot, Weather } from './types';
import { getGeo } from '../character/geometry';
import { lerpArms, poseArms, restArms, type ArmsPose } from '../character/pose';
import { MOODS } from '../character/parts/face';
import { getScene, SCENE_H, SCENE_W } from '../scenes/backgrounds';
import { kitGroundY } from '../sets/kit';
import { seeded } from '../character/parts/common';

/*
 * The timeline turns an episode into time-stamped tracks, then samples them into frames.
 * Everything here is pure: the player and the video exporter call the same functions,
 * so what you see while editing is exactly what gets exported.
 */

/** Lip-sync envelopes are sampled this many times a second. */
export const ENV_FPS = 60;
export const FRAME_W = 1600;
export const FRAME_H = 900;
const TITLE_SECONDS = 3.2;
const WALK_SPEED = 380; // scene units per second
const HOP_PERIOD = 0.42;
const OFF_LEFT = -260;
const OFF_RIGHT = SCENE_W + 260;
const BASE_SCALE = 1.15;
const GESTURE_BLEND = 0.12;

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
  kind: Move['kind'];
}

interface ActorTrack {
  castId: string;
  depth: number;
  flip: boolean;
  startX: number;
  startVisible: boolean;
  moves: MoveSeg[];
  moods: { t: number; mood: MoodId }[];
  gestures: { t0: number; t1: number; gesture: GestureId }[];
  actions: { t: number; action: ActionId }[];
  talks: { t0: number; t1: number; beatId: string; lookAt?: string }[];
  blinks: number[];
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

function beatLength(beat: Beat, clips: ClipMap, moveTime: number): number {
  if (beat.text?.trim()) return clips.get(beat.id)?.duration ?? estimateLineSeconds(beat.text);
  if (beat.duration !== undefined) return Math.max(0.1, beat.duration);
  let d = 0.8;
  if (beat.caption) d = Math.max(d, 2.2);
  if (beat.action === 'faint') d = Math.max(d, 1.1);
  if (beat.action) d = Math.max(d, 0.9);
  return Math.max(d, moveTime);
}

/* ---------------------------------------------------------------- compile */

export function compileScene(scene: Scene, index: number, start: number, cast: Map<string, CastMember>, clips: ClipMap): CompiledScene {
  const groundY = groundYOf(scene.set);

  // Everyone who is blocked, moves or speaks gets a track. Unblocked speakers are spread across the stage.
  const tracks = new Map<string, ActorTrack>();
  const ensure = (id: string): ActorTrack | null => {
    if (!cast.has(id)) return null;
    let tr = tracks.get(id);
    if (!tr) {
      const b = scene.blocking.find((x) => x.who === id);
      tr = {
        castId: id,
        depth: clamp(b?.depth ?? 0, 0, 1),
        flip: !!b?.flip,
        startX: b ? clamp(b.x, -400, SCENE_W + 400) : NaN,
        startVisible: b ? !b.offstage : true,
        moves: [],
        moods: [{ t: 0, mood: b?.mood ?? 'happy' }],
        gestures: [],
        actions: [],
        talks: [],
        blinks: [],
      };
      tracks.set(id, tr);
    }
    return tr;
  };
  scene.blocking.forEach((b) => ensure(b.who));
  for (const beat of scene.beats) {
    if (beat.who) ensure(beat.who);
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

  // Running position of each actor while laying out moves.
  const pos = new Map<string, { x: number; visible: boolean; busyUntil: number }>();
  for (const tr of tracks.values()) pos.set(tr.castId, { x: tr.startX, visible: tr.startVisible, busyUntil: 0 });

  const beats: CompiledBeat[] = [];
  const shots: CompiledScene['shots'] = [{ t: 0, shot: { type: 'wide' } }];
  let t = Math.max(0, scene.hold);
  scene.beats.forEach((beat, i) => {
    let moveTime = 0;
    for (const m of beat.moves ?? []) {
      const tr = tracks.get(m.who);
      const p = pos.get(m.who);
      if (!tr || !p) continue;
      const t0 = Math.max(t, p.busyUntil);
      let x0 = p.x;
      let x1 = p.x;
      if (m.kind === 'enter') {
        x1 = clamp(m.x ?? p.x, 140, 1460);
        const side = m.side ?? (x1 < SCENE_W / 2 ? 'left' : 'right');
        x0 = side === 'left' ? OFF_LEFT : OFF_RIGHT;
      } else if (m.kind === 'exit') {
        const side = m.side ?? (p.x < SCENE_W / 2 ? 'left' : 'right');
        x1 = side === 'left' ? OFF_LEFT : OFF_RIGHT;
      } else if (m.kind === 'walk') {
        x1 = clamp(m.x ?? p.x, 140, 1460);
      } else if (m.kind === 'appear') {
        x0 = x1 = clamp(m.x ?? p.x, 140, 1460);
      }
      const dur = m.kind === 'appear' || m.kind === 'vanish' ? 0 : Math.max(0.35, Math.abs(x1 - x0) / WALK_SPEED);
      tr.moves.push({ t0, t1: t0 + dur, x0, x1, kind: m.kind });
      p.x = x1;
      p.visible = m.kind !== 'exit' && m.kind !== 'vanish';
      p.busyUntil = t0 + dur;
      moveTime = Math.max(moveTime, t0 + dur - t);
    }
    const len = beatLength(beat, clips, moveTime);
    const end = t + len;
    const gap = beat.pauseAfter ?? (beat.text ? 0.24 : 0.12);
    const cb: CompiledBeat = { beat, index: i, start: t, end, next: end + Math.max(0, gap) };
    beats.push(cb);

    const who = beat.who ? tracks.get(beat.who) : undefined;
    if (who) {
      if (beat.mood) who.moods.push({ t, mood: beat.mood });
      if (beat.gesture && beat.gesture !== 'none') who.gestures.push({ t0: t, t1: Math.max(end, t + 0.9), gesture: beat.gesture });
      if (beat.action) who.actions.push({ t, action: beat.action });
      if (beat.text?.trim()) who.talks.push({ t0: t, t1: end, beatId: beat.id, lookAt: beat.lookAt });
    }
    for (const [id, mood] of Object.entries(beat.reactions ?? {})) tracks.get(id)?.moods.push({ t, mood });
    if (beat.shot) shots.push({ t, shot: beat.shot, beat: cb });
    t = cb.next;
  });
  const duration = t + 0.5;

  // Blinks every few seconds, at times that stay put between renders.
  for (const tr of tracks.values()) {
    let h = 0;
    for (const ch of tr.castId + scene.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = seeded(h);
    for (let bt = 0.6 + rnd() * 2.4; bt < duration; bt += 2.2 + rnd() * 3.2) tr.blinks.push(bt);
  }

  return { scene, index, start, duration, groundY, beats, tracks: [...tracks.values()], shots };
}

export function compileEpisode(episode: Episode, clips: ClipMap): CompiledEpisode {
  const cast = new Map(episode.cast.map((c) => [c.id, c]));
  const titleDuration = episode.titleCard ? TITLE_SECONDS : 0;
  let t = titleDuration;
  const scenes = episode.scenes.map((s, i) => {
    const cs = compileScene(s, i, t, cast, clips);
    t += cs.duration;
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
  arms: ArmsPose | undefined;
  /** Extra transform for jumps, spins and faints, in character coordinates. */
  lift: number;
  rotate: number;
  squash: number;
  jitter: number;
  depth: number;
}

export interface SceneFrame {
  kind: 'scene';
  scene: CompiledScene;
  /** Time inside the scene. */
  t: number;
  camera: Camera;
  actors: ActorFrame[];
  beat: CompiledBeat | null;
  caption: string | null;
  subtitle: { who: string; text: string } | null;
  flash: number;
  weather: Weather;
}

export interface TitleFrame {
  kind: 'title';
  title: string;
  t: number;
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

function lastAt<T extends { t: number }>(list: T[], t: number): T | undefined {
  let found: T | undefined;
  for (const e of list) if (e.t <= t) found = e;
  return found;
}

/** Where an actor's feet are at time t, and whether they're walking. */
function actorPlace(tr: ActorTrack, t: number): { x: number; visible: boolean; walking: number; dir: number; walkT: number } {
  let x = tr.startX;
  let visible = tr.startVisible;
  for (const m of tr.moves) {
    if (t < m.t0) break;
    if (t < m.t1) {
      const k = (t - m.t0) / (m.t1 - m.t0);
      return { x: m.x0 + (m.x1 - m.x0) * k, visible: true, walking: 1, dir: Math.sign(m.x1 - m.x0) || 1, walkT: t - m.t0 };
    }
    x = m.x1;
    visible = m.kind !== 'exit' && m.kind !== 'vanish';
  }
  return { x, visible, walking: 0, dir: 0, walkT: 0 };
}

function placeAt(sc: CompiledScene, id: string, t: number): number | null {
  const tr = sc.tracks.find((x) => x.castId === id);
  if (!tr) return null;
  const p = actorPlace(tr, t);
  return p.visible ? p.x : null;
}

function talkLevel(tr: ActorTrack, t: number, clips: ClipMap): { level: number; talk: ActorTrack['talks'][number] | null } {
  for (const tk of tr.talks) {
    if (t >= tk.t0 && t < tk.t1) {
      const clip = clips.get(tk.beatId);
      const env = clip?.env;
      const i = Math.floor((t - tk.t0) * ENV_FPS);
      const raw = env && env.length ? env[Math.min(env.length - 1, i)] : 0.5 + 0.5 * Math.sin((t - tk.t0) * 16);
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
      // Tips over backwards like a cardboard cut-out and stays down.
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
      jitter = Math.sin(dt * 160) * 5;
    }
  }
  return { lift, rotate, squash, jitter };
}

function headBox(af: Pick<ActorFrame, 'x' | 'y' | 'scale' | 'c'>) {
  const g = getGeo(af.c.body, af.c.headShape);
  return {
    cx: af.x + (g.headCx - 200) * af.scale,
    cy: af.y + (g.headCy - 480) * af.scale,
    r: Math.max(g.headRx, g.headRy) * af.scale,
    top: af.y + (g.headCy - g.headRy * 1.6 - 480) * af.scale,
  };
}

function fitCamera(cx: number, cy: number, w: number): Camera {
  const ww = clamp(w, 360, SCENE_W);
  const h = (ww * FRAME_H) / FRAME_W;
  return { x: clamp(cx - ww / 2, 0, SCENE_W - ww), y: clamp(cy - h / 2, 0, SCENE_H - h), w: ww, h };
}

export const WIDE: Camera = { x: 0, y: SCENE_H - FRAME_H, w: FRAME_W, h: FRAME_H };

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

function sampleActors(sc: CompiledScene, ep: CompiledEpisode, t: number, clips: ClipMap): ActorFrame[] {
  const out: ActorFrame[] = [];
  // Who is talking right now (everyone else looks at them).
  let speaker: { id: string; x: number } | null = null;
  for (const tr of sc.tracks) {
    if (tr.talks.some((tk) => t >= tk.t0 && t < tk.t1)) {
      const x = placeAt(sc, tr.castId, t);
      if (x !== null) speaker = { id: tr.castId, x };
    }
  }
  for (const tr of sc.tracks) {
    const member = ep.cast.get(tr.castId);
    if (!member) continue;
    const place = actorPlace(tr, t);
    if (!place.visible) continue;
    const mood = lastAt(tr.moods, t)?.mood ?? 'happy';
    const c = withMood(member.look, mood);
    const g = getGeo(c.body, c.headShape);
    const { level, talk } = talkLevel(tr, t, clips);

    // Facing: walkers face where they're going; talkers look at their target; listeners look at the talker.
    let lookDir = 0;
    if (place.walking) lookDir = place.dir;
    else {
      let targetX: number | null = null;
      if (talk) {
        if (talk.lookAt) targetX = placeAt(sc, talk.lookAt, t);
        if (targetX === null) {
          let best = Infinity;
          for (const other of sc.tracks) {
            if (other === tr) continue;
            const ox = placeAt(sc, other.castId, t);
            if (ox !== null && Math.abs(ox - place.x) < best) {
              best = Math.abs(ox - place.x);
              targetX = ox;
            }
          }
        }
      } else if (speaker && speaker.id !== tr.castId) targetX = speaker.x;
      if (targetX !== null && Math.abs(targetX - place.x) > 30) lookDir = Math.sign(targetX - place.x);
    }
    const turn = place.walking ? lookDir : lookDir * (talk ? 0.55 : 0.42);

    // Arms: blend in and out of gestures quickly, cut-out style.
    const lead = (lookDir || 1) as -1 | 1;
    const charLead = (tr.flip ? -lead : lead) as -1 | 1;
    let arms: ArmsPose | undefined;
    const gs = gestureAt(tr, t);
    if (gs) {
      const target = poseArms(g, gs.gesture, charLead, t - gs.t0, level);
      const kin = Math.min(1, (t - gs.t0) / GESTURE_BLEND);
      const kout = t > gs.t1 ? 1 - (t - gs.t1) / GESTURE_BLEND : 1;
      const k = Math.max(0, Math.min(kin, kout));
      arms = k >= 1 ? target : lerpArms(restArms(g), target, k);
    }

    const act = actionAt(tr, t);
    const hop = place.walking ? Math.round((1 - Math.abs(2 * ((place.walkT / HOP_PERIOD) % 1) - 1)) * 2) / 2 : 0;
    const blink = !talk && mood !== 'love' && tr.blinks.some((b) => t >= b && t < b + 0.13);
    const scale = BASE_SCALE * (1 - tr.depth * 0.28);
    out.push({
      castId: tr.castId,
      name: member.name,
      c,
      x: place.x + act.jitter,
      y: sc.groundY - tr.depth * 90,
      scale,
      flip: tr.flip,
      turn: tr.flip ? -turn : turn,
      talk: level,
      blink,
      arms,
      lift: hop * 26 + act.lift + level * 3,
      rotate: act.rotate,
      squash: act.squash,
      jitter: act.jitter,
      depth: tr.depth,
    });
  }
  // Far actors first; at the same depth, whoever's talking ends up on top.
  return out.sort((a, b) => b.depth - a.depth || a.talk - b.talk);
}

export function sampleScene(sc: CompiledScene, ep: CompiledEpisode, t: number, clips: ClipMap): SceneFrame {
  const actors = sampleActors(sc, ep, t, clips);
  let beat: CompiledBeat | null = null;
  for (const b of sc.beats) if (b.start <= t) beat = b;

  // Camera: the latest shot, framed on where everyone stood when it cut in.
  const shotEv = lastAt(sc.shots, t) ?? sc.shots[0];
  const framing = shotEv.t === t ? actors : sampleActors(sc, ep, shotEv.t + 1e-3, clips);
  let camera = cameraFor(shotEv.shot, framing, shotEv.beat?.beat.who);
  if (shotEv.shot.push && shotEv.beat) {
    const k = clamp((t - shotEv.beat.start) / Math.max(0.5, shotEv.beat.end - shotEv.beat.start), 0, 1);
    camera = fitCamera(camera.x + camera.w / 2, camera.y + camera.h / 2, camera.w * (1 - 0.1 * k));
  }

  // Screen effects.
  let flash = 0;
  for (const b of sc.beats) {
    const dt = t - b.start;
    if (dt < 0) break;
    if (b.beat.effect === 'shake' && dt < 0.6) {
      const amp = (1 - dt / 0.6) * camera.w * 0.012;
      camera = { ...camera, x: camera.x + Math.sin(dt * 90) * amp, y: camera.y + Math.cos(dt * 70) * amp };
    }
    if (b.beat.effect === 'flash' && dt < 0.45) flash = Math.max(flash, 1 - dt / 0.45);
  }

  let caption: string | null = null;
  for (const b of sc.beats) if (b.beat.caption && t >= b.start && t < Math.max(b.next, b.start + 2.2)) caption = b.beat.caption;

  let subtitle: SceneFrame['subtitle'] = null;
  if (beat?.beat.text && t < beat.end) subtitle = { who: ep.cast.get(beat.beat.who ?? '')?.name ?? '', text: beat.beat.text };

  return { kind: 'scene', scene: sc, t, camera, actors, beat, caption, subtitle, flash, weather: sc.scene.weather };
}

export function sampleEpisode(ep: CompiledEpisode, t: number, clips: ClipMap): Frame | null {
  if (t < ep.titleDuration) return { kind: 'title', title: ep.episode.title, t };
  for (const sc of ep.scenes) {
    if (t < sc.start + sc.duration) return sampleScene(sc, ep, Math.max(0, t - sc.start), clips);
  }
  const last = ep.scenes[ep.scenes.length - 1];
  return last ? sampleScene(last, ep, last.duration, clips) : null;
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
