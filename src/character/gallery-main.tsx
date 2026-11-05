/*
 * Dev-only gallery of every character part, for checking the art. One category per page:
 * parts-gallery.html?cat=hat&body=kid,adult&view=hat&cols=6
 *   cat   a category id (default hat), or "pose" for every gesture
 *   body  body types to draw each part on
 *   view  a thumbnail view (head, face, top, hat, torso, legs, feet, held, side, full)
 *   cols  columns
 *   page, per  paging for long categories
 *   bg    background colour without the #, e.g. fff to check pale parts against snow
 */
import { createRoot } from 'react-dom/client';
import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/900.css';
import type { CategoryId, CharacterState } from '../types';
import type { GestureId } from '../episode/types';
import { CATEGORIES, GROUPS, thumbViewBox } from '../data/catalog';
import { GESTURE_LIST } from '../episode/catalog';
import { DEFAULT_CHARACTER } from '../data/defaults';
import { applyItem } from '../lib/apply';
import { CharacterSvg } from './Character';
import { installFlatStyle } from './flat';
import { frameViewBox, getGeo } from './geometry';
import { poseArms } from './pose';

installFlatStyle();

const q = new URLSearchParams(location.search);
const cat = (q.get('cat') ?? 'hat') as CategoryId | 'pose';
const bodies = (q.get('body') ?? 'kid,adult').split(',');
const cols = Number(q.get('cols') ?? 6);
const per = Number(q.get('per') ?? 999);
const page = Number(q.get('page') ?? 0);

/** A neutral model, so the part under review is what you see. */
function base(body: string): CharacterState {
  const adult = body !== 'kid' && body !== 'husky' && body !== 'skinny';
  return {
    ...DEFAULT_CHARACTER,
    body,
    hat: 'none',
    hair: adult ? 'sidepart' : 'messy',
    top: 'sweater',
    topColor: '#6b8e9e',
    bottomColor: '#55555a',
    nose: adult ? 'adult' : 'none',
  };
}

const VIEWS: Partial<Record<CategoryId, 'full'>> = { body: 'full' };

function Cell({ id, name, make }: { id: string; name: string; make: (c: CharacterState) => CharacterState }) {
  const view = q.get('view') ?? (cat === 'pose' ? 'full' : (VIEWS[cat as CategoryId] ?? CATEGORIES[cat as CategoryId].view));
  return (
    <div className="cell" style={q.has('bg') ? { background: `#${q.get('bg')}` } : undefined}>
      <div className="pair">
        {bodies.map((b) => {
          const c = make(base(b));
          const g = getGeo(c.body, c.headShape);
          const viewBox = view === 'full' ? frameViewBox(g) : thumbViewBox(view as never, g);
          const arms = cat === 'pose' ? poseArms(g, id as GestureId, 1, 0.2) : undefined;
          return <CharacterSvg key={b} c={c} viewBox={viewBox} arms={arms} />;
        })}
      </div>
      <div className="nm">{name}</div>
    </div>
  );
}

function App() {
  const items = cat === 'pose' ? GESTURE_LIST.map((g) => ({ id: g.id as string, name: g.label })) : CATEGORIES[cat].items;
  const shown = items.slice(page * per, (page + 1) * per);
  return (
    <>
      <nav>
        {GROUPS.flatMap((g) => g.cats).map((c) => (
          <a key={c} href={`?cat=${c}`}>
            {c}
          </a>
        ))}
        <a href="?cat=pose">pose</a>
      </nav>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {shown.map((item) => (
          <Cell key={item.id} id={item.id} name={`${item.id}`} make={(c) => (cat === 'pose' ? c : applyItem(c, cat, item.id))} />
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
