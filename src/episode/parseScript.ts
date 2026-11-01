import type { MoodId } from './types';
import { normalizeEpisode, looksAdult } from './normalize';
import type { Episode } from './types';

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

interface RawBeat {
  who?: string;
  text?: string;
  delivery?: string;
  mood?: MoodId;
  action?: string;
  moves?: { who: string; kind: string; side?: string; x?: number }[];
  sfx?: string;
  effect?: string;
  shot?: { type: string; on?: string[] };
  gesture?: string;
}

interface RawScene {
  title: string;
  description: string;
  set: { kind: 'preset'; preset: string } | { kind: 'kit'; place: 'interior' | 'exterior'; time: string; pieces: unknown[] };
  weather: string;
  blocking: { who: string; x: number; depth: number; mood: MoodId; offstage?: boolean }[];
  beats: RawBeat[];
  people: string[];
  offscreen: Set<string>;
}

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
  return name.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase());
}

/** Turn plain-English stage directions into moves and actions where we can recognise them. */
function actionBeat(text: string, known: string[], scene: RawScene): RawBeat | null {
  const subjects = known.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  const beat: RawBeat = {};
  const who = subjects[0];
  if (/\b(enters?|walks? in|comes? in|arrives?|runs? in|shows? up|steps? in)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'enter' }));
  } else if (/\b(leaves?|exits?|walks? (off|out|away)|storms? off|runs? (off|away|out)|goes? home)\b/i.test(text)) {
    beat.moves = (subjects.length ? subjects : []).map((s) => ({ who: s, kind: 'exit' }));
  }
  if (/\b(faints?|passes out|collapses?|falls? (over|down)|dies)\b/i.test(text)) beat.action = 'faint';
  else if (/\b(jumps?|leaps?)\b/i.test(text)) beat.action = 'jump';
  else if (/\b(shakes?|trembles?|shivers?)\b/i.test(text)) beat.action = 'shake';
  else if (/\b(spins?|twirls?)\b/i.test(text)) beat.action = 'spin';
  if (/\bexplo(des?|sion)\b/i.test(text)) {
    beat.sfx = 'explosion';
    beat.effect = 'flash';
  } else if (/\bfarts?\b/i.test(text)) beat.sfx = 'fart';
  else if (/\b(slaps?)\b/i.test(text)) beat.sfx = 'slap';
  else if (/\b(crash(es)?|smash(es)?)\b/i.test(text)) beat.sfx = 'crash';
  else if (/\bdoorbell\b/i.test(text)) beat.sfx = 'doorbell';
  if (/\bwaves?\b/i.test(text)) beat.gesture = 'wave';
  if (/\bpoints?\b/i.test(text)) beat.gesture = 'point';
  if (/\bsnow(ing|s)?\b/i.test(text) && /\b(start|begin|it'?s)\b/i.test(text)) scene.weather = 'snow';
  if (!beat.moves?.length) delete beat.moves;
  if (!beat.moves && !beat.action && !beat.sfx && !beat.gesture && !beat.effect) return null;
  if (who) beat.who = who;
  return beat;
}

export function parseScript(script: string): Episode {
  const lines = script.replace(/\r/g, '').split('\n');
  let title = '';
  const scenes: RawScene[] = [];
  const allNames: string[] = [];
  const newScene = (heading: string, interior: boolean): RawScene => {
    const s: RawScene = {
      title: heading ? titleCase(heading.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS|DUSK|DAWN).*$/i, '').trim()) || `Scene ${scenes.length + 1}` : `Scene ${scenes.length + 1}`,
      description: heading,
      set: setFor(heading, interior),
      weather: /\bsnow/i.test(heading) ? 'snow' : 'none',
      blocking: [],
      beats: [],
      people: [],
      offscreen: new Set(),
    };
    scenes.push(s);
    return s;
  };
  let scene: RawScene | null = null;
  let pendingSpeaker: { name: string; delivery?: string } | null = null;

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
      const interior = /^INT/i.test(h[1] ?? '') || /\b(inside|interior|room|office|store|shop|house|kitchen|hall|school)\b/i.test(h[2] ?? '');
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
    if (c && !/^(note|fade|cut|title)$/i.test(c[1])) {
      addLine(c[1], c[3], c[4]);
      continue;
    }
    const n = NAME_ONLY.exec(line);
    if (n && n[1].trim().split(/\s+/).length <= 4 && !/^(FADE|CUT|THE END|END)\b/.test(n[1])) {
      pendingSpeaker = { name: n[1] + (n[2] ?? ''), delivery: n[3] };
      continue;
    }
    // Stage direction.
    if (!scene) scene = newScene('', false);
    const text = line.replace(/^[[(]|[\])]$/g, '');
    if (!scene.description) scene.description = text;
    const known = [...new Set([...allNames, ...scene.people])];
    const b = actionBeat(text, known, scene);
    if (b) scene.beats.push(b);
  }

  // Block everyone who talks or moves: spread across the stage, entrances start off stage.
  for (const s of scenes) {
    const people = [...new Set([...s.people, ...s.beats.flatMap((b) => b.moves?.map((m) => m.who) ?? [])])];
    const onstage = people.filter((p) => !s.offscreen.has(p));
    onstage.forEach((p, i) => {
      const n = onstage.length;
      const x = n === 1 ? 800 : Math.round(330 + (i * (1270 - 330)) / (n - 1));
      const firstMove = s.beats.find((b) => b.moves?.some((m) => m.who === p))?.moves?.find((m) => m.who === p);
      const firstLine = s.beats.findIndex((b) => b.who === p && b.text);
      const firstMoveIdx = s.beats.findIndex((b) => b.moves?.some((m) => m.who === p));
      const entersLater = firstMove?.kind === 'enter' && (firstLine === -1 || firstMoveIdx < firstLine);
      if (firstMove?.kind === 'enter') firstMove.x = x;
      s.blocking.push({ who: p, x, depth: 0, mood: 'happy', ...(entersLater ? { offstage: true } : {}) });
    });
    for (const p of s.offscreen) if (!onstage.includes(p)) s.blocking.push({ who: p, x: 800, depth: 0, mood: 'happy', offstage: true });
    // A little camera grammar: big emotional lines get a close-up, then cut back wide.
    let close = false;
    for (const b of s.beats) {
      if (!b.text) continue;
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
    scenes: scenes.map(({ people: _p, offscreen: _o, ...rest }) => rest),
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
