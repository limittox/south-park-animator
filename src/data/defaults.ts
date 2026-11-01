import type { CharacterState } from '../types';

export const DEFAULT_CHARACTER: CharacterState = {
  name: 'New Kid',
  body: 'kid',
  headShape: 'round',
  skin: '#fcd9b8',
  eyes: 'classic',
  brows: 'none',
  mouth: 'smile',
  nose: 'none',
  faceDetail: 'none',
  facialHair: 'none',
  hair: 'messy',
  hairColor: '#3d2314',
  top: 'coat',
  topColor: '#d33b2c',
  bottom: 'pants',
  bottomColor: '#3b6fd8',
  shoes: 'plain',
  shoesColor: '#1f1f22',
  neck: 'none',
  neckColor: '#d33b2c',
  hat: 'pom',
  hatColor: '#3b6fd8',
  glasses: 'none',
  glassesColor: '#1f1f22',
  faceGear: 'none',
  held: 'none',
  heldColor: '#d33b2c',
  sidekick: 'none',
  signText: 'WE WANT RECESS',
  photoFace: null,
  usePhotoFace: false,
};

/** Fill in anything missing (old saves, hand-edited share links). */
export function normalizeCharacter(input: Partial<CharacterState> | null | undefined): CharacterState {
  const out: CharacterState = { ...DEFAULT_CHARACTER };
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(DEFAULT_CHARACTER) as (keyof CharacterState)[]) {
    const v = input[key];
    if (v === undefined || v === null) continue;
    const expected = typeof DEFAULT_CHARACTER[key];
    if (key === 'photoFace') {
      if (typeof v === 'string' && v.startsWith('data:image/')) out.photoFace = v;
      continue;
    }
    if (expected === 'string' && typeof v === 'string') (out as unknown as Record<string, unknown>)[key] = v.slice(0, 200);
    else if (expected === 'boolean' && typeof v === 'boolean') (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}
