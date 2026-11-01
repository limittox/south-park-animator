import type { CharacterState } from '../types';
import { DEFAULT_CHARACTER, normalizeCharacter } from '../data/defaults';

const SKIP = new Set<keyof CharacterState>(['photoFace', 'usePhotoFace']);

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Compact, URL-safe encoding: only fields that differ from the default character. Photos are never shared. */
export function encodeCharacter(c: CharacterState): string {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_CHARACTER) as (keyof CharacterState)[]) {
    if (SKIP.has(key)) continue;
    if (c[key] !== DEFAULT_CHARACTER[key]) diff[key] = c[key];
  }
  return toBase64Url(JSON.stringify(diff));
}

export function decodeCharacter(s: string): CharacterState | null {
  try {
    const parsed = JSON.parse(fromBase64Url(s));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    for (const key of SKIP) delete parsed[key];
    return normalizeCharacter(parsed);
  } catch {
    return null;
  }
}

export function shareUrl(c: CharacterState): string {
  return `${location.origin}${location.pathname}#c=${encodeCharacter(c)}`;
}

export function characterFromHash(hash: string): CharacterState | null {
  const m = /[#&]c=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? decodeCharacter(m[1]) : null;
}
