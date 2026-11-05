import { memo, useState } from 'react';
import type { CastMember, Crowd, KitPiece, KitSet, Scene, Transition, Vehicle, VehicleType, Weather } from '../episode/types';
import { getVehicleDef, VEHICLES } from '../sets/vehicles';
import { TRANSITION_LIST, WEATHER_LIST } from '../episode/catalog';
import { SCENES } from '../scenes/backgrounds';
import { defaultKitSet, getPieceDef, KIT_PIECES } from '../sets/kit';
import { newId } from '../episode/normalize';
import { SetLayer } from '../render/FrameSvg';

interface Props {
  scene: Scene;
  onScene: (scene: Scene, merge?: string) => void;
}

/** Who appears on the TV, who's on the other end of a split screen, and how big the crowd is. */
function Staging({ scene, cast, onScene }: Props & { cast: CastMember[] }) {
  const crowd: Crowd = scene.crowd ?? { count: 0, layout: 'group' };
  const setCrowd = (patch: Partial<Crowd>, merge?: string) => {
    const next = { ...crowd, ...patch };
    onScene({ ...scene, crowd: next.count ? next : undefined }, merge);
  };
  const here = cast.filter((c) => scene.blocking.some((b) => b.who === c.id) || scene.beats.some((b) => b.who === c.id));
  const toggleScreen = (id: string) => {
    const has = scene.blocking.some((b) => b.who === id);
    const blocking = has ? scene.blocking.map((b) => (b.who === id ? { ...b, screen: b.screen ? undefined : true } : b)) : [...scene.blocking, { who: id, x: 800, depth: 0, mood: 'happy' as const, screen: true }];
    onScene({ ...scene, blocking });
  };
  const split = scene.split;
  const toggleSplit = (id: string) => {
    const who = split?.who.includes(id) ? split.who.filter((x) => x !== id) : [...(split?.who ?? []), id];
    onScene({ ...scene, split: who.length ? { set: split?.set ?? { kind: 'preset', preset: 'studio' }, who, ...(split?.weather ? { weather: split.weather } : {}) } : undefined });
  };
  return (
    <div className="field-grid">
      <label>
        Crowd size
        <input type="number" min={0} max={40} step={1} value={crowd.count} onChange={(e) => setCrowd({ count: Math.max(0, Math.min(40, Number(e.target.value))) }, `crowd-${scene.id}`)} />
      </label>
      <label>
        Crowd stands in
        <select value={crowd.layout} onChange={(e) => setCrowd({ layout: e.target.value as Crowd['layout'] })} disabled={!crowd.count}>
          <option value="group">Rows</option>
          <option value="line">A line</option>
        </select>
      </label>
      <div className="span2">
        <span className="lbl">On the TV or video call</span>
        <div className="chips">
          {here.map((c) => (
            <button key={c.id} className="chip-btn" aria-pressed={!!scene.blocking.find((b) => b.who === c.id)?.screen} onClick={() => toggleScreen(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="span2">
        <span className="lbl">Other end of a split screen</span>
        <div className="chips">
          {here.map((c) => (
            <button key={c.id} className="chip-btn" aria-pressed={!!split?.who.includes(c.id)} onClick={() => toggleSplit(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {split && (
        <label className="span2">
          Their set
          <select value={split.set.kind === 'preset' ? split.set.preset : ''} onChange={(e) => onScene({ ...scene, split: { ...split, set: { kind: 'preset', preset: e.target.value } } })}>
            {split.set.kind === 'kit' && <option value="">Built from the paper kit</option>}
            {SCENES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

const PresetThumb = memo(function PresetThumb({ id }: { id: string }) {
  return (
    <svg viewBox="0 100 1600 900" className="preset-svg" aria-hidden>
      <SetLayer set={{ kind: 'preset', preset: id }} layer="back" />
    </svg>
  );
});

const WALL_STYLES: KitSet['wallStyle'][] = ['plain', 'stripes', 'panels', 'brick', 'tiles', 'wainscot'];
const FLOOR_STYLES: KitSet['floorStyle'][] = ['plain', 'boards', 'tiles', 'carpet', 'checker'];
const GROUNDS: KitSet['ground'][] = ['snow', 'grass', 'road', 'sidewalk', 'dirt', 'sand'];
const BACKDROPS: KitSet['backdrop'][] = ['mountains', 'town', 'forest', 'city', 'none'];

function PieceRow({ p, set, onChange, onRemove }: { p: KitPiece; set: KitSet; onChange: (p: KitPiece, merge?: string) => void; onRemove: () => void }) {
  const def = getPieceDef(p.type);
  return (
    <div className="piece-row">
      <div className="piece-top">
        <b>{def?.name ?? p.type}</b>
        <span className="spacer" />
        <label className="check" title="Draw in front of the characters">
          <input type="checkbox" checked={!!p.front} onChange={(e) => onChange({ ...p, front: e.target.checked || undefined })} /> front
        </label>
        <label className="check">
          <input type="checkbox" checked={!!p.flip} onChange={(e) => onChange({ ...p, flip: e.target.checked || undefined })} /> flip
        </label>
        <button className="icon-btn tiny" onClick={onRemove} aria-label={`Remove ${def?.name ?? p.type}`}>
          ✕
        </button>
      </div>
      <div className="piece-controls">
        <label>
          x
          <input type="range" min={-100} max={1700} step={10} value={p.x} onChange={(e) => onChange({ ...p, x: Number(e.target.value) }, `px-${p.id}`)} />
        </label>
        <label>
          size
          <input type="range" min={0.3} max={2.5} step={0.05} value={p.scale ?? 1} onChange={(e) => onChange({ ...p, scale: Number(e.target.value) }, `ps-${p.id}`)} />
        </label>
        <input type="color" value={p.color ?? def?.defaultColor ?? '#888888'} onChange={(e) => onChange({ ...p, color: e.target.value }, `pc-${p.id}`)} aria-label="Colour" title={def?.colors ?? 'Colour'} />
        {def?.defaultColor2 && (
          <input type="color" value={p.color2 ?? def.defaultColor2} onChange={(e) => onChange({ ...p, color2: e.target.value }, `pc2-${p.id}`)} aria-label="Second colour" />
        )}
      </div>
      {def?.text && <input value={p.text ?? ''} placeholder="Text" onChange={(e) => onChange({ ...p, text: e.target.value }, `pt-${p.id}`)} aria-label="Text" />}
      {set.place === 'interior' && def?.anchor === 'wall' && (
        <label className="inline small">
          height
          <input type="range" min={150} max={650} step={10} value={p.y ?? def.defaultY ?? 460} onChange={(e) => onChange({ ...p, y: Number(e.target.value) }, `py-${p.id}`)} />
        </label>
      )}
    </div>
  );
}

export function SetPanel({ scene, cast, onScene }: Props & { cast: CastMember[] }) {
  const set = scene.set;
  const [adding, setAdding] = useState('');
  const setKit = (patch: Partial<KitSet>, merge?: string) => set.kind === 'kit' && onScene({ ...scene, set: { ...set, ...patch } }, merge);

  return (
    <div className="set-panel">
      <div className="field-grid">
        <label>
          Weather
          <select value={scene.weather} onChange={(e) => onScene({ ...scene, weather: e.target.value as Weather })}>
            {WEATHER_LIST.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Opening shot (s)
          <input type="number" min={0} max={8} step={0.1} value={scene.hold} onChange={(e) => onScene({ ...scene, hold: Number(e.target.value) }, `hold-${scene.id}`)} />
        </label>
        <label className="span2">
          Scene change
          <select
            value={scene.transition ?? 'cut'}
            onChange={(e) => {
              const v = e.target.value as Transition;
              onScene({ ...scene, transition: v === 'cut' ? undefined : v });
            }}
          >
            {TRANSITION_LIST.map((x) => (
              <option key={x.id} value={x.id} title={x.desc}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check span2">
          <input type="checkbox" checked={scene.sting} onChange={(e) => onScene({ ...scene, sting: e.target.checked })} /> Guitar sting at the start of the scene
        </label>
      </div>

      <Staging scene={scene} cast={cast} onScene={onScene} />

      <div className="seg-toggle" role="tablist">
        <button role="tab" aria-selected={set.kind === 'preset'} onClick={() => set.kind !== 'preset' && onScene({ ...scene, set: { kind: 'preset', preset: 'busstop' } })}>
          Town locations
        </button>
        <button role="tab" aria-selected={set.kind === 'kit'} onClick={() => set.kind !== 'kit' && onScene({ ...scene, set: defaultKitSet('interior') })}>
          Build with the paper kit
        </button>
      </div>

      {set.kind === 'preset' ? (
        <>
          <div className="preset-grid">
            {SCENES.map((s) => (
              <button key={s.id} className="preset-btn" aria-pressed={set.preset === s.id} onClick={() => onScene({ ...scene, set: { kind: 'preset', preset: s.id, townName: set.townName } })}>
                <PresetThumb id={s.id} />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
          {set.preset === 'townsign' && (
            <label className="field">
              <span className="lbl">Town name</span>
              <input value={set.townName ?? ''} placeholder="Snowpine Hollow" onChange={(e) => onScene({ ...scene, set: { ...set, townName: e.target.value } }, `town-${scene.id}`)} />
            </label>
          )}
        </>
      ) : (
        <>
          <div className="field-grid">
            <label>
              Place
              <select value={set.place} onChange={(e) => onScene({ ...scene, set: { ...defaultKitSet(e.target.value as KitSet['place']), time: set.time } })}>
                <option value="interior">Indoors</option>
                <option value="exterior">Outdoors</option>
              </select>
            </label>
            <label>
              Time
              <select value={set.time} onChange={(e) => setKit({ time: e.target.value as KitSet['time'] })}>
                <option value="day">Day</option>
                <option value="dusk">Dusk</option>
                <option value="night">Night</option>
              </select>
            </label>
            {set.place === 'interior' ? (
              <>
                <label>
                  Walls
                  <span className="row tight">
                    <input type="color" value={set.wall} onChange={(e) => setKit({ wall: e.target.value }, 'wall')} aria-label="Wall colour" />
                    <input type="color" value={set.wallAccent} onChange={(e) => setKit({ wallAccent: e.target.value }, 'accent')} aria-label="Wall accent colour" />
                    <select value={set.wallStyle} onChange={(e) => setKit({ wallStyle: e.target.value as KitSet['wallStyle'] })}>
                      {WALL_STYLES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </span>
                </label>
                <label>
                  Floor
                  <span className="row tight">
                    <input type="color" value={set.floor} onChange={(e) => setKit({ floor: e.target.value }, 'floor')} aria-label="Floor colour" />
                    <select value={set.floorStyle} onChange={(e) => setKit({ floorStyle: e.target.value as KitSet['floorStyle'] })}>
                      {FLOOR_STYLES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </span>
                </label>
              </>
            ) : (
              <>
                <label>
                  Ground
                  <select value={set.ground} onChange={(e) => setKit({ ground: e.target.value as KitSet['ground'] })}>
                    {GROUNDS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Far away
                  <select value={set.backdrop} onChange={(e) => setKit({ backdrop: e.target.value as KitSet['backdrop'] })}>
                    {BACKDROPS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          <h4>Pieces</h4>
          <p className="muted small">Pause, then drag pieces around on the stage.</p>
          <div className="row">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Piece to add">
              <option value="">Add a piece…</option>
              {KIT_PIECES.filter((p) => p.place === 'any' || p.place === set.place).map((p) => (
                <option key={p.id} value={p.id} title={p.desc}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="btn small"
              disabled={!adding}
              onClick={() => {
                setKit({ pieces: [...set.pieces, { id: newId('p'), type: adding, x: 800 }] });
                setAdding('');
              }}
            >
              + Add
            </button>
          </div>
          <div className="pieces">
            {set.pieces.map((p) => (
              <PieceRow
                key={p.id}
                p={p}
                set={set}
                onChange={(np, merge) => setKit({ pieces: set.pieces.map((x) => (x.id === p.id ? np : x)) }, merge)}
                onRemove={() => setKit({ pieces: set.pieces.filter((x) => x.id !== p.id) })}
              />
            ))}
          </div>
        </>
      )}

      <Vehicles scene={scene} onScene={onScene} />
    </div>
  );
}

/** Cars and buses in the scene. They drive and pick people up with moves in the Beats tab. */
function Vehicles({ scene, onScene }: Props) {
  const list = scene.vehicles ?? [];
  const put = (next: Vehicle[], merge?: string) => onScene({ ...scene, vehicles: next.length ? next : undefined }, merge);
  const change = (v: Vehicle, patch: Partial<Vehicle>, merge?: string) =>
    put(
      list.map((x) => {
        if (x.id !== v.id) return x;
        const next: Vehicle = { ...x, ...patch };
        for (const k of Object.keys(next) as (keyof Vehicle)[]) if (next[k] === undefined) delete next[k];
        return next;
      }),
      merge,
    );
  const add = (type: VehicleType) => {
    let id: string = type;
    for (let n = 2; list.some((v) => v.id === id); n++) id = `${type}-${n}`;
    put([...list, { id, type, x: 800, offstage: true, ...(type === 'bus' ? { lane: 'front' as const } : {}) }]);
  };
  return (
    <>
      <h4>Vehicles</h4>
      <p className="muted small">Make one drive in, pick people up and drive off with moves in the Beats tab.</p>
      <div className="row wrap">
        {VEHICLES.map((d) => (
          <button key={d.id} className="btn small" onClick={() => add(d.id)}>
            + {d.name}
          </button>
        ))}
      </div>
      <div className="pieces">
        {list.map((v) => {
          const def = getVehicleDef(v.type);
          return (
            <div key={v.id} className="piece-row">
              <div className="piece-top">
                <b>
                  {def.name} <span className="muted small">({v.id})</span>
                </b>
                <span className="spacer" />
                <label className="check" title="Drives in later">
                  <input type="checkbox" checked={!!v.offstage} onChange={(e) => change(v, { offstage: e.target.checked || undefined })} /> starts off stage
                </label>
                <label className="check" title="Face left">
                  <input type="checkbox" checked={!!v.flip} onChange={(e) => change(v, { flip: e.target.checked || undefined })} /> flip
                </label>
                <button className="icon-btn tiny" onClick={() => put(list.filter((x) => x.id !== v.id))} aria-label={`Remove ${def.name}`}>
                  ✕
                </button>
              </div>
              <div className="piece-controls">
                <label>
                  x
                  <input type="range" min={0} max={1600} step={10} value={v.x} onChange={(e) => change(v, { x: Number(e.target.value) }, `vx-${v.id}`)} />
                </label>
                <select value={v.lane ?? 'back'} onChange={(e) => change(v, { lane: e.target.value === 'front' ? 'front' : undefined })} aria-label="Lane">
                  <option value="back">behind the front row</option>
                  <option value="front">in front of everyone</option>
                </select>
                <input type="color" value={v.color ?? def.defaultColor} onChange={(e) => change(v, { color: e.target.value }, `vc-${v.id}`)} aria-label="Colour" />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
