import type { CategoryId, CharacterState } from '../types';
import { CATEGORIES, findItem } from '../data/catalog';
import { MOODS } from '../character/parts/face';

/**
 * Put an item on the character. Items come in their own default colour unless
 * the player has already dyed the slot something else.
 */
export function applyItem(c: CharacterState, cat: CategoryId, id: string): CharacterState {
  if (cat === 'mood') {
    const mood = MOODS.find((m) => m.id === id);
    return mood ? { ...c, ...mood.set } : c;
  }
  const def = CATEGORIES[cat];
  if (!def.field) return c;
  const next: CharacterState = { ...c, [def.field]: id };
  if (def.colorField) {
    const prev = findItem(cat, c[def.field]);
    const item = findItem(cat, id);
    const cur = String(c[def.colorField]).toLowerCase();
    const prevDefault = prev?.defaultColor?.toLowerCase();
    if (item?.defaultColor && (!prevDefault || cur === prevDefault)) {
      (next as unknown as Record<string, string>)[def.colorField] = item.defaultColor;
    }
  }
  return next;
}

export function isSelected(c: CharacterState, cat: CategoryId, id: string): boolean {
  if (cat === 'mood') {
    const mood = MOODS.find((m) => m.id === id);
    return !!mood && c.eyes === mood.set.eyes && c.brows === mood.set.brows && c.mouth === mood.set.mouth;
  }
  const field = CATEGORIES[cat].field;
  return !!field && String(c[field]).toLowerCase() === id.toLowerCase();
}

export function currentItemName(c: CharacterState, cat: CategoryId): string {
  const field = CATEGORIES[cat].field;
  if (!field) return '';
  return findItem(cat, String(c[field]))?.name ?? '';
}
