import type { CharacterState } from '../types';
import type { CastMember, Episode, Scene } from '../episode/types';
import { normalizeCastMember, normalizeEpisode, normalizeLook, normalizeScene, normalizeVoice, resolveCast } from '../episode/normalize';
import type { Settings } from '../store/settings';
import { chatJson, listModels, type ChatMessage } from './openrouter';
import { CAST_SYSTEM, characterReference, editSystem, scenesSystem, voiceReference } from './prompts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

async function voicesFor(model: string): Promise<string[]> {
  try {
    return (await listModels('speech')).find((m) => m.id === model)?.voices ?? [];
  } catch {
    return [];
  }
}

export interface DirectorProgress {
  castChars: number;
  sceneChars: number;
}

/** A saved character the user wants to reuse when the script mentions them by name. */
export interface CrewLook {
  name: string;
  look: CharacterState;
}

function castSystem(voices: string[]): string {
  return `${CAST_SYSTEM}\n\nCHARACTER PARTS\n${characterReference()}\n\nVOICES\n${voiceReference(voices)}`;
}

/** Script in, episode out: the cast designer and the director work in parallel, then their answers are merged. */
export async function directScript(script: string, settings: Settings, crew: CrewLook[], onProgress?: (p: DirectorProgress) => void, signal?: AbortSignal): Promise<Episode> {
  const voices = await voicesFor(settings.ttsModel);
  const progress: DirectorProgress = { castChars: 0, sceneChars: 0 };
  const crewNote = crew.length
    ? `\n\nThe user already has these characters designed. If the script uses one of these names, keep them in the cast but you may give any look (it will be replaced):\n${crew.map((c) => `- ${c.name}`).join('\n')}`
    : '';
  const base = { apiKey: settings.apiKey, model: settings.llmModel, signal };
  const [castOut, scenesOut] = await Promise.all([
    chatJson({
      ...base,
      maxTokens: 16000,
      messages: [
        { role: 'system', content: castSystem(voices) },
        { role: 'user', content: `SCRIPT:\n${script}${crewNote}` },
      ],
      onText: (t) => {
        progress.castChars = t.length;
        onProgress?.({ ...progress });
      },
    }),
    chatJson({
      ...base,
      maxTokens: 64000,
      messages: [
        { role: 'system', content: scenesSystem() },
        { role: 'user', content: `SCRIPT:\n${script}` },
      ],
      onText: (t) => {
        progress.sceneChars = t.length;
        onProgress?.({ ...progress });
      },
    }),
  ]);
  const c = isObj(castOut) ? castOut : {};
  const s = isObj(scenesOut) ? scenesOut : {};
  const episode = normalizeEpisode({ title: c.title, cast: c.cast, scenes: s.scenes }, script);
  return applyCrew(episode, crew);
}

/** Swap in the user's own saved characters wherever the script uses their names. */
export function applyCrew(episode: Episode, crew: CrewLook[]): Episode {
  if (!crew.length) return episode;
  const cast = episode.cast.map((m) => {
    const hit = crew.find((c) => resolveCast([m], c.name) === m.id);
    return hit ? { ...m, look: { ...hit.look, name: m.name } } : m;
  });
  return { ...episode, cast };
}

/* ---------------------------------------------------------------- chat edits */

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface EditResult {
  episode: Episode;
  reply: string;
}

function castForPrompt(cast: CastMember[]) {
  return cast.map(({ id, name, aliases, bio, look, voice }) => {
    const { photoFace: _p, usePhotoFace: _u, ...rest } = look;
    return { id, name, aliases, bio, voice, look: rest };
  });
}

/** Merge the edit model's answer into the episode. Exported for tests. */
export function applyEdit(episode: Episode, sceneIndex: number | null, out: unknown): EditResult {
  const o = isObj(out) ? out : {};
  let cast = [...episode.cast];
  const taken = new Set(cast.map((c) => c.id));
  for (const u of Array.isArray(o.cast) ? o.cast : []) {
    if (!isObj(u)) continue;
    const existingId = typeof u.id === 'string' ? resolveCast(cast, u.id) : typeof u.name === 'string' ? resolveCast(cast, u.name) : undefined;
    const existing = existingId ? cast.find((c) => c.id === existingId) : undefined;
    if (existing) {
      const look = normalizeLook(u.look, existing.look);
      const updated: CastMember = {
        ...existing,
        bio: typeof u.bio === 'string' && u.bio.trim() ? u.bio.trim() : existing.bio,
        look: { ...look, name: existing.name },
        voice: normalizeVoice(isObj(u.voice) ? { ...existing.voice, ...u.voice } : undefined, existing.voice),
      };
      cast = cast.map((c) => (c.id === existing.id ? updated : c));
    } else {
      const m = normalizeCastMember(u, taken);
      if (m) cast.push(m);
    }
  }
  // Speakers the model introduced without casting them still get a character.
  const rawScenes = sceneIndex !== null ? (isObj(o.scene) ? [o.scene] : []) : Array.isArray(o.scenes) ? o.scenes : [];
  for (const s of rawScenes) {
    if (!isObj(s) || !Array.isArray(s.beats)) continue;
    for (const b of s.beats) {
      if (isObj(b) && typeof b.who === 'string' && b.who.trim() && !resolveCast(cast, b.who)) {
        const m = normalizeCastMember({ name: b.who.trim() }, taken);
        if (m) cast.push(m);
      }
    }
  }
  let scenes = episode.scenes;
  if (sceneIndex !== null && isObj(o.scene)) {
    const next = normalizeScene(o.scene, cast, sceneIndex);
    if (next) scenes = scenes.map((sc, i) => (i === sceneIndex ? { ...next, id: sc.id } : sc));
  } else if (sceneIndex === null && Array.isArray(o.scenes)) {
    const next = o.scenes.map((sc, i) => normalizeScene(sc, cast, i)).filter((sc): sc is Scene => !!sc);
    if (next.length) scenes = next.map((sc, i) => ({ ...sc, id: episode.scenes.find((old) => old.id === sc.id)?.id ?? episode.scenes[i]?.id ?? sc.id }));
  }
  const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 100) : episode.title;
  const reply = typeof o.reply === 'string' && o.reply.trim() ? o.reply.trim() : 'Done.';
  return { episode: { ...episode, title, cast, scenes, updatedAt: Date.now() }, reply };
}

export async function editWithChat(opts: {
  episode: Episode;
  sceneIndex: number | null;
  request: string;
  history: ChatTurn[];
  settings: Settings;
  signal?: AbortSignal;
  onText?: (t: string) => void;
}): Promise<EditResult> {
  const { episode, sceneIndex, request, history, settings, signal, onText } = opts;
  const voices = await voicesFor(settings.ttsModel);
  const context =
    sceneIndex !== null
      ? {
          editing: `scene ${sceneIndex + 1} of ${episode.scenes.length}`,
          title: episode.title,
          otherScenes: episode.scenes.map((s, i) => `${i + 1}. ${s.title}`),
          cast: castForPrompt(episode.cast),
          scene: episode.scenes[sceneIndex],
        }
      : { editing: 'the whole episode', title: episode.title, cast: castForPrompt(episode.cast), scenes: episode.scenes };
  const messages: ChatMessage[] = [
    { role: 'system', content: `${editSystem()}\n\nVOICES\n${voiceReference(voices)}` },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.text })),
    { role: 'user', content: `CURRENT EPISODE DATA:\n${JSON.stringify(context)}\n\nREQUEST: ${request}` },
  ];
  const out = await chatJson({ apiKey: settings.apiKey, model: settings.llmModel, messages, maxTokens: 64000, signal, onText });
  return applyEdit(episode, sceneIndex, out);
}

/** Redesign one character from a description ("make him older, give him a cowboy hat"). */
export async function redesignCharacter(member: CastMember, request: string, settings: Settings, signal?: AbortSignal): Promise<CastMember> {
  const voices = await voicesFor(settings.ttsModel);
  const out = await chatJson({
    apiKey: settings.apiKey,
    model: settings.llmModel,
    signal,
    maxTokens: 6000,
    messages: [
      { role: 'system', content: castSystem(voices) },
      {
        role: 'user',
        content: `Redesign this one character. Keep their name. Return {"cast": [ one entry ]}.\nCURRENT: ${JSON.stringify(castForPrompt([member])[0])}\nREQUEST: ${request}`,
      },
    ],
  });
  const entry = isObj(out) && Array.isArray(out.cast) && isObj(out.cast[0]) ? out.cast[0] : {};
  return {
    ...member,
    bio: typeof entry.bio === 'string' && entry.bio.trim() ? entry.bio.trim() : member.bio,
    look: { ...normalizeLook(entry.look, member.look), name: member.name },
    voice: normalizeVoice(isObj(entry.voice) ? { ...member.voice, ...entry.voice } : undefined, member.voice),
  };
}
