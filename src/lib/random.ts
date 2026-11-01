import type { CategoryId, CharacterState } from '../types';
import { CATEGORIES } from '../data/catalog';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../data/palette';
import { FIRST_NAMES, LAST_NAMES } from '../data/humor';
import { DEFAULT_CHARACTER } from '../data/defaults';
import { applyItem } from './apply';

export const pick = <T,>(list: readonly T[], rnd = Math.random): T => list[Math.floor(rnd() * list.length)];
const chance = (p: number, rnd = Math.random) => rnd() < p;

export function randomName(rnd = Math.random): string {
  return `${pick(FIRST_NAMES, rnd)} ${pick(LAST_NAMES, rnd)}`;
}

/** Natural-ish skin tones are far more likely than the silly ones. */
function randomSkin(rnd: () => number): string {
  const natural = SKIN_TONES.slice(0, 10);
  return chance(0.92, rnd) ? pick(natural, rnd).color : pick(SKIN_TONES.slice(10), rnd).color;
}

function randomHairColor(rnd: () => number): string {
  const natural = HAIR_COLORS.slice(0, 10);
  return chance(0.85, rnd) ? pick(natural, rnd).color : pick(HAIR_COLORS.slice(10), rnd).color;
}

function itemIds(cat: CategoryId): string[] {
  return CATEGORIES[cat].items.map((i) => i.id);
}

function randomItem(cat: CategoryId, rnd: () => number, noneChance = 0): string {
  const ids = itemIds(cat);
  if (ids[0] === 'none' && chance(noneChance, rnd)) return 'none';
  const rest = ids[0] === 'none' ? ids.slice(1) : ids;
  return pick(rest, rnd);
}

/** Randomise one category, keeping everything else. */
export function randomizeCategory(c: CharacterState, cat: CategoryId, rnd = Math.random): CharacterState {
  const def = CATEGORIES[cat];
  if (cat === 'skin') return { ...c, skin: randomSkin(rnd) };
  if (cat === 'hairColor') return { ...c, hairColor: randomHairColor(rnd) };
  let next = applyItem(c, cat, pick(def.items, rnd).id);
  if (def.colorField && def.palette && chance(0.6, rnd)) next = { ...next, [def.colorField]: pick(def.palette, rnd) };
  return next;
}

export function randomCharacter(rnd = Math.random, keepName = false, base: CharacterState = DEFAULT_CHARACTER): CharacterState {
  const body = pick(['kid', 'kid', 'kid', 'husky', 'skinny', 'adult', 'dadbod', 'lanky', 'buff'], rnd);
  const adult = body === 'adult' || body === 'dadbod' || body === 'lanky' || body === 'buff';
  let c: CharacterState = {
    ...DEFAULT_CHARACTER,
    name: keepName ? base.name : randomName(rnd),
    signText: base.signText,
    photoFace: base.photoFace,
    usePhotoFace: false,
    body,
    headShape: chance(0.75, rnd) ? 'round' : pick(['wide', 'egg', 'square', 'canadian'], rnd),
    skin: randomSkin(rnd),
    hairColor: randomHairColor(rnd),
  };
  c = applyItem(c, 'eyes', chance(0.5, rnd) ? 'classic' : randomItem('eyes', rnd));
  c = applyItem(c, 'mouth', chance(0.3, rnd) ? 'smile' : randomItem('mouth', rnd));
  c = applyItem(c, 'brows', randomItem('brows', rnd, 0.45));
  c = applyItem(c, 'nose', adult ? pick(['adult', 'button', 'none'], rnd) : randomItem('nose', rnd, 0.75));
  c = applyItem(c, 'faceDetail', randomItem('faceDetail', rnd, 0.65));
  c = applyItem(c, 'facialHair', adult ? randomItem('facialHair', rnd, 0.45) : randomItem('facialHair', rnd, 0.95));
  c = applyItem(c, 'hair', randomItem('hair', rnd));
  c = applyItem(c, 'top', randomItem('top', rnd));
  c = applyItem(c, 'bottom', randomItem('bottom', rnd));
  c = applyItem(c, 'shoes', randomItem('shoes', rnd));
  c = applyItem(c, 'neck', randomItem('neck', rnd, 0.7));
  c = applyItem(c, 'hat', randomItem('hat', rnd, 0.35));
  c = applyItem(c, 'glasses', randomItem('glasses', rnd, 0.75));
  c = applyItem(c, 'faceGear', randomItem('faceGear', rnd, 0.9));
  c = applyItem(c, 'held', randomItem('held', rnd, 0.65));
  c = applyItem(c, 'sidekick', randomItem('sidekick', rnd, 0.75));
  for (const field of ['topColor', 'bottomColor', 'shoesColor', 'neckColor', 'hatColor', 'heldColor'] as const) {
    if (chance(0.55, rnd)) c = { ...c, [field]: pick(CLOTH_COLORS, rnd) };
  }
  return c;
}
