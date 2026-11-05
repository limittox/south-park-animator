import type { MoodId } from './types';
import { formId, normalizeEpisode, looksAdult, propId } from './normalize';
import type { BurstId, Crowd, CrowdReaction, Episode, Transition } from './types';

/*
 * The no-LLM path. Understands the common script shapes:
 *   NAME: line            NAME (yelling): line          [action] / (action) / plain action lines
 *   INT. PLACE - DAY      EXT. PLACE                    Scene 2: Somewhere
 *   NAME                  (screenplay style: name on its own line, dialogue below)
 *   dialogue...
 * It is deliberately simple; the LLM director does the real interpretation.
 */

const HEADING = /^\s*(?:#+\s*)?(?:(INT|EXT|INT\.?\/EXT|I\/E)\b\.?|SCENE\b\s*\d*\s*[:.-]?|LOCATION\s*:)\s*(.*)$/i;
const TITLE = /^\s*(?:TITLE|EPISODE)\s*:\s*(.+)$/i;
const COLON_LINE = /^\s*([A-Za-z][A-Za-z0-9 .'’-]{0,40}?)\s*(\(([^)]*)\))?\s*:\s*(.+)$/;
const NAME_ONLY = /^\s*([A-Z][A-Z0-9 .'’-]{1,40}?)\s*(\(([^)]*)\))?\s*$/;
/** Screenplay furniture that looks like a name on its own line. */
const NOT_A_NAME = /^(FADE|CUT|SMASH CUT|MATCH CUT|DISSOLVE|SPLIT SCREEN|INTERCUT|THE END|END|INT|EXT)\b/;
/** Labels, not people: "NOTE: ...", "CAPTION: Later that night". */
const NOT_A_SPEAKER = /^(note|fade|cut|title|caption|super|subtitle|title card|on[- ]?screen(?: text)?|split[- ]?screen|intercut)$/i;
/** "Fade to black.", "The screen fades out.", "DISSOLVE TO:" say how the next scene starts. "The ghost fades away" doesn't. */
const SCREEN_CHANGE = /^(?:(?:slow|quick)(?:ly)? )?(?:the (?:screen|scene|picture|image) (?:slowly |quickly )?)?(fades?|dissolves?)\b/i;
/** `A caption reads "1982."`, `The sign says "Closed."` */
const CAPTION_READS = /\b(?:caption|title card|subtitle|card|signs?|banner|chyron)\b[^"“”]{0,30}?\b(?:reads?|says?|shows?)\b[^"“”]{0,12}["“]([^"”]+)["”]/i;
/** `CAPTION: Later that night` */
const CAPTION_LABEL = /^(?:caption|super|subtitle|title card|on[- ]?screen(?: text)?)\s*:\s*["“]?(.+?)["”]?$/i;
/** A time jump on a line of its own: "Three hours later...", "THE NEXT MORNING". */
const TIME_JUMP = /^(?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|fifty|a few|several|many|\d+)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+later|later(?:\s+that\s+(?:day|night|morning|afternoon|evening))?|the next (?:day|morning))[.…!]*$/i;

interface RawMove {
  who: string;
  kind: string;
  side?: string;
  x?: number;
  run?: boolean;
  sneak?: boolean;
  on?: string;
}

interface RawBeat {
  who?: string;
  text?: string;
  delivery?: string;
  mood?: MoodId;
  action?: string;
  moves?: RawMove[];
  sfx?: string;
  effect?: string;
  shot?: { type: string; on?: string[]; pan?: boolean; follow?: boolean };
  gesture?: string;
  hold?: string;
  give?: string;
  hug?: string;
  also?: string[];
  lookAt?: string;
  face?: string;
  caption?: string;
  becomes?: string;
  crowd?: CrowdReaction;
  burst?: { kind: BurstId; at?: string; stay?: boolean };
  drift?: { item: string; style: 'blow' | 'roll' | 'fall' };
  weather?: string;
  /** What the sign they're holding says. */
  slogan?: string;
}

interface RawScene {
  title: string;
  description: string;
  set: { kind: 'preset'; preset: string; time?: string } | { kind: 'kit'; place: 'interior' | 'exterior'; time: string; pieces: unknown[] };
  weather: string;
  blocking: { who: string; x: number; depth: number; mood: MoodId; offstage?: boolean; sit?: string; lie?: string; in?: string; screen?: boolean; hold?: string }[];
  beats: RawBeat[];
  vehicles: { id: string; type: string; x: number; offstage: boolean; lane?: 'front' }[];
  /** Who starts the scene inside which vehicle. */
  riders: Map<string, string>;
  people: string[];
  offscreen: Set<string>;
  /** Who has their back to the camera, so that turning round brings them back. */
  turned: Set<string>;
  transition?: Transition;
  crowd?: Crowd;
  split?: { set: RawScene['set']; who: string[]; caller?: string };
}

/** What the script says about someone's look: their pet and the words on their sign. It lasts the whole episode. */
type LookNotes = Map<string, { sidekick?: string; signText?: string }>;

/** Stand for "the kids" / "everyone" until we know who's in the scene. */
const KIDS = '*kids';
const EVERYONE = '*all';
const KID_WORDS = /\b(the kids|the boys|the girls|the class|the children|the students)\b/i;
const ALL_WORDS = /\b(everyone|everybody|they all|all of them|they)\b/i;

const VEHICLE_WORDS: [RegExp, string][] = [
  [/\bschool ?bus\b|\bbus\b/i, 'bus'],
  [/\b(police car|cop car|squad car|cruiser|patrol car)\b/i, 'police'],
  [/\b(car|van|truck|taxi|minivan|sedan|station wagon)\b/i, 'car'],
];
const SEAT_WORDS = /\b(?:on|at|in|onto|around|by)\s+(?:the|a|an|his|her|their|its)?\s*(couch|sofa|bench|chair|armchair|desks?|tables?|floor|ground|logs?|campfire|bed|toilet|rock|stool)\b/i;
/** The kit piece to add for "sits on the <word>" when a built set has nothing to sit on. */
const SEAT_PIECES: Record<string, string> = { couch: 'couch', chair: 'chair', armchair: 'armchair', bench: 'bench', table: 'table', desk: 'desk', bed: 'bed', toilet: 'toilet', rock: 'rock', log: 'bench', stool: 'chair', seat: 'chair' };

/** "hands the remote to Dad", "gives Priya the money". */
const GIVE_PROP = /\b(?:hands?|gives?|passes?|offers?|tosses)\s+(?:[a-z][\w.]*\s+)?(?:a|an|the|his|her|their|some)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/i;
const PROP_VERB = /\b(?:picks? up|grabs?|takes? out|pulls? out|holds? up|holds?|is holding|holding|clutches|clutching|carries|carrying|eats?|drinks?|sips?|reads?|waves? around|opens?|raises?|lifts?|brandish(?:es)?|swings?|with)\s+(?:a|an|the|his|her|their|some)?\s*([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/i;
const THROW = /\b(?:throws?|hurls?|chucks?|lobs?|flings?|tosses)\s+(?:a|an|the|his|her|their|some)?\s*([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/i;

/** A direction opening with several names: "Stan, Kyle and Butters". They all do what it says next. */
const TOGETHER = /^(?:the\s+)?[A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*)*(?:(?:,\s*(?:and\s+)?|\s+and\s+)[A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*)*)+/;
const LIES = /\b(?:lies?|lying|lays?|laying|sprawls?|sprawled|sleeps?|sleeping|naps?|napping|asleep|passed out)\b/i;
const SNEAKS = /\b(?:sneaks?|sneaking|tiptoes?|tiptoeing|creeps?|creeping|prowls?|prowling|slinks?|slinking|skulks?|skulking)\b/i;
const EATS = /\b(?:eats?|eating|chews?|chewing|munch(?:es|ing)?|bites? into|wolfs? down)\b/i;
/** Drinking, not "a drink". */
const DRINKS = /(?<!\b(?:a|an|the|his|her|their|of|with) )\b(?:drinks?|drinking|sips?|sipping|chugs?|chugging|gulps?|swigs?)\b/i;

/** "Stan and Kyle appear on a large video-call screen", "Kenny shows up on the call", "Mayor Lee, a stern mayor, on the TV". Not "turns on the TV". */
const ON_SCREEN = /(?:\b(?:appears?|shows? up|joins?|pops? up|comes? on|is|are)\s+|,\s*)on\s+(?:the\s+|a\s+|an\s+)?(?:[\w-]+\s+){0,2}(?:tv|television|screen|monitor|call|laptop|computer)\b/i;
const OFF_SCREEN = /\b(?:leaves|drops? off|logs? off|disappears? from)\s+(?:the\s+)?(?:call|screen|tv)\b/i;
const CROWD = /\b(?:crowds?|mobs?|townspeople|townsfolk|villagers|neighbou?rs|audience|protesters|onlookers|fans|students|classmates|packed)\b/i;
/** A thing going by on its own, with the thing named before the verb. */
const DRIFTS = /\b(blows?|drifts?|floats?|flutters?|sails?|flies|rolls?|tumbles?|falls?)\s+(?:past|by|across|through|along|over|down|in)\b/i;
const TURNS = /\b(?:turns?|turning|transforms?|transforming|morphs?|morphing|changes?|changing)\s+into\s+(?:(?:a|an|the)\s+)?([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/i;

/** "turns his back", "her back to the room", "turns away", "faces the window", "looks out the window". */
const AWAY = /\b(?:turns?|turning)\s+(?:his|her|their|its)\s+back\b|\b(?:his|her|their)\s+back\s+(?:is\s+)?to\b|\b(?:turns?|turning|faces?|facing)\s+away\b|\b(?:faces?|facing)\s+(?:the\s+)?(?:wall|window|board|blackboard|chalkboard|door|horizon|corner|tv|television|screen|stage)\b|\b(?:looks?|looking|stares?|staring|gazes?|gazing|peers?|peering)\s+out\s+(?:of\s+)?(?:the|a)\s+window\b/i;
/** "turns to the camera", "turns back to us", "faces front". */
const TO_CAMERA = /\b(?:turns?|turning)\s+(?:back\s+)?(?:(?:a)?round\s+)?(?:to|toward|towards)\s+(?:face\s+)?(?:the\s+camera|the\s+audience|the\s+front|us)\b|\b(?:faces?|facing)\s+(?:the\s+camera|the\s+audience|the\s+front|front|forward|us)\b/i;
/** "turns around": which way they end up depends on which way they were facing. */
const TURNS_ROUND = /\b(?:turns?|turning|whirls?|swings?)\s+(?:back\s+)?(?:a)?round\b/i;
/** "turns to Kyle", "faces Kyle". Not "makes faces at Kyle". */
const TURNS_TO = /\b(?:turns?|turning)\s+(?:back\s+)?(?:to|toward|towards)\b|(?<!\bmak(?:es?|ing)\s)\b(?:faces?|facing)\b/i;
/** Off into the distance or out through a door, rather than off to one side. */
const WALKS_AWAY = /\b(?:walks?|goes|heads?|wanders?|trudges?|shuffles?|limps?|stumbles?)\s+(?:slowly\s+|sadly\s+|quietly\s+)?(?:away|off into|into the (?:distance|night|snow|sunset|darkness|fog))\b|\b(?:walks?|goes|heads?|steps?|leaves?)\s+(?:out\s+|back\s+)?(?:through|out)\s+(?:of\s+)?(?:the|a)\s+(?:\w+\s+)?door\b/i;

/** `holds a "FREE PIZZA" sign`: the words come first. */
const SIGN_QUOTED = /["“]([^"”]+)["”]\s+(signs?)\b/i;
/** "walks her dog", "with his pet chicken", "and their cat", "has a pet pig". Just a dog in the street isn't anyone's. */
const PET = /\b(?:(?:a|an)\s+pet\s+|(?:walks?|walking|pets?|petting|feeds?|feeding|brings?|bringing|carries|carrying|holds?|holding|with|and)\s+(?:his|her|their)\s+(?:pet\s+)?|(?:his|her|their)\s+pet\s+)([a-z-]+(?:\s+pig)?)/i;

/** Arm poses, the first match winning. */
const GESTURE_WORDS: [RegExp, string][] = [
  [/\bpoints?\b/i, 'point'],
  [/\bwaves?\b/i, 'wave'],
  [/\b(?:covers?|covering|plugs?|plugging)\s+(?:\w+\s+)?ears\b|\bhands? over (?:\w+ )?ears\b/i, 'coverEars'],
  [/\bfacepalms?\b|\bhead in (?:\w+ )?hands\b/i, 'facepalm'],
  [/\bshrugs?\b/i, 'shrug'],
  [/\b(?:crosses|crossing|folds?|folding)\s+(?:\w+\s+)?arms\b|\barms (?:crossed|folded)\b/i, 'cross'],
  [/\bhands? on (?:\w+ )?hips\b/i, 'hipHands'],
  [/\b(?:shakes?|shaking|raises?|clenches)\s+(?:\w+\s+)?fists?\b/i, 'fists'],
  [/\bflails?\b|\bflailing\b|\bpanics\b/i, 'flail'],
  [/\b(?:raises?|lifts?|throws?|puts?|holds?)\s+(?:\w+\s+)+(?:up|over (?:\w+ )?heads?)\b|\barms (?:up|in the air)\b/i, 'armsUp'],
  [/\b(?:strokes?|rubs?|scratches)\s+(?:\w+\s+)?(?:chin|head)\b|\bponders?\b/i, 'thinking'],
  [/\breach(?:es|ing)?\b/i, 'grab'],
];

const MOOD_WORDS: [RegExp, MoodId][] = [
  [/\b(scream|screaming|yell|yelling|shout|shouting|furious|rage|enraged)\b/i, 'rage'],
  [/\b(angry|annoyed|mad|irritated|frustrated|stern)\b/i, 'angry'],
  [/\b(crying|cries|sob|sobbing|weeping|bawling|tearful)\b/i, 'cry'],
  [/\b(sad|depressed|upset)\b/i, 'sad'],
  [/\b(nervous|anxious|worried|sweating|sweaty|panicking)\b/i, 'nervous'],
  [/\b(shock|shocked|surprised|gasp|gasps|stunned|horrified|scared|terrified|afraid)\b/i, 'shock'],
  [/\b(happy|excited|triumphant|cheerful|delighted|thrilled|joyful|ecstatic)\b/i, 'joy'],
  [/\b(sarcastic|smug|sly|smirking|knowing|condescending)\b/i, 'smug'],
  [/\b(evil|scheming|sinister|menacing)\b/i, 'evil'],
  [/\b(deadpan|flat|bored|monotone|unimpressed)\b/i, 'deadpan'],
  [/\b(sick|queasy|nauseous|gross)\b/i, 'sick'],
  [/\b(in love|dreamy|lovestruck|swoon)\b/i, 'love'],
  [/\b(crazy|manic|unhinged|hysterical)\b/i, 'crazy'],
];

function moodFrom(delivery = '', text = ''): MoodId | undefined {
  for (const [re, mood] of MOOD_WORDS) if (re.test(delivery)) return mood;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 6 && letters === letters.toUpperCase() && /!/.test(text)) return 'rage';
  return undefined;
}

const PRESET_WORDS: [RegExp, string][] = [
  [/bus ?stop/i, 'busstop'],
  [/class ?room|school room|lesson/i, 'classroom'],
  [/cafeteria|lunch ?room|canteen/i, 'cafeteria'],
  [/living ?room|lounge|den\b/i, 'livingroom'],
  [/pond|lake|ice rink|frozen/i, 'pond'],
  [/welcome sign|town sign|edge of town|town limits/i, 'townsign'],
  [/hell|down below|underworld/i, 'below'],
  [/heaven|up above|clouds|afterlife/i, 'above'],
  [/space|mars|planet|moon|rocket/i, 'space'],
  [/camp ?fire|camping|campsite/i, 'campfire'],
  [/news|tv studio|anchor desk|broadcast/i, 'news'],
  [/studio|photo/i, 'studio'],
  [/main street|street|downtown|sidewalk|road|town square|outside/i, 'mainstreet'],
];

/** Pick a set for a scene heading. Unknown interiors get a plain paper room. */
function setFor(heading: string, interior: boolean): RawScene['set'] {
  const time = /night|evening|midnight/i.test(heading) ? 'night' : /dusk|sunset|dawn/i.test(heading) ? 'dusk' : 'day';
  for (const [re, preset] of PRESET_WORDS) if (re.test(heading)) return { kind: 'preset', preset, ...(time === 'day' ? {} : { time }) };
  if (interior) return { kind: 'kit', place: 'interior', time, pieces: [{ type: 'door', x: 260 }, { type: 'window', x: 820 }, { type: 'picture', x: 1260 }] };
  return { kind: 'kit', place: 'exterior', time, pieces: [{ type: 'pine', x: 180 }, { type: 'house', x: 1180 }, { type: 'pine', x: 1480 }] };
}

const cleanName = (n: string) =>
  n
    .replace(/\((?:O\.?S\.?|V\.?O\.?|CONT'?D|OFF|OS|VO)\)/gi, '')
    .trim()
    .replace(/\s+/g, ' ');

function titleCase(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s.'’-])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase())
    // "Priya's", not "Priya'S". "O'Brien" keeps its capital.
    .replace(/['’](?:S|T|Re|Ll|D|Ve|M)\b/g, (m) => m.toLowerCase())
    .replace(/\bMc([a-z])/g, (_m, ch: string) => `Mc${ch.toUpperCase()}`);
}

/** A prop named in a stage direction ("a phone", "the money"). */
function propIn(text: string): string | undefined {
  const m = PROP_VERB.exec(text) ?? GIVE_PROP.exec(text);
  if (m) {
    const words = m[1].split(/\s+/);
    // "the love letter" and "a phone call" both work: try two words, then each word.
    for (const w of [m[1], ...words]) {
      const id = propId(w);
      if (id && id !== 'none') return id;
    }
  }
  return undefined;
}

/** What a direction throws, if it does: "throws a snowball at Priya". A party, a fit or their hands don't count. */
function thrownIn(text: string, target: boolean): string | undefined {
  const m = THROW.exec(text);
  if (!m || /\b(?:hands?|arms?|up|it|them|fit|party|punch)\b/i.test(m[1])) return undefined;
  // Tossing something *to* someone is handing it over.
  if (/^toss/i.test(m[0]) && /\bto\b/i.test(text)) return undefined;
  for (const w of [m[1], ...m[1].split(/\s+/)]) {
    const id = propId(w);
    if (id && id !== 'none') return id;
  }
  return target ? 'snowball' : undefined;
}

/** A crowd named in a direction, and how it's reacting if it is. */
function crowdIn(text: string, scene: RawScene): CrowdReaction | undefined {
  if (!CROWD.test(text)) return undefined;
  const line = /\b(?:line|queue)\s+of\b|\blined up\b/i.test(text);
  const size = /\b(?:long|packed|huge|massive|whole town)\b/i.test(text) ? 30 : /\b(?:few|some|couple)\b/i.test(text) ? 8 : 18;
  const mood = moodFrom(text);
  scene.crowd ??= { count: size, layout: line ? 'line' : 'group', ...(/\b(?:students|classmates|kids|children)\b/i.test(text) ? { kids: true } : {}), ...(mood ? { mood } : {}) };
  if (/\b(?:cheers?|applauds?|applause|claps?|roars?|goes? wild)\b/i.test(text)) return 'cheer';
  if (/\bgasps?\b/i.test(text)) return 'gasp';
  if (/\b(?:boos?|jeers?)\b/i.test(text)) return 'boo';
  return /\b(?:panics?|screams?|flees?|scatters?)\b/i.test(text) ? 'panic' : undefined;
}

/** A prop going by on its own: "A used mask blows past." */
function driftIn(text: string): RawBeat['drift'] {
  const m = DRIFTS.exec(text);
  if (!m) return undefined;
  const item = text.slice(0, m.index).split(/\s+/).map(propId).filter((id) => id && id !== 'none').pop();
  if (!item) return undefined;
  return { item, style: /^(?:rolls?|tumbles?)/i.test(m[1]) ? 'roll' : /^falls?/i.test(m[1]) ? 'fall' : 'blow' };
}

/** Smoke and fire in a direction, on `at` if it's someone's. */
function burstIn(text: string, at: string | undefined): RawBeat['burst'] {
  const on = at ? { at } : {};
  if (/\bexplo(?:des?|sion)\b/i.test(text)) return { kind: 'explosion', ...on };
  if (/\bpuff of smoke\b|\bpoofs?\b/i.test(text)) return { kind: 'poof', ...on };
  if (/\b(?:catch(?:es)? fire|on fire|bursts? into flames|goes? up in flames|in flames|ablaze|burns?|burning)\b/i.test(text)) return { kind: 'fire', stay: true, ...on };
  if (/\bsmok(?:e|ing|y)\b|\bsmokes\b(?! a\b)/i.test(text)) return { kind: 'smoke', ...on };
  return undefined;
}

/** On-screen text in a direction. */
function captionIn(text: string): string | undefined {
  const line = text.trim();
  return (CAPTION_READS.exec(line) ?? CAPTION_LABEL.exec(line))?.[1] ?? (TIME_JUMP.test(line) ? line : undefined);
}

/** "It starts snowing.", "It stops raining." */
function weatherIn(text: string): string | undefined {
  const kind = /\bsnow(?:ing|s)?\b/i.test(text) ? 'snow' : /\brain(?:ing|s)?\b/i.test(text) ? 'rain' : undefined;
  if (!kind) return undefined;
  if (/\b(?:stops?|ends?)\b/i.test(text)) return 'none';
  return /\b(?:starts?|begins?|it'?s)\b/i.test(text) ? kind : undefined;
}

/** A role written the ordinary way: "the cashier" is the Cashier. "The phone" still isn't a character called Phone, nor "the kids" a character called Kids. */
function capitalizeRoles(line: string, known: string[]): string {
  return known.reduce((l, name) => {
    const lower = name.toLowerCase();
    if (propId(name) || SEAT_PIECES[lower] || VEHICLE_WORDS.some(([re]) => re.test(name)) || CROWD.test(name) || KID_WORDS.test(`the ${lower}`) || ALL_WORDS.test(lower)) return l;
    const words = lower.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    return l.replace(new RegExp(`\\b([Tt]he\\s+)${words}\\b`, 'g'), (_m, the: string) => the + name);
  }, line);
}

/** A verb the camera does: "The camera pans to Priya", "We pull back", or just "Zoom in on Dex". "Dex pulls out a phone" isn't. */
const cameraDoes = (verbs: string) => new RegExp(`^(?:slow(?:ly)? )?(?:${verbs})\\b|\\b(?:camera|we)\\s+(?:\\w+ly\\s+)?(?:${verbs})\\b`, 'i');
const PULL_BACK = cameraDoes('pulls? back|pulls? out|zooms? out');
const ZOOM_IN = cameraDoes('zooms? in|push(?:es)? in');
const FOLLOW = cameraDoes('follows?|tracks?');
const PAN = cameraDoes('pans?');

function cameraIn(text: string, subjects: string[]): RawBeat['shot'] {
  if (PULL_BACK.test(text)) return { type: 'wide', pan: true };
  if (/\bwide shot\b/i.test(text)) return { type: 'wide' };
  if (!subjects.length) return undefined;
  if (ZOOM_IN.test(text)) return { type: 'close', on: subjects.slice(0, 1), pan: true };
  if (/^close on\b|\bclose[- ]?up (?:on|of)\b/i.test(text)) return { type: 'close', on: subjects.slice(0, 1) };
  if (FOLLOW.test(text)) return { type: 'medium', on: subjects, follow: true };
  if (PAN.test(text)) return { type: 'medium', on: subjects, pan: true };
  return undefined;
}

/** Vehicles: arriving, getting in and out, driving off. Returns null when the direction isn't about one. */
function vehicleBeat(text: string, subjects: string[], group: string | null, scene: RawScene): RawBeat | null {
  const type = VEHICLE_WORDS.find(([re]) => re.test(text))?.[1];
  const riding = (name: string) => [...scene.beats].reverse().find((b) => b.moves?.some((m) => m.who === name && (m.kind === 'getIn' || m.kind === 'getOut')))?.moves?.find((m) => m.who === name)?.kind === 'getIn' || scene.riders.has(name);
  const vehicleOf = (name: string) => scene.riders.get(name) ?? scene.vehicles[scene.vehicles.length - 1]?.id;
  const find = () => (type ? [...scene.vehicles].reverse().find((v) => v.type === type) : scene.vehicles[scene.vehicles.length - 1]);
  if (type && /\b(?:crash(?:es)?|smash(?:es)?|plows?|slams?|rams?|bursts?|drives?)\s+(?:through|into)\b/i.test(text)) {
    let v = find();
    if (!v) {
      v = { id: `${type}-${scene.vehicles.length + 1}`, type, x: 800, offstage: true };
      scene.vehicles.push(v);
    }
    for (const s of subjects) scene.riders.set(s, v.id);
    return { moves: [{ who: v.id, kind: 'crash', x: 800, ...(/\b(?:wall|house|building|window|door|store|shop)\b/i.test(text) ? { on: 'wall' } : {}) }], ...(subjects[0] ? { who: subjects[0] } : {}) };
  }
  if (type && /\b(drives? (up|in|over|by)|pulls? (up|in)|arrives?|comes?|shows? up|rolls? up)\b/i.test(text)) {
    let v = find();
    if (!v || !/\bagain\b/i.test(text)) {
      v = { id: `${type}-${scene.vehicles.length + 1}`, type, x: 800, offstage: true, ...(type === 'bus' ? { lane: 'front' as const } : {}) };
      scene.vehicles.push(v);
    }
    for (const s of subjects) scene.riders.set(s, v.id);
    return { moves: [{ who: v.id, kind: 'enter', x: 800 }], ...(subjects[0] ? { who: subjects[0] } : {}) };
  }
  const leaving = /\b(drives? (off|away)|pulls? away|speeds? (off|away)|zooms? off|takes? off|leaves)\b/i.test(text);
  if (leaving && (type || subjects.some(riding) || (!subjects.length && scene.vehicles.length))) {
    const v = (subjects[0] && scene.riders.get(subjects[0])) || find()?.id || vehicleOf(subjects[0] ?? '');
    return v ? { moves: [{ who: v, kind: 'exit' }] } : null;
  }
  if (/\b(gets? (in|into|on|onto|aboard)|climbs? (in|into|on|aboard)|boards?|hops? (in|on)|jumps? in)\b/i.test(text) && (type || scene.vehicles.length)) {
    const v = find()?.id;
    return v ? { moves: (subjects.length ? subjects : [group ?? EVERYONE]).map((s) => ({ who: s, kind: 'getIn', on: v })) } : null;
  }
  if (/\b(gets? (out|off)|climbs? (out|off|down)|hops? (out|off)|steps? (out|off))\b/i.test(text) && (type || scene.vehicles.length)) {
    return { moves: (subjects.length ? subjects : [group ?? EVERYONE]).map((s) => ({ who: s, kind: 'getOut' })) };
  }
  return null;
}

/** Turn plain-English stage directions into moves and actions where we can recognise them. */
function actionBeat(direction: string, known: string[], scene: RawScene, looks: LookNotes): RawBeat | null {
  const written = SIGN_QUOTED.exec(direction);
  const plain = written ? direction.replace(written[0], written[2]) : direction;
  // What a caption says isn't something happening on stage.
  const caption = captionIn(plain);
  const line = capitalizeRoles(caption ? plain.replace(caption, '') : plain, known);
  // Subjects in the order the direction names them: "Dex hands the money to Priya". Names count as written, a word
  // at a time ("Stan", "STAN", "TV Anchor"): not the word "phone" for a character called Phone, and not "Stan's living room".
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = (n: string) => `\\b${n.split(/\s+/).map((w) => `(?:${esc(w)}|${esc(w.toUpperCase())})`).join('\\s+')}\\b`;
  // The longest name gets its words first: "Butters Mom" isn't Butters as well.
  const spots = new Map<string, number>();
  let unread = line;
  for (const n of [...known].sort((a, b) => b.length - a.length)) {
    const found = unread.search(new RegExp(`${named(n)}(?!['’]s\\b)`));
    if (found >= 0) spots.set(n, found);
    unread = unread.replace(new RegExp(named(n), 'g'), (m) => ' '.repeat(m.length));
  }
  const at = (n: string) => spots.get(n) ?? -1;
  const subjects = known.filter((n) => at(n) >= 0).sort((a, b) => at(a) - at(b));
  // Names aren't verbs: "Dance Master spins."
  const text = subjects.reduce((t, n) => t.replace(new RegExp(named(n), 'g'), ''), line);
  // A phone call: everyone after the first name is in a second set, on the other half of the screen.
  if (/\b(?:split[- ]?screen|intercut)\b/i.test(text)) {
    scene.split = { set: setFor(text, !/\b(?:outside|street|park|yard)\b/i.test(text)), who: subjects.length > 1 ? subjects.slice(1) : subjects, ...(subjects.length > 1 ? { caller: subjects[0] } : {}) };
    return null;
  }
  const reaction = crowdIn(text, scene);
  const group = subjects.length || reaction ? null : KID_WORDS.test(text) ? KIDS : ALL_WORDS.test(text) ? EVERYONE : null;
  const vehicle = vehicleBeat(text, subjects, group, scene);
  // "Stan and Kyle throw snowballs at Cartman": two people do it, to the third.
  const together = TOGETHER.exec(line)?.[0].length ?? 0;
  const crowd = subjects.slice(1).filter((s) => at(s) < together);
  const object = subjects.slice(1).find((s) => at(s) >= together);
  const beat: RawBeat = vehicle ? { ...vehicle } : {};
  const who = subjects[0];
  if (caption) beat.caption = caption;
  if (reaction) beat.crowd = reaction;
  const drift = driftIn(text);
  if (drift) beat.drift = drift;
  const shot = cameraIn(text, subjects);
  if (shot) beat.shot = shot;
  const run = /\b(runs?|running|dash(es)?|sprints?|races?|rushes|bolts?)\b/i.test(text);
  const sneak = SNEAKS.test(text);
  const pace = run ? { run } : sneak ? { sneak } : {};
  const seat = SEAT_WORDS.exec(text)?.[1]?.toLowerCase();
  const on = seat === 'sofa' ? 'couch' : seat === 'campfire' ? 'log' : seat?.replace(/s$/, '');
  if (vehicle) {
    // The vehicle has said where everyone goes.
  } else if (ON_SCREEN.test(text)) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'joinScreen' }));
  } else if (OFF_SCREEN.test(text)) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'leaveScreen' }));
  } else if (/\b(enters?|walks? in|comes? in|arrives?|runs? in|shows? up|steps? in|rushes in|bursts? in|(?:sneaks?|creeps?|tiptoes?|slinks?|prowls?) in)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'enter', ...pace }));
  } else if (WALKS_AWAY.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'exit', side: 'back', ...pace }));
  } else if (/\b(leaves?|exits?|walks? (off|out|away)|storms? off|runs? (off|away|out)|goes? home|bolts?|flees|(?:sneaks?|creeps?|tiptoes?|slinks?|prowls?) (?:off|out|away))\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'exit', ...pace }));
  } else if (LIES.test(text) && (on || /\b(?:down|flat|asleep|sleeps?|sleeping)\b/i.test(text))) {
    beat.moves = (subjects.length ? subjects : group ? [group] : []).map((s) => ({ who: s, kind: 'lie', on: on ?? 'floor' }));
  } else if (/\b(sits?|sitting|sat|takes? a seat|plops? down|flops? down)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : group ? [group] : []).map((s) => ({ who: s, kind: 'sit', ...(on ? { on } : {}) }));
  } else if (/\b(stands? up|gets? up|jumps? up(?! and down)|rises|leaps? up)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : group ? [group] : []).map((s) => ({ who: s, kind: 'stand' }));
  } else if (/\b(vanish(es)?|disappears?|poofs?)\b/i.test(text)) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'vanish' }));
  } else if (/\b(appears?|pops? up|materiali[sz]es?)\b/i.test(text)) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'appear' }));
  } else if (object && /\b(?:walks?|runs?|goes|moves?|steps?|rushes|races?|dashes|sneaks?|creeps?|tiptoes?)\s+(?:\w+\s+)?(?:to|toward|towards|behind|up on)\b|\bapproach(?:es)?\b/i.test(text)) {
    beat.moves = [{ who, kind: 'approach', on: object, ...pace }];
  } else if (sneak) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'walk', sneak }));
  }
  const pet = PET.exec(text);
  const petId = pet ? formId(pet[1]) : undefined;
  if (who && petId) (looks.get(who) ?? looks.set(who, {}).get(who)!).sidekick ??= petId;
  for (const n of known) {
    const theirs = new RegExp(`${named(n)}['’]s\\s+(?:pet\\s+)?([a-z-]+(?:\\s+pig)?)`).exec(line);
    const id = theirs ? formId(theirs[1]) : undefined;
    if (id) (looks.get(n) ?? looks.set(n, {}).get(n)!).sidekick ??= id;
  }
  const thrown = thrownIn(text, !!object);
  const drinks = DRINKS.test(text);
  const eats = EATS.test(text);
  const prop = thrown ?? propIn(petId ? text.replace(pet![0], '') : text) ?? (drinks ? (/\b(?:beers?|bottles?|booze|whiskey|wine)\b/i.test(text) ? 'beer' : 'soda') : eats ? 'snack' : undefined);
  const giving = !thrown && /\b(hands?|gives?|passes?|offers?|tosses)\b/i.test(text);
  if (giving && subjects.length >= 2) {
    beat.give = subjects[1];
    if (prop) beat.hold = prop;
  } else if (prop) beat.hold = prop;
  else if (/\b(drops?|puts? (it |them )?(down|away)|throws? (it )?away|pockets?)\b/i.test(text)) beat.hold = 'none';
  const slogan = prop === 'sign' ? written?.[1] ?? (/\bsigns?\b/i.test(plain) ? caption : undefined) : undefined;
  if (slogan) {
    beat.slogan = slogan;
    delete beat.caption;
  }
  // Only people faint: a plunger that falls down is just falling.
  if ((who || group) && !drift && /\b(faints?|passes out|collapses?|falls? (over|down)|dies)\b/i.test(text)) beat.action = 'faint';
  else if (/\b(vomits?|vomiting|pukes?|puking|barfs?|barfing|throws? up|throwing up)\b/i.test(text)) beat.action = 'vomit';
  else if (thrown) {
    beat.action = 'throw';
    if (object) beat.lookAt = object;
  } else if (/\b(dances?|breakdances?|boogies|twerks?)\b|(?<!for )\bdancing\b/i.test(text)) beat.action = 'dance';
  else if (/\b(bounces?|bouncing|(?:jumps?|jumping|hops?|hopping) up and down)\b/i.test(text)) beat.action = 'bounce';
  else if (/\b(jumps?|leaps?)\b/i.test(text)) beat.action = 'jump';
  else if (/\b(shakes?(?! (?:\w+ )?(?:head|fists?|hands?))|trembles?|shivers?)\b/i.test(text)) beat.action = 'shake';
  else if (/\b(spins?|twirls?)\b/i.test(text)) beat.action = 'spin';
  const turning = TURNS.exec(line);
  const form = turning && (object ?? [turning[1], ...turning[1].split(/\s+/)].map(formId).find(Boolean));
  if (form && who) {
    beat.becomes = form;
    beat.moves = beat.moves?.filter((m) => m.kind !== 'vanish');
  }
  const burst = burstIn(text, who);
  if (burst) beat.burst = burst;
  if (/\bexplo(des?|sion)\b/i.test(text)) {
    beat.sfx = 'explosion';
    beat.effect = 'flash';
  } else if (/\bfarts?\b/i.test(text)) beat.sfx = 'fart';
  else if (/\b(slaps?)\b/i.test(text)) beat.sfx = 'slap';
  else if (/\b(crash(es)?|smash(es)?)\b/i.test(text)) {
    beat.sfx = 'crash';
    beat.effect = 'shake';
  } else if (/\bdoorbell\b/i.test(text)) beat.sfx = 'doorbell';
  else if (/\b(crowd cheers|cheers|applauds|applause)\b/i.test(text)) beat.sfx = 'cheer';
  else if (reaction === 'gasp') beat.sfx = 'gasp';
  else if (/\bpops?\b/i.test(text)) beat.sfx = 'pop';
  if (/\bflash(es)?\b/i.test(text) && !beat.effect) beat.effect = 'flash';
  beat.gesture = drinks ? 'drink' : eats ? 'eat' : GESTURE_WORDS.find(([re]) => re.test(text))?.[1];
  if (object && /\b(?:looks?|glances?|stares?|glares?|peeks?)\s+(?:\w+\s+)?at\b|\bside-?eyes\b/i.test(text)) beat.lookAt = object;
  if (AWAY.test(text)) beat.face = 'away';
  else if (TO_CAMERA.test(text)) beat.face = 'front';
  else if (TURNS_ROUND.test(text)) beat.face = who && scene.turned.has(who) ? 'front' : 'away';
  else if (object && TURNS_TO.test(text)) beat.face = object;
  if (beat.face) for (const s of [who, ...crowd]) if (s) scene.turned[beat.face === 'away' ? 'add' : 'delete'](s);
  if (subjects.length >= 2 && /\b(?:hugs?|hugging|embraces?)\b/i.test(text)) beat.hug = object ?? subjects[1];
  if (/\b(?:cries|crying|sobs|sobbing|weeps|weeping|bawls|bawling|bursts? into tears|in tears)\b/i.test(text)) beat.mood = 'cry';
  else if (/\b(?:sweats?|sweating)\b/i.test(text)) beat.mood = 'nervous';
  // Several people, or a group that's worked out once we know who's in the scene.
  const team = group ? [group] : crowd;
  if (team.length && !beat.hug && (beat.action || beat.gesture || beat.hold || beat.face)) beat.also = team;
  // Before anything has happened it's how the scene opens; after that it starts then and there.
  const sky = weatherIn(text);
  if (sky) {
    if (scene.beats.length) beat.weather = sky;
    else scene.weather = sky;
  }
  if (vehicle) {
    // Moving a vehicle is the point of the sentence, so only what goes along with it is kept: "jumps in the car" isn't a jump.
    const { moves, caption: words, crowd: reacts, shot: framing, gesture, lookAt, mood, weather } = beat;
    const acting = who && (gesture || lookAt || mood || beat.hold);
    return { ...(moves ? { moves } : {}), ...(words ? { caption: words } : {}), ...(reacts ? { crowd: reacts, sfx: beat.sfx } : {}), ...(framing ? { shot: framing } : {}), ...(weather ? { weather } : {}), ...(vehicle.who ? { who: vehicle.who } : {}), ...(acting ? { who, gesture, lookAt, mood, hold: beat.hold } : {}) };
  }
  if (!beat.moves?.length) delete beat.moves;
  if (!beat.moves && !beat.action && !beat.sfx && !beat.gesture && !beat.effect && !beat.hold && !beat.give && !beat.hug && !beat.mood && !beat.caption && !beat.shot && !beat.lookAt && !beat.face && !beat.crowd && !beat.burst && !beat.drift && !beat.becomes && !beat.weather) return null;
  if ((beat.hold || beat.give) && !who && !beat.also) return beat.moves || beat.action || beat.sfx || beat.gesture || beat.effect || beat.caption || beat.shot || beat.crowd || beat.burst || beat.drift || beat.face || beat.weather ? { ...beat, hold: undefined, give: undefined } : null;
  if (who) beat.who = who;
  return beat;
}

export function parseScript(script: string): Episode {
  const lines = script.replace(/\r/g, '').split('\n');
  let title = '';
  const scenes: RawScene[] = [];
  const allNames: string[] = [];
  const looks: LookNotes = new Map();
  /** A fade or dissolve written at the end of a scene, waiting for the scene it leads into. */
  let nextTransition: Transition | undefined;
  const newScene = (heading: string, interior: boolean): RawScene => {
    const s: RawScene = {
      title: heading ? titleCase(heading.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS|DUSK|DAWN).*$/i, '').trim()) || `Scene ${scenes.length + 1}` : `Scene ${scenes.length + 1}`,
      description: heading,
      set: setFor(heading, interior),
      weather: /\bsnow/i.test(heading) ? 'snow' : 'none',
      blocking: [],
      beats: [],
      vehicles: [],
      riders: new Map(),
      people: [],
      offscreen: new Set(),
      turned: new Set(),
      ...(nextTransition ? { transition: nextTransition } : {}),
    };
    nextTransition = undefined;
    scenes.push(s);
    return s;
  };
  let scene: RawScene | null = null;
  let pendingSpeaker: { name: string; delivery?: string } | null = null;

  // Directions often name people before they speak ("Dad sits on the couch."), so learn every speaker first.
  const speakers: string[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const c = COLON_LINE.exec(line);
    const n = !c && lines[i + 1]?.trim() ? NAME_ONLY.exec(line) : null;
    const name = c && !NOT_A_SPEAKER.test(c[1]) ? c[1] : n && n[1].trim().split(/\s+/).length <= 4 && !NOT_A_NAME.test(n[1]) && !TIME_JUMP.test(line) ? n[1] : '';
    const clean = name && !HEADING.test(line) && !TITLE.test(line) ? titleCase(cleanName(name)) : '';
    if (clean && !speakers.includes(clean)) speakers.push(clean);
  });

  const addLine = (rawName: string, delivery: string | undefined, text: string) => {
    if (!scene) scene = newScene('', false);
    // "(O.S.)" / "(V.O.)" mark a voice from off screen; they aren't acting notes.
    const OFF = /(^|[\s,(])(o\.?s\.?|v\.?o\.?|off[- ]?screen|off)(?=$|[\s,)])/gi;
    const offscreen = /\((O\.?S\.?|V\.?O\.?|OFF)\)/i.test(rawName) || OFF.test(delivery ?? '');
    if (delivery) delivery = delivery.replace(OFF, '$1').replace(/^[\s,]+|[\s,]+$/g, '') || undefined;
    const name = titleCase(cleanName(rawName));
    if (!name) return;
    // A parenthetical at the start of the line is delivery too: "BOB: (yelling) Hey!"
    let body = text.trim();
    const lead = /^\(([^)]*)\)\s*/.exec(body);
    if (lead) {
      delivery = delivery ? `${delivery}, ${lead[1]}` : lead[1];
      body = body.slice(lead[0].length);
    }
    if (!body) return;
    if (!allNames.includes(name)) allNames.push(name);
    if (!scene.people.includes(name)) scene.people.push(name);
    if (offscreen) scene.offscreen.add(name);
    scene.beats.push({ who: name, text: body, delivery: delivery?.trim() || undefined, mood: moodFrom(delivery, body) });
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      pendingSpeaker = null;
      continue;
    }
    const t = TITLE.exec(line);
    if (t) {
      title = t[1].trim();
      continue;
    }
    const h = HEADING.exec(line);
    if (h && (h[1] || line.length < 80)) {
      // EXT means outside, even outside a house or a town hall.
      const interior = /^INT/i.test(h[1] ?? '') || (!/^EXT/i.test(h[1] ?? '') && /\b(inside|interior|room|office|store|shop|house|kitchen|hall|school)\b/i.test(h[2] ?? ''));
      scene = newScene((h[2] || line).trim(), interior);
      pendingSpeaker = null;
      continue;
    }
    if (pendingSpeaker) {
      if (/^\(.*\)$/.test(line)) {
        pendingSpeaker.delivery = line.slice(1, -1);
        continue;
      }
      addLine(pendingSpeaker.name, pendingSpeaker.delivery, line);
      pendingSpeaker = { name: pendingSpeaker.name };
      continue;
    }
    const c = COLON_LINE.exec(line);
    if (c && !NOT_A_SPEAKER.test(c[1])) {
      addLine(c[1], c[3], c[4]);
      continue;
    }
    const n = NAME_ONLY.exec(line);
    if (n && n[1].trim().split(/\s+/).length <= 4 && !NOT_A_NAME.test(n[1]) && !TIME_JUMP.test(line)) {
      pendingSpeaker = { name: n[1] + (n[2] ?? ''), delivery: n[3] };
      continue;
    }
    // Stage direction, a sentence at a time: "Dad sits on the couch. The kids sit on the floor."
    const text = line.replace(/^[[(]|[\])]$/g, '');
    const sentences = text.split(/(?<=[.!?])(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Mt|Lt|Sgt|Prof)\.)\s+(?=[A-Z])|;\s+/).filter((sentence) => {
      const change = SCREEN_CHANGE.exec(sentence);
      if (change) nextTransition = /^d/i.test(change[1]) ? 'dissolve' : 'fade';
      return !change;
    });
    if (!sentences.length) continue;
    if (!scene) scene = newScene('', false);
    if (!scene.description) scene.description = text;
    const known = [...new Set([...speakers, ...allNames, ...scene.people])];
    for (const sentence of sentences) {
      const b = actionBeat(sentence, known, scene, looks);
      if (b) scene.beats.push(b);
    }
  }

  // Block everyone who talks or moves: spread across the stage, entrances start off stage.
  for (const s of scenes) {
    // "The kids" and "everyone" are whoever turns out to be in the scene.
    const isVehicle = (id: string) => s.vehicles.some((v) => v.id === id);
    // Anyone a direction has doing something is there, even if they never move or speak.
    const acting = s.beats.flatMap((b) => [b.who, ...(b.also ?? []), b.lookAt, b.give, b.hug].filter((p): p is string => !!p && !p.startsWith('*')));
    const present = [...new Set([...s.people, ...s.beats.flatMap((b) => b.moves?.map((m) => m.who) ?? []), ...acting])].filter((p) => !p.startsWith('*') && !s.offscreen.has(p) && !isVehicle(p));
    const kids = present.filter((p) => !looksAdult(p));
    for (const b of s.beats) {
      if (!b.moves?.some((m) => m.who.startsWith('*'))) continue;
      b.moves = b.moves.flatMap((m) => (m.who.startsWith('*') ? (m.who === KIDS && kids.length ? kids : present).map((p) => ({ ...m, who: p })) : [m]));
    }
    for (const b of s.beats) {
      if (!b.also?.some((w) => w.startsWith('*'))) continue;
      const team = b.also.flatMap((w) => (w === KIDS && kids.length ? kids : w.startsWith('*') ? present : [w]));
      b.who ??= team[0];
      b.also = team.filter((w) => w !== b.who);
    }
    for (const b of s.beats) {
      if (b.slogan) for (const p of [b.who, ...(b.also ?? [])]) if (p) (looks.get(p) ?? looks.set(p, {}).get(p)!).signText ??= b.slogan;
    }
    // Sitting down before anyone has said a word is how the scene starts.
    const firstLine = s.beats.findIndex((b) => b.text);
    const seated = new Map<string, string>();
    const lying = new Set<string>();
    const onScreen = new Set<string>();
    s.beats.forEach((b, i) => {
      if (firstLine >= 0 && i > firstLine) return;
      b.moves = b.moves?.filter((m) => {
        const earlier = s.beats.slice(0, i).some((pb) => pb.moves?.some((pm) => pm.who === m.who));
        if (m.kind === 'joinScreen' && !earlier) {
          onScreen.add(m.who);
          return false;
        }
        if ((m.kind !== 'sit' && m.kind !== 'lie') || earlier) return true;
        seated.set(m.who, m.on ?? 'seat');
        if (m.kind === 'lie') lying.add(m.who);
        return false;
      });
      if (b.moves && !b.moves.length) delete b.moves;
    });
    s.beats = s.beats.filter((b) => b.text || b.moves || b.action || b.sfx || b.effect || b.gesture || b.hold || b.give || b.hug || b.mood || b.caption || b.shot || b.lookAt || b.face || b.crowd || b.burst || b.drift || b.becomes || b.weather);
    // A built set gets the furniture people sit on: "sit at a table" in a bar needs a table.
    const sits = [...seated].map(([who, on]) => ({ who, on }));
    for (const m of s.beats.flatMap((b) => b.moves ?? [])) if (m.kind === 'sit' || m.kind === 'lie') sits.push({ who: m.who, on: m.on ?? 'seat' });
    const furnish = (set: RawScene['set'], asked: string[]) => {
      if (set.kind !== 'kit') return;
      [...new Set(asked)]
        .filter((k) => k !== 'floor' && k !== 'ground')
        .forEach((k, i) => {
          const type = set.place === 'exterior' && !['bench', 'rock', 'log'].includes(k) ? 'bench' : SEAT_PIECES[k] ?? 'chair';
          if (!set.pieces.some((p) => (p as { type?: string }).type === type)) set.pieces.push({ type, x: [800, 460, 1140][i % 3] });
        });
    };
    const faraway = (who: string) => !!s.split?.who.includes(who);
    furnish(s.set, sits.filter((x) => !faraway(x.who)).map((x) => x.on));
    if (s.split) furnish(s.split.set, sits.filter((x) => faraway(x.who)).map((x) => x.on));
    const people = [...new Set([...s.people, ...seated.keys(), ...onScreen, ...s.beats.flatMap((b) => b.moves?.map((m) => m.who) ?? []), ...acting, ...(s.split?.who ?? [])])].filter((p) => !isVehicle(p));
    for (const p of onScreen) s.offscreen.delete(p);
    const onstage = people.filter((p) => !s.offscreen.has(p) && !s.riders.has(p) && !onScreen.has(p));
    // A call has two ends: whoever the split names, and whoever on this side talks first if it doesn't say.
    const onCall = new Set(s.split?.who.length ? [...s.split.who, s.split.caller ?? s.beats.find((b) => b.text && b.who && !faraway(b.who))?.who ?? ''] : []);
    // Spread out whoever's standing; people seated at the start head for the seat nearest their own spot.
    const standing = onstage.filter((p) => !seated.has(p));
    // Each half of a split screen is its own narrow stage, so people there stand closer together.
    const spread = (i: number, n: number) => (n === 1 ? 800 : s.split ? Math.round(800 + (i - (n - 1) / 2) * Math.min(300, 560 / (n - 1))) : Math.round(330 + (i * (1270 - 330)) / (n - 1)));
    onstage.forEach((p) => {
      const sameSide = (q: string) => faraway(q) === faraway(p);
      const beside = (list: string[]) => spread(list.filter(sameSide).indexOf(p), list.filter(sameSide).length);
      const x = beside(seated.has(p) ? onstage : standing);
      const firstMove = s.beats.find((b) => b.moves?.some((m) => m.who === p))?.moves?.find((m) => m.who === p);
      const firstLine = s.beats.findIndex((b) => b.who === p && b.text);
      const firstMoveIdx = s.beats.findIndex((b) => b.moves?.some((m) => m.who === p));
      const arrives = firstMove?.kind === 'enter' || firstMove?.kind === 'appear' || firstMove?.kind === 'joinScreen';
      const entersLater = arrives && (firstLine === -1 || firstMoveIdx < firstLine);
      if (arrives) firstMove.x = x;
      // Someone another character turns into isn't there until it happens.
      const madeAt = s.beats.findIndex((b) => b.becomes === p);
      const madeLater = madeAt >= 0 && (firstLine === -1 || madeAt < firstLine) && (firstMoveIdx === -1 || madeAt < firstMoveIdx);
      const sit = seated.get(p);
      s.blocking.push({ who: p, x, depth: 0, mood: 'happy', ...(entersLater || madeLater ? { offstage: true } : {}), ...(sit ? (lying.has(p) ? { lie: sit } : { sit }) : {}), ...(onCall.has(p) ? { hold: 'phone' } : {}) });
    });
    for (const p of onScreen) s.blocking.push({ who: p, x: 800, depth: 0, mood: 'happy', screen: true });
    for (const [p, v] of s.riders) s.blocking.push({ who: p, x: 800, depth: 0, mood: 'happy', in: v });
    for (const p of s.offscreen) if (!onstage.includes(p)) s.blocking.push({ who: p, x: 800, depth: 0, mood: 'happy', offstage: true });
    // A little camera grammar: big emotional lines get a close-up, then cut back wide.
    let close = false;
    for (const b of s.beats) {
      // The script asked for this shot, and it stays until something else changes it.
      if (b.shot) {
        close = false;
        continue;
      }
      if (!b.text) {
        // A car through the wall or a puff of smoke wants the whole stage in view.
        // So does anything the arms or the crowd do, which a close-up would crop.
        if (close && (b.moves?.length || b.sfx || b.effect || b.gesture || b.action || b.hold || b.give || b.hug || b.crowd || b.burst || b.drift || b.becomes)) {
          b.shot = { type: 'wide' };
          close = false;
        }
        continue;
      }
      if ((b.mood === 'rage' || b.mood === 'shock') && b.who && !s.offscreen.has(b.who)) {
        b.shot = { type: 'close', on: [b.who] };
        close = true;
      } else if (close) {
        b.shot = { type: 'wide' };
        close = false;
      }
    }
  }

  const raw = {
    title: title || (scenes[0]?.title ? `The ${scenes[0].title} Incident` : 'Untitled Episode'),
    cast: allNames.map((name) => ({ name, bio: looksAdult(name) ? 'a grown-up in town' : 'a kid in town', ...(looks.has(name) ? { look: looks.get(name) } : {}) })),
    scenes: scenes.map(({ people: _p, offscreen: _o, riders: _r, ...rest }) => rest),
  };
  return normalizeEpisode(raw, script);
}

export const SAMPLE_SCRIPT = `TITLE: The Snow Day Scheme

EXT. BUS STOP - MORNING
Dex, Benny and Priya wait at the bus stop. Priya walks her dog.

BENNY: Dude, the internet says flushing ice cubes makes it snow so much they cancel school.
DEX: (deadpan) That's the dumbest thing I've ever heard.
PRIYA: (excited) It's science, Dex! Everything on the internet is science!
BENNY: My cousin in Denver got a snow day. Explain THAT.
Dex eats a hotdog and looks at Benny.
BENNY: (smug) Chicken?
Dex turns into a chicken.
DEX: (deadpan) ...Okay, I'm in.
The school bus pulls up.
The kids get on the bus.
The bus drives off.

INT. CLASSROOM - DAY
Mr. Hargrove stands at the chalkboard. The kids sit at their desks.

MR. HARGROVE: Today, children, the water cycle.
Mr. Hargrove faces the chalkboard as the camera pans to Priya.
BENNY: (whispering) Psst. How many did you flush?
PRIYA: (proud) Four hundred. My mom thinks the freezer is haunted.
DEX: (whispering) Flush harder.
Mr. Hargrove turns around.
MR. HARGROVE: (yelling) Benny! Care to share with the class?
BENNY: (nervous) Uhh... the water cycle is when you flush ice and the sky gets jealous?
MR. HARGROVE: That is the stupidest... actually, that's not totally wrong.
Mr. Hargrove faints.
FADE OUT.

INT. BATHROOM - DAY
SPLIT SCREEN: Priya and Dex on main street.
Priya sits on the toilet.

PRIYA: (nervous) The toilet's humming.
DEX: (deadpan) Keep flushing.
The toilet explodes and Priya covers her ears.
A plunger falls through the ceiling.
PRIYA: (crying) Now my mom thinks the toilet's haunted too!
DISSOLVE TO:

INT. LIVING ROOM - DAY
Benny lies on the couch. The Anchor appears on the TV.

ANCHOR: This town is out of ice. Experts are baffled.
Benny drinks a soda.
BENNY: (sick) It's warm.
Benny vomits.

INT. GROCERY STORE - NIGHT
A line of angry townspeople waits for ice.

CASHIER: Sir, that's your ninth cart of ice this week.
DEX: (deadpan) It's for science.
The camera follows Dex as he sneaks up to the Cashier.
Dex hands the money to the Cashier as the crowd boos and we pull back.
Officer Plunkett drives through the wall in his police car.
The crowd panics.
OFFICER PLUNKETT: (nervous) Sorry. Icy roads.
CASHIER: (shocked) Oh my God. Is it... snowing?

EXT. MAIN STREET - NIGHT
A crowd of townspeople fills the street.
Dex and Benny run in holding signs that read "SNOW DAY NOW".
It starts snowing.
DEX: (triumphant) We did it! No school tomorrow!
Dex and Benny dance as the crowd cheers while a caption reads "Science works."
PRIYA (O.S.): Dex! Tomorrow's Saturday!
The crowd gasps as we zoom in on Dex.
DEX: (sad) ...Aw, crap.
Benny throws a snowball at Dex.
`;
