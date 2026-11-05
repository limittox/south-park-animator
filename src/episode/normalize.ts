import type { CharacterState } from '../types';
import type { Beat, Blocking, CastMember, Crowd, Episode, Facing, Move, Scene, SetSpec, Shot, Vehicle, VehicleType, VoiceSpec } from './types';
import { ACTION_IDS, BURST_IDS, CROWD_IDS, EFFECT_IDS, GESTURE_IDS, MOOD_IDS, SFX_IDS, SHOT_IDS, TRANSITION_IDS, WEATHER_IDS } from './catalog';
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

const HONORIFIC = /^(mr|mister|mrs|ms|miss|dr)$/;
/** A family word closing a name means someone else: "Butters Dad" isn't Butters, though "Uncle Jimbo" is Jimbo. So does a possessive: "Stan's Lawyer". */
const RELATIVE = /^(mom|mum|mommy|mama|mother|dad|daddy|papa|father|parents|brother|sister|son|daughter|wife|husband|uncle|aunt|auntie|grandma|granny|grandmother|grandpa|grandfather|cousin|nephew|niece|girlfriend|boyfriend)$/;
const POSSESSIVE = /['’]s?\s/;

const honorificOf = (name: string) => name.toLowerCase().split(/[^a-z0-9]+/).find((w) => HONORIFIC.test(w));
/** The words that say who someone is. Stray letters go (the "s" of "Stan's"); numbers stay ("Cop 2"). */
const nameWords = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => (w.length > 1 || /\d/.test(w)) && w !== 'the' && !HONORIFIC.test(w));

/**
 * Could two spellings be one person? One has to be the other with words left out: "Garrison" and
 * "Mr. Garrison", "Stan" and "Stan Marsh", but not "Mr. Kim" and "Mr. Garrison", or "Mr. Tucker" and "Mrs. Tucker".
 */
function sameName(a: string, b: string): boolean {
  const [ha, hb] = [honorificOf(a), honorificOf(b)];
  if (ha && hb && ha !== hb) return false;
  const [wa, wb] = [nameWords(a), nameWords(b)];
  const [short, long, longName] = wa.length < wb.length ? [wa, wb, b] : [wb, wa, a];
  if (!short.length || !short.every((w) => long.includes(w))) return false;
  const last = long[long.length - 1];
  return short.includes(last) || !(RELATIVE.test(last) || POSSESSIVE.test(longName));
}

/** Find a cast member by id, name or alias, forgivingly ("STAN", "Stan Marsh", "stan-marsh"). */
export function resolveCast(cast: CastMember[], ref: unknown): string | undefined {
  if (typeof ref !== 'string' || !ref.trim()) return undefined;
  const r = ref.trim().toLowerCase();
  const slug = slugify(ref);
  const exact = cast.find((c) => c.id === r || c.id === slug || c.name.toLowerCase() === r || c.aliases.some((a) => a.toLowerCase() === r));
  if (exact) return exact.id;
  return cast.find((c) => [c.name, ...c.aliases].some((n) => sameName(n, ref)))?.id;
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
  return {
    type,
    ...(on?.length ? { on } : {}),
    ...(input.push === true ? { push: true } : {}),
    ...(input.pan === true ? { pan: true } : {}),
    ...(input.follow === true && type !== 'wide' ? { follow: true } : {}),
  };
}

/** Move kinds as the LLM (or a person) might spell them, mapped to a kind plus "run". */
const MOVE_ALIASES: Record<string, { kind: Move['kind']; run?: boolean; sneak?: boolean }> = {
  walk: { kind: 'walk' },
  move: { kind: 'walk' },
  go: { kind: 'walk' },
  drive: { kind: 'walk' },
  run: { kind: 'walk', run: true },
  sneak: { kind: 'walk', sneak: true },
  tiptoe: { kind: 'walk', sneak: true },
  creep: { kind: 'walk', sneak: true },
  prowl: { kind: 'walk', sneak: true },
  sneakin: { kind: 'enter', sneak: true },
  sneakout: { kind: 'exit', sneak: true },
  sneakoff: { kind: 'exit', sneak: true },
  approach: { kind: 'approach' },
  walkup: { kind: 'approach' },
  walkupto: { kind: 'approach' },
  lie: { kind: 'lie' },
  liedown: { kind: 'lie' },
  lay: { kind: 'lie' },
  laydown: { kind: 'lie' },
  crash: { kind: 'crash' },
  crashinto: { kind: 'crash' },
  crashthrough: { kind: 'crash' },
  smash: { kind: 'crash' },
  joinscreen: { kind: 'joinScreen' },
  join: { kind: 'joinScreen' },
  joincall: { kind: 'joinScreen' },
  leavescreen: { kind: 'leaveScreen' },
  leavecall: { kind: 'leaveScreen' },
  enter: { kind: 'enter' },
  arrive: { kind: 'enter' },
  drivein: { kind: 'enter' },
  pullup: { kind: 'enter' },
  runin: { kind: 'enter', run: true },
  exit: { kind: 'exit' },
  leave: { kind: 'exit' },
  driveoff: { kind: 'exit' },
  driveaway: { kind: 'exit' },
  driveout: { kind: 'exit' },
  runoff: { kind: 'exit', run: true },
  runout: { kind: 'exit', run: true },
  runaway: { kind: 'exit', run: true },
  appear: { kind: 'appear' },
  vanish: { kind: 'vanish' },
  disappear: { kind: 'vanish' },
  sit: { kind: 'sit' },
  sitdown: { kind: 'sit' },
  stand: { kind: 'stand' },
  standup: { kind: 'stand' },
  getup: { kind: 'stand' },
  getin: { kind: 'getIn' },
  getinto: { kind: 'getIn' },
  geton: { kind: 'getIn' },
  board: { kind: 'getIn' },
  getout: { kind: 'getOut' },
  getoff: { kind: 'getOut' },
  alight: { kind: 'getOut' },
};

const VEHICLE_ALIASES: Record<string, VehicleType> = {
  car: 'car',
  sedan: 'car',
  van: 'car',
  truck: 'car',
  taxi: 'car',
  minivan: 'car',
  police: 'police',
  policecar: 'police',
  copcar: 'police',
  cruiser: 'police',
  squadcar: 'police',
  bus: 'bus',
  schoolbus: 'bus',
};
const squash = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');

/** A vehicle id from an id, its type ("the bus") or the only vehicle there is. */
function resolveVehicle(vehicles: Vehicle[], ref: unknown): string | undefined {
  if (typeof ref !== 'string' || !ref.trim()) return vehicles.length === 1 ? vehicles[0].id : undefined;
  const r = ref.trim().toLowerCase();
  const byId = vehicles.find((v) => v.id.toLowerCase() === r || v.id === slugify(ref));
  if (byId) return byId.id;
  const type = VEHICLE_ALIASES[squash(r.replace(/^(the|a|his|her|their)\s+/, ''))];
  return type ? vehicles.find((v) => v.type === type)?.id : undefined;
}

const PROP_ALIASES: Record<string, string> = {
  facemask: 'mask',
  surgicalmask: 'mask',
  paper: 'newspaper',
  nothing: 'none',
  empty: 'none',
  money: 'cash',
  dollars: 'cash',
  bills: 'cash',
  present: 'gift',
  giftbox: 'gift',
  envelope: 'letter',
  note: 'letter',
  loveletter: 'letter',
  cellphone: 'phone',
  smartphone: 'phone',
  mobile: 'phone',
  tvremote: 'remote',
  remotecontrol: 'remote',
  drink: 'soda',
  cup: 'soda',
  pop: 'soda',
  groceries: 'bag',
  grocerybag: 'bag',
  shoppingbag: 'bag',
  chips: 'snack',
  snacks: 'snack',
  sandwich: 'snack',
  burger: 'hotdog',
  ball: 'football',
  mug: 'coffee',
  rubberchicken: 'chicken',
  toiletpaper: 'tp',
  gamecontroller: 'controller',
  teddybear: 'teddy',
  icecreamcone: 'icecream',
  cone: 'icecream',
  protestsign: 'sign',
  placard: 'sign',
  stick: 'cane',
  bottle: 'beer',
  booze: 'beer',
  pick: 'pickaxe',
  pickax: 'pickaxe',
  qtip: 'swab',
  test: 'swab',
  covidtest: 'swab',
  mic: 'microphone',
  butterflynet: 'net',
};

/** A held-item id from an id, a name ("Fresh Fish") or a common word for it ("money"). */
export function propId(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const s = squash(v.replace(/^(a|an|the|some|his|her|their)\s+/i, ''));
  const items = CATEGORIES.held.items;
  const hit = items.find((i) => i.id === s || squash(i.name) === s) ?? items.find((i) => i.id === PROP_ALIASES[s]);
  return hit?.id ?? items.find((i) => i.id === s.replace(/s$/, '') || i.id === s.replace(/es$/, ''))?.id;
}

const FORM_ALIASES: Record<string, string> = { chicken: 'hen', bird: 'hen', rooster: 'hen', toad: 'frog', mouse: 'hamster', rat: 'hamster', puppy: 'dog', kitten: 'cat' };

/** A creature someone can turn into: a sidekick id, name or everyday word for it. */
export function formId(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const s = squash(v);
  const items = CATEGORIES.sidekick.items.filter((i) => i.id !== 'none');
  return (items.find((i) => i.id === s || squash(i.name) === s) ?? items.find((i) => i.id === FORM_ALIASES[s]))?.id;
}

function normalizeMove(input: unknown, cast: CastMember[], vehicles: Vehicle[], fallbackWho?: string): Move | null {
  if (!isObj(input)) return null;
  // Vehicles first: loose name matching would turn "the bus" into "Bus Driver".
  const vehicle = typeof input.who === 'string' && input.who.trim() ? resolveVehicle(vehicles, input.who) : undefined;
  const who = vehicle ?? resolveCast(cast, input.who) ?? fallbackWho;
  const alias = typeof input.kind === 'string' ? MOVE_ALIASES[squash(input.kind)] : undefined;
  if (!who || !alias) return null;
  // Vehicles only drive.
  if (vehicle ? !['walk', 'enter', 'exit', 'appear', 'vanish', 'crash'].includes(alias.kind) : alias.kind === 'crash') return null;
  const x = num(input.x);
  // Walking to a person, not a spot, is walking up to them.
  const target = !vehicle && (alias.kind === 'walk' || alias.kind === 'approach') ? resolveCast(cast, input.on ?? input.to) : undefined;
  const kind: Move['kind'] = target && x === undefined ? 'approach' : alias.kind;
  if (kind === 'approach' && (!target || target === who)) return null;
  // Only people can walk away from the camera, and only on the way out.
  const side = oneOf(input.side, kind === 'exit' && !vehicle ? (['left', 'right', 'back'] as const) : (['left', 'right'] as const));
  const pace = String(input.speed ?? input.pace ?? '');
  const run = !vehicle && (alias.run || input.run === true || /^run/i.test(pace));
  const sneak = !vehicle && !run && (alias.sneak || input.sneak === true || /^(sneak|creep|tiptoe)/i.test(pace));
  const move: Move = { who, kind, ...(x !== undefined ? { x: clamp(x, vehicle ? 0 : 140, vehicle ? 1600 : 1460) } : {}), ...(side ? { side } : {}), ...(run ? { run: true } : {}), ...(sneak ? { sneak: true } : {}) };
  if (kind === 'getIn') {
    const v = resolveVehicle(vehicles, input.on ?? input.vehicle ?? input.into);
    if (!v) return null;
    move.on = v;
  } else if (kind === 'approach') {
    move.on = target;
  } else if (kind === 'crash') {
    if (input.on === 'wall' || input.through === true) move.on = 'wall';
  } else if (kind === 'sit' || kind === 'lie') {
    const on = str(input.on ?? input.seat, 40);
    if (on) move.on = on;
  }
  return move;
}

function normalizeVehicle(input: unknown, taken: Set<string>): Vehicle | null {
  if (!isObj(input)) return null;
  const type = typeof input.type === 'string' ? VEHICLE_ALIASES[squash(input.type)] : undefined;
  if (!type) return null;
  let id = slugify(str(input.id, 40) ?? type);
  while (taken.has(id)) id += '-2';
  taken.add(id);
  const color = str(input.color, 7);
  const lane = oneOf(input.lane, ['back', 'front'] as const);
  return {
    id,
    type,
    x: clamp(num(input.x) ?? 800, 0, 1600),
    ...(color && HEX.test(color) ? { color: color.toLowerCase() } : {}),
    ...(input.offstage === true ? { offstage: true } : {}),
    ...(input.flip === true ? { flip: true } : {}),
    ...(lane === 'front' ? { lane } : {}),
  };
}

const FACE_ALIASES: Record<string, Facing> = { front: 'front', forward: 'front', camera: 'front', audience: 'front', away: 'away', back: 'away', behind: 'away', backward: 'away', backwards: 'away', left: 'left', right: 'right' };

/** "away", "the camera", or someone to turn toward, but not yourself. */
function faceId(input: unknown, cast: CastMember[], who: string | undefined): string | undefined {
  if (typeof input !== 'string') return undefined;
  const word = FACE_ALIASES[squash(input.replace(/^\s*the\s+/i, ''))];
  if (word) return word;
  const person = resolveCast(cast, input);
  return person && person !== who ? person : undefined;
}

export function normalizeBeat(input: unknown, cast: CastMember[], vehicles: Vehicle[] = []): Beat | null {
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
  const also = Array.isArray(input.also) ? [...new Set(input.also.map((x) => resolveCast(cast, x)))].filter((x): x is string => !!x && x !== who) : [];
  if (also.length && who) beat.also = also;
  if (Array.isArray(input.moves)) {
    const moves = input.moves.map((m) => normalizeMove(m, cast, vehicles, who)).filter((m): m is Move => !!m);
    if (moves.length) beat.moves = moves;
  }
  const hold = propId(input.hold);
  if (hold && who) beat.hold = hold;
  const give = resolveCast(cast, input.give);
  if (give && who && give !== who) beat.give = give;
  const hug = resolveCast(cast, input.hug);
  if (hug && who && hug !== who) beat.hug = hug;
  const becomes = resolveCast(cast, input.becomes) ?? formId(input.becomes);
  if (becomes && who && becomes !== who) beat.becomes = becomes;
  const reaction = oneOf(input.crowd, CROWD_IDS);
  if (reaction) beat.crowd = reaction;
  const b = typeof input.burst === 'string' ? { kind: input.burst } : input.burst;
  const burst = isObj(b) ? oneOf(b.kind, BURST_IDS) : undefined;
  if (isObj(b) && burst) {
    const at = resolveCast(cast, b.at) ?? resolveVehicle(vehicles, typeof b.at === 'string' ? b.at : '__nothing__');
    const x = num(b.x);
    beat.burst = { kind: burst, ...(at ? { at } : {}), ...(x !== undefined ? { x: clamp(x, 0, 1600) } : {}), ...(b.stay === true ? { stay: true } : {}) };
  }
  const d = typeof input.drift === 'string' ? { item: input.drift } : input.drift;
  const item = isObj(d) ? propId(d.item) : undefined;
  if (isObj(d) && item && item !== 'none') {
    const style = oneOf(d.style, ['blow', 'roll', 'fall'] as const);
    const from = oneOf(d.from, ['left', 'right'] as const);
    const x = num(d.x);
    beat.drift = { item, ...(style ? { style } : {}), ...(from ? { from } : {}), ...(x !== undefined ? { x: clamp(x, 0, 1600) } : {}) };
  }
  const lookAt = resolveCast(cast, input.lookAt);
  if (lookAt && lookAt !== who) beat.lookAt = lookAt;
  const face = faceId(input.face, cast, who);
  if (face) beat.face = face;
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
  const doesSomething =
    beat.text || beat.moves || beat.action || beat.caption || beat.sfx || beat.effect || beat.shot || beat.duration || beat.mood || beat.reactions || beat.gesture || beat.hold || beat.give || beat.hug || beat.lookAt || beat.face || beat.becomes || beat.crowd || beat.burst || beat.drift;
  return doesSomething ? beat : null;
}

function normalizeBlocking(input: unknown, cast: CastMember[], vehicles: Vehicle[]): Blocking | null {
  if (!isObj(input)) return null;
  const who = resolveCast(cast, input.who);
  if (!who) return null;
  const sit = input.sit === true ? 'seat' : str(input.sit ?? input.seat, 40);
  const lie = input.lie === true ? 'floor' : str(input.lie, 40);
  const ride = input.in !== undefined || input.vehicle !== undefined ? resolveVehicle(vehicles, input.in ?? input.vehicle) : undefined;
  const hold = propId(input.hold);
  const face = faceId(input.face, cast, who);
  return {
    who,
    x: clamp(num(input.x) ?? 800, 140, 1460),
    depth: clamp(num(input.depth) ?? 0, 0, 1),
    mood: oneOf(input.mood, MOOD_IDS) ?? 'happy',
    ...(input.offstage === true ? { offstage: true } : {}),
    ...(input.flip === true ? { flip: true } : {}),
    ...(ride ? { in: ride } : sit ? { sit } : lie ? { lie } : {}),
    ...(hold ? { hold } : {}),
    ...(input.screen === true ? { screen: true } : {}),
    ...(face ? { face } : {}),
  };
}

function normalizeCrowd(input: unknown): Crowd | undefined {
  const c = typeof input === 'number' ? { count: input } : input;
  if (!isObj(c)) return undefined;
  const count = Math.round(clamp(num(c.count) ?? 18, 0, 40));
  if (!count) return undefined;
  const mood = oneOf(c.mood, MOOD_IDS);
  return { count, layout: oneOf(c.layout, ['group', 'line'] as const) ?? 'group', ...(c.kids === true ? { kids: true } : {}), ...(mood ? { mood } : {}) };
}

function normalizeSplit(input: unknown, cast: CastMember[]): Scene['split'] {
  if (!isObj(input) || !Array.isArray(input.who)) return undefined;
  const who = [...new Set(input.who.map((x) => resolveCast(cast, x)))].filter((x): x is string => !!x);
  if (!who.length) return undefined;
  const weather = oneOf(input.weather, WEATHER_IDS);
  return { set: normalizeSet(input.set), who, ...(weather ? { weather } : {}) };
}

export function normalizeScene(input: unknown, cast: CastMember[], index: number): Scene | null {
  if (!isObj(input)) return null;
  const takenVehicles = new Set<string>();
  const vehicles = Array.isArray(input.vehicles) ? input.vehicles.map((v) => normalizeVehicle(v, takenVehicles)).filter((v): v is Vehicle => !!v).slice(0, 4) : [];
  const beats = Array.isArray(input.beats) ? input.beats.map((b) => normalizeBeat(b, cast, vehicles)).filter((b): b is Beat => !!b) : [];
  const seenBeat = new Set<string>();
  for (const b of beats) {
    if (seenBeat.has(b.id)) b.id = newId('b');
    seenBeat.add(b.id);
  }
  const blocking = Array.isArray(input.blocking) ? input.blocking.map((b) => normalizeBlocking(b, cast, vehicles)).filter((b): b is Blocking => !!b) : [];
  const dedup = blocking.filter((b, i) => blocking.findIndex((x) => x.who === b.who) === i);
  const transition = oneOf(input.transition, TRANSITION_IDS);
  const crowd = normalizeCrowd(input.crowd);
  const split = normalizeSplit(input.split, cast);
  return {
    id: str(input.id, 40) ?? newId('s'),
    title: str(input.title, 80) ?? `Scene ${index + 1}`,
    description: str(input.description, 600) ?? '',
    set: normalizeSet(input.set),
    weather: oneOf(input.weather, WEATHER_IDS) ?? 'none',
    blocking: dedup,
    beats,
    ...(vehicles.length ? { vehicles } : {}),
    hold: clamp(num(input.hold) ?? (index === 0 ? 0.6 : 1.2), 0, 8),
    sting: typeof input.sting === 'boolean' ? input.sting : index > 0,
    ...(transition && transition !== 'cut' ? { transition } : {}),
    ...(crowd ? { crowd } : {}),
    ...(split ? { split } : {}),
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
