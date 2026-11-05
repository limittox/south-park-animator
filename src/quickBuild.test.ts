import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseScript } from './episode/parseScript';
import { compileEpisode, sampleEpisode, type SceneFrame } from './episode/timeline';
import { FrameSvg } from './render/FrameSvg';
import { getScene } from './scenes/backgrounds';
import { seatsOf } from './episode/seats';

/* What Quick build does with the plain-English parts of a script, played through to the frames where it matters. */

const scene = (script: string) => parseScript(script).scenes[0];
const play = (script: string) => {
  const ep = parseScript(script);
  const c = compileEpisode(ep, new Map());
  const sc = c.scenes[0];
  return { ep, c, sc, at: (t: number) => sampleEpisode(c, sc.start + t) as SceneFrame };
};
const draw = (frame: SceneFrame) => renderToStaticMarkup(createElement(FrameSvg, { frame }));

describe('who is in a scene', () => {
  it("doesn't count a vehicle as one of the people", () => {
    const ep = parseScript('EXT. BUS STOP - DAY\nThe school bus pulls up. Everyone dances.\n\nINT. CLASSROOM - DAY\nGUS: Hi.');
    expect(ep.cast.map((c) => c.name)).toEqual(['Gus']);
    expect(ep.scenes[0].blocking.map((b) => b.who)).toEqual([]);
  });

  it('counts someone who only gestures as one of the kids', () => {
    const s = scene('INT. CLASSROOM - DAY\nPriya waves. The kids sit at their desks.\nBENNY: Hi.\n\nINT. KITCHEN - DAY\nPRIYA: Hi.');
    expect(s.blocking.filter((b) => b.sit).map((b) => b.who).sort()).toEqual(['benny', 'priya']);
  });

  it('reads a lowercase role after "the", but not a thing that shares a name', () => {
    const stares = scene('INT. GROCERY STORE - DAY\nCASHIER: Hi.\nDEX: Hi.\nThe cashier stares at Dex.').beats.at(-1);
    expect(stares).toMatchObject({ who: 'cashier', lookAt: 'dex' });
    const both = scene('INT. GROCERY STORE - DAY\nCASHIER: Hi.\nDEX: Hi.\nThe cashier and Dex dance.').beats.at(-1);
    expect(both).toMatchObject({ who: 'cashier', also: ['dex'], action: 'dance' });
    expect(scene('INT. KITCHEN - DAY\nGUS: Hi.\nPHONE: Ring.\nGus picks up the phone.').beats.at(-1)).toMatchObject({ who: 'gus', hold: 'phone' });
    expect(scene('INT. KITCHEN - DAY\nGUS: Hi.\nBUS: Honk.\nThe bus explodes.').beats.at(-1)?.who).toBeUndefined();
  });
});

describe('scene titles', () => {
  it("keeps a possessive lowercase and a surname's capital", () => {
    expect(scene("INT. PRIYA'S BATHROOM - DAY\nGUS: Hi.").title).toBe("Priya's Bathroom");
    expect(scene('INT. PRIYA’S BATHROOM - DAY\nGUS: Hi.').title).toBe('Priya’s Bathroom');
    expect(parseScript("INT. KITCHEN - DAY\nMRS. O'BRIEN: Hi.").cast[0].name).toBe("Mrs. O'Brien");
  });
});

describe('vehicle directions', () => {
  const beat = (direction: string) => scene(`EXT. MAIN STREET - DAY\nA crowd fills the street.\nGUS: Hi.\n${direction}`).beats.at(-1)!;

  it('keeps the rest of the sentence', () => {
    expect(beat('The bus drives up as the crowd cheers.')).toMatchObject({ crowd: 'cheer', moves: [{ kind: 'enter' }] });
    expect(beat('The bus drives up as we pull back.')).toMatchObject({ shot: { type: 'wide', pan: true }, moves: [{ kind: 'enter' }] });
    expect(beat('The bus drives up and a caption reads "Later."')).toMatchObject({ caption: 'Later.', moves: [{ kind: 'enter' }] });
    expect(scene('EXT. MAIN STREET - DAY\nThe bus pulls up.\nGUS: Hi.\nThe bus drives off as Gus waves.').beats.at(-1)).toMatchObject({ who: 'gus', gesture: 'wave', moves: [{ kind: 'exit' }] });
  });

  it("doesn't turn getting in into a jump", () => {
    const got = scene('EXT. MAIN STREET - DAY\nThe car pulls up.\nGUS: Hi.\nGus jumps in the car.').beats.at(-1)!;
    expect(got.action).toBeUndefined();
    expect(got.moves?.[0].kind).toBe('getIn');
  });
});

describe('things that fall', () => {
  it('lets a prop fall down without anyone fainting', () => {
    const fell = scene('INT. KITCHEN - DAY\nGUS: Hi.\nA plunger falls down.').beats.at(-1)!;
    expect(fell.drift).toMatchObject({ item: 'plunger', style: 'fall' });
    expect(fell.action).toBeUndefined();
    expect(scene('INT. KITCHEN - DAY\nGUS: Hi.\nGus falls down.').beats.at(-1)).toMatchObject({ who: 'gus', action: 'faint' });
  });
});

describe('close-ups', () => {
  it('cuts back wide for a gesture the close-up would crop', () => {
    const s = scene('EXT. MAIN STREET - DAY\nGUS: (yelling) NO WAY!\nGus shrugs.\nGUS: Fine.');
    expect(s.beats[0].shot).toMatchObject({ type: 'close' });
    expect(s.beats[1].shot).toMatchObject({ type: 'wide' });
    expect(s.beats[2].shot).toBeUndefined();
  });

  it('stays in close for a side-eye', () => {
    const s = scene('EXT. MAIN STREET - DAY\nGUS: (yelling) NO WAY!\nTILLY: Hm.\nGus glances at Tilly.');
    expect(s.beats[2].shot).toBeUndefined();
  });
});

describe('weather that changes during a scene', () => {
  const SNOW = 'EXT. MAIN STREET - DAY\nGUS: Is that...\nIt starts snowing.\nGUS: Snow!';

  it('holds off until the direction, then comes on gradually', () => {
    const { sc, at } = play(SNOW);
    expect(sc.scene.weather).toBe('none');
    const start = sc.beats.find((b) => b.beat.weather)!.start;
    expect(at(0.2).weather).toBe('none');
    expect(at(start - 0.05).weather).toBe('none');
    expect(at(start + 0.3).weather).toBe('snow');
    expect(at(start + 0.3).weatherLevel).toBeGreaterThan(0);
    expect(at(start + 0.3).weatherLevel).toBeLessThan(1);
    expect(at(start + 4).weatherLevel).toBe(1);
  });

  it('draws more flakes as it builds', () => {
    const { sc, at } = play(SNOW);
    const start = sc.beats.find((b) => b.beat.weather)!.start;
    const flakes = (t: number) => (draw(at(t)).match(/opacity="0\.9"/g) ?? []).length;
    expect(flakes(start + 0.3)).toBeLessThan(flakes(start + 4));
    expect(flakes(start - 0.05)).toBe(0);
  });

  it('snows from the start when that is how the scene opens', () => {
    expect(scene('EXT. MAIN STREET - DAY\nIt starts snowing.\nGUS: Hi.').weather).toBe('snow');
  });

  it('can stop again, and rain the same way', () => {
    const { sc, at } = play('EXT. MAIN STREET - SNOW\nGUS: Brr.\nIt stops snowing.\nGUS: Phew.');
    const stop = sc.beats.find((b) => b.beat.weather)!.start;
    expect(at(0.2).weather).toBe('snow');
    expect(at(stop + 5).weather).toBe('none');
    expect(scene('EXT. MAIN STREET - DAY\nGUS: Hi.\nIt starts raining.').beats.at(-1)?.weather).toBe('rain');
  });
});

describe('time of day on the hand-drawn sets', () => {
  it('reads it from the heading', () => {
    expect(scene('EXT. MAIN STREET - NIGHT\nGUS: Hi.').set).toMatchObject({ kind: 'preset', preset: 'mainstreet', time: 'night' });
    expect(scene('EXT. BUS STOP - DUSK\nGUS: Hi.').set).toMatchObject({ preset: 'busstop', time: 'dusk' });
    expect(scene('EXT. BUS STOP - DAY\nGUS: Hi.').set).toEqual({ kind: 'preset', preset: 'busstop' });
  });

  it('leaves alone a place that has no daytime', () => {
    expect(scene('EXT. OUTER SPACE - NIGHT\nGUS: Hi.').set).toEqual({ kind: 'preset', preset: 'space' });
  });

  it('draws the set differently at night', () => {
    const frame = (time: string) => draw(play(`EXT. MAIN STREET - ${time}\nGUS: Hi.`).at(0.3));
    expect(frame('NIGHT')).toContain('kit-tint-night');
    expect(frame('DAY')).not.toContain('kit-tint');
  });

  it('shows the night through a hole in the wall', () => {
    const script = (time: string) => `INT. GROCERY STORE - ${time}\nGUS: Hi.\nOfficer Plunkett drives through the wall in his police car.\nOFFICER PLUNKETT: Sorry.`;
    const after = (time: string) => {
      const { sc, at } = play(script(time));
      return draw(at(sc.impacts[0].t + 1));
    };
    expect(after('DAY')).toContain('#bfe3ee');
    expect(after('NIGHT')).not.toContain('#bfe3ee');
  });
});

describe('split screens', () => {
  const CALL = 'INT. KITCHEN - DAY\nSPLIT SCREEN: Gus and Tilly at the bus stop.\nGUS: Hello?\nTILLY: Hi.\nMOM: Who is that?';

  it('only gives phones to the two on the call', () => {
    const s = scene(CALL);
    expect(s.blocking.filter((b) => b.hold === 'phone').map((b) => b.who).sort()).toEqual(['gus', 'tilly']);
  });

  it('finds the caller when the split only names the other end', () => {
    const s = scene('INT. KITCHEN - DAY\nGUS: Hi.\nTILLY: Hi.\nSPLIT SCREEN: Tilly at the bus stop.\nMOM: Who is that?');
    expect(s.blocking.filter((b) => b.hold === 'phone').map((b) => b.who).sort()).toEqual(['gus', 'tilly']);
  });

  it('puts someone on the other end even if they never speak', () => {
    expect(scene('INT. KITCHEN - DAY\nSPLIT SCREEN: Gus and Tilly at the bus stop.\nGUS: Hello?\n\nINT. BEDROOM - DAY\nTILLY: Hi.').blocking.map((b) => b.who).sort()).toEqual(['gus', 'tilly']);
  });

  it('keeps everyone on one side in that half of the picture', () => {
    const { at, sc } = play('INT. KITCHEN - DAY\nSPLIT SCREEN: Gus and Tilly at the bus stop.\nGUS: Hello?\nTILLY: Hi.\nMOM: Who is that?');
    const frame = at(sc.duration - 0.2);
    const { left } = frame.split!;
    for (const a of frame.actors.filter((x) => !x.right)) {
      expect(a.x).toBeGreaterThan(left.x + 60);
      expect(a.x).toBeLessThan(left.x + left.w - 60);
    }
  });

  it('builds the furniture on the side that needs it', () => {
    const s = scene('INT. KITCHEN - DAY\nSPLIT SCREEN: Gus and Tilly in the bedroom.\nTilly sits on the bed.\nGUS: Hello?\nTILLY: Hi.');
    const pieces = (set: typeof s.set) => (set.kind === 'kit' ? set.pieces.map((p) => p.type) : []);
    expect(pieces(s.split!.set)).toContain('bed');
    expect(pieces(s.set)).not.toContain('bed');
  });

  it('sits someone on the seat in their own half', () => {
    const { at, sc } = play('EXT. BUS STOP - DAY\nSPLIT SCREEN: Gus and Tilly in the living room.\nTilly sits on the couch.\nGUS: Hello?\nTILLY: Hi.');
    const couch = seatsOf(sc.scene.split!.set)[0];
    const tilly = at(sc.duration - 0.2).actors.find((a) => a.castId === 'tilly')!;
    expect(tilly.y).toBe(couch.y);
    expect(Math.abs(tilly.x - couch.x)).toBeLessThan(couch.w / 2);
  });

  it('draws an explosion on the other end in that half', () => {
    const { at, sc } = play('INT. KITCHEN - DAY\nSPLIT SCREEN: Gus and Tilly at the bus stop.\nGUS: Hello?\nTILLY: Hi.\nTilly explodes.\nGUS: Hello?');
    const frame = at(sc.beats.find((b) => b.beat.burst)!.start + 0.2);
    expect(frame.bursts[0].right).toBe(true);
  });

  it('flies a prop thrown on the other end in that half', () => {
    const { at, sc } = play('INT. KITCHEN - DAY\nSPLIT SCREEN: Gus and Tilly at the bus stop.\nGUS: Hello?\nTILLY: Hi.\nTilly throws a snowball.\nGUS: Hello?');
    const flight = sc.flights[0];
    expect(at((flight.t0 + flight.t1) / 2).props[0].right).toBe(true);
  });
});

describe('the classroom', () => {
  it('has a desk for each of four kids', () => {
    const seats = getScene('classroom').seats!;
    expect(seats.length).toBeGreaterThanOrEqual(4);
    const { at, sc } = play('INT. CLASSROOM - DAY\nThe kids sit at their desks.\nDEX: Hi.\nBENNY: Hi.\nPRIYA: Hi.\nGUS: Hi.');
    const xs = at(sc.duration - 0.2).actors.map((a) => a.x).sort((a, b) => a - b);
    expect(xs).toHaveLength(4);
    xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThan(150));
  });
});

describe('seats', () => {
  it('gives kids a desk each before anyone shares', () => {
    const { at, sc } = play('INT. CLASSROOM - DAY\nMr. Hargrove stands at the chalkboard. The kids sit at their desks.\nMR. HARGROVE: Today.\nBENNY: Hi.\nPRIYA: Hi.\nDEX: Hi.');
    const kids = at(sc.duration - 0.2).actors.filter((a) => a.castId !== 'mr-hargrove').map((a) => a.x).sort((a, b) => a - b);
    expect(kids).toHaveLength(3);
    kids.slice(1).forEach((x, i) => expect(x - kids[i]).toBeGreaterThan(200));
  });

  it('still shares one couch', () => {
    const { at, sc } = play('INT. LIVING ROOM - DAY\nThe kids sit on the couch.\nBENNY: Hi.\nPRIYA: Hi.');
    expect(new Set(at(sc.duration - 0.2).actors.map((a) => a.y)).size).toBe(1);
  });
});

describe('signs and pets', () => {
  it('writes a held sign from the script', () => {
    const ep = parseScript('EXT. MAIN STREET - DAY\nGus holds a sign that reads "SNOW DAY NOW".\nGUS: Hi.');
    expect(ep.cast[0].look.signText).toBe('SNOW DAY NOW');
    expect(ep.scenes[0].beats[0]).toMatchObject({ who: 'gus', hold: 'sign' });
    expect(ep.scenes[0].beats[0].caption).toBeUndefined();
  });

  it('gives a slogan to everyone holding one', () => {
    const ep = parseScript('EXT. MAIN STREET - DAY\nGus and Tilly run in holding signs that say "NO HOMEWORK".\nGUS: Hi.\nTILLY: Hi.');
    expect(ep.cast.map((c) => c.look.signText)).toEqual(['NO HOMEWORK', 'NO HOMEWORK']);
    const kids = parseScript('EXT. MAIN STREET - DAY\nGUS: Hi.\nTILLY: Hi.\nThe kids hold signs that read "NO HOMEWORK".');
    expect(kids.cast.map((c) => c.look.signText)).toEqual(['NO HOMEWORK', 'NO HOMEWORK']);
  });

  it('reads the words written before the sign', () => {
    const ep = parseScript('EXT. MAIN STREET - DAY\nGus holds a "FREE PIZZA" sign.\nGUS: Hi.');
    expect(ep.cast[0].look.signText).toBe('FREE PIZZA');
    expect(ep.scenes[0].beats[0]).toMatchObject({ who: 'gus', hold: 'sign' });
  });

  it('leaves a sign in the set as a caption', () => {
    expect(scene('EXT. MAIN STREET - DAY\nGUS: Hi.\nThe sign says "Closed."').beats.at(-1)?.caption).toBe('Closed.');
  });

  it('gives someone their pet', () => {
    const pet = (direction: string) => parseScript(`EXT. MAIN STREET - DAY\nGUS: Hi.\n${direction}`).cast[0].look.sidekick;
    expect(pet('Gus walks his dog.')).toBe('dog');
    expect(pet('Gus arrives with her cat.')).toBe('cat');
    expect(pet('Gus holds his pet chicken.')).toBe('hen');
    expect(pet("Gus's turtle looks up.")).toBe('turtle');
    expect(pet('Gus has a pet pig.')).toBe('pig');
  });

  it("doesn't mistake a prop or a stray animal for a pet", () => {
    const pet = (direction: string) => parseScript(`EXT. MAIN STREET - DAY\nGUS: Hi.\n${direction}`).cast[0].look.sidekick;
    expect(pet('Gus holds his rubber chicken.')).toBe('none');
    expect(pet('Gus looks at a dog.')).toBe('none');
    expect(pet('Gus turns into a frog.')).toBe('none');
  });

  it('keeps a pet the same colour whatever is in their hand', () => {
    const { at, sc } = play('EXT. MAIN STREET - DAY\nGus walks his dog.\nGUS: Hi.\nGus picks up a phone.\nGUS: Hello?');
    const look = (t: number) => at(t).actors[0].c;
    const before = look(0.2);
    const after = look(sc.duration - 0.2);
    expect(after.held).toBe('phone');
    expect(after.sidekickColor).toBe(before.heldColor);
  });

  it("doesn't hand someone their pet as a prop", () => {
    const beats = scene('EXT. MAIN STREET - DAY\nGUS: Hi.\nGus runs in with his pet chicken.').beats;
    expect(beats.at(-1)?.hold).toBeUndefined();
  });
});
