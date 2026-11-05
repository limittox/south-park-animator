import { describe, expect, it } from 'vitest';
import { parseScript, SAMPLE_SCRIPT } from './episode/parseScript';
import { compileEpisode, sampleEpisode, type SceneFrame } from './episode/timeline';

/* The sample is what a new user sees first, and a direction Quick build can't read just does nothing. So check each one does what it's there for. */

describe('the sample script', () => {
  it('builds with no AI: the right cast, a short run, and every feature it shows off', () => {
    const ep = parseScript(SAMPLE_SCRIPT);
    expect(ep.cast.map((c) => c.name).sort()).toEqual(['Anchor', 'Benny', 'Cashier', 'Dex', 'Mr. Hargrove', 'Officer Plunkett', 'Priya']);
    const beats = ep.scenes.flatMap((s) => s.beats);
    const lines = beats.filter((b) => b.text);
    expect(ep.scenes).toHaveLength(6);
    expect(lines.length).toBeLessThanOrEqual(40);
    expect(lines.every((b) => ep.cast.some((c) => c.id === b.who))).toBe(true);
    expect(lines.at(-2)).toMatchObject({ who: 'priya', text: "Dex! Tomorrow's Saturday!" });
    expect(lines.at(-1)).toMatchObject({ who: 'dex', text: '...Aw, crap.' });

    const [stop, classroom, bathroom, home, store, street] = ep.scenes;
    const moves = (s: typeof stop) => s.beats.flatMap((b) => b.moves ?? []);

    // The chicken, then everyone onto the bus.
    expect(stop.beats.find((b) => b.gesture === 'eat')).toMatchObject({ who: 'dex', hold: 'hotdog', lookAt: 'benny' });
    expect(stop.beats.find((b) => b.becomes)).toMatchObject({ who: 'dex', becomes: 'hen' });
    expect(stop.vehicles?.map((v) => v.type)).toEqual(['bus']);
    expect(moves(stop).filter((m) => m.kind === 'getIn').map((m) => m.who)).toEqual(['benny', 'dex', 'priya']);
    expect(moves(stop).at(-1)).toMatchObject({ who: 'bus-1', kind: 'exit' });

    // A back turned, a pan, and a whisper from the desks.
    expect(classroom.blocking.filter((b) => b.sit).map((b) => b.who).sort()).toEqual(['benny', 'dex', 'priya']);
    expect(classroom.beats.flatMap((b) => b.face ?? [])).toEqual(['away', 'front']);
    expect(classroom.beats.find((b) => b.face === 'away')?.shot).toMatchObject({ type: 'medium', pan: true });
    expect(classroom.beats.at(-1)).toMatchObject({ who: 'mr-hargrove', action: 'faint' });

    // A phone call, and what happens to the toilet.
    expect(bathroom.transition).toBe('fade');
    expect(bathroom.split).toMatchObject({ who: ['dex'], set: { kind: 'preset', preset: 'mainstreet' } });
    expect(bathroom.set.kind === 'kit' && bathroom.set.pieces.some((p) => p.type === 'toilet')).toBe(true);
    expect(bathroom.blocking.map((b) => b.hold)).toEqual(['phone', 'phone']);
    expect(bathroom.beats.find((b) => b.burst)).toMatchObject({ who: 'priya', burst: { kind: 'explosion' }, sfx: 'explosion', effect: 'flash', gesture: 'coverEars' });
    expect(bathroom.beats.find((b) => b.drift)?.drift).toEqual({ item: 'plunger', style: 'fall' });

    expect(home.transition).toBe('dissolve');
    expect(home.blocking.find((b) => b.who === 'benny')?.lie).toBe('couch');
    expect(home.blocking.find((b) => b.who === 'anchor')?.screen).toBe(true);
    expect(home.beats.find((b) => b.gesture === 'drink')?.hold).toBe('soda');
    expect(home.beats.at(-1)).toMatchObject({ who: 'benny', action: 'vomit' });

    // A queue, a sneak, a hand-over and a police car through the wall.
    expect(store.crowd).toMatchObject({ layout: 'line', mood: 'angry' });
    expect(moves(store)).toContainEqual({ who: 'dex', kind: 'approach', sneak: true, on: 'cashier' });
    expect(store.beats.find((b) => b.moves?.[0].sneak)?.shot).toMatchObject({ follow: true });
    expect(store.beats.find((b) => b.give)).toMatchObject({ who: 'dex', give: 'cashier', hold: 'cash', crowd: 'boo', shot: { type: 'wide', pan: true } });
    expect(store.blocking.find((b) => b.who === 'officer-plunkett')?.in).toBe('police-1');
    expect(moves(store)).toContainEqual({ who: 'police-1', kind: 'crash', x: 800, on: 'wall' });
    expect(store.beats.flatMap((b) => b.crowd ?? [])).toEqual(['boo', 'panic']);

    // Snow at last, starting right there in the scene, and how it goes wrong.
    expect(ep.scenes.every((s) => s.weather === 'none')).toBe(true);
    expect(street.beats.find((b) => b.weather)?.weather).toBe('snow');
    expect(store.set).toMatchObject({ kind: 'kit', time: 'night' });
    expect(street.set).toMatchObject({ kind: 'preset', preset: 'mainstreet', time: 'night' });
    expect(ep.cast.find((m) => m.name === 'Dex')?.look.signText).toBe('SNOW DAY NOW');
    expect(ep.cast.find((m) => m.name === 'Priya')?.look.sidekick).toBe('dog');
    expect(street.crowd?.layout).toBe('group');
    expect(street.beats[0]).toMatchObject({ who: 'dex', also: ['benny'], hold: 'sign' });
    expect(moves(street).map((m) => [m.who, m.run])).toEqual([['dex', true], ['benny', true]]);
    expect(street.beats.find((b) => b.action === 'dance')).toMatchObject({ who: 'dex', also: ['benny'], crowd: 'cheer', caption: 'Science works.' });
    expect(street.beats.find((b) => b.crowd === 'gasp')?.shot).toMatchObject({ type: 'close', on: ['dex'], pan: true });
    expect(street.beats.at(-1)).toMatchObject({ who: 'benny', action: 'throw', hold: 'snowball', lookAt: 'dex' });

    // Some of it only shows once it's compiled and played.
    const c = compileEpisode(ep, new Map());
    expect(c.duration).toBeLessThan(125);
    const at = (scene: number, t: number) => sampleEpisode(c, c.scenes[scene].start + t) as SceneFrame;
    const beat = (scene: number, test: (b: (typeof c.scenes)[number]['beats'][number]['beat']) => unknown) => c.scenes[scene].beats.find((b) => test(b.beat))!;
    const actor = (f: SceneFrame, id: string) => f.actors.find((a) => a.castId === id);

    const leaving = beat(0, (b) => b.moves?.[0].kind === 'exit');
    expect(actor(at(0, leaving.start + 1), 'dex')).toMatchObject({ riding: 'bus-1', form: 'hen' });
    expect(actor(at(1, beat(1, (b) => b.face === 'away').end), 'mr-hargrove')?.view).toBe('back');

    const call = at(2, 2);
    expect(call.split).toBeDefined();
    expect(actor(call, 'dex')?.right).toBe(true);
    expect(actor(at(3, 2), 'anchor')?.tile).toBeDefined();
    expect(actor(at(3, beat(3, (b) => b.action === 'vomit').start + 0.5), 'benny')?.vomit).toBeGreaterThan(0);

    const sneaking = beat(4, (b) => b.moves?.[0].sneak);
    expect(actor(at(4, sneaking.start + 1), 'dex')).toMatchObject({ view: 'side', flip: true });
    const crash = c.scenes[4].impacts[0];
    expect(crash).toMatchObject({ hole: true, vehicle: 'police-1' });
    expect(at(4, crash.t + 0.1).bursts.map((b) => b.kind)).toEqual(expect.arrayContaining(['debris', 'smoke']));

    // Benny runs in from the right, so he's the one mirrored with his sign.
    expect(actor(at(5, c.scenes[5].beats[0].start + 0.2), 'benny')).toMatchObject({ view: 'side', flip: true });
    const thrown = beat(5, (b) => b.action === 'throw');
    expect(c.scenes[5].flights[0]).toMatchObject({ item: 'snowball', at: 'dex' });
    expect(at(5, thrown.start + 0.7).props).toHaveLength(1);
  });
});
