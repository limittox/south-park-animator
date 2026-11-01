import { describe, expect, it } from 'vitest';
import { parseScript, SAMPLE_SCRIPT } from './episode/parseScript';
import { PROMPT_EXAMPLE, PROMPT_PLACES, scriptWritingPrompt } from './episode/writingPrompt';
import { stripCodeFences } from './lib/clipboard';
import { normalizeEpisode, normalizeLook, resolveCast, stockCharacter } from './episode/normalize';
import { cameraFor, compileEpisode, estimateLineSeconds, locate, sampleEpisode, syntheticEnvelope, WIDE, type SceneFrame } from './episode/timeline';
import { repositionActor, setMoodAt } from './episode/edit';
import { applyEdit } from './ai/director';
import { extractJson } from './ai/openrouter';
import { envelope, processVoice, resample, timeStretch, trimSilence } from './audio/dsp';
import { directionMode, speechFormat, speechRequest } from './audio/voices';
import { poseArms, restArms } from './character/pose';
import { getGeo } from './character/geometry';
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
    expect(sampleEpisode(c, 0.5, new Map())?.kind).toBe('title');
    const sc = c.scenes[0];
    const line = sc.beats.find((b) => b.beat.text)!;
    const f = sampleEpisode(c, sc.start + line.start + 0.2, new Map()) as SceneFrame;
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
    const at = (t: number) => (sampleEpisode(c, sc.start + t, new Map()) as SceneFrame).actors.find((a) => a.castId === 'b');
    expect(at(0)).toBeUndefined();
    const mid = at(sc.beats[0].start + 0.3)!;
    expect(mid.x).toBeGreaterThan(1100);
    expect(mid.turn).toBe(-1);
    expect(at(sc.beats[1].start + 0.1)!.x).toBeCloseTo(1100);
  });

  it('frames close-ups tighter than wide shots and keeps them inside the set', () => {
    const ep = sample();
    const c = compileEpisode(ep, new Map());
    const f = sampleEpisode(c, c.scenes[0].start + 2, new Map()) as SceneFrame;
    const close = cameraFor({ type: 'close' }, f.actors, f.actors[0].castId);
    expect(close.w).toBeLessThan(WIDE.w / 1.5);
    expect(close.x).toBeGreaterThanOrEqual(0);
    expect(close.y + close.h).toBeLessThanOrEqual(1000);
    expect(close.w / close.h).toBeCloseTo(16 / 9);
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
