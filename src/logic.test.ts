import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FrameSvg } from './render/FrameSvg';
import { parseScript, SAMPLE_SCRIPT } from './episode/parseScript';
import { PROMPT_EXAMPLE, PROMPT_PLACES, scriptWritingPrompt } from './episode/writingPrompt';
import { stripCodeFences } from './lib/clipboard';
import { normalizeEpisode, normalizeLook, resolveCast, stockCharacter } from './episode/normalize';
import { audioCues, cameraFor, compileEpisode, estimateLineSeconds, FPS, locate, POSE_FPS, sampleEpisode, syntheticEnvelope, transitionTime, WIDE, type ClipMap, type SceneFrame, type TitleFrame } from './episode/timeline';
import { repositionActor, setMoodAt } from './episode/edit';
import { applyCrew, applyEdit } from './ai/director';
import { extractJson } from './ai/openrouter';
import { envelope, processVoice, resample, timeStretch, trimSilence } from './audio/dsp';
import { directionMode, speechFormat, speechRequest } from './audio/voices';
import { poseArms, restArms } from './character/pose';
import { getGeo, seatedGeo } from './character/geometry';
import { CharacterGroup } from './character/Character';
import { talkingMouth } from './character/parts/face';
import { mouthTrack, sounds } from './episode/lipSync';
import { DEFAULT_CHARACTER } from './data/defaults';
import type { Episode } from './episode/types';

const sample = () => parseScript(SAMPLE_SCRIPT);

describe('parseScript', () => {
  it('reads the sample: title, three scenes, the cast and every line', () => {
    const ep = sample();
    expect(ep.title).toBe('The Snow Day Scheme');
    expect(ep.scenes).toHaveLength(3);
    expect(ep.cast.map((c) => c.name).sort()).toEqual(['Benny', 'Cashier', 'Dex', 'Mr. Hargrove', 'Priya']);
    const lines = ep.scenes.flatMap((s) => s.beats).filter((b) => b.text);
    expect(lines).toHaveLength(18);
  });

  it('picks sets from scene headings', () => {
    const ep = sample();
    expect(ep.scenes[0].set).toMatchObject({ kind: 'preset', preset: 'busstop' });
    expect(ep.scenes[1].set).toMatchObject({ kind: 'preset', preset: 'classroom' });
    expect(ep.scenes[2].set).toMatchObject({ kind: 'kit', place: 'interior', time: 'night' });
  });

  it('turns parentheticals into delivery and mood, and stage directions into actions', () => {
    const ep = sample();
    const scene2 = ep.scenes[1];
    const angry = scene2.beats.find((b) => b.text?.startsWith('Benny! Is there'));
    expect(angry?.delivery).toBe('angry');
    expect(angry?.mood).toBe('angry');
    expect(scene2.beats.some((b) => b.action === 'faint' && b.who === 'mr-hargrove')).toBe(true);
  });

  it('keeps off-screen voices off stage', () => {
    const ep = sample();
    const priya = ep.scenes[2].blocking.find((b) => b.who === 'priya');
    expect(priya?.offstage).toBe(true);
  });

  it('handles screenplay layout (name on its own line)', () => {
    const ep = parseScript('INT. KITCHEN - NIGHT\n\nMOM\n(worried)\nWhere have you been?\n\nKID\nNowhere.\n');
    const lines = ep.scenes[0].beats.filter((b) => b.text);
    expect(lines.map((b) => [b.who, b.text, b.delivery])).toEqual([
      ['mom', 'Where have you been?', 'worried'],
      ['kid', 'Nowhere.', undefined],
    ]);
    expect(ep.cast.find((c) => c.id === 'mom')?.look.body).not.toBe('kid');
  });
});

describe('parseScript stage business', () => {
  it('sits, stands, runs, passes props and rides in cars', () => {
    const ep = parseScript(`INT. LIVING ROOM - NIGHT
Dad sits on the couch. The kids sit on the floor.
DAD: Remote.
BENNY: Here.
Benny hands the remote to Dad.
DAD: Thanks.
Dad stands up.
Priya runs off.
PRIYA: Bye!

EXT. MAIN STREET - DAY
Mom drives up in her car.
MOM: Get in, Benny!
Benny picks up a snowball.
Benny gets in the car.
They drive off.`);
    const [home, street] = ep.scenes;
    const block = (s: typeof home, id: string) => s.blocking.find((b) => b.who === id)!;
    // Sitting before the first line is how the scene starts.
    expect(block(home, 'dad').sit).toBe('couch');
    expect(block(home, 'benny').sit).toBe('floor');
    expect(block(home, 'priya').sit).toBe('floor');
    const give = home.beats.find((b) => b.give)!;
    expect(give).toMatchObject({ who: 'benny', give: 'dad', hold: 'remote' });
    expect(home.beats.some((b) => b.moves?.some((m) => m.who === 'dad' && m.kind === 'stand'))).toBe(true);
    expect(home.beats.flatMap((b) => b.moves ?? []).find((m) => m.who === 'priya')).toMatchObject({ kind: 'exit', run: true });

    expect(street.vehicles).toEqual([{ id: 'car-1', type: 'car', x: 800, offstage: true }]);
    expect(block(street, 'mom').in).toBe('car-1');
    const moves = street.beats.flatMap((b) => b.moves ?? []);
    expect(moves).toContainEqual({ who: 'car-1', kind: 'enter', x: 800 });
    expect(moves).toContainEqual({ who: 'benny', kind: 'getIn', on: 'car-1' });
    expect(moves).toContainEqual({ who: 'car-1', kind: 'exit' });
    expect(street.beats.find((b) => b.hold)).toMatchObject({ who: 'benny', hold: 'snowball' });
  });

  it('reads screenplay-style descriptions the way they are meant', () => {
    const ep = parseScript(`EXT. KENNY HOUSE - DAY
REPORTER stands outside the house. REPORTER, a TV journalist holding a microphone.
REPORTER: Tom, I'm outside.

INT. CLINIC - DAY
CARTMAN sits at a desk; BUTTERS wears a lab coat; RANDY waits beside a tray, holding his phone.
CARTMAN: Next!
RANDY: Me.
PHONE (O.S.): Who is calling?
CARTMAN collapses.
CARTMAN jumps.

INT. LIVING ROOM - DAY
RANDY and MARVIN sit on the couch in Stan's living room.
MAYOR MCDANIELS (O.S.): Testing is mandatory.
There is a flash and Randy vanishes. STAN appears.
STAN: Dad?`);
    const [outside, clinic, home] = ep.scenes;
    expect(outside.set).toMatchObject({ kind: 'kit', place: 'exterior' });
    expect(outside.beats.find((b) => b.hold)).toMatchObject({ who: 'reporter', hold: 'microphone' });
    // Only Cartman sits, at a desk the built set gets; "his phone" is a prop, not the PHONE character.
    expect(clinic.blocking.filter((b) => b.sit).map((b) => b.who)).toEqual(['cartman']);
    expect(clinic.set.kind === 'kit' && clinic.set.pieces.some((p) => p.type === 'desk')).toBe(true);
    expect(clinic.blocking.find((b) => b.who === 'phone')?.offstage).toBe(true);
    expect(clinic.beats.find((b) => b.hold)).toMatchObject({ who: 'randy', hold: 'phone' });
    // Stan's living room doesn't put Stan in it; he appears later, after Randy vanishes in a flash.
    expect(home.blocking.find((b) => b.who === 'stan')?.offstage).toBe(true);
    expect(home.beats.flatMap((b) => b.moves ?? [])).toEqual(expect.arrayContaining([expect.objectContaining({ who: 'randy', kind: 'vanish' }), expect.objectContaining({ who: 'stan', kind: 'appear' })]));
    expect(home.beats.find((b) => b.moves?.some((m) => m.kind === 'vanish'))?.effect).toBe('flash');
    expect(ep.cast.map((c) => c.name)).toContain('Mayor McDaniels');

    // A faint lasts until they next do something.
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const sc = c.scenes[1];
    const jump = sc.beats.find((b) => b.beat.action === 'jump')!;
    const cartman = (t: number) => (sampleEpisode(c, sc.start + t) as SceneFrame).actors.find((a) => a.castId === 'cartman')!;
    expect(cartman(jump.start - 0.05).rotate).toBe(-90);
    expect(cartman(jump.start + 0.1).rotate).toBe(0);
  });

  it('seats the sample classroom kids at their desks', () => {
    const classroom = parseScript(SAMPLE_SCRIPT).scenes[1];
    const seated = classroom.blocking.filter((b) => b.sit);
    expect(seated.map((b) => b.who).sort()).toEqual(['benny', 'priya']);
    expect(seated.every((b) => b.sit === 'desk')).toBe(true);
  });
});

describe('AI writing prompt', () => {
  it("teaches a format the parser reads: the prompt's own example parses fully", () => {
    const ep = parseScript(PROMPT_EXAMPLE);
    expect(ep.title).toBe('The Lemonade Loophole');
    expect(ep.scenes[0].set).toMatchObject({ kind: 'preset', preset: 'mainstreet' });
    expect(ep.cast.map((c) => c.name).sort()).toEqual(['Gus', 'Officer Plunkett', 'Tilly']);
    const beats = ep.scenes[0].beats;
    expect(beats.filter((b) => b.text)).toHaveLength(5);
    expect(beats.find((b) => b.who === 'officer-plunkett')?.delivery).toBe('nervous');
    expect(beats.some((b) => b.action === 'jump' && b.who === 'gus')).toBe(true);
    expect(beats.some((b) => b.moves?.some((m) => m.who === 'gus' && m.kind === 'exit'))).toBe(true);
    expect(ep.scenes[0].blocking.find((b) => b.who === 'tilly')?.offstage).toBe(true);
  });

  it('only promises hand-drawn sets for places that have one', () => {
    for (const place of PROMPT_PLACES) {
      const ep = parseScript(`EXT. ${place.toUpperCase()} - DAY\nA: Hi.`);
      expect(ep.scenes[0].set.kind, place).toBe('preset');
    }
  });

  it('carries the crew names and draft along when there are some', () => {
    const plain = scriptWritingPrompt();
    expect(plain).toContain('Ask me what the episode is about');
    expect(plain).not.toContain('MY CHARACTERS');
    expect(plain).not.toContain('MY DRAFT');
    const full = scriptWritingPrompt({ crew: ['Dex', 'Priya'], draft: 'TITLE: Mine\nDEX: Hi.' });
    expect(full).toContain('spelled exactly like this: Dex, Priya.');
    expect(full).toMatch(/MY DRAFT\nTITLE: Mine\nDEX: Hi\.$/);
    expect(full).toContain('Read my draft');
  });

  it('does what it promises for captions, scene changes and the camera', () => {
    const prompt = scriptWritingPrompt();
    for (const words of ['bounces up and down', 'looks at', 'A caption reads', 'FADE OUT.', 'DISSOLVE TO:', 'Close on Gus.', 'Zoom in on Gus.', 'The camera pans to Tilly.', 'The camera follows Gus.', 'The camera pulls back.']) {
      expect(prompt).toContain(words);
    }
    const ep = parseScript(`EXT. MAIN STREET - DAY
GUS: Hi.
TILLY: Hi.
Gus bounces up and down.
Gus looks at Tilly.
A caption reads "Three hours later."
Close on Gus.
Zoom in on Gus.
The camera pans to Tilly.
The camera follows Gus.
The camera pulls back.
FADE OUT.

EXT. BUS STOP - DAY
GUS: Hi.
DISSOLVE TO:

EXT. POND - DAY
GUS: Hi.`);
    const beats = ep.scenes[0].beats.filter((b) => !b.text);
    expect(beats).toHaveLength(8);
    expect(beats[0]).toMatchObject({ who: 'gus', action: 'bounce' });
    expect(beats[1]).toMatchObject({ who: 'gus', lookAt: 'tilly' });
    expect(beats[2].caption).toBe('Three hours later.');
    expect(beats.slice(3).map((b) => b.shot)).toEqual([
      { type: 'close', on: ['gus'] },
      { type: 'close', on: ['gus'], pan: true },
      { type: 'medium', on: ['tilly'], pan: true },
      { type: 'medium', on: ['gus'], follow: true },
      { type: 'wide', pan: true },
    ]);
    expect(ep.scenes.map((s) => s.transition)).toEqual([undefined, 'fade', 'dissolve']);
  });

  it('promises acting words the parser understands', () => {
    const prompt = scriptWritingPrompt();
    for (const words of ['dances', 'sneaks in', 'tiptoes', 'walks up to', 'hugs', 'cries', 'sweats', 'vomits', 'covers his ears', 'crosses her arms', 'puts her hands on her hips', 'shrugs', 'lie down', 'drink', 'Gus throws a snowball at Tilly.', 'Gus and Tilly dance.']) {
      expect(prompt).toContain(words);
    }
    const beats = parseScript(`EXT. MAIN STREET - DAY
GUS: Hi.
TILLY: Hi.
Gus dances.
Gus sneaks in.
Gus tiptoes.
Gus walks up to Tilly.
Gus hugs Tilly.
Gus cries.
Gus sweats.
Gus vomits.
Gus covers his ears.
Tilly crosses her arms.
Tilly puts her hands on her hips.
Gus shrugs.
Gus lies down on the floor.
Gus drinks a soda.
Gus throws a snowball at Tilly.
Gus and Tilly dance.`).scenes[0].beats.filter((b) => !b.text);
    expect(beats).toHaveLength(16);
    expect(beats.map((b) => b.action ?? b.gesture ?? b.mood ?? b.moves?.[0].kind ?? (b.hug ? 'hug' : ''))).toEqual(['dance', 'enter', 'walk', 'approach', 'hug', 'cry', 'nervous', 'vomit', 'coverEars', 'cross', 'hipHands', 'shrug', 'lie', 'drink', 'throw', 'dance']);
  });

  it('strips code fences from a pasted script', () => {
    expect(stripCodeFences('```text\nTITLE: X\nA: Hi.\n```\n')).toBe('TITLE: X\nA: Hi.\n');
    expect(stripCodeFences('A: no fences')).toBe('A: no fences');
  });
});

describe('normalize', () => {
  it('drops unknown part ids and bad colours but keeps good ones', () => {
    const c = normalizeLook({ hat: 'not-a-hat', hair: 'messy', topColor: 'red', skin: '#AABBCC', body: 'adult' }, DEFAULT_CHARACTER);
    expect(c.hat).toBe(DEFAULT_CHARACTER.hat);
    expect(c.hair).toBe('messy');
    expect(c.topColor).toBe(DEFAULT_CHARACTER.topColor);
    expect(c.skin).toBe('#aabbcc');
    expect(c.body).toBe('adult');
  });

  it('repairs a sloppy LLM episode', () => {
    const ep = normalizeEpisode(
      {
        title: 'Test',
        cast: [{ name: 'Stan Smith', look: { body: 'kid' } }],
        scenes: [
          {
            set: { kind: 'preset', preset: 'nope' },
            blocking: [{ who: 'STAN', x: 99999 }],
            beats: [
              { who: 'Stan', text: 'Hi', mood: 'ANGRY', gesture: 'moonwalk', shot: 'close' },
              { who: 'Ghost', text: 'Boo' },
              { text: 'nobody says this' },
              { junk: true },
            ],
          },
        ],
      },
      'x',
    );
    const s = ep.scenes[0];
    expect(s.set).toEqual({ kind: 'preset', preset: 'busstop', townName: undefined });
    expect(s.blocking[0]).toMatchObject({ who: 'stan-smith', x: 1460 });
    expect(s.beats).toHaveLength(2);
    expect(s.beats[0]).toMatchObject({ who: 'stan-smith', mood: 'angry', shot: { type: 'close' } });
    expect(s.beats[0].gesture).toBeUndefined();
    // A speaker nobody cast still gets a character.
    expect(ep.cast.map((c) => c.id)).toContain('ghost');
  });

  it('resolves cast by id, name, alias and first name', () => {
    const ep = sample();
    expect(resolveCast(ep.cast, 'HARGROVE')).toBe('mr-hargrove');
    expect(resolveCast(ep.cast, 'mr. hargrove')).toBe('mr-hargrove');
    expect(resolveCast(ep.cast, 'dex')).toBe('dex');
    expect(resolveCast(ep.cast, 'Nobody')).toBeUndefined();
  });

  it('tells people with similar names apart', () => {
    const { cast } = normalizeEpisode({ cast: ['Butters', 'Mr. Garrison', 'Mrs. Tucker', 'Cop 1', 'The Cashier', 'Uncle Jimbo'].map((name) => ({ name })) }, 'x');
    for (const someoneElse of ['BUTTERS DAD', 'Butters Mom', "Butters' Lawyer", 'MR. KIM', 'Mr. Tucker', 'Cop 2', 'the bus']) {
      expect(resolveCast(cast, someoneElse), someoneElse).toBeUndefined();
    }
    // Shorter and longer spellings of the same person still work.
    expect(resolveCast(cast, 'Garrison')).toBe('mr-garrison');
    expect(resolveCast(cast, 'Butters Stotch')).toBe('butters');
    expect(resolveCast(cast, 'Tucker')).toBe('mrs-tucker');
    expect(resolveCast(cast, 'Jimbo')).toBe('uncle-jimbo');
    expect(resolveCast(cast, 'Cashier')).toBe('the-cashier');
  });

  it('casts a forgotten speaker instead of giving their lines to someone with a similar name', () => {
    const ep = normalizeEpisode(
      { cast: [{ name: 'Butters' }, { name: 'Mr. Garrison' }], scenes: [{ beats: [{ who: 'BUTTERS DAD', text: 'Grounded.' }, { who: 'MR. KIM', text: 'Hello.' }] }] },
      'x',
    );
    expect(ep.scenes[0].beats.map((b) => b.who)).toEqual(['butters-dad', 'mr-kim']);
  });

  it('gives a crew look only to the character it names', () => {
    const ep = parseScript('BUTTERS: Hi.\nBUTTERS DAD: Son.\nMR. KIM: Hello.\nMR. GARRISON: Class.\n');
    const look = (hairColor: string) => ({ ...DEFAULT_CHARACTER, hairColor });
    const { cast } = applyCrew(ep, [
      { name: 'Butters', look: look('#010203') },
      { name: 'Mr. Garrison', look: look('#040506') },
    ]);
    const hair = Object.fromEntries(cast.map((c) => [c.name, c.look.hairColor]));
    expect(hair.Butters).toBe('#010203');
    expect(hair['Mr. Garrison']).toBe('#040506');
    expect(hair['Butters Dad']).not.toBe('#010203');
    expect(hair['Mr. Kim']).not.toBe('#040506');
  });

  it('gives the same stock look to the same name', () => {
    expect(stockCharacter('Benny', false)).toEqual(stockCharacter('Benny', false));
    expect(['adult', 'dadbod', 'lanky', 'buff']).toContain(stockCharacter('Officer Duke', true).body);
  });
});

describe('timeline', () => {
  it('lays scenes end to end and times lines', () => {
    const ep = sample();
    const c = compileEpisode(ep, new Map());
    expect(c.titleDuration).toBeGreaterThan(0);
    expect(c.scenes[0].start).toBe(c.titleDuration);
    expect(c.scenes[1].start).toBeCloseTo(c.scenes[0].start + c.scenes[0].duration);
    const b = c.scenes[0].beats[0];
    expect(b.end - b.start).toBeCloseTo(estimateLineSeconds(b.beat.text!));
  });

  it('uses real audio length when a clip exists', () => {
    const ep = sample();
    const first = ep.scenes[0].beats.find((b) => b.text)!;
    const c = compileEpisode(ep, new Map([[first.id, { duration: 7.5, env: syntheticEnvelope('x', 7.5) }]]));
    const cb = c.scenes[0].beats.find((b) => b.beat.id === first.id)!;
    expect(cb.end - cb.start).toBeCloseTo(7.5);
  });

  it('samples the title card, then the scene with the speaker talking', () => {
    const ep = sample();
    const c = compileEpisode(ep, new Map());
    expect(sampleEpisode(c, 0.5)?.kind).toBe('title');
    const sc = c.scenes[0];
    const line = sc.beats.find((b) => b.beat.text)!;
    const f = sampleEpisode(c, sc.start + line.start + 0.2) as SceneFrame;
    expect(f.kind).toBe('scene');
    const speaker = f.actors.find((a) => a.castId === line.beat.who)!;
    expect(speaker).toBeTruthy();
    // Listeners turn toward whoever is talking.
    for (const a of f.actors.filter((x) => x.castId !== speaker.castId)) expect(Math.sign(a.turn)).toBe(Math.sign(speaker.x - a.x));
    expect(locate(c, sc.start + line.start + 0.2)).toEqual({ scene: 0, beat: line.index });
  });

  it('walks entering characters in from off stage', () => {
    const ep = normalizeEpisode(
      {
        cast: [{ name: 'A' }, { name: 'B' }],
        scenes: [{ blocking: [{ who: 'A', x: 500 }], beats: [{ who: 'B', moves: [{ who: 'B', kind: 'enter', x: 1100, side: 'right' }] }, { who: 'B', text: 'Hi' }] }],
      },
      '',
    );
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const sc = c.scenes[0];
    const at = (t: number) => (sampleEpisode(c, sc.start + t) as SceneFrame).actors.find((a) => a.castId === 'b');
    expect(at(0)).toBeUndefined();
    const mid = at(sc.beats[0].start + 0.3)!;
    expect(mid.x).toBeGreaterThan(1100);
    expect(mid.turn).toBe(-1);
    expect(at(sc.beats[1].start + 0.1)!.x).toBeCloseTo(1100);
  });

  it('frames close-ups tighter than wide shots and keeps them inside the set', () => {
    const ep = sample();
    const c = compileEpisode(ep, new Map());
    const f = sampleEpisode(c, c.scenes[0].start + 2) as SceneFrame;
    const close = cameraFor({ type: 'close' }, f.actors, f.actors[0].castId);
    expect(close.w).toBeLessThan(WIDE.w / 1.5);
    expect(close.x).toBeGreaterThanOrEqual(0);
    expect(close.y + close.h).toBeLessThanOrEqual(1000);
    expect(close.w / close.h).toBeCloseTo(16 / 9);
  });
});

describe('stage business: running, sitting, props and vehicles', () => {
  /** One scene, no title card, sampled by scene time. */
  const stage = (scene: Record<string, unknown>, cast: unknown[] = [{ name: 'Dad', look: { body: 'adult' } }, { name: 'Kid', look: { body: 'kid', held: 'none' } }]) => {
    const ep = normalizeEpisode({ cast, scenes: [scene] }, '');
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const sc = c.scenes[0];
    const frame = (t: number) => sampleEpisode(c, sc.start + t) as SceneFrame;
    const who = (t: number, id: string) => frame(t).actors.find((a) => a.castId === id);
    return { ep, sc, frame, who };
  };

  it('runs faster than it walks, leaning into it', () => {
    const go = (run: boolean) => stage({ blocking: [{ who: 'Kid', x: 200 }], beats: [{ who: 'Kid', moves: [{ who: 'Kid', kind: 'walk', x: 1300, run }] }] });
    const walk = go(false);
    const run = go(true);
    expect(run.sc.beats[0].end).toBeLessThan(walk.sc.beats[0].end / 1.8);
    const mid = run.who(run.sc.beats[0].start + 0.3, 'kid')!;
    expect(mid.rotate).toBeGreaterThan(0);
    expect(mid.arms).toBeTruthy();
  });

  it('sits on the couch: walks back to it, grown-ups drop their hips, kids get lifted on', () => {
    const { sc, who, frame } = stage({
      set: { kind: 'preset', preset: 'livingroom' },
      blocking: [{ who: 'Dad', x: 300 }, { who: 'Kid', x: 1300 }],
      beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'sit', on: 'the couch' }, { who: 'Kid', kind: 'sit', on: 'sofa' }] }, { who: 'Dad', text: 'Ahh.' }, { who: 'Dad', moves: [{ who: 'Dad', kind: 'stand' }] }, { who: 'Dad', text: 'Bedtime.' }],
    });
    const seated = sc.beats[1].start + 0.1;
    const dad = who(seated, 'dad')!;
    const kid = who(seated, 'kid')!;
    expect(dad.y).toBe(700);
    expect(dad.hipY).toBeGreaterThan(getGeo('adult', 'round').legTop);
    expect(Math.abs(dad.x - 800)).toBeLessThan(260);
    expect(kid.hipY).toBeUndefined();
    expect(kid.lift).toBeGreaterThan(80);
    // Side by side, not on top of each other.
    expect(Math.abs(dad.x - kid.x)).toBeGreaterThan(150);
    // Mid-walk back to the couch, the actors are still drawn back to front.
    const ys = frame(sc.beats[0].start + 0.3).actors.map((a) => a.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[0]).toBeLessThan(sc.groundY);
    expect(who(sc.beats[3].start + 0.1, 'dad')!.hipY).toBeUndefined();
  });

  it('sits on the floor when there is nothing to sit on, and behind tables that cover them', () => {
    const floor = stage({ set: { kind: 'preset', preset: 'busstop' }, blocking: [{ who: 'Kid', x: 600, sit: 'floor' }], beats: [{ who: 'Kid', text: 'Brr.' }] });
    expect(floor.who(0.5, 'kid')!.hipY).toBeGreaterThan(getGeo('kid', 'round').legTop);
    const lunch = stage({ set: { kind: 'preset', preset: 'cafeteria' }, blocking: [{ who: 'Kid', x: 200, sit: 'table' }], beats: [{ who: 'Kid', text: 'Mystery meat again.' }] });
    const kid = lunch.who(0.5, 'kid')!;
    expect(kid.cover).toBe('table-1');
    expect(kid.y).toBe(910);
    const kit = stage({
      set: { kind: 'kit', place: 'interior', pieces: [{ id: 'chair-1', type: 'chair', x: 400 }, { id: 'bench-1', type: 'bench', x: 1200 }] },
      blocking: [{ who: 'Dad', x: 1100 }],
      beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'sit', on: 'chair' }] }],
    });
    expect(kit.who(kit.sc.duration - 0.1, 'dad')!.x).toBe(400);
  });

  it('picks props up and hands them over halfway through the beat', () => {
    const { sc, who } = stage({
      blocking: [{ who: 'Dad', x: 600, hold: 'money' }, { who: 'Kid', x: 900 }],
      beats: [{ who: 'Dad', text: 'Here.', give: 'Kid' }, { who: 'Kid', text: 'Sweet!', hold: 'soda' }],
    });
    const b = sc.beats[0];
    expect(who(b.start + 0.1, 'dad')!.c.held).toBe('cash');
    expect(who(b.start + 0.1, 'kid')!.c.held).toBe('none');
    expect(who(b.start + 0.3, 'dad')!.arms).toBeTruthy();
    expect(who(b.start + 0.6, 'dad')!.c.held).toBe('none');
    expect(who(b.start + 0.6, 'kid')!.c.held).toBe('cash');
    expect(who(sc.beats[1].start + 0.1, 'kid')!.c.held).toBe('soda');
  });

  it('drives a car in with someone inside, lets them out, picks someone up and drives off', () => {
    const { sc, who, frame } = stage({
      set: { kind: 'preset', preset: 'mainstreet' },
      vehicles: [{ type: 'car', x: 800, offstage: true }],
      blocking: [{ who: 'Dad', in: 'car' }, { who: 'Kid', x: 300 }],
      beats: [
        { moves: [{ who: 'the car', kind: 'drive in', x: 800 }] },
        { who: 'Dad', moves: [{ who: 'Dad', kind: 'get out' }] },
        { who: 'Kid', moves: [{ who: 'Kid', kind: 'get in', on: 'car' }] },
        { moves: [{ who: 'car', kind: 'drive off' }] },
      ],
    });
    const [arrive, out, inn, off] = sc.beats;
    expect(frame(0).vehicles).toHaveLength(0);
    expect(who(0, 'dad')).toBeUndefined();
    const driving = frame(arrive.start + 0.3);
    expect(driving.vehicles[0].x).toBeLessThan(800);
    expect(who(arrive.start + 0.3, 'dad')!.riding).toBe('car');
    expect(who(out.end + 0.1, 'dad')!.riding).toBeUndefined();
    expect(who(inn.end + 0.1, 'kid')!.riding).toBe('car');
    // The car waits for the kid to climb in before it leaves.
    expect(off.start).toBeGreaterThanOrEqual(inn.end);
    expect(frame(sc.duration - 0.01).vehicles).toHaveLength(0);
    expect(who(sc.duration - 0.01, 'kid')).toBeUndefined();
  });

  it('normalizes how people describe it', () => {
    const ep = normalizeEpisode(
      {
        cast: [{ name: 'Dad' }, { name: 'The Cashier' }],
        scenes: [
          {
            vehicles: [{ type: 'School Bus', x: 700 }, { type: 'spaceship' }],
            blocking: [{ who: 'Dad', sit: true, hold: 'a present' }, { who: 'The Cashier', vehicle: 'the bus' }],
            beats: [
              { who: 'Dad', moves: [{ who: 'Dad', kind: 'Run In', x: 2000 }, { who: 'the bus', kind: 'Drive_Off' }, { who: 'the bus', kind: 'sit' }] },
              { who: 'Dad', give: 'cashier', hold: 'groceries' },
            ],
          },
        ],
      },
      '',
    );
    const s = ep.scenes[0];
    expect(s.vehicles).toEqual([{ id: 'bus', type: 'bus', x: 700 }]);
    expect(s.blocking[0]).toMatchObject({ sit: 'seat', hold: 'gift' });
    expect(s.blocking[1].in).toBe('bus');
    expect(s.beats[0].moves).toEqual([
      { who: 'dad', kind: 'enter', x: 1460, run: true },
      { who: 'bus', kind: 'exit' },
    ]);
    expect(s.beats[1]).toMatchObject({ give: 'the-cashier', hold: 'bag' });
  });

  it('draws passengers inside their vehicle and tables over the people sitting at them, the same way every time', () => {
    const { sc, frame } = stage({
      set: { kind: 'preset', preset: 'cafeteria' },
      vehicles: [{ type: 'police', x: 800, lane: 'front' }],
      blocking: [{ who: 'Dad', in: 'police' }, { who: 'Kid', x: 200, sit: 'table' }],
      beats: [{ who: 'Dad', text: 'Freeze!' }],
    });
    const at = sc.beats[0].start + 0.2;
    const markup = () => renderToStaticMarkup(createElement(FrameSvg, { frame: frame(at) }));
    const svg = new DOMParser().parseFromString(markup(), 'image/svg+xml');
    const clip = svg.querySelector('clipPath[id^="veh"]')!;
    const inside = svg.querySelector(`g[clip-path="url(#${clip.id})"]`)!;
    expect(inside.querySelectorAll('.sp-char')).toHaveLength(1);
    // The kid, then the lunch table drawn again over them.
    const kid = [...svg.querySelectorAll('.sp-char')].find((g) => !inside.contains(g))!;
    expect(kid.parentElement!.parentElement!.nextElementSibling?.getAttribute('class')).toBe('sp-scene');
    // Frame-identical markup is what lets the exporter skip redrawing.
    expect(markup()).toBe(markup());
  });

  it('sitting shortens the legs and keeps the feet on the floor', () => {
    const g = getGeo('adult', 'round');
    const s = seatedGeo(g, g.legTop + 80);
    expect(s.legBottom).toBe(g.legBottom);
    expect(s.headCy - g.headCy).toBe(80);
    expect(seatedGeo(g, 10_000).legTop).toBe(g.legBottom - 6);
  });
});

describe('editing', () => {
  it('dragging moves the starting spot, or the target of the move that got them there', () => {
    const ep = normalizeEpisode(
      { cast: [{ name: 'A' }], scenes: [{ blocking: [{ who: 'A', x: 400 }], beats: [{ who: 'A', text: 'one' }, { who: 'A', moves: [{ who: 'A', kind: 'walk', x: 900 }] }, { who: 'A', text: 'two' }] }] },
      '',
    );
    const sc = compileEpisode(ep, new Map()).scenes[0];
    const early = repositionActor(ep.scenes[0], sc, 'a', sc.beats[0].start + 0.1, 600, 0.2);
    expect(early.blocking[0]).toMatchObject({ x: 600, depth: 0.2 });
    const late = repositionActor(ep.scenes[0], sc, 'a', sc.beats[2].start + 0.1, 1200, 0);
    expect(late.blocking[0].x).toBe(400);
    expect(late.beats[1].moves?.[0].x).toBe(1200);
  });

  it('sets a listener\'s face as a reaction', () => {
    const ep = sample();
    const s = setMoodAt(ep.scenes[0], 0, 'dex', 'shock');
    expect(s.beats[0].who).not.toBe('dex');
    expect(s.beats[0].reactions?.dex).toBe('shock');
  });

  it('merges a chat edit: scene replaced, cast updated, ids kept', () => {
    const ep: Episode = sample();
    const scene = ep.scenes[0];
    const out = {
      reply: 'Made Dex grumpier.',
      scene: { ...scene, beats: scene.beats.map((b) => (b.who === 'dex' ? { ...b, mood: 'angry' } : b)) },
      cast: [{ id: 'dex', look: { hat: 'none' }, voice: { pitch: 2 } }, { name: 'Newbie', bio: 'new kid' }],
    };
    const res = applyEdit(ep, 0, out);
    expect(res.reply).toBe('Made Dex grumpier.');
    expect(res.episode.scenes[0].id).toBe(scene.id);
    expect(res.episode.scenes[0].beats.filter((b) => b.who === 'dex').every((b) => b.mood === 'angry')).toBe(true);
    const dex = res.episode.cast.find((c) => c.id === 'dex')!;
    expect(dex.look.hat).toBe('none');
    expect(dex.voice.pitch).toBe(2);
    expect(dex.voice.voice).toBe(ep.cast.find((c) => c.id === 'dex')!.voice.voice);
    expect(res.episode.cast.some((c) => c.name === 'Newbie')).toBe(true);
    expect(res.episode.scenes[1]).toBe(ep.scenes[1]);
  });

  it('pulls JSON out of chatty answers', () => {
    expect(extractJson('Sure!\n```json\n{"a": [1, 2,],}\n```')).toEqual({ a: [1, 2] });
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('voices', () => {
  const sr = 24000;
  const tone = (secs: number, f = 220) => Float32Array.from({ length: Math.round(sr * secs) }, (_, i) => Math.sin((2 * Math.PI * f * i) / sr) * 0.5);

  it('time-stretches without changing length the wrong way', () => {
    expect(timeStretch(tone(1), 1.5, sr).length).toBe(Math.round(sr * 1.5));
    expect(timeStretch(tone(1), 0.7, sr).length).toBe(Math.round(sr * 0.7));
  });

  it('pitches up while keeping the speaking time', () => {
    const out = processVoice(tone(1), sr, 5, 1);
    expect(out.length / sr).toBeCloseTo(1, 1);
    // Count zero crossings: pitch up 5 semitones ≈ 1.335× the crossings.
    const crossings = (x: Float32Array) => x.reduce((n, v, i) => (i && Math.sign(v) !== Math.sign(x[i - 1]) ? n + 1 : n), 0);
    expect(crossings(out) / crossings(tone(1))).toBeGreaterThan(1.25);
    expect(crossings(out) / crossings(tone(1))).toBeLessThan(1.42);
    expect(resample(tone(1), 2).length).toBe(sr / 2);
  });

  it('trims silence and builds a mouth envelope', () => {
    const padded = new Float32Array(sr * 2);
    padded.set(tone(0.5), sr);
    const trimmed = trimSilence(padded, sr);
    expect(trimmed.length / sr).toBeLessThan(0.6);
    const env = envelope(trimmed, sr);
    expect(Math.max(...env)).toBeGreaterThan(0.8);
  });

  it('shapes the request for each kind of speech model', () => {
    const member = sample().cast[0];
    const beat = { id: 'x', text: 'Hello', delivery: 'yelling' };
    // Gemini speaks its input verbatim, so direction must never be written into the text.
    expect(directionMode('google/gemini-3.8-flash-tts')).toBe('instructions');
    expect(speechRequest('google/gemini-3.8-flash-tts', member, beat)).toMatchObject({ input: 'Hello', instructions: expect.stringContaining('yelling') });
    expect(speechFormat('google/gemini-3.8-flash-tts')).toBe('pcm');
    expect(speechFormat('elevenlabs/eleven-v4')).toBe('mp3');
    expect(speechRequest('openai/gpt-4o-mini-tts', member, beat)).toMatchObject({ input: 'Hello', instructions: expect.stringContaining('yelling') });
    expect(speechRequest('elevenlabs/eleven-v4', member, beat).input).toBe('[yelling] Hello');
    expect(speechRequest('hexgrad/kokoro-82m', member, beat).input).toBe('Hello');
  });
});

describe('poses', () => {
  it('rest pose matches the plain renderer and gestures move the hands', () => {
    for (const body of ['kid', 'adult']) {
      const g = getGeo(body, 'round');
      const rest = restArms(g);
      const wave = poseArms(g, 'wave', 1, 0);
      expect(wave[0]).toEqual(rest[0]);
      expect(wave[1].hand[1]).toBeLessThan(rest[1].hand[1] - 40);
      const palm = poseArms(g, 'facepalm', -1, 0);
      expect(palm[0].over).toBe(true);
      expect(palm[1].over).toBe(false);
    }
  });
});

describe('Quick build reads captions, scene changes and camera words', () => {
  it('finds captions in all their forms without casting them', () => {
    const ep = parseScript(`EXT. MAIN STREET - DAY
DEX: Hi.
CAPTION: Later that night
THREE HOURS LATER
The next morning.
The sign says "Closed."
A used mask blows past. A caption reads "Lockdown, day 112."`);
    expect(ep.cast.map((c) => c.name)).toEqual(['Dex']);
    expect(ep.scenes[0].beats.flatMap((b) => b.caption ?? [])).toEqual(['Later that night', 'THREE HOURS LATER', 'The next morning.', 'Closed.', 'Lockdown, day 112.']);
  });

  it('keeps what happens on stage when a sign is read out', () => {
    const ep = parseScript('INT. CLASSROOM - DAY\nDEX: Hi.\nDex picks up a sign that reads "Explosion!"');
    const beat = ep.scenes[0].beats[1];
    expect(beat).toMatchObject({ who: 'dex', caption: 'Explosion!', hold: 'sign' });
    expect(beat.sfx).toBeUndefined();
  });

  it('only takes a fade or a dissolve when the screen is what changes', () => {
    const ep = parseScript(`FADE IN:

EXT. POND - DAY
DEX: Hi.
The ghost fades away.
The screen slowly fades to black.

INT. CLASSROOM - DAY
DEX: Hi.
CUT TO:

EXT. BUS STOP - DAY
DEX: Hi.
DISSOLVE TO BLACK

EXT. MAIN STREET - DAY
DEX: Hi.`);
    expect(ep.scenes.map((s) => s.transition)).toEqual(['fade', 'fade', undefined, 'dissolve']);
    expect(ep.cast.map((c) => c.name)).toEqual(['Dex']);
  });

  it('leaves the same words alone when a character says or does them', () => {
    const ep = parseScript(`INT. KITCHEN - DAY
DEX: Hi.
Dex pulls out a phone.
Dex follows Mom.
Dex looks at the floor.`);
    expect(ep.scenes[0].beats.flatMap((b) => b.shot ?? [])).toEqual([]);
    expect(ep.scenes[0].beats.flatMap((b) => b.lookAt ?? [])).toEqual([]);
  });

  it("doesn't take a close-up the script asked for back to wide on the next line", () => {
    const ep = parseScript('EXT. POND - DAY\nDEX: Hi.\nPRIYA: Yo.\nClose on Dex.\nDEX: So.\nPRIYA: Well.');
    expect(ep.scenes[0].beats.map((b) => b.shot?.type)).toEqual([undefined, undefined, 'close', undefined, undefined]);
  });

  it('keeps pans, follows and transitions from the director, and drops what it cannot do', () => {
    const ep = normalizeEpisode(
      {
        cast: [{ name: 'A' }],
        scenes: [
          { transition: 'dissolve', beats: [{ who: 'A', text: 'Hi', shot: { type: 'close', on: ['A'], pan: true, follow: true } }, { who: 'A', shot: { type: 'wide', follow: true } }, { who: 'A', lookAt: 'A' }] },
          { transition: 'wipe', beats: [] },
          { transition: 'cut', beats: [] },
        ],
      },
      '',
    );
    const [first, second, third] = ep.scenes;
    expect(first.transition).toBe('dissolve');
    expect(first.beats[0].shot).toEqual({ type: 'close', on: ['a'], pan: true, follow: true });
    expect(first.beats[1].shot).toEqual({ type: 'wide' });
    expect(second.transition).toBeUndefined();
    expect(third.transition).toBeUndefined();
  });
});

describe("the show's timing", () => {
  const walker = () => {
    const ep = normalizeEpisode({ cast: [{ name: 'Kid' }], scenes: [{ blocking: [{ who: 'Kid', x: 200 }], beats: [{ who: 'Kid', moves: [{ who: 'Kid', kind: 'walk', x: 1300 }] }] }] }, '');
    ep.titleCard = false;
    return compileEpisode(ep, new Map());
  };

  it('moves characters every second frame at 24 frames a second', () => {
    expect(FPS).toBe(24);
    expect(POSE_FPS).toBe(12);
    const c = walker();
    const x = (frame: number) => (sampleEpisode(c, frame / FPS) as SceneFrame).actors[0].x;
    const first = Math.round(c.scenes[0].beats[0].start * FPS) + 4;
    for (let f = first; f < first + 12; f += 2) {
      expect(x(f + 1)).toBe(x(f));
      expect(x(f + 2)).toBeGreaterThan(x(f + 1));
    }
    // The picture only changes on the grid, however often it's asked for.
    expect(x(first + 0.5)).toBe(x(first));
  });

  it('starts every beat and scene on a pose, whatever the audio lengths are', () => {
    const ep = sample();
    const line = ep.scenes[0].beats.find((b) => b.text)!;
    const c = compileEpisode(ep, new Map([[line.id, { duration: 1.2345, env: syntheticEnvelope('x', 1.2345) }]]));
    const onPose = (t: number) => expect(Math.abs(t * POSE_FPS - Math.round(t * POSE_FPS))).toBeLessThan(1e-6);
    onPose(c.duration);
    for (const sc of c.scenes) {
      onPose(sc.start);
      for (const b of sc.beats) onPose(sc.start + b.start);
    }
  });

  it('hears a syllable that falls between two poses', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ blocking: [{ who: 'A', x: 800 }], beats: [{ id: 'hi', who: 'A', text: 'Hi' }] }] }, '');
    ep.titleCard = false;
    const env = new Float32Array(60);
    env.fill(1, 1, 5);
    const clips: ClipMap = new Map([['hi', { duration: 1, env }]]);
    const c = compileEpisode(ep, clips);
    const talk = (dt: number) => (sampleEpisode(c, c.scenes[0].beats[0].start + dt) as SceneFrame).actors[0].talk;
    expect(talk(0)).toBeGreaterThan(0);
    expect(talk(0.25)).toBe(0);
  });

  it('trembles from side to side on every pose', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ blocking: [{ who: 'A', x: 800 }], beats: [{ who: 'A', action: 'shake', effect: 'shake' }] }] }, '');
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const start = c.scenes[0].beats[0].start;
    const frames = [1, 2, 3, 4].map((i) => sampleEpisode(c, start + i / POSE_FPS) as SceneFrame);
    const moves = frames.map((f) => f.actors[0].jitter);
    expect(moves[0]).toBe(-moves[1]);
    expect(moves[1]).toBe(-moves[2]);
    // The screen shakes the same way, rather than drifting slowly around.
    const cam = frames.map((f) => f.camera.x);
    expect(Math.sign(cam[0])).toBe(-Math.sign(cam[1]));
    expect(Math.sign(cam[1])).toBe(-Math.sign(cam[2]));
  });
});

describe('camera moves', () => {
  const twoHanders = (second: Record<string, unknown>) => {
    const ep = normalizeEpisode(
      {
        cast: [{ name: 'A' }, { name: 'B' }],
        scenes: [{ blocking: [{ who: 'A', x: 300 }, { who: 'B', x: 1300 }], beats: [{ who: 'A', text: 'Hello there.', shot: { type: 'close', on: ['A'] } }, { who: 'B', text: 'A long enough line to fill the whole pan.', shot: { type: 'close', on: ['B'], ...second } }] }],
      },
      '',
    );
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const beat = c.scenes[0].beats[1];
    return { beat, frame: (dt: number) => sampleEpisode(c, beat.start + dt) as SceneFrame };
  };

  it('cuts straight to a shot unless it pans', () => {
    const { frame } = twoHanders({});
    expect(frame(0).camera.x).toBe(frame(1.5).camera.x);
  });

  it('glides between shots on a pan, on every frame, then settles', () => {
    const { frame } = twoHanders({ pan: true });
    const from = frame(0).camera.x;
    const mid = frame(0.5).camera.x;
    const to = frame(1).camera.x;
    expect(from).toBeLessThan(mid);
    expect(mid).toBeLessThan(to);
    expect(frame(1.5).camera.x).toBe(to);
    // The camera runs on every frame while the characters hold their pose.
    const a = frame(0.5);
    const b = frame(0.5 + 1 / FPS);
    expect(b.camera.x).toBeGreaterThan(a.camera.x);
    expect(b.t).toBe(a.t);
  });

  it('gives a silent pan time to finish', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ blocking: [{ who: 'A', x: 300 }], beats: [{ who: 'A', shot: { type: 'close', on: ['A'], pan: true } }] }] }, '');
    const beat = compileEpisode(ep, new Map()).scenes[0].beats[0];
    expect(beat.end - beat.start).toBeCloseTo(1);
  });

  it('follows someone across the stage and cuts back to wide once they have left', () => {
    const ep = normalizeEpisode(
      {
        cast: [{ name: 'A' }, { name: 'B' }],
        scenes: [{ blocking: [{ who: 'A', x: 300 }, { who: 'B', x: 800 }], beats: [{ who: 'A', shot: { type: 'medium', on: ['A'], follow: true }, moves: [{ who: 'A', kind: 'walk', x: 1200 }] }, { who: 'A', moves: [{ who: 'A', kind: 'exit', side: 'right' }] }, { who: 'B', text: 'Bye.' }] }],
      },
      '',
    );
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const [walk, , line] = c.scenes[0].beats;
    const at = (t: number) => sampleEpisode(c, t) as SceneFrame;
    const stepped = at(walk.start + 1);
    const later = at(walk.start + 1.5);
    expect(later.camera.x).toBeGreaterThan(stepped.camera.x);
    // Hops don't shake the frame: the character stays in the same place in it.
    const inFrame = (f: SceneFrame) => f.actors.find((a) => a.castId === 'a')!.x - f.camera.x;
    expect(inFrame(later)).toBeCloseTo(inFrame(stepped), 3);
    expect(later.camera.y).toBe(stepped.camera.y);
    // Whoever's left isn't talking to an empty street.
    const gone = at(line.start + 0.2);
    expect(gone.actors.map((a) => a.castId)).toEqual(['b']);
    expect(gone.camera).toEqual(WIDE);
  });
});

describe('scene transitions', () => {
  const twoScenes = (transition?: string, titleCard = false) => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ set: { kind: 'preset', preset: 'pond' }, blocking: [{ who: 'A', x: 800 }], beats: [{ who: 'A', text: 'First.' }] }, { transition, set: { kind: 'preset', preset: 'classroom' }, blocking: [{ who: 'A', x: 800 }], beats: [{ who: 'A', text: 'Second.' }] }] }, '');
    ep.titleCard = titleCard;
    const c = compileEpisode(ep, new Map());
    return { c, join: c.scenes[1].start, at: (t: number) => sampleEpisode(c, t) as SceneFrame };
  };

  it('cuts by default', () => {
    const { at, join } = twoScenes();
    expect(at(join - 0.05).fade).toBe(0);
    expect(at(join).fade).toBe(0);
    expect(at(join).under).toBeUndefined();
  });

  it('fades out through black and back up without moving anything in time', () => {
    const { c, at, join } = twoScenes('fade');
    expect(at(join - 1).fade).toBe(0);
    expect(at(join - 0.25).fade).toBeCloseTo(0.5, 1);
    expect(at(join - 0.001).scene.index).toBe(0);
    expect(at(join - 0.001).fade).toBeGreaterThan(0.9);
    expect(at(join).fade).toBe(1);
    expect(at(join + 0.25).fade).toBeCloseTo(0.5, 1);
    expect(at(join + 1).fade).toBe(0);
    expect(c.duration).toBe(twoScenes().c.duration);
    expect(join).toBe(twoScenes().join);
  });

  it('fades the title card out into a first scene that fades up', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ transition: 'fade', beats: [{ who: 'A', text: 'Hi.' }] }] }, '');
    const c = compileEpisode(ep, new Map());
    const title = (t: number) => sampleEpisode(c, t) as TitleFrame;
    expect(title(1).fade).toBe(0);
    expect(title(c.titleDuration - 0.25).fade).toBeCloseTo(0.5, 1);
    expect((sampleEpisode(c, c.titleDuration) as SceneFrame).fade).toBe(1);
  });

  it('dissolves with the last scene on top, carrying on, until it has melted away', () => {
    const { c, at, join } = twoScenes('dissolve');
    const before = at(join - 0.001);
    expect(before.under).toBeUndefined();
    const start = at(join);
    expect(start.scene.index).toBe(1);
    expect(start.under?.frame.scene.index).toBe(0);
    expect(start.under?.opacity).toBe(1);
    const mid = at(join + 10 / FPS);
    expect(mid.under?.opacity).toBeCloseTo(0.5);
    expect(mid.fade).toBe(0);
    expect(at(join + 0.9).under).toBeUndefined();
    expect(c.duration).toBe(twoScenes().c.duration);
    // Both sets are in the picture, the old one in its own frame, and it survives the export path.
    const markup = renderToStaticMarkup(createElement(FrameSvg, { frame: mid, width: 1600, height: 900, xmlns: 'http://www.w3.org/2000/svg' }));
    expect(markup.match(/<svg/g)).toHaveLength(2);
    expect(markup).toMatch(/<g opacity="0\.\d+"/);
  });

  it('shows the set, not a black frame, when a scene is picked in the editor', () => {
    const { c, at, join } = twoScenes('fade');
    expect(at(join + transitionTime(c.scenes[1]) + 0.001).fade).toBe(0);
    const dissolve = twoScenes('dissolve');
    expect(dissolve.at(dissolve.join + transitionTime(dissolve.c.scenes[1]) + 0.001).under).toBeUndefined();
    expect(transitionTime(twoScenes().c.scenes[1])).toBe(0);
  });
});

describe('eyes', () => {
  const pair = (beats: unknown[], extra: Record<string, unknown> = {}) => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }, { name: 'B' }], scenes: [{ blocking: [{ who: 'A', x: 400, ...extra }, { who: 'B', x: 1200 }], beats }] }, '');
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    return { c, who: (t: number, id: string) => (sampleEpisode(c, t) as SceneFrame).actors.find((a) => a.castId === id)! };
  };

  it('points them at whoever is talking', () => {
    const { c, who } = pair([{ who: 'B', text: 'Over here, look at me.' }]);
    const t = c.scenes[0].beats[0].start + 0.2;
    expect(who(t, 'a').gazeX).toBeGreaterThan(0);
    expect(who(t, 'b').gazeX).toBeLessThan(0);
  });

  it('slides just the eyes on a silent look, and back when it ends', () => {
    const { c, who } = pair([{ who: 'A', lookAt: 'B', duration: 1 }, { who: 'B', text: 'What?' }]);
    const [look, line] = c.scenes[0].beats;
    const glance = who(look.start + 0.3, 'a');
    expect(glance.gazeX).toBe(1);
    expect(glance.turn).toBe(0);
    expect(who(line.start + 0.2, 'a').gazeX).toBeLessThan(1);
  });

  it('mirrors them with the character', () => {
    const { c, who } = pair([{ who: 'A', lookAt: 'B', duration: 1 }], { flip: true });
    expect(who(c.scenes[0].beats[0].start + 0.3, 'a').gazeX).toBe(-1);
  });

  it('lets them wander when nothing is going on, the same way every time', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ blocking: [{ who: 'A', x: 800 }], beats: [{ who: 'A', duration: 20 }] }] }, '');
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const gaze = (i: number) => (sampleEpisode(c, i / POSE_FPS) as SceneFrame).actors[0].gazeX;
    const seen = Array.from({ length: 240 }, (_, i) => gaze(i));
    expect(seen.filter((g) => g !== 0).length).toBeGreaterThan(10);
    expect(seen.filter((g) => g === 0).length).toBeGreaterThan(100);
    expect(Array.from({ length: 240 }, (_, i) => gaze(i))).toEqual(seen);
  });

  it('moves the pupils and leaves eyes alone that have no pupils to move', () => {
    const draw = (eyes: string, gazeX: number) => renderToStaticMarkup(createElement('svg', null, createElement(CharacterGroup, { c: { ...DEFAULT_CHARACTER, eyes }, gazeX })));
    expect(draw('classic', 0)).not.toContain('translate(15.0');
    expect(draw('classic', 1)).toContain('translate(15.0 0.0)');
    expect(draw('hearts', 1)).not.toContain('translate(15.0');
    expect(draw('dead', 1)).not.toContain('translate(15.0');
  });
});

describe('mouth shapes', () => {
  const loud = (n: number) => new Float32Array(n).fill(1);

  it('reads the sounds of a line, dropping silent letters', () => {
    expect(sounds('moo').map((s) => s.shape)).toEqual([null, 'oo']);
    expect(sounds('Fee').map((s) => s.shape)).toEqual(['fv', 'ee']);
    expect(sounds('note').map((s) => s.shape)).toEqual(['th', 'oh', 'th']);
    expect(sounds('1982')).toEqual([]);
  });

  it('steps through the sounds in order, closing the lips on m, b and p', () => {
    const track = mouthTrack('map', loud(60), 1, 12, 60);
    expect(track).toHaveLength(12);
    expect(track[0].level).toBe(0);
    expect(track[5]).toEqual({ level: 1, shape: 'ah' });
    expect(track[11].level).toBe(0);
  });

  it('waits through a pause in the audio instead of running ahead of it', () => {
    const env = loud(120);
    env.fill(0, 30, 90);
    const track = mouthTrack('aaaa oooo', env, 2, 12, 60);
    expect(track[3].shape).toBe('ah');
    expect(track.slice(6, 18).every((m) => m.level === 0)).toBe(true);
    expect(track[20].shape).toBe('oo');
  });

  it('keeps the mouth shut when there is no sound, and open on a line with no letters', () => {
    expect(mouthTrack('hello', new Float32Array(60), 1, 12, 60).every((m) => m.level === 0)).toBe(true);
    expect(mouthTrack('1982', loud(60), 1, 12, 60)[0]).toEqual({ level: 1, shape: 'ah' });
  });

  it('changes shape along a line in the timeline, from the audio when there is some', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }], scenes: [{ blocking: [{ who: 'A', x: 800 }], beats: [{ id: 'hi', who: 'A', text: 'Oh me oh my we see' }] }] }, '');
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map([['hi', { duration: 2, env: loud(120) }]]));
    const start = c.scenes[0].beats[0].start;
    const seen = new Set(Array.from({ length: 24 }, (_, i) => (sampleEpisode(c, start + i / POSE_FPS) as SceneFrame).actors[0]).filter((a) => a.talk).map((a) => a.mouth));
    expect(seen.size).toBeGreaterThan(2);
  });

  it('draws each shape differently, with teeth where they show', () => {
    const shapes = ['ah', 'eh', 'ee', 'oh', 'oo', 'fv', 'th'] as const;
    const drawn = shapes.map((s) => renderToStaticMarkup(createElement('g', null, talkingMouth(1, s))));
    expect(new Set(drawn).size).toBe(shapes.length);
    expect(drawn[2]).toContain('#fff');
    expect(drawn[0]).not.toContain('#fff');
  });
});

describe('acting', () => {
  const play = (scene: Record<string, unknown>, cast: unknown[] = [{ name: 'Dad', look: { body: 'adult', held: 'none' } }, { name: 'Kid', look: { body: 'kid', held: 'none' } }]) => {
    const ep = normalizeEpisode({ cast, scenes: [scene] }, '');
    ep.titleCard = false;
    const c = compileEpisode(ep, new Map());
    const sc = c.scenes[0];
    const frame = (t: number) => sampleEpisode(c, sc.start + t) as SceneFrame;
    return { c, sc, frame, who: (t: number, id: string) => frame(t).actors.find((a) => a.castId === id)! };
  };

  it('runs tears and sweat for as long as the mood lasts', () => {
    const { sc, who } = play({ blocking: [{ who: 'Kid', x: 800 }], beats: [{ who: 'Kid', mood: 'cry', duration: 2 }, { who: 'Kid', mood: 'nervous', duration: 2 }, { who: 'Kid', mood: 'happy', duration: 1 }] });
    const [cry, nervous, happy] = sc.beats;
    const tears = [0, 2, 4, 6].map((i) => who(cry.start + i / POSE_FPS, 'kid').tears);
    expect(tears.every(Boolean)).toBe(true);
    expect(new Set(tears).size).toBe(4);
    expect(who(cry.start + 1, 'kid').c.mouth).toBe('wail');
    expect(who(cry.start + 1, 'kid').sweat).toBe(0);
    expect(who(nervous.start + 1, 'kid').sweat).toBeGreaterThan(0);
    expect(who(nervous.start + 1, 'kid').tears).toBe(0);
    expect(who(happy.start + 0.5, 'kid').sweat).toBe(0);
  });

  it('reads crying and sweating from acting notes and directions', () => {
    const ep = parseScript('INT. KITCHEN - DAY\nDEX: (sobbing) Why?\nPRIYA: (nervous) Because.\nDex bursts into tears.\nPriya starts sweating.');
    const beats = ep.scenes[0].beats;
    expect(beats.map((b) => b.mood)).toEqual(['cry', 'nervous', 'cry', 'nervous']);
  });

  it('vomits with a sick face, an open mouth, a lean and the sound', () => {
    const { c, sc, who } = play({ blocking: [{ who: 'Dad', x: 500 }, { who: 'Kid', x: 1100 }], beats: [{ who: 'Dad', action: 'vomit' }, { who: 'Kid', text: 'Gross.' }] });
    const [sick, line] = sc.beats;
    expect(sick.end - sick.start).toBeCloseTo(1.5);
    const dad = who(sick.start + 0.5, 'dad');
    expect(dad.vomit).toBeGreaterThan(0);
    expect(dad.c.eyes).toBe('tired');
    expect(dad.talk).toBe(1);
    expect(dad.rotate).not.toBe(0);
    expect(dad.turn).not.toBe(0);
    expect(who(line.start + 0.1, 'dad').vomit).toBe(0);
    expect(audioCues(c).filter((q) => q.sfx === 'vomit')).toHaveLength(1);
    expect(renderToStaticMarkup(createElement('svg', null, createElement(CharacterGroup, { c: DEFAULT_CHARACTER, vomit: 2, turn: 1 })))).toContain('#a9c23f');
  });

  it('dances through a loop of poses until the beat ends, and everyone named joins in', () => {
    const { sc, who } = play({ blocking: [{ who: 'Dad', x: 500 }, { who: 'Kid', x: 1100 }], beats: [{ who: 'Dad', action: 'dance', also: ['Kid'] }, { who: 'Kid', text: 'Woo.' }] });
    const [dance, line] = sc.beats;
    expect(dance.end - dance.start).toBeCloseTo(3);
    const steps = [0, 3, 6, 9].map((i) => who(dance.start + i / POSE_FPS, 'dad'));
    expect(steps.map((s) => s.rotate)).toEqual([-9, 0, 9, 0]);
    expect(steps[1].lift).toBeGreaterThan(steps[0].lift);
    expect(steps[0].arms?.[0].hand[1]).toBeLessThan(steps[0].arms![1].hand[1]);
    expect(steps[2].arms?.[1].hand[1]).toBeLessThan(steps[2].arms![0].hand[1]);
    expect(who(dance.start + 0.5, 'kid').rotate).toBe(who(dance.start + 0.5, 'dad').rotate);
    expect(who(line.start + 0.1, 'dad').rotate).toBe(0);
  });

  it('covers the ears with both hands, over the head', () => {
    const g = getGeo('kid', 'round');
    const [left, right] = poseArms(g, 'coverEars', 1, 0);
    expect(left.over && right.over).toBe(true);
    expect(left.hand[0]).toBeLessThan(g.headCx - g.headRx * 0.6);
    expect(right.hand[0]).toBeGreaterThan(g.headCx + g.headRx * 0.6);
    expect(Math.abs(left.hand[1] - g.headCy)).toBeLessThan(g.headRy * 0.5);
  });

  it('eats and drinks with the prop hand at the mouth, on whichever side they face', () => {
    for (const body of ['kid', 'adult']) {
      const g = getGeo(body, 'round');
      for (const lead of [-1, 1] as const) {
        const [other, hand] = poseArms(g, 'drink', lead, 0);
        expect(other.over).toBe(false);
        expect(hand.over).toBe(true);
        // Out on the side they face, with the top of the cup tipped back in toward the mouth.
        expect(Math.sign(hand.hand[0] - g.headCx)).toBe(lead);
        expect(Math.sign(hand.tilt!)).toBe(-lead);
        expect(hand.hand[1]).toBeGreaterThan(g.headCy);
      }
      const bites = [0, 0.25, 0.5, 0.75].map((t) => poseArms(g, 'eat', 1, t)[1].hand[1]);
      expect(new Set(bites).size).toBe(2);
    }
  });

  it('chews while eating, and talks over it', () => {
    const { sc, who } = play({ blocking: [{ who: 'Kid', x: 800, hold: 'pizza' }], beats: [{ who: 'Kid', gesture: 'eat', duration: 2 }] });
    const start = sc.beats[0].start;
    const mouth = [0, 2, 4, 6].map((i) => who(start + i / POSE_FPS, 'kid').talk);
    expect(new Set(mouth).size).toBe(2);
  });

  it('sneaks slower than it walks, crouched, leaning in, hands up', () => {
    const go = (sneak: boolean) => play({ blocking: [{ who: 'Dad', x: 300 }], beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'walk', x: 1000, sneak }] }] });
    const walk = go(false);
    const sneak = go(true);
    const length = (s: typeof walk) => s.sc.beats[0].end - s.sc.beats[0].start;
    expect(length(sneak)).toBeGreaterThan(length(walk) * 1.8);
    const dad = sneak.who(sneak.sc.beats[0].start + 0.5, 'dad');
    expect(dad.hipY).toBeGreaterThan(getGeo('adult', 'round').legTop);
    expect(dad.rotate).toBeGreaterThan(0);
    expect(dad.arms).toBeTruthy();
    expect(walk.who(walk.sc.beats[0].start + 0.5, 'dad').hipY).toBeUndefined();
  });

  it('prowls across the stage when it is not told where to go', () => {
    const { sc, who } = play({ blocking: [{ who: 'Dad', x: 300 }], beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'sneak' }] }] });
    expect(who(sc.duration - 0.1, 'dad').x).toBe(720);
  });

  it('walks up to someone and stops beside them, from either side', () => {
    for (const [from, side] of [[300, -1], [1400, 1]]) {
      const { sc, who } = play({ blocking: [{ who: 'Dad', x: from }, { who: 'Kid', x: 800 }], beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'approach', on: 'Kid' }] }] });
      expect(who(sc.duration - 0.1, 'dad').x).toBe(800 + side * 240);
    }
  });

  it('takes a walk to a person as walking up to them', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }, { name: 'B' }], scenes: [{ beats: [{ who: 'A', moves: [{ who: 'A', kind: 'walk', on: 'B' }, { who: 'A', kind: 'approach', on: 'A' }, { who: 'A', kind: 'approach' }, { who: 'A', kind: 'creep', x: 500 }] }] }] }, '');
    expect(ep.scenes[0].beats[0].moves).toEqual([{ who: 'a', kind: 'approach', on: 'b' }, { who: 'a', kind: 'walk', x: 500, sneak: true }]);
  });

  it('lies down along a couch and stays there until getting up', () => {
    const { sc, who } = play({
      set: { kind: 'preset', preset: 'livingroom' },
      blocking: [{ who: 'Dad', x: 300 }],
      beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'lie', on: 'couch' }] }, { who: 'Dad', text: 'Ugh.' }, { who: 'Dad', moves: [{ who: 'Dad', kind: 'stand' }] }, { who: 'Dad', text: 'Better.' }],
    });
    const lying = who(sc.beats[1].start + 0.1, 'dad');
    expect(lying.rotate).toBe(-90);
    expect(lying.y).toBeLessThan(700);
    expect(lying.hipY).toBeUndefined();
    // Stretched out from the feet, leftwards, across the middle of the seat.
    expect(lying.x).toBeGreaterThan(800);
    expect(who(sc.beats[3].start + 0.1, 'dad').rotate).toBe(0);
  });

  it('starts a scene lying down, on the floor if there is nothing else', () => {
    const { who } = play({ set: { kind: 'preset', preset: 'busstop' }, blocking: [{ who: 'Kid', x: 600, lie: true }], beats: [{ who: 'Kid', text: 'Brr.' }] });
    const kid = who(0.5, 'kid');
    expect(kid.rotate).toBe(-90);
    expect(kid.y).toBe(who(0.5, 'kid').y);
  });

  it('turns a sitter into someone lying down on the same seat', () => {
    const { sc, who } = play({ set: { kind: 'preset', preset: 'livingroom' }, blocking: [{ who: 'Dad', x: 800, sit: 'couch' }], beats: [{ who: 'Dad', moves: [{ who: 'Dad', kind: 'lie', on: 'couch' }] }] });
    expect(who(0.05, 'dad').rotate).toBe(0);
    expect(who(sc.duration - 0.1, 'dad').rotate).toBe(-90);
  });

  it('frames a close-up on the head of someone lying down, not their feet', () => {
    const { sc, frame } = play({ set: { kind: 'preset', preset: 'livingroom' }, blocking: [{ who: 'Dad', x: 800, lie: 'couch' }], beats: [{ who: 'Dad', text: 'Ugh.', shot: { type: 'close', on: ['Dad'] } }] });
    const f = frame(sc.beats[0].start + 0.1);
    const dad = f.actors[0];
    expect(f.camera.x + f.camera.w / 2).toBeLessThan(dad.x - 100);
  });

  it('hugs: walks up, both arms go out, and they stay together', () => {
    const { sc, who } = play({ blocking: [{ who: 'Dad', x: 300 }, { who: 'Kid', x: 1200 }], beats: [{ who: 'Dad', hug: 'Kid' }, { who: 'Kid', text: 'Aw.' }] });
    const [hug, line] = sc.beats;
    const close = hug.end - 0.5;
    const dad = who(close, 'dad');
    const kid = who(close, 'kid');
    expect(Math.abs(dad.x - kid.x)).toBe(150);
    expect(dad.arms).toBeTruthy();
    expect(kid.arms).toBeTruthy();
    expect(dad.turn).toBeGreaterThan(0);
    expect(kid.turn).toBeLessThan(0);
    expect(dad.rotate).toBeGreaterThan(0);
    expect(hug.end - hug.start).toBeGreaterThan(1.4 + 700 / 380);
    expect(who(line.start + 0.3, 'dad').arms).toBeUndefined();
  });

  describe('throwing', () => {
    const toss = (extra: Record<string, unknown>, hold = 'snowball') =>
      play({ blocking: [{ who: 'Dad', x: 300, ...(hold ? { hold } : {}) }, { who: 'Kid', x: 1200 }], beats: [{ who: 'Dad', action: 'throw', ...extra }, { who: 'Kid', text: 'Ow!' }] });

    it('winds up, lets go, and sends the prop in an arc to the target', () => {
      const { c, sc, who, frame } = toss({ lookAt: 'Kid' });
      const { start } = sc.beats[0];
      expect(who(start + 0.1, 'dad').c.held).toBe('snowball');
      expect(who(start + 0.1, 'dad').arms?.[1].hand[1]).toBeLessThan(who(start + 0.4, 'dad').arms![1].hand[1]);
      expect(frame(start + 0.1).props).toEqual([]);
      expect(who(start + 0.34, 'dad').c.held).toBe('none');
      const mid = frame(start + 0.5).props[0];
      expect(mid).toMatchObject({ item: 'snowball' });
      expect(mid.x).toBeGreaterThan(300);
      expect(mid.x).toBeLessThan(1200);
      expect(mid.y).toBeLessThan(frame(start + 0.3).props[0].y);
      expect(who(start + 0.3, 'dad').turn).toBeGreaterThan(0);
      expect(frame(start + 1.5).props).toEqual([]);
      const hits = audioCues(c).filter((q) => q.sfx === 'slap');
      expect(hits).toHaveLength(1);
      expect(hits[0].t).toBeGreaterThan(sc.start + start + 0.7);
      expect(audioCues(c).some((q) => q.sfx === 'whoosh')).toBe(true);
    });

    it('homes in on where the head really is, even on someone lying down', () => {
      const { sc, frame, who } = play({ set: { kind: 'preset', preset: 'livingroom' }, blocking: [{ who: 'Kid', x: 300, hold: 'snowball' }, { who: 'Dad', x: 800, lie: 'couch' }], beats: [{ who: 'Kid', action: 'throw', lookAt: 'Dad' }] });
      const lastPose = sc.flights[0].t1 - 0.05;
      const prop = frame(lastPose).props[0];
      const dad = who(lastPose, 'dad');
      expect(prop.y).toBeGreaterThan(dad.y - 200);
      expect(prop.x).toBeLessThan(dad.x);
    });

    it('sails out of shot when there is nobody to hit', () => {
      const { c, sc, frame } = toss({});
      const { start } = sc.beats[0];
      expect(frame(start + 0.9).props[0].x).toBeGreaterThan(1200);
      expect(audioCues(c).some((q) => q.sfx === 'slap')).toBe(false);
    });

    it('only throws what is in the hand', () => {
      const { sc, frame, who } = toss({ lookAt: 'Kid' }, '');
      const { start } = sc.beats[0];
      expect(frame(start + 0.5).props).toEqual([]);
      expect(who(start + 0.1, 'dad').arms).toBeTruthy();
    });

    it('takes up the prop on the same beat, and lets a group throw together', () => {
      const { sc, frame } = play({ blocking: [{ who: 'Dad', x: 300 }, { who: 'Kid', x: 600 }], beats: [{ who: 'Dad', action: 'throw', hold: 'football', also: ['Kid'] }] });
      expect(frame(sc.beats[0].start + 0.5).props.map((p) => p.item)).toEqual(['football', 'football']);
    });

    it('draws the prop in the air', () => {
      const { sc, frame } = toss({ lookAt: 'Kid' });
      const f = frame(sc.beats[0].start + 0.5);
      const flying = renderToStaticMarkup(createElement(FrameSvg, { frame: f, xmlns: 'http://www.w3.org/2000/svg' }));
      const still = renderToStaticMarkup(createElement(FrameSvg, { frame: { ...f, props: [] }, xmlns: 'http://www.w3.org/2000/svg' }));
      expect(flying.length).toBeGreaterThan(still.length);
      expect(flying).toContain('#f2f7ff');
      expect(still).not.toContain('#f2f7ff');
    });
  });
});

describe('Quick build reads acting', () => {
  const direct = (lines: string) => parseScript(`INT. KITCHEN - DAY\nDEX: Hi.\nPRIYA: Yo.\nBENNY: Sup.\n${lines}`).scenes[0].beats.filter((b) => !b.text);

  it('lets everyone named at the start act together', () => {
    const [raise] = direct('Dex, Priya and Benny raise their pickaxes over their heads.');
    expect(raise).toMatchObject({ who: 'dex', also: ['priya', 'benny'], gesture: 'armsUp', hold: 'pickaxe' });
  });

  it('works out who a group is once the scene is known', () => {
    const [dance] = direct('Everyone dances.');
    expect(dance).toMatchObject({ who: 'dex', also: ['priya', 'benny'], action: 'dance' });
  });

  it('keeps the person something is done to out of it', () => {
    const [point] = direct('Dex points at Priya.');
    expect(point.also).toBeUndefined();
    const [snowball] = direct('Dex and Priya throw snowballs at Benny.');
    expect(snowball).toMatchObject({ who: 'dex', also: ['priya'], action: 'throw', hold: 'snowball', lookAt: 'benny' });
  });

  it("doesn't take a character's name for what they do", () => {
    const ep = parseScript('INT. GYM - DAY\nDANCE MASTER: Hi.\nDANCE MASTER spins.\nThe Dance Master sits on a chair.');
    const [spin, sit] = ep.scenes[0].beats.filter((b) => !b.text);
    expect(spin.action).toBe('spin');
    expect(sit.action).toBeUndefined();
  });

  it('tells throwing from throwing up, throwing a party and handing over', () => {
    expect(direct('Dex throws up.')[0].action).toBe('vomit');
    expect(direct('Dex throws a party.')).toEqual([]);
    expect(direct('Dex throws his hands up.')[0]).toMatchObject({ gesture: 'armsUp' });
    expect(direct('Dex throws a rock at Priya.')[0]).toMatchObject({ action: 'throw', hold: 'snowball', lookAt: 'priya' });
    const [toss] = direct('Dex tosses the football to Priya.');
    expect(toss).toMatchObject({ give: 'priya', hold: 'football' });
    expect(toss.action).toBeUndefined();
  });

  it('picks the right drink and food, and takes "a drink" for a noun', () => {
    expect(direct('Dex drinks a coffee.')[0]).toMatchObject({ gesture: 'drink', hold: 'coffee' });
    expect(direct('Dex drinks beer from a bottle.')[0]).toMatchObject({ gesture: 'drink', hold: 'beer' });
    expect(direct('Dex sips something.')[0]).toMatchObject({ gesture: 'drink', hold: 'soda' });
    expect(direct('Dex eats a hotdog.')[0]).toMatchObject({ gesture: 'eat', hold: 'hotdog' });
    expect(direct('Dex eats.')[0]).toMatchObject({ gesture: 'eat', hold: 'snack' });
    const [held] = direct('Dex holds a drink.');
    expect(held.hold).toBe('soda');
    expect(held.gesture).toBeUndefined();
  });

  it('sneaks in, out and up to people', () => {
    expect(direct('Dex sneaks in.')[0].moves).toEqual([expect.objectContaining({ who: 'dex', kind: 'enter', sneak: true })]);
    expect(direct('Dex tiptoes out.')[0].moves).toEqual([expect.objectContaining({ who: 'dex', kind: 'exit', sneak: true })]);
    expect(direct('Dex creeps up on Priya.')[0].moves).toEqual([{ who: 'dex', kind: 'approach', on: 'priya', sneak: true }]);
    expect(direct('Dex prowls around.')[0].moves).toEqual([{ who: 'dex', kind: 'walk', sneak: true }]);
    expect(direct('Dex runs to Priya.')[0].moves).toEqual([{ who: 'dex', kind: 'approach', on: 'priya', run: true }]);
  });

  it('lies people down, adding the furniture, and starts them there if nobody has spoken', () => {
    const ep = parseScript('INT. BEDROOM - NIGHT\nDex lies hungover on the bed.\nDEX: Ugh.\nPRIYA: Hi.\nPriya lies down on the floor.');
    const scene = ep.scenes[0];
    expect(scene.blocking.find((b) => b.who === 'dex')).toMatchObject({ lie: 'bed' });
    expect(scene.set.kind === 'kit' && scene.set.pieces.some((p) => p.type === 'bed')).toBe(true);
    expect(scene.beats.flatMap((b) => b.moves ?? [])).toEqual([{ who: 'priya', kind: 'lie', on: 'floor' }]);
  });

  it("doesn't take a lie for lying down", () => {
    expect(direct('Dex lies to Priya.')).toEqual([]);
  });

  it('hugs one way or both', () => {
    expect(direct('Dex hugs Priya.')[0]).toMatchObject({ who: 'dex', hug: 'priya' });
    const [both] = direct('Dex and Priya hug.');
    expect(both).toMatchObject({ who: 'dex', hug: 'priya' });
    expect(both.also).toBeUndefined();
  });

  it('reads arm poses, and only trembles when someone actually trembles', () => {
    const says = (line: string) => direct(line)[0];
    expect(says('Dex covers his ears.').gesture).toBe('coverEars');
    expect(says('Dex shrugs.').gesture).toBe('shrug');
    expect(says('Dex crosses his arms.').gesture).toBe('cross');
    expect(says('Dex puts his hands on his hips.').gesture).toBe('hipHands');
    expect(says('Dex shakes his fist.')).toMatchObject({ gesture: 'fists' });
    expect(says('Dex shakes his fist.').action).toBeUndefined();
    expect(direct('Dex shakes his head.')).toEqual([]);
    expect(says('Dex shakes.').action).toBe('shake');
  });

  it('keeps group and hug fields from the director, and drops people who are not there', () => {
    const ep = normalizeEpisode({ cast: [{ name: 'A' }, { name: 'B' }], scenes: [{ blocking: [{ who: 'A', lie: 'bed' }, { who: 'B', lie: true }], beats: [{ who: 'A', action: 'dance', also: ['B', 'A', 'Nobody', 'B'] }, { who: 'A', hug: 'B' }, { who: 'A', hug: 'A' }] }] }, '');
    const [dance, hug] = ep.scenes[0].beats;
    expect(dance.also).toEqual(['b']);
    expect(hug.hug).toBe('b');
    expect(ep.scenes[0].beats).toHaveLength(2);
    expect(ep.scenes[0].blocking.map((b) => b.lie)).toEqual(['bed', 'floor']);
  });
});
