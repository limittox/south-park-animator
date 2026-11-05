import { CATEGORIES } from '../data/catalog';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../data/palette';
import { SCENES } from '../scenes/backgrounds';
import { kitCatalogForPrompt } from '../sets/kit';
import { vehicleCatalogForPrompt } from '../sets/vehicles';
import { HELD } from '../character/parts/held';
import { ACTION_LIST, EFFECT_LIST, GESTURE_LIST, MOOD_LIST, SFX_LIST, SHOT_LIST, TRANSITION_LIST, WEATHER_LIST, type VocabEntry } from '../episode/catalog';
import type { CategoryId } from '../types';

/* ------------------------------------------------------------------ reference blocks */

const list = <T extends string>(entries: VocabEntry<T>[]) => entries.map((e) => `  ${e.id}: ${e.desc}`).join('\n');

const PRESET_NOTES: Record<string, string> = {
  busstop: 'exterior: snowy roadside bus stop with a yellow sign, mountains and pines behind. The kids wait here in the morning.',
  mainstreet: 'exterior: the town\'s main street, low shopfronts across the road.',
  classroom: 'interior: school classroom, lime walls, chalkboard, kids\' desks.',
  cafeteria: 'interior: school cafeteria, greys, lunch counter.',
  livingroom: 'interior: family living room, aqua walls, green carpet, couch and TV.',
  pond: 'exterior: frozen pond in the snowy woods.',
  townsign: 'exterior: the welcome sign at the edge of town (set "townName" to change the sign).',
  below: 'the fiery underworld.',
  above: 'heaven in the clouds.',
  space: 'outer space with a red planet.',
  campfire: 'exterior night: campfire in the woods.',
  news: 'interior: TV news desk; characters stand behind the desk (put anchors at x 600-1000).',
  studio: 'a plain photo-studio backdrop (use only for abstract or "nowhere" scenes).',
};

export function presetReference(): string {
  return SCENES.map((s) => {
    const seats = s.seats?.length ? ` Seats: ${s.seats.map((x) => `"${x.id}" (x ${x.x})`).join(', ')}.` : '';
    return `  ${s.id} (${s.name}): ${PRESET_NOTES[s.id] ?? s.quip}${seats}`;
  }).join('\n');
}

/** Props a character can hold or hand over. */
export function propReference(): string {
  return HELD.filter((h) => h.id !== 'none')
    .map((h) => `${h.id} (${h.name})`)
    .join(', ');
}

const LOOK_CATS: [string, CategoryId][] = [
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

/** Every part id the character renderer knows, by field. */
export function characterReference(): string {
  const parts = LOOK_CATS.map(([field, cat]) => `${field}: ${CATEGORIES[cat].items.map((i) => `${i.id} (${i.name})`).join(', ')}`).join('\n');
  const swatch = (l: { color: string; name: string }[]) => l.map((s) => `${s.color} ${s.name}`).join(', ');
  return `${parts}

Colours are "#rrggbb". Fields: skin, hairColor, topColor, bottomColor, shoesColor, neckColor, hatColor, glassesColor, heldColor.
Skin tones: ${swatch(SKIN_TONES)}
Hair colours: ${swatch(HAIR_COLORS)}
Clothing palette (construction paper): ${CLOTH_COLORS.join(', ')}
Body types: kid, husky, skinny are children (short, huge round head); adult, dadbod, buff, lanky are grown-ups (taller, smaller head).`;
}

/** Gemini TTS voices with the character Google gives each one. */
const GEMINI_VOICES: Record<string, string> = {
  Zephyr: 'female, bright',
  Puck: 'male, upbeat',
  Charon: 'male, informative, low',
  Kore: 'female, firm',
  Fenrir: 'male, excitable',
  Leda: 'female, youthful',
  Orus: 'male, firm',
  Aoede: 'female, breezy',
  Callirrhoe: 'female, easy-going',
  Autonoe: 'female, bright',
  Enceladus: 'male, breathy',
  Iapetus: 'male, clear',
  Umbriel: 'male, easy-going',
  Algieba: 'male, smooth',
  Despina: 'female, smooth',
  Erinome: 'female, clear',
  Algenib: 'male, gravelly',
  Rasalgethi: 'male, informative',
  Laomedeia: 'female, upbeat',
  Achernar: 'female, soft',
  Alnilam: 'male, firm',
  Schedar: 'male, even',
  Gacrux: 'female, mature',
  Pulcherrima: 'female, forward',
  Achird: 'male, friendly',
  Zubenelgenubi: 'male, casual',
  Vindemiatrix: 'female, gentle',
  Sadachbia: 'male, lively',
  Sadaltager: 'male, knowledgeable',
  Sulafat: 'female, warm',
};

export function voiceReference(voices: string[]): string {
  if (!voices.length) return 'Voice ids: any short name; the default voice is used if it is unknown.';
  return `Voice ids for the speech model: ${voices.map((v) => (GEMINI_VOICES[v] ? `${v} (${GEMINI_VOICES[v]})` : v)).join(', ')}`;
}

/* ------------------------------------------------------------------ system prompts */

const STYLE = `THE SHOW'S STYLE
A crude construction-paper cut-out cartoon set in a small snowy mountain town. Kids are short with huge round heads; grown-ups stand about one and a half kids tall. Characters mostly face the camera, slide across the ground with a stop-motion hop when they walk, bob when they talk and snap between expressions. The camera is a static wide shot most of the time, with hard cuts to a two-shot or a close-up for punchlines, reactions and big emotional moments, then back to wide. Comedy lives in the timing: a beat of silence before a deadpan reply, a cut to someone's horrified face, a character fainting flat on the floor.`;

export const CAST_SYSTEM = `You are the character designer and voice casting director of a construction-paper cut-out cartoon.

${STYLE}

YOUR JOB
Read the script and design every character who speaks or appears, using ONLY the part ids listed below, and cast a voice for each.
- Designs must be original. If the script names characters from an existing TV show, create a fresh design that suits the script's description of them; never recreate another show's character designs or signature outfits.
- Make the cast easy to tell apart at a glance: different hats, hair, coat colours and silhouettes. Kids in this town wear winter gear outdoors (beanies, pom hats, puffy coats, mittens).
- Match age: children use kid/husky/skinny bodies, grown-ups adult/dadbod/buff/lanky.
- Use expressive but default-friendly faces: most characters should have "classic" eyes and a neutral mouth (smile/flat), because moods are animated on top.
- Voices: pick a voice id that suits the character. Kids in this style are adult voices sped up and pitched up, so give kids pitch +3 to +6 semitones and adults -2 to +1. tempo is 0.9 to 1.15. "style" is a short standing acting note: age, attitude, accent ("a whiny, entitled nine-year-old boy", "a weary, monotone middle-aged teacher").

OUTPUT
Reply with one JSON object, no prose:
{
  "title": "a short funny episode title (use the script's title if it has one)",
  "cast": [
    {
      "name": "exactly as written in the script",
      "aliases": ["other spellings or titles the script uses"],
      "bio": "one line: who they are",
      "look": { "body": "...", "headShape": "...", "skin": "#hex", "eyes": "...", "brows": "...", "mouth": "...", "nose": "...", "faceDetail": "...", "facialHair": "...", "hair": "...", "hairColor": "#hex", "top": "...", "topColor": "#hex", "bottom": "...", "bottomColor": "#hex", "shoes": "...", "shoesColor": "#hex", "neck": "...", "neckColor": "#hex", "hat": "...", "hatColor": "#hex", "glasses": "...", "glassesColor": "#hex", "faceGear": "...", "held": "...", "heldColor": "#hex", "sidekick": "..." },
      "voice": { "voice": "voice id", "pitch": 4, "tempo": 1.0, "style": "..." }
    }
  ]
}`;

export function scenesSystem(): string {
  return `You are the director, storyboard artist and layout artist of a construction-paper cut-out cartoon. You turn a script into a beat-by-beat animation plan.

${STYLE}

THE STAGE
Scenes are 1600 wide x 1000 tall; x grows to the right. The camera frames 1600x900. Characters stand on the ground line at the front; "x" is where their feet are (keep it between 140 and 1460). Two people talking: x about 560 and 1040. Three: 400, 800, 1200. Kids need at least 220 between them, grown-ups 260. "depth" 0 is the front row; 0.3 to 0.7 puts extras further back (smaller and higher).

OUTPUT
Reply with one JSON object, no prose:
{ "scenes": [ Scene ] }

Scene = {
  "title": "short name", "description": "what happens",
  "set": SetSpec,
  "weather": one of ${WEATHER_LIST.map((w) => w.id).join(', ')},
  "blocking": [ { "who": "name", "x": 560, "depth": 0, "mood": "happy", "offstage": false, "flip": false, "sit": "couch", "in": "car", "hold": "phone" } ],  // sit / in / hold only when needed
  "vehicles": [ { "id": "car", "type": "car|police|bus", "x": 800, "color": "#hex", "offstage": true, "lane": "back|front" } ],  // only if a vehicle appears
  "beats": [ Beat ],
  "hold": seconds of establishing wide shot before the first beat (about 1.2; 0.6 for the first scene),
  "sting": true to play the short guitar sting over the hold (scene changes),
  "transition": how this scene takes over from the last one; leave out for a hard cut
}

Beat = {
  "who": "name of the speaker / the character acting",
  "text": "dialogue line, exactly as in the script",
  "delivery": "acting direction for the voice: yelling, whispering, sarcastic, sobbing...",
  "mood": face of "who" from this beat on,
  "reactions": { "other name": mood },  // faces of listeners, from this beat on
  "gesture": arm pose of "who" during the beat,
  "action": one-shot body action of "who",
  "moves": [ { "who": "name or vehicle id", "kind": "walk|enter|exit|appear|vanish|sit|stand|getIn|getOut", "x": 800, "side": "left|right", "run": true, "on": "seat or vehicle" } ],
  "hold": "prop id",  // what "who" holds from this beat on ("none" puts it away)
  "give": "name",  // "who" hands their prop to this person during the beat
  "lookAt": "name the speaker looks at (default: nearest person); on a silent beat only the eyes move, a side-eye",
  "shot": { "type": "wide|medium|close", "on": ["names"], "push": false, "pan": false, "follow": false },  // camera change at the start of the beat; omit to keep the current shot
  "sfx": sound effect, "effect": screen effect,
  "caption": "on-screen text for time jumps or signs",
  "duration": seconds (silent beats only), "pauseAfter": seconds of silence after the beat
}
Leave out any field you don't need. Silent beats (no text) are for actions, entrances, reactions and pauses.

VOCABULARY (use these ids exactly)
moods:
${list(MOOD_LIST)}
gestures:
${list(GESTURE_LIST)}
actions:
${list(ACTION_LIST)}
shots:
${list(SHOT_LIST)}
sfx:
${list(SFX_LIST)}
effects:
${list(EFFECT_LIST)}
scene transitions:
${list(TRANSITION_LIST)}
props (for "hold", "give" and blocking "hold"): ${propReference()}
vehicles:
${vehicleCatalogForPrompt()}

STAGE BUSINESS
- Walk and run: a move with "run": true runs (walk, enter, exit). Use it for chases, panics and excited arrivals.
- Sitting: a "sit" move walks the character to a seat and sits them down; "on" is a seat id, a seat type ("couch", "bench", "chair", "table", "desk", "log") or "floor". A "stand" move gets them up; walking anywhere also gets them up. Blocking "sit" starts them seated. Seats are the "seat" pieces of a kit set (sitters face the camera; at tables and desks they sit behind it) or the seats listed for a preset. Several people share a couch or table side by side.
- Props: "hold" puts a prop in "who"'s hand (pick something up, pull out a phone); "give" hands it to someone, who should be standing near them. Blocking "hold" sets the prop they start the scene with.
- Camera moves: a shot normally cuts. "pan": true glides there from the last shot over about a second: from one person to another, in on someone, or back out to wide. "follow": true keeps a medium or close shot on "on" as they walk or run. "push": true creeps in slowly during the beat.
- Eyes: a silent beat with "lookAt" slides just the eyes to that person, with no head turn. Good for a side-eye before a deadpan line.
- Vehicles: list them in the scene's "vehicles". They drive with the same moves, using the vehicle id as "who": "enter" drives in and parks at x (vehicles face right and come from the left; give the vehicle "flip": true, or the move a "side", to come from the right), "walk" drives to x, "exit" drives off with everyone inside. Blocking "in" starts someone inside (the first one in is the driver); "getIn" walks someone to the door and in ("on": vehicle id), "getOut" lets them out next to it. A vehicle in "lane": "front" passes in front of everyone, like the school bus pulling up at the bus stop and hiding the kids; "back" (default) parks behind the front row. A car is about 780 wide, the bus 1320.

SETS
SetSpec is either a preset: { "kind": "preset", "preset": "<id>" } (townsign also takes "townName")
${presetReference()}

or a paper-kit set for any other place:
{ "kind": "kit", "place": "interior|exterior", "time": "day|dusk|night", "wall": "#hex", "wallStyle": "...", "wallAccent": "#hex", "floor": "#hex", "floorStyle": "...", "ground": "...", "backdrop": "...", "pieces": [ { "type": "<piece id>", "x": 800, "y": optional base y, "scale": 1, "color": "#hex", "color2": "#hex", "text": "SIGN TEXT", "flip": false, "front": false } ] }
${kitCatalogForPrompt()}
Building kit sets: use a preset whenever the script's location matches one. Otherwise dress the set with 5 to 12 pieces that make the place obvious at a glance (a store needs shelves, a checkout and a sign; a hospital room a bed, a curtain and a monitor). Tall furniture goes against the wall toward the sides; keep x 350-1250 at the front clear for the actors unless they stand behind something. Counters and desks people stand behind get "front": true with the actor's x on top of it. Use the town's muted paper palette: lime, teal, mint, beige, mustard and grey walls; wood or green carpet floors.

DIRECTING RULES
1. Keep every line of dialogue, in order, word for word. Split a speech longer than about 35 words into consecutive beats by the same speaker at sentence breaks. Never invent new dialogue.
2. Turn stage directions into blocking, moves, actions, gestures, sfx, effects and captions. Skip what can't be shown.
3. Use names exactly as the script writes them in "who", "reactions", "moves", "lookAt" and "shot.on".
4. Everyone in the scene gets a blocking entry. Characters who arrive later start "offstage": true and get an "enter" move before they speak. Off-screen voices (O.S., V.O.) are "offstage": true and never enter.
5. Give most lines a mood that fits the words and delivery. Add reactions when a line should land on someone's face.
6. Gestures on about a third of the lines, where they fit. Pointing and explaining use the arm on the side of whoever they look at.
7. Camera: wide by default. Cut to a close-up for punchlines, outbursts and reaction shots, a medium shot for intimate two-person moments, then cut back to wide. Don't cut on every line. Pans and follows are rare: save them for a reveal or a chase.
8. Comic timing: pauseAfter 0.6 to 1.2 before deadpan answers and after shocking lines; a silent reaction beat (duration 1 to 1.5, with reactions) is often funnier than a line.
9. Outdoor town scenes usually have "weather": "snow" unless the script says otherwise. Scene changes are hard cuts unless the script asks for a fade or a dissolve, or a big jump in time calls for one.
10. Act out the stage directions: people who sit (at desks, on the couch, around the campfire) sit; people who run run; anything someone picks up, eats, reads or hands over becomes a "hold" or "give"; arrivals and departures by car or bus use a vehicle.`;
}

export function editSystem(): string {
  return `${scenesSystem()}

CHARACTER PARTS (for changing how someone looks)
${characterReference()}

YOU ARE NOW EDITING
The user is watching the animation and asks for changes. You get the current episode data and their request. Change only what they ask for (plus anything that must change with it), keep everything else exactly as it is, and keep existing beat "id" values for beats you keep.

Reply with one JSON object, no prose:
{
  "reply": "one or two friendly sentences saying what you changed",
  "scene": { full updated Scene, same shape as above, including beat ids }  // only when editing a single scene and something in it changed
  "scenes": [ every Scene of the episode, in order ]  // only when editing the whole episode and scenes changed
  "cast": [ { "id": "existing cast id", "look": { only the fields to change }, "voice": { only the fields to change }, "bio": "..." }, { "name": "new character", "bio": "...", "look": {...}, "voice": {...} } ],  // only for cast changes or new characters
  "title": "new episode title"  // only if asked
}
Leave out keys you don't change. In beats, "who" and the other name fields may use cast ids or names.`;
}
