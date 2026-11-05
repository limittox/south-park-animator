/* Dev-only gallery of the paper set kit: every piece, plus sample sets with characters for scale. */
import { createRoot } from 'react-dom/client';
import '@fontsource/luckiest-guy/400.css';
import type { KitSet, TimeOfDay } from '../episode/types';
import { installFlatStyle } from '../character/flat';
import { CharacterGroup } from '../character/Character';
import { DEFAULT_CHARACTER } from '../data/defaults';
import { defaultKitSet, KIT_PIECES, kitGroundY, normalizeKitSet, renderKitSet, resolvePiece, type KitPieceDef } from './kit';

installFlatStyle();

function PieceCell({ def, time }: { def: KitPieceDef; time: TimeOfDay }) {
  const set = defaultKitSet(def.place === 'exterior' ? 'exterior' : 'interior');
  const ctx = { time, set: { ...set, time } };
  const p = resolvePiece(set, { id: def.id, type: def.id, x: 0, y: 0, text: def.text ? 'Sample Text' : undefined });
  const pad = 40;
  const vb = `${-def.w / 2 - pad} ${-def.h - pad} ${def.w + pad * 2} ${def.h + pad * 2}`;
  const bg = def.place === 'exterior' ? (time === 'night' ? '#1a2558' : '#92d6e6') : '#d8c7a0';
  return (
    <div className="cell">
      <svg viewBox={vb} className="sp-scene">
        <rect x={-def.w / 2 - pad} y={-def.h - pad} width={def.w + pad * 2} height={def.h + pad * 2} fill={bg} />
        {def.render(p, ctx)}
        {def.lights?.(p, ctx)}
      </svg>
      <div className="nm">
        {def.id} ({def.anchor})
      </div>
    </div>
  );
}

const kid = DEFAULT_CHARACTER;
const adult = { ...DEFAULT_CHARACTER, body: 'adult', hat: 'none', hair: 'short', top: 'suit', topColor: '#3d4a6a' };

const SAMPLES: { name: string; set: KitSet; cast?: boolean }[] = [
  {
    name: 'Big-box store',
    cast: true,
    set: normalizeKitSet({
      place: 'interior',
      wall: '#e8e4ea',
      wallStyle: 'panels',
      floor: '#c9c9c9',
      floorStyle: 'tiles',
      pieces: [
        { type: 'wall-sign', x: 800, y: 150, text: 'SUPER BIG STUFF MART', color: '#2e4fa8', color2: '#ffffff' },
        { type: 'store-shelf', x: 230 },
        { type: 'store-shelf', x: 670 },
        { type: 'fridge-case', x: 1150, text: 'FROZEN' },
        { type: 'checkout', x: 1380, y: 990, front: true },
      ],
    }),
  },
  {
    name: "Principal's office",
    cast: true,
    set: normalizeKitSet({
      place: 'interior',
      wall: '#c9b98f',
      wallStyle: 'wainscot',
      wallAccent: '#8a5a32',
      floor: '#6b4a3a',
      floorStyle: 'boards',
      pieces: [
        { type: 'wall-sign', x: 800, y: 170, text: "PRINCIPAL'S OFFICE" },
        { type: 'door', x: 230, text: 'PRINCIPAL' },
        { type: 'big-window', x: 1150, color2: '#7a2a2a' },
        { type: 'filing-cabinet', x: 1480 },
        { type: 'flag', x: 480 },
        { type: 'plant', x: 1380, y: 720 },
        { type: 'desk', x: 1100, y: 1000, front: true },
        { type: 'computer', x: 1060, y: 800, front: true },
      ],
    }),
  },
  {
    name: 'Hospital room at night',
    set: normalizeKitSet({
      place: 'interior',
      time: 'night',
      wall: '#cfe3dc',
      wallStyle: 'tiles',
      wallAccent: '#b7cfc7',
      floor: '#9fb0b0',
      floorStyle: 'tiles',
      pieces: [
        { type: 'window', x: 1240, color2: '#7fb3a5' },
        { type: 'hospital-bed', x: 700, y: 780 },
        { type: 'clock', x: 400 },
        { type: 'floor-lamp', x: 1450 },
        { type: 'tv', x: 220, text: 'NEWS' },
      ],
    }),
  },
  {
    name: 'Classroom',
    cast: true,
    set: normalizeKitSet({
      place: 'interior',
      wall: '#6ea31c',
      floor: '#7c6053',
      pieces: [
        { type: 'chalkboard', x: 800, text: "TODAY'S LESSON: DON'T." },
        { type: 'clock', x: 1400, y: 240 },
        { type: 'poster', x: 180, text: 'HANG IN THERE' },
        { type: 'school-desk', x: 160, y: 990, front: true },
        { type: 'school-desk', x: 1440, y: 990, front: true },
        { type: 'flag', x: 1250 },
        { type: 'bulletin-board', x: 1450, y: 600 },
      ],
    }),
  },
  {
    name: 'Town street at dusk',
    set: normalizeKitSet({
      place: 'exterior',
      time: 'dusk',
      ground: 'road',
      backdrop: 'mountains',
      pieces: [
        { type: 'sun-moon', x: 1300, y: 330 },
        { type: 'shop', x: 220, text: 'TACO PALACE' },
        { type: 'police-station', x: 720 },
        { type: 'shop', x: 1220, text: "BOB'S BAIT", color: '#3f7f5a', color2: '#df924c' },
        { type: 'streetlight', x: 470 },
        { type: 'streetlight', x: 1460 },
        { type: 'car', x: 1000, y: 850 },
        { type: 'hydrant', x: 120, y: 960 },
      ],
    }),
  },
  {
    name: 'Forest at night',
    set: normalizeKitSet({
      place: 'exterior',
      time: 'night',
      ground: 'snow',
      backdrop: 'forest',
      pieces: [
        { type: 'sun-moon', x: 1250, y: 260 },
        { type: 'tent', x: 360 },
        { type: 'campfire', x: 800 },
        { type: 'bare-tree', x: 1450, y: 820 },
        { type: 'signpost', x: 1120, text: 'CAMP LAKE' },
        { type: 'rock', x: 140, y: 900 },
        { type: 'snowman', x: 560, y: 820 },
      ],
    }),
  },
  {
    name: 'Suburb, day, grass',
    set: normalizeKitSet({
      place: 'exterior',
      ground: 'grass',
      backdrop: 'town',
      pieces: [
        { type: 'cloud', x: 300 },
        { type: 'sun-moon', x: 1400 },
        { type: 'house', x: 300 },
        { type: 'house', x: 1250, color: '#3b6fd8' },
        { type: 'fence', x: 620, y: 780 },
        { type: 'fence', x: 940, y: 780 },
        { type: 'bush', x: 800 },
        { type: 'mailbox', x: 520, y: 860 },
      ],
    }),
  },
  {
    name: 'Downtown, night',
    cast: true,
    set: normalizeKitSet({
      place: 'exterior',
      time: 'night',
      ground: 'sidewalk',
      backdrop: 'city',
      pieces: [
        { type: 'building', x: 200 },
        { type: 'hospital', x: 800 },
        { type: 'building', x: 1400, color: '#7a6a8a' },
        { type: 'streetlight', x: 480, y: 780 },
        { type: 'bench', x: 1150, y: 820 },
        { type: 'dumpster', x: 1460, y: 840 },
      ],
    }),
  },
  {
    name: 'School front, snow',
    set: normalizeKitSet({
      place: 'exterior',
      ground: 'snow',
      backdrop: 'mountains',
      pieces: [
        { type: 'school', x: 800 },
        { type: 'flag', x: 300 },
        { type: 'church', x: 1400, scale: 0.8 },
        { type: 'bus-stop-sign', x: 130, y: 860 },
        { type: 'gas-pump', x: 1180, y: 800 },
      ],
    }),
  },
  {
    name: 'Kitchen + stage',
    set: normalizeKitSet({
      place: 'interior',
      wall: '#f2d48a',
      wallStyle: 'stripes',
      wallAccent: '#f6e2a8',
      floor: '#1d1d1d',
      floorStyle: 'checker',
      pieces: [
        { type: 'cabinets', x: 400 },
        { type: 'fridge', x: 760 },
        { type: 'stove', x: 980 },
        { type: 'table', x: 1300 },
        { type: 'chair', x: 1180 },
        { type: 'vending-machine', x: 1500 },
        { type: 'trash-can', x: 100 },
      ],
    }),
  },
  {
    name: 'Living room at dusk',
    set: normalizeKitSet({
      place: 'interior',
      time: 'dusk',
      wall: '#b6dad9',
      floor: '#c0cf7f',
      floorStyle: 'carpet',
      pieces: [
        { type: 'couch', x: 800 },
        { type: 'armchair', x: 1250 },
        { type: 'tv', x: 270, text: 'TOOT TOOT HOUR' },
        { type: 'big-window', x: 1150, y: 470, color2: '#4b4f7d' },
        { type: 'picture', x: 600 },
        { type: 'fireplace', x: 1460, scale: 0.8 },
        { type: 'rug', x: 800 },
        { type: 'floor-lamp', x: 1500, y: 720 },
        { type: 'bookshelf', x: 100 },
      ],
    }),
  },
  {
    name: 'Bathroom + school hallway + stage',
    set: normalizeKitSet({
      place: 'interior',
      wall: '#b8d0e8',
      wallStyle: 'tiles',
      wallAccent: '#9fbad6',
      floor: '#8a8fa0',
      floorStyle: 'tiles',
      pieces: [
        { type: 'curtain-stage', x: 800 },
        { type: 'stall', x: 200 },
        { type: 'toilet', x: 520 },
        { type: 'lockers', x: 1000 },
        { type: 'trophy-case', x: 1400 },
        { type: 'podium', x: 800, y: 1000, front: true, text: 'VOTE KYLIE' },
        { type: 'whiteboard', x: 1000, y: 300, scale: 0.5, text: 'MEETING 3PM' },
        { type: 'counter', x: 1420, y: 1000, front: true },
      ],
    }),
  },
];

function SampleSet({ name, set, cast }: { name: string; set: KitSet; cast?: boolean }) {
  const { back, front } = renderKitSet(set);
  const gy = kitGroundY(set);
  return (
    <div className="set">
      <div className="nm">
        {name} ({set.place}, {set.time})
      </div>
      <svg viewBox="0 0 1600 1000">
        {back}
        {cast && (
          <>
            <g transform={`translate(640 ${gy}) scale(1.15) translate(-200 -480)`}>
              <CharacterGroup c={kid} turn={0.4} />
            </g>
            <g transform={`translate(960 ${gy}) scale(1.15) translate(-200 -480)`}>
              <CharacterGroup c={adult} turn={-0.4} />
            </g>
            <g transform={`translate(1300 ${gy}) scale(1.15) translate(-200 -480)`}>
              <CharacterGroup c={kid} />
            </g>
          </>
        )}
        {front}
      </svg>
    </div>
  );
}

function Gallery() {
  // ?page=0&per=24&time=night shows one page of pieces at a size that's easy to check.
  const q = new URLSearchParams(location.search);
  const page = q.get('page');
  if (page !== null) {
    const per = Number(q.get('per') ?? 24);
    const time = (q.get('time') ?? 'day') as TimeOfDay;
    return (
      <div className="grid">
        {KIT_PIECES.slice(Number(page) * per, (Number(page) + 1) * per).map((d) => (
          <PieceCell key={d.id} def={d} time={time} />
        ))}
      </div>
    );
  }
  return (
    <>
      <h1>Paper set kit — {KIT_PIECES.length} pieces</h1>
      <h2>Day</h2>
      <div className="grid">
        {KIT_PIECES.map((d) => (
          <PieceCell key={d.id} def={d} time="day" />
        ))}
      </div>
      <h2>Sample sets</h2>
      <div className="sets">
        {SAMPLES.map((s) => (
          <SampleSet key={s.name} {...s} />
        ))}
      </div>
      <h2>Night</h2>
      <div className="grid">
        {KIT_PIECES.map((d) => (
          <PieceCell key={d.id} def={d} time="night" />
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Gallery />);
