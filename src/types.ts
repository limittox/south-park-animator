import type { ReactNode } from 'react';

/** Everything needed to draw one character. Kept flat + JSON-friendly so it can be saved and shared. */
export interface CharacterState {
  name: string;
  body: string;
  headShape: string;
  skin: string;
  eyes: string;
  brows: string;
  mouth: string;
  nose: string;
  faceDetail: string;
  facialHair: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  neck: string;
  neckColor: string;
  hat: string;
  hatColor: string;
  glasses: string;
  glassesColor: string;
  faceGear: string;
  held: string;
  heldColor: string;
  sidekick: string;
  signText: string;
  /** Cropped photo of a real face (data URL) used by "photo face" mode. */
  photoFace?: string | null;
  usePhotoFace?: boolean;
}

export type CategoryId =
  | 'body'
  | 'headShape'
  | 'skin'
  | 'eyes'
  | 'brows'
  | 'mouth'
  | 'nose'
  | 'faceDetail'
  | 'facialHair'
  | 'mood'
  | 'hair'
  | 'hairColor'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'neck'
  | 'hat'
  | 'glasses'
  | 'faceGear'
  | 'held'
  | 'sidekick';

export interface BodyGeo {
  cx: number;
  headCx: number;
  headCy: number;
  headRx: number;
  headRy: number;
  torsoTop: number;
  torsoBottom: number;
  shoulder: number;
  hip: number;
  belly: number;
  legTop: number;
  legBottom: number;
  legSep: number;
  legW: number;
  footY: number;
  footRx: number;
  footRy: number;
  footSep: number;
  shoulderY: number;
  handX: number;
  handY: number;
  handR: number;
  armW: number;
  isAdult: boolean;
}

export interface RenderCtx {
  c: CharacterState;
  g: BodyGeo;
  /** The item's own colour (topColor for tops, hatColor for hats, ...). */
  color: string;
  /** Make a document-unique id for clipPaths / gradients. */
  uid: (name: string) => string;
  /** 0 = mouth closed, 1 = mouth open (talking). */
  talk: number;
}

export type Render = (ctx: RenderCtx) => ReactNode;

export interface ItemBase {
  id: string;
  name: string;
  quip: string;
  /** Colour applied when the item is first picked. */
  defaultColor?: string;
  /** False for items whose colours are baked in. */
  colorable?: boolean;
}
