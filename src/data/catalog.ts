import type { BodyGeo, CategoryId, CharacterState, ItemBase } from '../types';
import { BODY_TYPES, HEAD_SHAPE_ITEMS } from '../character/parts/body';
import { BROWS, EYES, FACE_DETAILS, FACIAL_HAIR, MOODS, MOUTHS, NOSES } from '../character/parts/face';
import { HAIR } from '../character/parts/hair';
import { HATS } from '../character/parts/hats';
import { FACE_GEAR, GLASSES } from '../character/parts/glasses';
import { BOTTOMS, chinY, NECKWEAR, SHOES, TOPS } from '../character/parts/clothes';
import { HELD, SIDEKICKS } from '../character/parts/held';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from './palette';

export interface CatalogItem extends ItemBase {
  /** For colour-only categories (skin, hair colour) the item *is* a colour. */
  swatch?: string;
}

type View = 'full' | 'head' | 'face' | 'top' | 'hat' | 'torso' | 'legs' | 'feet' | 'held' | 'side';

type StringField = {
  [K in keyof CharacterState]: CharacterState[K] extends string ? K : never;
}[keyof CharacterState];

export interface CategoryDef {
  id: CategoryId;
  label: string;
  /** Field the selected item id is written to. Moods have none (they set several fields). */
  field?: StringField;
  colorField?: StringField;
  palette?: string[];
  items: CatalogItem[];
  view: View;
  /** Hide things that would block the view of this category's thumbnails. */
  thumb?: Partial<CharacterState>;
  hint: string;
}

export interface GroupDef {
  id: string;
  label: string;
  icon: string;
  cats: CategoryId[];
}

const swatches = (list: { color: string; name: string; quip?: string }[], fallback: string): CatalogItem[] =>
  list.map((s) => ({ id: s.color, name: s.name, quip: s.quip ?? fallback, swatch: s.color }));

const noFaceClutter: Partial<CharacterState> = { hat: 'none', glasses: 'none', faceGear: 'none', usePhotoFace: false };

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  skin: {
    id: 'skin',
    label: 'Skin Tone',
    field: 'skin',
    items: swatches(SKIN_TONES, 'Looking good. Like, really good.'),
    view: 'head',
    thumb: noFaceClutter,
    hint: 'Pick a skin tone. Real ones, silly ones, frostbitten ones.',
  },
  body: { id: 'body', label: 'Body Type', field: 'body', items: BODY_TYPES, view: 'full', hint: 'Kid, grown-up, or somewhere in between.' },
  headShape: { id: 'headShape', label: 'Head Shape', field: 'headShape', items: HEAD_SHAPE_ITEMS, view: 'head', hint: 'Round is classic. Canadian is... special.' },
  eyes: { id: 'eyes', label: 'Eyes', field: 'eyes', items: EYES, view: 'face', thumb: noFaceClutter, hint: 'The windows to the soul. Or at least to the snack cupboard.' },
  brows: { id: 'brows', label: 'Eyebrows', field: 'brows', items: BROWS, view: 'face', thumb: noFaceClutter, hint: 'Brows take your hair colour. Hats may hide them.' },
  mouth: { id: 'mouth', label: 'Mouth', field: 'mouth', items: MOUTHS, view: 'face', thumb: noFaceClutter, hint: 'Where the swears come out.' },
  mood: { id: 'mood', label: 'Moods', items: MOODS, view: 'face', thumb: noFaceClutter, hint: 'One-click eyes + brows + mouth combos.' },
  nose: { id: 'nose', label: 'Nose', field: 'nose', items: NOSES, view: 'face', thumb: noFaceClutter, hint: 'Most kids around here skip the nose. Your call.' },
  faceDetail: { id: 'faceDetail', label: 'Face Details', field: 'faceDetail', items: FACE_DETAILS, view: 'head', thumb: noFaceClutter, hint: 'Freckles, scars, war paint and other life choices.' },
  facialHair: {
    id: 'facialHair',
    label: 'Facial Hair',
    field: 'facialHair',
    items: FACIAL_HAIR,
    view: 'head',
    thumb: { hat: 'none', faceGear: 'none', usePhotoFace: false },
    hint: 'Uses your hair colour. Works on kids too. We will not judge.',
  },
  hair: { id: 'hair', label: 'Hairstyle', field: 'hair', items: HAIR, view: 'top', thumb: { hat: 'none' }, hint: 'Take your hat off to see the full glory.' },
  hairColor: {
    id: 'hairColor',
    label: 'Hair Colour',
    field: 'hairColor',
    items: swatches(HAIR_COLORS, 'A fine choice. Your stylist approves. Your mom does not.'),
    view: 'top',
    thumb: { hat: 'none' },
    hint: 'Also colours eyebrows and facial hair.',
  },
  top: {
    id: 'top',
    label: 'Tops',
    field: 'top',
    colorField: 'topColor',
    palette: CLOTH_COLORS,
    items: TOPS,
    view: 'torso',
    thumb: { held: 'none' },
    hint: 'Pick a top, then dye it any colour.',
  },
  bottom: {
    id: 'bottom',
    label: 'Bottoms',
    field: 'bottom',
    colorField: 'bottomColor',
    palette: CLOTH_COLORS,
    items: BOTTOMS,
    view: 'legs',
    thumb: { held: 'none', sidekick: 'none' },
    hint: 'Leg tubes, skirts and the occasional diaper.',
  },
  shoes: {
    id: 'shoes',
    label: 'Shoes',
    field: 'shoes',
    colorField: 'shoesColor',
    palette: CLOTH_COLORS,
    items: SHOES,
    view: 'feet',
    thumb: { held: 'none', sidekick: 'none' },
    hint: 'Feet: covered. Mostly.',
  },
  neck: {
    id: 'neck',
    label: 'Neckwear',
    field: 'neck',
    colorField: 'neckColor',
    palette: CLOTH_COLORS,
    items: NECKWEAR,
    view: 'torso',
    thumb: { held: 'none' },
    hint: 'Scarves, ties, capes and bling.',
  },
  hat: {
    id: 'hat',
    label: 'Hats',
    field: 'hat',
    colorField: 'hatColor',
    palette: CLOTH_COLORS,
    items: HATS,
    view: 'hat',
    hint: 'The most important decision you will make today.',
  },
  glasses: {
    id: 'glasses',
    label: 'Glasses',
    field: 'glasses',
    colorField: 'glassesColor',
    palette: CLOTH_COLORS,
    items: GLASSES,
    view: 'face',
    thumb: { hat: 'none', faceGear: 'none' },
    hint: 'See better. Or look like you do.',
  },
  faceGear: { id: 'faceGear', label: 'Face Gear', field: 'faceGear', items: FACE_GEAR, view: 'head', thumb: { hat: 'none' }, hint: 'Masks, patches, gum and other things on your face.' },
  held: {
    id: 'held',
    label: 'Hand Item',
    field: 'held',
    colorField: 'heldColor',
    palette: CLOTH_COLORS,
    items: HELD,
    view: 'held',
    hint: 'Something to hold. The protest sign takes custom text!',
  },
  sidekick: {
    id: 'sidekick',
    label: 'Sidekick',
    field: 'sidekick',
    colorField: 'heldColor',
    palette: CLOTH_COLORS,
    items: SIDEKICKS,
    view: 'side',
    hint: 'A loyal companion. Shares a colour with your hand item.',
  },
};

export const GROUPS: GroupDef[] = [
  { id: 'body', label: 'Body', icon: '🧍', cats: ['skin', 'body', 'headShape'] },
  { id: 'face', label: 'Face', icon: '😬', cats: ['eyes', 'mouth', 'mood', 'brows', 'nose', 'faceDetail', 'facialHair'] },
  { id: 'hair', label: 'Hair', icon: '💇', cats: ['hair', 'hairColor'] },
  { id: 'clothes', label: 'Clothes', icon: '👕', cats: ['top', 'bottom', 'shoes', 'neck'] },
  { id: 'hats', label: 'Hats', icon: '🧢', cats: ['hat'] },
  { id: 'extras', label: 'Extras', icon: '🕶️', cats: ['glasses', 'faceGear', 'held', 'sidekick'] },
];

export function groupOf(cat: CategoryId): GroupDef {
  return GROUPS.find((g) => g.cats.includes(cat)) ?? GROUPS[0];
}

export function findItem(cat: CategoryId, id: string): CatalogItem | undefined {
  return CATEGORIES[cat].items.find((i) => i.id === id);
}

/** Square viewBox that frames the part of the body a category is about. */
export function thumbViewBox(view: View, g: BodyGeo): string {
  const sq = (cx: number, cy: number, size: number) => `${cx - size / 2} ${cy - size / 2} ${size} ${size}`;
  switch (view) {
    case 'head':
      return sq(g.headCx, g.headCy + g.headRy * 0.05, Math.max(g.headRx, g.headRy) * 2.5);
    case 'face':
      return sq(g.headCx, g.headCy + g.headRy * 0.1, g.headRx * 1.7);
    case 'top':
      return sq(g.headCx, g.headCy - g.headRy * 0.45, g.headRx * 3.1);
    case 'hat':
      return sq(g.headCx, g.headCy - g.headRy * 0.72, g.headRx * 3.6);
    case 'torso': {
      const ch = chinY(g);
      return sq(g.cx, ch + (g.torsoBottom - ch) * 0.42, (g.hip + 70) * 2);
    }
    case 'legs':
      return sq(g.cx, g.legTop + (480 - g.legTop) * 0.45, Math.max(200, (g.hip + 34) * 2));
    case 'feet':
      return sq(g.cx, g.footY - 18, (g.footSep + g.footRx) * 2 + 80);
    case 'held':
      return sq(g.cx + g.handX * 0.45, g.handY - 120, 400);
    case 'side':
      return sq(g.cx - 186, 420, 190);
    default:
      return '-40 -60 480 560';
  }
}

/** Ordered list of every category for keyboard cycling and random picks. */
export const ALL_CATS: CategoryId[] = GROUPS.flatMap((g) => g.cats);
