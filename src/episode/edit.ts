import type { Beat, Episode, MoodId, Scene } from './types';
import type { CompiledScene } from './timeline';
import { newId } from './normalize';

/* Small, pure edits the UI makes to an episode. */

export function updateScene(ep: Episode, index: number, fn: (s: Scene) => Scene): Episode {
  return { ...ep, scenes: ep.scenes.map((s, i) => (i === index ? fn(s) : s)) };
}

export function updateBeat(scene: Scene, beatId: string, patch: Partial<Beat>): Scene {
  return {
    ...scene,
    beats: scene.beats.map((b) => {
      if (b.id !== beatId) return b;
      const next: Beat = { ...b, ...patch };
      // Empty fields are removed rather than stored as "".
      for (const k of Object.keys(next) as (keyof Beat)[]) {
        const v = next[k];
        if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete next[k];
      }
      return next;
    }),
  };
}

export function insertBeat(scene: Scene, afterIndex: number, beat: Partial<Beat> = {}): { scene: Scene; id: string } {
  const id = newId('b');
  const beats = [...scene.beats];
  beats.splice(afterIndex + 1, 0, { id, ...beat });
  return { scene: { ...scene, beats }, id };
}

export function moveBeat(scene: Scene, index: number, dir: -1 | 1): Scene {
  const j = index + dir;
  if (j < 0 || j >= scene.beats.length) return scene;
  const beats = [...scene.beats];
  [beats[index], beats[j]] = [beats[j], beats[index]];
  return { ...scene, beats };
}

export function removeBeat(scene: Scene, beatId: string): Scene {
  return { ...scene, beats: scene.beats.filter((b) => b.id !== beatId) };
}

/**
 * Drag a character on the stage: change where they are *at that moment*. If a move brought
 * them there, that move's target changes; otherwise their starting position does.
 */
export function repositionActor(scene: Scene, compiled: CompiledScene, castId: string, t: number, x: number, depth: number): Scene {
  const X = Math.round(Math.max(140, Math.min(1460, x)));
  const D = Math.round(Math.max(0, Math.min(1, depth)) * 100) / 100;
  let target: { beat: number; move: number } | null = null;
  for (const cb of compiled.beats) {
    if (cb.start > t + 1e-6) break;
    cb.beat.moves?.forEach((m, mi) => {
      if (m.who === castId && (m.kind === 'walk' || m.kind === 'enter' || m.kind === 'appear')) target = { beat: cb.index, move: mi };
    });
  }
  const blocking = scene.blocking.some((b) => b.who === castId)
    ? scene.blocking.map((b) => (b.who === castId ? { ...b, depth: D, ...(target ? {} : { x: X }) } : b))
    : [...scene.blocking, { who: castId, x: X, depth: D, mood: 'happy' as MoodId }];
  const hit = target as { beat: number; move: number } | null;
  const beats = hit
    ? scene.beats.map((b, bi) => (bi === hit.beat ? { ...b, moves: b.moves?.map((m, mi) => (mi === hit.move ? { ...m, x: X } : m)) } : b))
    : scene.beats;
  return { ...scene, blocking, beats };
}

/** Set someone's face from a given beat on. */
export function setMoodAt(scene: Scene, beatIndex: number, castId: string, mood: MoodId): Scene {
  if (beatIndex < 0) {
    return { ...scene, blocking: scene.blocking.map((b) => (b.who === castId ? { ...b, mood } : b)) };
  }
  return {
    ...scene,
    beats: scene.beats.map((b, i) => {
      if (i !== beatIndex) return b;
      if (b.who === castId) return { ...b, mood };
      return { ...b, reactions: { ...(b.reactions ?? {}), [castId]: mood } };
    }),
  };
}

export function toggleFlip(scene: Scene, castId: string): Scene {
  const has = scene.blocking.some((b) => b.who === castId);
  return {
    ...scene,
    blocking: has
      ? scene.blocking.map((b) => (b.who === castId ? { ...b, flip: !b.flip } : b))
      : [...scene.blocking, { who: castId, x: 800, depth: 0, mood: 'happy', flip: true }],
  };
}
