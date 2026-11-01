import type { CharacterState } from '../types';
import type { Beat, Blocking, CastMember, Episode, Move, Scene, SetSpec, Shot, VoiceSpec } from './types';
import { ACTION_IDS, EFFECT_IDS, GESTURE_IDS, MOOD_IDS, SFX_IDS, SHOT_IDS, WEATHER_IDS } from './catalog';
import { CATEGORIES } from '../data/catalog';
import { DEFAULT_CHARACTER, normalizeCharacter } from '../data/defaults';
import { applyItem } from '../lib/apply';
import { randomCharacter } from '../lib/random';
import { seeded } from '../character/parts/common';
import { SCENES } from '../scenes/backgrounds';
import { normalizeKitSet } from '../sets/kit';
import { CLOTH_COLORS } from '../data/palette';
import type { CategoryId } from '../types';

/*
 * LLM output is treated as a suggestion: every field is checked against the vocabulary,
 * clamped into the scene and given a default, so a sloppy answer still plays.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 2000): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => {
  if (typeof v !== 'string') return undefined;
  const lower = v.trim().toLowerCase();
  return list.find((x) => x.toLowerCase() === lower);
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const HEX = /^#[0-9a-f]{6}$/i;

export function newId(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'someone'
  );
}

function hashString(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

const ADULT_HINT = /\b(mr|mrs|ms|miss|dr|officer|chef|principal|teacher|mom|mother|dad|father|mayor|sheriff|uncle|aunt|grandpa|grandma|coach|captain|president|reporter|anchor|doctor|nurse|cop|manager|boss|priest|father|sir|lady|man|woman|guy|clerk|cashier|waiter|judge|senator)\b/i;

export function looksAdult(name: string, bio = ''): boolean {
  return ADULT_HINT.test(name) || /\b(adult|grown|parent|teacher|man|woman|old|elderly|middle-aged)\b/i.test(bio);
}

/* Wardrobes for stand-in characters: what people in a snowy small town actually wear. */
const KID_WARDROBE = {
  body: ['kid', 'kid', 'kid', 'husky', 'skinny'],
  hat: ['pom', 'trapper', 'beanie', 'beanie', 'pom', 'cap', 'backcap', 'hood', 'none', 'none', 'headband'],
  top: ['coat', 'puffy', 'puffy', 'hoodie', 'sweater', 'varsity', 'jersey', 'stripes', 'coat'],
  bottom: ['pants', 'jeans', 'cargo', 'track', 'pants'],
  shoes: ['plain', 'plain', 'sneakers', 'boots', 'hightops'],
  hair: ['messy', 'spiky', 'sidepart', 'curly', 'long', 'wavy', 'pigtails', 'ponytail', 'bob', 'buzz', 'afro', 'bowl', 'braids', 'emo', 'pixie'],
  neck: ['none', 'none', 'none', 'scarf'],
};
const ADULT_WARDROBE = {
  body: ['adult', 'adult', 'dadbod', 'lanky', 'buff'],
  hat: ['none', 'none', 'none', 'none', 'cap', 'police', 'beret', 'hardhat', 'cowboy', 'trapper'],
  top: ['suit', 'sweater', 'dressshirt', 'polo', 'flannel', 'cardigan', 'turtleneck', 'coat', 'labcoat', 'leather'],
  bottom: ['pants', 'jeans', 'plaid', 'pants', 'cargo'],
  shoes: ['plain', 'boots', 'plain', 'dress'],
  hair: ['sidepart', 'combover', 'horseshoe', 'bald', 'buzz', 'curly', 'bob', 'long', 'wavy', 'pompadour', 'mullet', 'flattop', 'beehive', 'ponytail'],
  neck: ['none', 'none', 'tie', 'bowtie', 'scarf', 'none'],
};

/** A character for someone the LLM didn't design (or there's no LLM): random but stable for the name. */
export function stockCharacter(name: string, adult: boolean): CharacterState {
  const rnd = seeded(hashString(name.toLowerCase()));
  const pick = <T,>(l: T[]) => l[Math.floor(rnd() * l.length)];
  const base = randomCharacter(rnd);
  const w = adult ? ADULT_WARDROBE : KID_WARDROBE;
  let c: CharacterState = { ...DEFAULT_CHARACTER, name, skin: base.skin, hairColor: base.hairColor, signText: base.signText };
  c = applyItem(c, 'body', pick(w.body));
  for (const cat of ['hat', 'top', 'bottom', 'shoes', 'hair', 'neck'] as const) c = applyItem(c, cat, pick(w[cat]));
  c = applyItem(c, 'mouth', pick(['smile', 'smile', 'flat']));
  c = applyItem(c, 'brows', adult ? pick(['thin', 'none', 'thin']) : pick(['none', 'none', 'thin']));
  if (adult) {
    c = applyItem(c, 'nose', pick(['adult', 'adult', 'button']));
    if (rnd() < 0.4) c = applyItem(c, 'facialHair', pick(CATEGORIES.facialHair.items.slice(1)).id);
  }
  // Clothes in the town's paper colours, all different from each other.
  for (const field of ['topColor', 'bottomColor', 'hatColor', 'neckColor'] as const) if (rnd() < 0.7) c = { ...c, [field]: pick(CLOTH_COLORS) };
  return c;
}

/* ---------------------------------------------------------------- characters */

const LOOK_FIELDS: [keyof CharacterState, CategoryId][] = [
  ['body', 'body'],
  ['headShape', 'headShape'],
  ['eyes', 'eyes'],
  ['brows', 'brows'],
  ['mouth', 'mouth'],
  ['nose', 'nose'],
  ['faceDetail', 'faceDetail'],
  ['facialHair', 'facialHair'],
  ['hair', 'hair'],
  ['top', 'top'],
  ['bottom', 'bottom'],
  ['shoes', 'shoes'],
  ['neck', 'neck'],
  ['hat', 'hat'],
  ['glasses', 'glasses'],
  ['faceGear', 'faceGear'],
  ['held', 'held'],
  ['sidekick', 'sidekick'],
];
const COLOR_FIELDS: (keyof CharacterState)[] = ['skin', 'hairColor', 'topColor', 'bottomColor', 'shoesColor', 'neckColor', 'hatColor', 'glassesColor', 'heldColor'];

/** Merge an LLM-designed look onto a base, keeping only real catalog ids and hex colours. */
export function normalizeLook(input: unknown, base: CharacterState): CharacterState {
  if (!isObj(input)) return base;
  let c: CharacterState = { ...base };
  for (const [field, cat] of LOOK_FIELDS) {
    const v = input[field];
    if (typeof v !== 'string') continue;
    const item = CATEGORIES[cat].items.find((i) => i.id.toLowerCase() === v.trim().toLowerCase());
    if (item) c = applyItem(c, cat, item.id);
  }
  // Colours after items: applyItem sets an item's default colour.
  for (const field of COLOR_FIELDS) {
    const v = input[field];
    if (typeof v === 'string' && HEX.test(v.trim())) (c as unknown as Record<string, string>)[field] = v.trim().toLowerCase();
  }
  const sign = str(input.signText, 40);
  if (sign) c.signText = sign;
  const name = str(input.name, 60);
  if (name) c.name = name;
  return normalizeCharacter(c);
}

export const DEFAULT_KID_VOICE: VoiceSpec = { voice: 'Puck', pitch: 4, tempo: 1, style: 'an excitable nine-year-old kid' };
export const DEFAULT_ADULT_VOICE: VoiceSpec = { voice: 'Charon', pitch: 0, tempo: 1, style: 'a small-town grown-up' };

export function normalizeVoice(input: unknown, fallback: VoiceSpec): VoiceSpec {
  if (!isObj(input)) return fallback;
  return {
    voice: str(input.voice, 80) ?? fallback.voice,
    pitch: clamp(num(input.pitch) ?? fallback.pitch, -12, 12),
    tempo: clamp(num(input.tempo) ?? fallback.tempo, 0.5, 2),
    style: str(input.style, 300) ?? fallback.style,
  };
}

export function isKidBody(body: string): boolean {
  return body === 'kid' || body === 'husky' || body === 'skinny';
}

export function normalizeCastMember(input: unknown, taken: Set<string>): CastMember | null {
  if (!isObj(input)) return null;
  const name = str(input.name, 60);
  if (!name) return null;
  let id = slugify(str(input.id, 60) ?? name);
  while (taken.has(id)) id += '-2';
  taken.add(id);
  const bio = str(input.bio, 400) ?? '';
  const adult = isObj(input.look) && typeof input.look.body === 'string' ? !isKidBody(input.look.body) : looksAdult(name, bio);
  const look = normalizeLook(input.look, stockCharacter(name, adult));
  const kid = isKidBody(look.body);
  const aliases = Array.isArray(input.aliases) ? input.aliases.map((a) => str(a, 60)).filter((a): a is string => !!a).slice(0, 8) : [];
  return {
    id,
    name,
    aliases,
    bio,
    look: { ...look, name },
    voice: normalizeVoice(input.voice, kid ? DEFAULT_KID_VOICE : DEFAULT_ADULT_VOICE),
  };
}

/** Find a cast member by id, name or alias, forgivingly ("STAN", "Stan Marsh", "stan-marsh"). */
export function resolveCast(cast: CastMember[], ref: unknown): string | undefined {
  if (typeof ref !== 'string' || !ref.trim()) return undefined;
  const r = ref.trim().toLowerCase();
  const slug = slugify(ref);
  const exact = cast.find((c) => c.id === r || c.id === slug || c.name.toLowerCase() === r || c.aliases.some((a) => a.toLowerCase() === r));
  if (exact) return exact.id;
  // First-name match: "Garrison" for "Mr. Garrison", "Stan" for "Stan Marsh".
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const refWords = words(ref);
  const loose = cast.find((c) => [c.name, ...c.aliases].some((n) => words(n).some((w) => refWords.includes(w))));
  return loose?.id;
}

/* ---------------------------------------------------------------- scenes */

export function normalizeSet(input: unknown): SetSpec {
  if (isObj(input)) {
    const preset = oneOf(input.preset, SCENES.map((s) => s.id));
    if (input.kind === 'preset' || (preset && input.kind !== 'kit')) {
      return { kind: 'preset', preset: preset ?? 'busstop', townName: str(input.townName, 40) };
    }
    if (input.kind === 'kit' || Array.isArray(input.pieces)) return normalizeKitSet(input);
  }
  return { kind: 'preset', preset: 'busstop' };
}

function normalizeShot(input: unknown, cast: CastMember[]): Shot | undefined {
  if (typeof input === 'string') {
    const type = oneOf(input, SHOT_IDS);
    return type ? { type } : undefined;
  }
  if (!isObj(input)) return undefined;
  const type = oneOf(input.type, SHOT_IDS);
  if (!type) return undefined;
  const on = Array.isArray(input.on) ? input.on.map((x) => resolveCast(cast, x)).filter((x): x is string => !!x) : undefined;
  return { type, ...(on?.length ? { on } : {}), ...(input.push === true ? { push: true } : {}) };
}

function normalizeMove(input: unknown, cast: CastMember[], fallbackWho?: string): Move | null {
  if (!isObj(input)) return null;
  const who = resolveCast(cast, input.who) ?? fallbackWho;
  const kind = oneOf(input.kind, ['walk', 'enter', 'exit', 'appear', 'vanish'] as const);
  if (!who || !kind) return null;
  const x = num(input.x);
  const side = oneOf(input.side, ['left', 'right'] as const);
  return { who, kind, ...(x !== undefined ? { x: clamp(x, 140, 1460) } : {}), ...(side ? { side } : {}) };
}

export function normalizeBeat(input: unknown, cast: CastMember[]): Beat | null {
  if (!isObj(input)) return null;
  const who = resolveCast(cast, input.who);
  const text = str(input.text, 1200);
  const beat: Beat = { id: str(input.id, 40) ?? newId('b') };
  if (who) beat.who = who;
  if (text) beat.text = text;
  const delivery = str(input.delivery, 160);
  if (delivery) beat.delivery = delivery;
  const mood = oneOf(input.mood, MOOD_IDS);
  if (mood) beat.mood = mood;
  if (isObj(input.reactions)) {
    const r: NonNullable<Beat['reactions']> = {};
    for (const [k, v] of Object.entries(input.reactions)) {
      const id = resolveCast(cast, k);
      const m = oneOf(v, MOOD_IDS);
      if (id && m && id !== who) r[id] = m;
    }
    if (Object.keys(r).length) beat.reactions = r;
  }
  const gesture = oneOf(input.gesture, GESTURE_IDS);
  if (gesture && gesture !== 'none') beat.gesture = gesture;
  const action = oneOf(input.action, ACTION_IDS);
  if (action) beat.action = action;
  if (Array.isArray(input.moves)) {
    const moves = input.moves.map((m) => normalizeMove(m, cast, who)).filter((m): m is Move => !!m);
    if (moves.length) beat.moves = moves;
  }
  const lookAt = resolveCast(cast, input.lookAt);
  if (lookAt && lookAt !== who) beat.lookAt = lookAt;
  const shot = normalizeShot(input.shot, cast);
  if (shot) beat.shot = shot;
  const sfx = oneOf(input.sfx, SFX_IDS);
  if (sfx) beat.sfx = sfx;
  const effect = oneOf(input.effect, EFFECT_IDS);
  if (effect) beat.effect = effect;
  const caption = str(input.caption, 120);
  if (caption) beat.caption = caption;
  const duration = num(input.duration);
  if (duration !== undefined) beat.duration = clamp(duration, 0.1, 30);
  const pauseAfter = num(input.pauseAfter);
  if (pauseAfter !== undefined) beat.pauseAfter = clamp(pauseAfter, 0, 10);
  // A line needs a speaker; a beat needs to do *something*.
  if (beat.text && !beat.who) return null;
  const doesSomething = beat.text || beat.moves || beat.action || beat.caption || beat.sfx || beat.effect || beat.shot || beat.duration || beat.mood || beat.reactions || beat.gesture;
  return doesSomething ? beat : null;
}

function normalizeBlocking(input: unknown, cast: CastMember[]): Blocking | null {
  if (!isObj(input)) return null;
  const who = resolveCast(cast, input.who);
  if (!who) return null;
  return {
    who,
    x: clamp(num(input.x) ?? 800, 140, 1460),
    depth: clamp(num(input.depth) ?? 0, 0, 1),
    mood: oneOf(input.mood, MOOD_IDS) ?? 'happy',
    ...(input.offstage === true ? { offstage: true } : {}),
    ...(input.flip === true ? { flip: true } : {}),
  };
}

export function normalizeScene(input: unknown, cast: CastMember[], index: number): Scene | null {
  if (!isObj(input)) return null;
  const beats = Array.isArray(input.beats) ? input.beats.map((b) => normalizeBeat(b, cast)).filter((b): b is Beat => !!b) : [];
  const seenBeat = new Set<string>();
  for (const b of beats) {
    if (seenBeat.has(b.id)) b.id = newId('b');
    seenBeat.add(b.id);
  }
  const blocking = Array.isArray(input.blocking) ? input.blocking.map((b) => normalizeBlocking(b, cast)).filter((b): b is Blocking => !!b) : [];
  const dedup = blocking.filter((b, i) => blocking.findIndex((x) => x.who === b.who) === i);
  return {
    id: str(input.id, 40) ?? newId('s'),
    title: str(input.title, 80) ?? `Scene ${index + 1}`,
    description: str(input.description, 600) ?? '',
    set: normalizeSet(input.set),
    weather: oneOf(input.weather, WEATHER_IDS) ?? 'none',
    blocking: dedup,
    beats,
    hold: clamp(num(input.hold) ?? (index === 0 ? 0.6 : 1.2), 0, 8),
    sting: typeof input.sting === 'boolean' ? input.sting : index > 0,
  };
}

/** Build a full episode from LLM output (or anything shaped like one). Unknown cast referenced in beats are added. */
export function normalizeEpisode(input: unknown, script: string, existing?: Partial<Episode>): Episode {
  const o = isObj(input) ? input : {};
  const taken = new Set<string>();
  const cast: CastMember[] = [];
  for (const c of Array.isArray(o.cast) ? o.cast : []) {
    const m = normalizeCastMember(c, taken);
    if (m) cast.push(m);
  }
  // Speakers the LLM forgot to cast still get a character.
  const rawScenes = Array.isArray(o.scenes) ? o.scenes : [];
  for (const s of rawScenes) {
    if (!isObj(s) || !Array.isArray(s.beats)) continue;
    for (const b of s.beats) {
      if (!isObj(b) || typeof b.who !== 'string' || !b.who.trim()) continue;
      if (!resolveCast(cast, b.who)) {
        const m = normalizeCastMember({ name: b.who.trim() }, taken);
        if (m) cast.push(m);
      }
    }
  }
  const scenes = rawScenes.map((s, i) => normalizeScene(s, cast, i)).filter((s): s is Scene => !!s);
  const now = Date.now();
  return {
    id: existing?.id ?? newId('e'),
    title: str(o.title, 100) ?? existing?.title ?? 'Untitled Episode',
    script,
    cast,
    scenes: scenes.length ? scenes : [emptyScene(0)],
    titleCard: typeof o.titleCard === 'boolean' ? o.titleCard : existing?.titleCard ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function emptyScene(index: number): Scene {
  return {
    id: newId('s'),
    title: `Scene ${index + 1}`,
    description: '',
    set: { kind: 'preset', preset: 'busstop' },
    weather: 'none',
    blocking: [],
    beats: [],
    hold: index === 0 ? 0.6 : 1.2,
    sting: index > 0,
  };
}

export { DEFAULT_CHARACTER };
