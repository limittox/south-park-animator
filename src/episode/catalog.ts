import type { ActionId, GestureId, MoodId, ScreenEffect, SfxId, ShotType, Weather } from './types';

/** The animation vocabulary: shown in the editor and handed to the LLM, so every entry says what it looks like. */
export interface VocabEntry<T extends string> {
  id: T;
  label: string;
  desc: string;
}

export const MOOD_LIST: VocabEntry<MoodId>[] = [
  { id: 'happy', label: 'Content', desc: 'neutral-pleasant default face, small smile' },
  { id: 'joy', label: 'Overjoyed', desc: 'big grin, happy closed eyes' },
  { id: 'angry', label: 'Angry', desc: 'angry brows, frown' },
  { id: 'rage', label: 'Screaming', desc: 'angry eyes, mouth wide open shouting' },
  { id: 'sad', label: 'Sad', desc: 'droopy eyes, worried brows, frown' },
  { id: 'shock', label: 'Shocked', desc: 'wide eyes, raised brows, O mouth' },
  { id: 'smug', label: 'Smug', desc: 'shifty half-lidded eyes, smirk' },
  { id: 'evil', label: 'Evil', desc: 'scheming demon eyes and fangs' },
  { id: 'sick', label: 'Sick', desc: 'tired eyes, wavy queasy mouth' },
  { id: 'love', label: 'Lovestruck', desc: 'heart eyes, kissy mouth' },
  { id: 'deadpan', label: 'Deadpan', desc: 'sleepy eyes, flat mouth, unimpressed' },
  { id: 'crazy', label: 'Unhinged', desc: 'mismatched pupils, grimace' },
];

export const GESTURE_LIST: VocabEntry<GestureId>[] = [
  { id: 'none', label: 'Arms down', desc: 'arms hang at the sides (the usual)' },
  { id: 'wave', label: 'Wave', desc: 'one arm up waving hello/bye' },
  { id: 'point', label: 'Point', desc: 'one arm straight out pointing (at whoever they look at)' },
  { id: 'armsUp', label: 'Arms up', desc: 'both arms raised: cheering, "hooray", or panic' },
  { id: 'shrug', label: 'Shrug', desc: 'both hands out: "I dunno", "whatever"' },
  { id: 'fists', label: 'Fists', desc: 'both fists raised and shaking: furious' },
  { id: 'facepalm', label: 'Facepalm', desc: 'hand over face: exasperated' },
  { id: 'hipHands', label: 'Hands on hips', desc: 'indignant, bossy, scolding' },
  { id: 'flail', label: 'Flail', desc: 'both arms flailing wildly: panic, hysterics' },
  { id: 'explain', label: 'Explain', desc: 'one hand out, bobbing while making a point' },
  { id: 'cross', label: 'Arms crossed', desc: 'arms folded: stubborn, unimpressed' },
  { id: 'thinking', label: 'Thinking', desc: 'hand to chin: pondering' },
  { id: 'grab', label: 'Reach', desc: 'one arm reaching out to grab or give something' },
];

export const ACTION_LIST: VocabEntry<ActionId>[] = [
  { id: 'jump', label: 'Jump', desc: 'hops straight up once (excitement, surprise)' },
  { id: 'shake', label: 'Tremble', desc: 'shivers in place (fear, cold, fury)' },
  { id: 'faint', label: 'Faint / fall', desc: 'topples over flat and stays down until their next action or move (for good if there is none)' },
  { id: 'spin', label: 'Spin', desc: 'spins around once' },
  { id: 'bounce', label: 'Bounce', desc: 'bounces up and down a few times (giddy)' },
];

export const SHOT_LIST: VocabEntry<ShotType>[] = [
  { id: 'wide', label: 'Wide', desc: 'whole set, everyone visible (the show\'s default)' },
  { id: 'medium', label: 'Medium', desc: 'frames the listed characters (two-shots, small groups)' },
  { id: 'close', label: 'Close-up', desc: 'head and shoulders of one character, for punchlines and reactions' },
];

export const SFX_LIST: VocabEntry<SfxId>[] = [
  { id: 'pop', label: 'Pop', desc: 'small comedic pop' },
  { id: 'boing', label: 'Boing', desc: 'springy cartoon boing' },
  { id: 'crash', label: 'Crash', desc: 'glass/metal crash' },
  { id: 'thud', label: 'Thud', desc: 'heavy body hitting the floor' },
  { id: 'whoosh', label: 'Whoosh', desc: 'fast movement' },
  { id: 'ding', label: 'Ding', desc: 'bell ding / idea' },
  { id: 'buzzer', label: 'Buzzer', desc: 'wrong-answer buzzer' },
  { id: 'fart', label: 'Fart', desc: 'a fart' },
  { id: 'gasp', label: 'Gasp', desc: 'crowd gasp' },
  { id: 'slap', label: 'Slap', desc: 'a slap' },
  { id: 'explosion', label: 'Explosion', desc: 'big explosion' },
  { id: 'sting', label: 'Guitar sting', desc: 'short acoustic guitar riff (scene changes)' },
  { id: 'doorbell', label: 'Doorbell', desc: 'ding-dong' },
  { id: 'cheer', label: 'Cheer', desc: 'small crowd cheering' },
];

export const EFFECT_LIST: VocabEntry<ScreenEffect>[] = [
  { id: 'shake', label: 'Screen shake', desc: 'camera shakes (impacts, explosions, rage)' },
  { id: 'flash', label: 'Flash', desc: 'white flash (explosions, revelations)' },
];

export const WEATHER_LIST: VocabEntry<Weather>[] = [
  { id: 'none', label: 'Clear', desc: 'nothing falling' },
  { id: 'snow', label: 'Snow', desc: 'gentle snowfall (the town\'s default outdoors)' },
  { id: 'rain', label: 'Rain', desc: 'rain' },
  { id: 'confetti', label: 'Confetti', desc: 'party confetti' },
  { id: 'hearts', label: 'Hearts', desc: 'floating hearts' },
  { id: 'cheesy', label: 'Snack storm', desc: 'cheesy snacks raining down' },
];

export const MOOD_IDS = MOOD_LIST.map((m) => m.id);
export const GESTURE_IDS = GESTURE_LIST.map((m) => m.id);
export const ACTION_IDS = ACTION_LIST.map((m) => m.id);
export const SHOT_IDS = SHOT_LIST.map((m) => m.id);
export const SFX_IDS = SFX_LIST.map((m) => m.id);
export const EFFECT_IDS = EFFECT_LIST.map((m) => m.id);
export const WEATHER_IDS = WEATHER_LIST.map((m) => m.id);

/** Feet stay inside this band so nobody is cut in half by the frame. */
export const STAGE_MIN_X = 140;
export const STAGE_MAX_X = 1460;
