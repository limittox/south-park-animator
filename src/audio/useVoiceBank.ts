import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Episode } from '../episode/types';
import type { LineClip } from '../episode/timeline';
import type { Settings } from '../store/settings';
import { lineSignature, voiceLine, type VoicedLine } from './voices';

export interface VoiceStatus {
  running: boolean;
  done: number;
  total: number;
  errors: Map<string, string>;
}

interface Job {
  beatId: string;
  sig: string;
}

/** Lines that need (re)voicing: every line whose words, delivery or voice changed since it was last synthesized. */
function staleLines(ep: Episode, model: string, bank: ReadonlyMap<string, VoicedLine>): Job[] {
  const cast = new Map(ep.cast.map((c) => [c.id, c]));
  const jobs: Job[] = [];
  for (const scene of ep.scenes) {
    for (const beat of scene.beats) {
      const member = beat.who ? cast.get(beat.who) : undefined;
      if (!member || !beat.text?.trim()) continue;
      const sig = lineSignature(model, member, beat);
      if (bank.get(beat.id)?.sig !== sig) jobs.push({ beatId: beat.id, sig });
    }
  }
  return jobs;
}

/**
 * Keeps a synthesized voice for every line in the episode. Lines are voiced in the background,
 * three at a time; anything already voiced is served from the cache.
 */
export function useVoiceBank(episode: Episode | null, settings: Settings) {
  const [bank, setBank] = useState<Map<string, VoicedLine>>(() => new Map());
  const [status, setStatus] = useState<VoiceStatus>({ running: false, done: 0, total: 0, errors: new Map() });
  const bankRef = useRef(bank);
  bankRef.current = bank;
  const epRef = useRef(episode);
  epRef.current = episode;
  const runRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    const ep = epRef.current;
    if (!ep || !settings.apiKey) return;
    const jobs = staleLines(ep, settings.ttsModel, bankRef.current);
    if (!jobs.length) return;
    runRef.current?.abort();
    const ctrl = new AbortController();
    runRef.current = ctrl;
    const errors = new Map<string, string>();
    let done = 0;
    setStatus({ running: true, done, total: jobs.length, errors });
    const queue = [...jobs];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        if (ctrl.signal.aborted) return;
        const cur = epRef.current;
        const beat = cur?.scenes.flatMap((s) => s.beats).find((b) => b.id === job.beatId);
        const member = beat?.who ? cur?.cast.find((c) => c.id === beat.who) : undefined;
        if (!beat || !member) continue;
        try {
          const line = await voiceLine(settings.apiKey, settings.ttsModel, member, beat, ctrl.signal);
          if (ctrl.signal.aborted) return;
          setBank((m) => new Map(m).set(beat.id, line));
        } catch (e) {
          if (ctrl.signal.aborted) return;
          errors.set(beat.id, (e as Error).message);
        }
        done++;
        setStatus({ running: true, done, total: jobs.length, errors: new Map(errors) });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (!ctrl.signal.aborted) {
      setStatus({ running: false, done, total: jobs.length, errors: new Map(errors) });
      runRef.current = null;
    }
  }, [settings.apiKey, settings.ttsModel]);

  // Re-voice changed lines a moment after editing stops.
  useEffect(() => {
    if (!episode || !settings.autoVoice || !settings.apiKey) return;
    const t = window.setTimeout(() => void generate(), 1500);
    return () => window.clearTimeout(t);
  }, [episode, settings.autoVoice, settings.apiKey, generate]);

  useEffect(() => () => runRef.current?.abort(), []);

  /** Only voices that match the current words count; stale ones would mistime the scene. */
  const current = useMemo(() => {
    const lines = new Map<string, VoicedLine>();
    if (!episode) return lines;
    const cast = new Map(episode.cast.map((c) => [c.id, c]));
    for (const scene of episode.scenes)
      for (const beat of scene.beats) {
        const v = bank.get(beat.id);
        const m = beat.who ? cast.get(beat.who) : undefined;
        if (v && m && v.sig === lineSignature(settings.ttsModel, m, beat)) lines.set(beat.id, v);
      }
    return lines;
  }, [bank, episode, settings.ttsModel]);

  const clips = useMemo(() => new Map<string, LineClip>([...current].map(([id, l]) => [id, l.clip])), [current]);
  const missing = useMemo(() => (episode ? staleLines(episode, settings.ttsModel, current).length : 0), [episode, settings.ttsModel, current]);

  return { lines: current, clips, status, generate, missing };
}
