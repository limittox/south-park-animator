import { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterState } from '../types';
import type { Episode } from '../episode/types';
import { normalizeCharacter } from '../data/defaults';
import { decodeCharacter } from '../lib/share';
import { dbAll, dbDelete, dbPut } from './db';

/* ---------------------------------------------------------------- saved episodes */

export interface EpisodeSummary {
  id: string;
  title: string;
  updatedAt: number;
  scenes: number;
}

export async function listEpisodes(): Promise<Episode[]> {
  try {
    return (await dbAll<Episode>('episodes')).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export const saveEpisode = (ep: Episode) => dbPut('episodes', ep.id, ep).catch(() => undefined);
export const deleteEpisode = (id: string) => dbDelete('episodes', id);

/* ---------------------------------------------------------------- undoable editing */

const MAX_HISTORY = 60;

export interface EpisodeEditor {
  episode: Episode | null;
  /** Replace the episode. `merge` folds rapid edits (typing, dragging) into one undo step. */
  set: (next: Episode | ((cur: Episode) => Episode), opts?: { merge?: string; skipHistory?: boolean }) => void;
  load: (ep: Episode | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useEpisodeEditor(): EpisodeEditor {
  const [state, setState] = useState<{ cur: Episode | null; past: Episode[]; future: Episode[]; mergeKey: string | null }>({
    cur: null,
    past: [],
    future: [],
    mergeKey: null,
  });

  const set: EpisodeEditor['set'] = useCallback((next, opts) => {
    setState((s) => {
      if (!s.cur) return s;
      const value = typeof next === 'function' ? next(s.cur) : next;
      if (value === s.cur) return s;
      const stamped = { ...value, updatedAt: Date.now() };
      if (opts?.skipHistory) return { ...s, cur: stamped };
      const merging = opts?.merge && opts.merge === s.mergeKey;
      return {
        cur: stamped,
        past: merging ? s.past : [...s.past, s.cur].slice(-MAX_HISTORY),
        future: [],
        mergeKey: opts?.merge ?? null,
      };
    });
  }, []);

  const load = useCallback((ep: Episode | null) => setState({ cur: ep, past: [], future: [], mergeKey: null }), []);
  const undo = useCallback(
    () =>
      setState((s) =>
        s.cur && s.past.length ? { cur: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.cur, ...s.future], mergeKey: null } : s,
      ),
    [],
  );
  const redo = useCallback(
    () => setState((s) => (s.cur && s.future.length ? { cur: s.future[0], past: [...s.past, s.cur], future: s.future.slice(1), mergeKey: null } : s)),
    [],
  );

  // Autosave, a moment after the last edit.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.cur) return;
    const ep = state.cur;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveEpisode(ep), 500);
    return () => window.clearTimeout(timer.current);
  }, [state.cur]);

  return { episode: state.cur, set, load, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

/* ---------------------------------------------------------------- the crew (characters from the creator) */

const CREW_KEY = 'ptstudio.crew.v1';
/** The character creator's own saved crew, readable when both apps are served from the same site. */
const CREATOR_CREW_KEY = 'ptcc.crew.v1';
export const CREATOR_URL = 'https://limittox.github.io/south-park-character-creator/';

export function loadCrew(): CharacterState[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CREW_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.map((c) => normalizeCharacter(c)) : [];
  } catch {
    return [];
  }
}

export function saveCrew(crew: CharacterState[]): void {
  try {
    localStorage.setItem(CREW_KEY, JSON.stringify(crew.map((c) => ({ ...c, photoFace: null, usePhotoFace: false }))));
  } catch {
    /* full */
  }
}

/** Characters saved in the creator on this same site, if any. */
export function creatorCrew(): CharacterState[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CREATOR_CREW_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((m) => m && m.c).map((m) => normalizeCharacter(m.c)) : [];
  } catch {
    return [];
  }
}

/** Read the creator's "Export crew" file. */
export function parseCrewFile(text: string): CharacterState[] {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : Array.isArray(data?.crew) ? data.crew : [];
  return list.map((c: unknown) => normalizeCharacter((c as { c?: unknown })?.c ?? (c as Partial<CharacterState>)));
}

/** A creator share link (…#c=…) or just the code. */
export function parseShareLink(text: string): CharacterState | null {
  const m = /(?:[#&]c=)?([A-Za-z0-9_-]{4,})\s*$/.exec(text.trim());
  return m ? decodeCharacter(m[1]) : null;
}
