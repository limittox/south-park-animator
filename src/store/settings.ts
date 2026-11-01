import { useSyncExternalStore } from 'react';

/** Everything the user configures. The API key never leaves the browser except in requests to OpenRouter. */
export interface Settings {
  apiKey: string;
  llmModel: string;
  ttsModel: string;
  subtitles: boolean;
  exportHeight: 720 | 1080;
  /** Generate voices automatically after a script is turned into an episode. */
  autoVoice: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  llmModel: 'anthropic/claude-sonnet-5.5',
  ttsModel: 'google/gemini-3.8-flash-tts',
  subtitles: false,
  exportHeight: 720,
  autoVoice: true,
};

const KEY = 'ptstudio.settings.v1';
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let current = load();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: settings last for this visit only */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
