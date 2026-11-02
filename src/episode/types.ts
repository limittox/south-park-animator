import type { CharacterState } from '../types';

/*
 * An episode is plain JSON: the LLM writes it, the editor changes it, the timeline compiler
 * turns it into frames. Scene coordinates are the photo booth's: 1600 × 1000, y down.
 */

export interface Episode {
  id: string;
  title: string;
  /** The script exactly as pasted. */
  script: string;
  cast: CastMember[];
  scenes: Scene[];
  /** Show a title card before the first scene. */
  titleCard: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CastMember {
  /** Stable slug, e.g. "mr-garrison". Beats refer to cast by this id. */
  id: string;
  /** Name as written in the script. */
  name: string;
  /** Other spellings the script uses ("MOM", "Mrs. Tucker"). */
  aliases: string[];
  /** One line about who they are, for the LLM and the cast panel. */
  bio: string;
  look: CharacterState;
  voice: VoiceSpec;
}

export interface VoiceSpec {
  /** Voice id for the speech model (e.g. "Puck" for Gemini TTS). */
  voice: string;
  /** Pitch shift in semitones, applied after synthesis. Kids sit around +4, like the show's sped-up voices. */
  pitch: number;
  /** Speaking speed multiplier, applied after synthesis without changing pitch. */
  tempo: number;
  /** Standing acting direction, e.g. "a whiny, nasal nine-year-old boy". */
  style: string;
}

export type MoodId =
  | 'happy'
  | 'joy'
  | 'angry'
  | 'rage'
  | 'sad'
  | 'shock'
  | 'smug'
  | 'evil'
  | 'sick'
  | 'love'
  | 'deadpan'
  | 'crazy';

export type GestureId =
  | 'none'
  | 'wave'
  | 'point'
  | 'armsUp'
  | 'shrug'
  | 'fists'
  | 'facepalm'
  | 'hipHands'
  | 'flail'
  | 'explain'
  | 'cross'
  | 'thinking'
  | 'grab';

/** One-shot body actions. Entrances and exits are moves, not actions. */
export type ActionId = 'jump' | 'shake' | 'faint' | 'spin' | 'bounce';

export type ShotType = 'wide' | 'medium' | 'close';

export interface Shot {
  type: ShotType;
  /** Cast ids to frame. Empty = everyone on stage (medium) or the speaker (close). */
  on?: string[];
  /** Slow push-in over the beat. */
  push?: boolean;
}

export type MoveKind = 'walk' | 'enter' | 'exit' | 'appear' | 'vanish' | 'sit' | 'stand' | 'getIn' | 'getOut';

export interface Move {
  /** Cast id, or a vehicle id: vehicles drive with walk / enter / exit / appear / vanish. */
  who: string;
  kind: MoveKind;
  /** Target x for walk / enter / appear, the spot to sit near for sit; ignored otherwise. */
  x?: number;
  /** Side of the screen for enter / exit. */
  side?: 'left' | 'right';
  /** Run instead of walk (walk / enter / exit / sit). */
  run?: boolean;
  /** sit: a seat id or type ("couch", "bench", "chair-2"), or "floor". getIn: the vehicle id. */
  on?: string;
}

export type SfxId =
  | 'pop'
  | 'boing'
  | 'crash'
  | 'thud'
  | 'whoosh'
  | 'ding'
  | 'buzzer'
  | 'fart'
  | 'gasp'
  | 'slap'
  | 'explosion'
  | 'sting'
  | 'doorbell'
  | 'cheer';

export type ScreenEffect = 'shake' | 'flash';

export interface Beat {
  id: string;
  /** Cast id of the speaker (lines) or the main subject (actions). */
  who?: string;
  /** Dialogue. A beat with text is a line. */
  text?: string;
  /** Acting direction for this line only ("yelling", "whispering", "sarcastic"). */
  delivery?: string;
  /** Face of `who` from this beat on. */
  mood?: MoodId;
  /** Faces of other cast from this beat on. */
  reactions?: Record<string, MoodId>;
  /** Arm pose of `who` during the beat. */
  gesture?: GestureId;
  /** One-shot body action of `who` at the start of the beat. */
  action?: ActionId;
  /** Movements that start with this beat (can run while someone talks). */
  moves?: Move[];
  /** Prop `who` holds from this beat on (a held item id; "none" puts it away). */
  hold?: string;
  /** Cast id `who` hands their prop to during this beat. */
  give?: string;
  /** Cast id `who` looks at; defaults to the nearest other character. */
  lookAt?: string;
  /** Camera cut at the start of the beat. Leave out to keep the previous shot. */
  shot?: Shot;
  sfx?: SfxId;
  effect?: ScreenEffect;
  /** On-screen text (a sign, a time jump: "Three hours later..."). */
  caption?: string;
  /** Seconds. Lines are timed by their audio; this is for silent beats. */
  duration?: number;
  /** Extra silence after the beat, in seconds. */
  pauseAfter?: number;
}

/** Where a character stands when the scene starts. */
export interface Blocking {
  who: string;
  /** Feet position, 0..1600. */
  x: number;
  /** 0 = front, 1 = far back (smaller, higher). */
  depth: number;
  mood: MoodId;
  /** Off stage at the start (enters later). */
  offstage?: boolean;
  /** Mirror the whole character (held item swaps hands). */
  flip?: boolean;
  /** Seated when the scene starts: a seat id or type, or "floor". */
  sit?: string;
  /** Riding in this vehicle when the scene starts. */
  in?: string;
  /** Prop in hand when the scene starts, instead of the one in their look. */
  hold?: string;
}

export type VehicleType = 'car' | 'police' | 'bus';

/** A car or bus. It drives with moves (who = its id) and people get in and out of it. */
export interface Vehicle {
  id: string;
  type: VehicleType;
  /** Body colour; each type has its own default. */
  color?: string;
  /** Centre x when the scene starts. */
  x: number;
  /** Off stage at the start (drives in later). */
  offstage?: boolean;
  /** Faces left. Vehicles turn to face the way they drive. */
  flip?: boolean;
  /** "back" parks behind the front row of characters; "front" drives along the very front, in front of everyone. */
  lane?: 'back' | 'front';
}

export type Weather = 'none' | 'snow' | 'confetti' | 'hearts' | 'cheesy' | 'rain';

export interface Scene {
  id: string;
  title: string;
  /** Scene heading / description from the script. */
  description: string;
  set: SetSpec;
  weather: Weather;
  blocking: Blocking[];
  beats: Beat[];
  vehicles?: Vehicle[];
  /** Seconds of establishing wide shot before the first beat. */
  hold: number;
  /** Play the scene-change guitar sting over the hold. */
  sting: boolean;
}

/* ---------------------------------------------------------------- sets */

/** A scene's background: one of the photo booth's hand-drawn places, or a set built from the paper kit. */
export type SetSpec = { kind: 'preset'; preset: string; townName?: string } | KitSet;

export type TimeOfDay = 'day' | 'dusk' | 'night';

export interface KitSet {
  kind: 'kit';
  place: 'interior' | 'exterior';
  time: TimeOfDay;
  /** Interior wall colour. */
  wall: string;
  wallStyle: 'plain' | 'stripes' | 'panels' | 'brick' | 'tiles' | 'wainscot';
  /** Second wall colour (stripes, wainscot, tile grout). */
  wallAccent: string;
  /** Interior floor colour. */
  floor: string;
  floorStyle: 'plain' | 'boards' | 'tiles' | 'carpet' | 'checker';
  /** Exterior ground. */
  ground: 'snow' | 'grass' | 'road' | 'sidewalk' | 'dirt' | 'sand';
  /** Exterior far layer. */
  backdrop: 'mountains' | 'town' | 'forest' | 'city' | 'none';
  /** Optional sky colour override (exterior). */
  sky?: string;
  pieces: KitPiece[];
}

export interface KitPiece {
  /** Instance id (unique within the set). */
  id: string;
  /** Kit catalog id: "door", "window", "pine", ... */
  type: string;
  /** Centre x of the piece's base, 0..1600. */
  x: number;
  /** Base y (where it stands). Defaults to the piece's natural spot: floor line, wall height or ground. */
  y?: number;
  scale?: number;
  color?: string;
  color2?: string;
  /** Text for signs, shop names, posters, chalkboards. */
  text?: string;
  flip?: boolean;
  /** Draw in front of the characters (desks people stand behind). */
  front?: boolean;
}
