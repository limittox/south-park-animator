import type { MoodId } from './types';
import { normalizeEpisode, looksAdult, propId } from './normalize';
import type { Episode, Transition } from './types';

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
const NOT_A_NAME = /^(FADE|CUT|SMASH CUT|MATCH CUT|DISSOLVE|THE END|END|INT|EXT)\b/;
/** Labels, not people: "NOTE: ...", "CAPTION: Later that night". */
const NOT_A_SPEAKER = /^(note|fade|cut|title|caption|super|subtitle|title card|on[- ]?screen(?: text)?)$/i;
/** "Fade to black.", "The screen fades out.", "DISSOLVE TO:" say how the next scene starts. "The ghost fades away" doesn't. */
const SCREEN_CHANGE = /^(?:(?:slow|quick)(?:ly)? )?(?:the (?:screen|scene|picture|image) (?:slowly |quickly )?)?(fades?|dissolves?)\b/i;
/** `A caption reads "1982."`, `The sign says "Closed."` */
const CAPTION_READS = /\b(?:caption|title card|subtitle|card|sign|banner|chyron)\b[^"“”]{0,30}?\b(?:reads?|says?|shows?)\b[^"“”]{0,12}["“]([^"”]+)["”]/i;
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
  lookAt?: string;
  caption?: string;
}

interface RawScene {
  title: string;
  description: string;
  set: { kind: 'preset'; preset: string } | { kind: 'kit'; place: 'interior' | 'exterior'; time: string; pieces: unknown[] };
  weather: string;
  blocking: { who: string; x: number; depth: number; mood: MoodId; offstage?: boolean; sit?: string; in?: string }[];
  beats: RawBeat[];
  vehicles: { id: string; type: string; x: number; offstage: boolean; lane?: 'front' }[];
  /** Who starts the scene inside which vehicle. */
  riders: Map<string, string>;
  people: string[];
  offscreen: Set<string>;
  transition?: Transition;
}

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
const PROP_VERB = /\b(?:picks? up|grabs?|takes? out|pulls? out|holds? up|holds|is holding|holding|clutches|clutching|carries|carrying|eats?|drinks?|sips?|reads?|waves? around|opens?)\s+(?:a|an|the|his|her|their|some)?\s*([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/i;

const MOOD_WORDS: [RegExp, MoodId][] = [
  [/\b(scream|screaming|yell|yelling|shout|shouting|furious|rage|enraged)\b/i, 'rage'],
  [/\b(angry|annoyed|mad|irritated|frustrated|stern)\b/i, 'angry'],
  [/\b(sad|crying|cries|sob|sobbing|depressed|upset|tearful)\b/i, 'sad'],
  [/\b(shock|shocked|surprised|gasp|gasps|stunned|horrified|scared|terrified|nervous|afraid)\b/i, 'shock'],
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
  for (const [re, preset] of PRESET_WORDS) if (re.test(heading)) return { kind: 'preset', preset };
  const time = /night|evening|midnight/i.test(heading) ? 'night' : /dusk|sunset|dawn/i.test(heading) ? 'dusk' : 'day';
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
    .replace(/(^|[\s.'-])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase())
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

/** On-screen text in a direction. */
function captionIn(text: string): string | undefined {
  const line = text.trim();
  return (CAPTION_READS.exec(line) ?? CAPTION_LABEL.exec(line))?.[1] ?? (TIME_JUMP.test(line) ? line : undefined);
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
function actionBeat(direction: string, known: string[], scene: RawScene): RawBeat | null {
  // What a caption says isn't something happening on stage.
  const caption = captionIn(direction);
  const text = caption ? direction.replace(caption, '') : direction;
  // Subjects in the order the direction names them: "Dex hands the money to Priya". Names count as written
  // ("Stan", "STAN"): not the word "phone" for a character called Phone, and not "Stan's living room".
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const at = (n: string) => text.search(new RegExp(`\\b(?:${esc(n)}|${esc(n.toUpperCase())})\\b(?!['’]s\\b)`));
  const subjects = known.filter((n) => at(n) >= 0).sort((a, b) => at(a) - at(b));
  const group = subjects.length ? null : KID_WORDS.test(text) ? KIDS : ALL_WORDS.test(text) ? EVERYONE : null;
  const vehicle = vehicleBeat(text, subjects, group, scene);
  if (vehicle) return vehicle;
  const beat: RawBeat = {};
  const who = subjects[0];
  if (caption) beat.caption = caption;
  const shot = cameraIn(text, subjects);
  if (shot) beat.shot = shot;
  const run = /\b(runs?|running|dash(es)?|sprints?|races?|rushes|bolts?)\b/i.test(text);
  if (/\b(enters?|walks? in|comes? in|arrives?|runs? in|shows? up|steps? in|rushes in|bursts? in)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'enter', ...(run ? { run } : {}) }));
  } else if (/\b(leaves?|exits?|walks? (off|out|away)|storms? off|runs? (off|away|out)|goes? home|bolts?|flees)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'exit', ...(run ? { run } : {}) }));
  } else if (/\b(sits?|sitting|sat|takes? a seat|plops? down|flops? down)\b/i.test(text)) {
    const seat = SEAT_WORDS.exec(text)?.[1]?.toLowerCase();
    const on = seat === 'sofa' ? 'couch' : seat === 'campfire' ? 'log' : seat?.replace(/s$/, '');
    beat.moves = (subjects.length ? subjects : group ? [group] : []).map((s) => ({ who: s, kind: 'sit', ...(on ? { on } : {}) }));
  } else if (/\b(stands? up|gets? up|jumps? up(?! and down)|rises|leaps? up)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : group ? [group] : []).map((s) => ({ who: s, kind: 'stand' }));
  } else if (/\b(vanish(es)?|disappears?|poofs?)\b/i.test(text)) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'vanish' }));
  } else if (/\b(appears?|pops? up|materiali[sz]es?)\b/i.test(text)) {
    beat.moves = subjects.map((s) => ({ who: s, kind: 'appear' }));
  }
  const prop = propIn(text);
  const giving = /\b(hands?|gives?|passes?|offers?|tosses)\b/i.test(text);
  if (giving && subjects.length >= 2) {
    beat.give = subjects[1];
    if (prop) beat.hold = prop;
  } else if (prop) beat.hold = prop;
  else if (/\b(drops?|puts? (it |them )?(down|away)|throws? (it )?away|pockets?)\b/i.test(text)) beat.hold = 'none';
  if (/\b(faints?|passes out|collapses?|falls? (over|down)|dies)\b/i.test(text)) beat.action = 'faint';
  else if (/\b(bounces?|bouncing|(?:jumps?|jumping|hops?|hopping) up and down)\b/i.test(text)) beat.action = 'bounce';
  else if (/\b(jumps?|leaps?)\b/i.test(text)) beat.action = 'jump';
  else if (/\b(shakes?|trembles?|shivers?)\b/i.test(text)) beat.action = 'shake';
  else if (/\b(spins?|twirls?)\b/i.test(text)) beat.action = 'spin';
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
  else if (/\bpops?\b/i.test(text)) beat.sfx = 'pop';
  if (/\bflash(es)?\b/i.test(text) && !beat.effect) beat.effect = 'flash';
  if (/\bwaves?\b/i.test(text)) beat.gesture = 'wave';
  if (/\bpoints?\b/i.test(text)) beat.gesture = 'point';
  if (subjects.length >= 2 && /\b(?:looks?|glances?|stares?|glares?|peeks?)\s+(?:\w+\s+)?at\b|\bside-?eyes\b/i.test(text)) beat.lookAt = subjects[1];
  if (/\bsnow(ing|s)?\b/i.test(text) && /\b(start|begin|it'?s)\b/i.test(text)) scene.weather = 'snow';
  if (!beat.moves?.length) delete beat.moves;
  if (!beat.moves && !beat.action && !beat.sfx && !beat.gesture && !beat.effect && !beat.hold && !beat.give && !beat.caption && !beat.shot && !beat.lookAt) return null;
  if ((beat.hold || beat.give) && !who) return beat.moves || beat.action || beat.sfx || beat.gesture || beat.effect || beat.caption || beat.shot ? { ...beat, hold: undefined, give: undefined } : null;
  if (who) beat.who = who;
  return beat;
}

export function parseScript(script: string): Episode {
  const lines = script.replace(/\r/g, '').split('\n');
  let title = '';
  const scenes: RawScene[] = [];
  const allNames: string[] = [];
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
      const b = actionBeat(sentence, known, scene);
      if (b) scene.beats.push(b);
    }
  }

  // Block everyone who talks or moves: spread across the stage, entrances start off stage.
  for (const s of scenes) {
    // "The kids" and "everyone" are whoever turns out to be in the scene.
    const present = [...new Set([...s.people, ...s.beats.flatMap((b) => b.moves?.map((m) => m.who) ?? [])])].filter((p) => !p.startsWith('*') && !s.offscreen.has(p));
    const kids = present.filter((p) => !looksAdult(p));
    for (const b of s.beats) {
      if (!b.moves?.some((m) => m.who.startsWith('*'))) continue;
      b.moves = b.moves.flatMap((m) => (m.who.startsWith('*') ? (m.who === KIDS && kids.length ? kids : present).map((p) => ({ ...m, who: p })) : [m]));
    }
    // Sitting down before anyone has said a word is how the scene starts.
    const firstLine = s.beats.findIndex((b) => b.text);
    const seated = new Map<string, string>();
    s.beats.forEach((b, i) => {
      if (firstLine >= 0 && i > firstLine) return;
      b.moves = b.moves?.filter((m) => {
        const earlier = s.beats.slice(0, i).some((pb) => pb.moves?.some((pm) => pm.who === m.who));
        if (m.kind !== 'sit' || earlier) return true;
        seated.set(m.who, m.on ?? 'seat');
        return false;
      });
      if (b.moves && !b.moves.length) delete b.moves;
    });
    s.beats = s.beats.filter((b) => b.text || b.moves || b.action || b.sfx || b.effect || b.gesture || b.hold || b.give || b.caption || b.shot || b.lookAt);
    // A built set gets the furniture people sit on: "sit at a table" in a bar needs a table.
    const set = s.set;
    if (set.kind === 'kit') {
      const asked = [...seated.values(), ...s.beats.flatMap((b) => b.moves ?? []).filter((m) => m.kind === 'sit').map((m) => m.on ?? 'seat')];
      [...new Set(asked)]
        .filter((k) => k !== 'floor' && k !== 'ground')
        .forEach((k, i) => {
          const type = set.place === 'exterior' && !['bench', 'rock', 'log'].includes(k) ? 'bench' : SEAT_PIECES[k] ?? 'chair';
          if (!set.pieces.some((p) => (p as { type?: string }).type === type)) set.pieces.push({ type, x: [800, 460, 1140][i % 3] });
        });
    }
    const people = [...new Set([...s.people, ...seated.keys(), ...s.beats.flatMap((b) => b.moves?.map((m) => m.who) ?? [])])].filter((p) => !s.vehicles.some((v) => v.id === p));
    const onstage = people.filter((p) => !s.offscreen.has(p) && !s.riders.has(p));
    // Spread out whoever's standing; people seated at the start head for the seat nearest their own spot.
    const standing = onstage.filter((p) => !seated.has(p));
    const spread = (i: number, n: number) => (n === 1 ? 800 : Math.round(330 + (i * (1270 - 330)) / (n - 1)));
    onstage.forEach((p, i) => {
      const x = seated.has(p) ? spread(i, onstage.length) : spread(standing.indexOf(p), standing.length);
      const firstMove = s.beats.find((b) => b.moves?.some((m) => m.who === p))?.moves?.find((m) => m.who === p);
      const firstLine = s.beats.findIndex((b) => b.who === p && b.text);
      const firstMoveIdx = s.beats.findIndex((b) => b.moves?.some((m) => m.who === p));
      const arrives = firstMove?.kind === 'enter' || firstMove?.kind === 'appear';
      const entersLater = arrives && (firstLine === -1 || firstMoveIdx < firstLine);
      if (arrives) firstMove.x = x;
      const sit = seated.get(p);
      s.blocking.push({ who: p, x, depth: 0, mood: 'happy', ...(entersLater ? { offstage: true } : {}), ...(sit ? { sit } : {}) });
    });
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
        if (close && (b.moves?.length || b.sfx || b.effect)) {
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
    cast: allNames.map((name) => ({ name, bio: looksAdult(name) ? 'a grown-up in town' : 'a kid in town' })),
    scenes: scenes.map(({ people: _p, offscreen: _o, riders: _r, ...rest }) => rest),
  };
  return normalizeEpisode(raw, script);
}

export const SAMPLE_SCRIPT = `TITLE: The Snow Day Scheme

EXT. BUS STOP - MORNING
Dex, Benny and Priya wait at the bus stop.

BENNY: Dude, I read on the internet that if you flush ice cubes down the toilet, it snows so much they have to cancel school.
DEX: (deadpan) That's the dumbest thing I've ever heard.
PRIYA: (excited) It's science, Dex! Everything on the internet is science!
DEX: (sarcastic) Oh sure. And I'm the Queen of England.
BENNY: Then explain why my cousin in Denver got a snow day. Huh? Explain THAT.
DEX: ...Okay, I'm in.

INT. CLASSROOM - DAY
Mr. Hargrove stands at the chalkboard. The kids sit at their desks.

MR. HARGROVE: Alright, children. Today we're learning about the water cycle.
BENNY: (whispering) Psst. How many ice cubes did you flush?
PRIYA: (proud) Four hundred. My mom thinks the freezer is haunted.
MR. HARGROVE: (angry) Benny! Is there something you'd like to share with the class?
BENNY: (nervous) Uhh... the water cycle is when you flush ice and the sky gets jealous?
MR. HARGROVE: That is the stupidest... actually, that's not totally wrong.
Mr. Hargrove faints.

INT. GROCERY STORE - NIGHT
Dex walks in with an empty cart. The cashier stares at him.

CASHIER: Sir, that's your ninth cart of ice this week.
DEX: (deadpan) It's for science.
CASHIER: (shocked) Oh my God. Is it... snowing?
DEX: (triumphant) We did it! No school tomorrow!
PRIYA (O.S.): Dex! Tomorrow's Saturday!
DEX: (sad) ...Aw, crap.
`;
