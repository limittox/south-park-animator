import { useEffect, useRef } from 'react';
import type { Beat, CastMember, Episode, Move, Scene, Shot } from '../episode/types';
import { ACTION_LIST, BURST_LIST, CROWD_LIST, EFFECT_LIST, GESTURE_LIST, MOOD_LIST, SFX_LIST, SHOT_LIST } from '../episode/catalog';
import { insertBeat, moveBeat, removeBeat, updateBeat } from '../episode/edit';
import { seatsOf } from '../episode/seats';
import { FaceSelect } from './FaceSelect';
import { getVehicleDef } from '../sets/vehicles';
import { HELD, SIDEKICKS } from '../character/parts/held';
import type { VoiceStatus } from '../audio/useVoiceBank';

interface Props {
  episode: Episode;
  sceneIndex: number;
  currentBeat: number;
  voiced: ReadonlySet<string>;
  voiceStatus: VoiceStatus;
  onScene: (scene: Scene, merge?: string) => void;
  onSeekBeat: (beatIndex: number) => void;
  onPlayLine: (beatId: string) => void;
}

const SPEAKER_COLORS = ['#d33b2c', '#3b6fd8', '#2e9d58', '#e08a16', '#8a4fd0', '#d14f93', '#1f9aa6', '#7a6a2e'];
export const castColor = (ep: Episode, id: string | undefined) => SPEAKER_COLORS[Math.max(0, ep.cast.findIndex((c) => c.id === id)) % SPEAKER_COLORS.length];

function CastSelect({ cast, value, onChange, allowNone }: { cast: CastMember[]; value?: string; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Character">
      {allowNone && <option value="">— nobody —</option>}
      {cast.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ShotEditor({ shot, cast, onChange }: { shot?: Shot; cast: CastMember[]; onChange: (s: Shot | undefined) => void }) {
  return (
    <div className="shot-edit">
      <select value={shot?.type ?? ''} onChange={(e) => onChange(e.target.value ? { ...(shot ?? {}), type: e.target.value as Shot['type'] } : undefined)} aria-label="Camera">
        <option value="">📷 keep shot</option>
        {SHOT_LIST.map((s) => (
          <option key={s.id} value={s.id}>
            📷 {s.label}
          </option>
        ))}
      </select>
      {shot && (
        <div className="chips">
          {shot.type !== 'wide' &&
            cast.map((c) => {
              const on = shot.on?.includes(c.id) ?? false;
              return (
                <button
                  key={c.id}
                  className="chip-btn"
                  aria-pressed={on}
                  onClick={() => onChange({ ...shot, on: on ? shot.on?.filter((x) => x !== c.id) : [...(shot.on ?? []), c.id] })}
                >
                  {c.name}
                </button>
              );
            })}
          <label className="check" title="Glide here from the last shot instead of cutting">
            <input type="checkbox" checked={!!shot.pan} onChange={(e) => onChange({ ...shot, pan: e.target.checked || undefined })} /> pan
          </label>
          {shot.type !== 'wide' && (
            <>
              <label className="check">
                <input type="checkbox" checked={!!shot.push} onChange={(e) => onChange({ ...shot, push: e.target.checked || undefined })} /> push in
              </label>
              <label className="check" title="Stay on them as they move">
                <input type="checkbox" checked={!!shot.follow} onChange={(e) => onChange({ ...shot, follow: e.target.checked || undefined })} /> follow
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const DRIVES: Move['kind'][] = ['walk', 'enter', 'exit', 'appear', 'vanish', 'crash'];

function MovesEditor({ moves, cast, scene, onChange }: { moves: Move[]; cast: CastMember[]; scene: Scene; onChange: (m: Move[]) => void }) {
  const vehicles = scene.vehicles ?? [];
  const seats = seatsOf(scene.set);
  const set = (i: number, patch: Partial<Move>) =>
    onChange(
      moves.map((m, j) => {
        if (j !== i) return m;
        const next: Move = { ...m, ...patch };
        for (const k of Object.keys(next) as (keyof Move)[]) if (next[k] === undefined) delete next[k];
        return next;
      }),
    );
  return (
    <div className="moves">
      {moves.map((m, i) => {
        const vehicle = vehicles.some((v) => v.id === m.who);
        return (
          <div key={i} className="move-row">
            <select
              value={m.who}
              onChange={(e) => {
                const toVehicle = vehicles.some((v) => v.id === e.target.value);
                set(i, { who: e.target.value, ...(toVehicle && !DRIVES.includes(m.kind) ? { kind: 'walk', on: undefined } : {}), ...(toVehicle ? { run: undefined } : {}) });
              }}
              aria-label="Who moves"
            >
              {cast.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {vehicles.length > 0 && (
                <optgroup label="Vehicles">
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {getVehicleDef(v.type).name} ({v.id})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <select
              value={m.kind}
              onChange={(e) => {
                const kind = e.target.value as Move['kind'];
                set(i, { kind, on: kind === 'getIn' ? vehicles[0]?.id : kind === 'sit' || kind === 'lie' ? m.on : kind === 'approach' ? cast.find((c) => c.id !== m.who)?.id : undefined });
              }}
              aria-label="Move"
            >
              <option value="walk">{vehicle ? 'drives to' : 'walks to'}</option>
              <option value="enter">{vehicle ? 'drives in to' : 'enters to'}</option>
              <option value="exit">{vehicle ? 'drives off' : 'exits'}</option>
              <option value="appear">appears at</option>
              <option value="vanish">vanishes</option>
              {vehicle && <option value="crash">crashes in at</option>}
              {!vehicle && <option value="approach">walks up to</option>}
              {!vehicle && <option value="sit">sits on</option>}
              {!vehicle && <option value="lie">lies on</option>}
              {!vehicle && <option value="stand">stands up</option>}
              {!vehicle && <option value="joinScreen">goes on the screen</option>}
              {!vehicle && <option value="leaveScreen">leaves the screen</option>}
              {!vehicle && vehicles.length > 0 && <option value="getIn">gets in</option>}
              {!vehicle && vehicles.length > 0 && <option value="getOut">gets out</option>}
            </select>
            {(m.kind === 'walk' || m.kind === 'enter' || m.kind === 'appear' || m.kind === 'crash') && (
              <input type="number" min={vehicle ? 0 : 140} max={vehicle ? 1600 : 1460} step={20} value={m.x ?? 800} onChange={(e) => set(i, { x: Number(e.target.value) })} aria-label="Target x" />
            )}
            {m.kind === 'crash' && (
              <label className="check" title="Tear a hole in the back of the set">
                <input type="checkbox" checked={m.on === 'wall'} onChange={(e) => set(i, { on: e.target.checked ? 'wall' : undefined })} /> through the wall
              </label>
            )}
            {(m.kind === 'enter' || m.kind === 'exit' || m.kind === 'crash') && (
              <select value={m.side ?? ''} onChange={(e) => set(i, { side: (e.target.value || undefined) as Move['side'] })} aria-label="Side">
                <option value="">{vehicle ? 'the way it faces' : 'nearest side'}</option>
                <option value="left">from/to left</option>
                <option value="right">from/to right</option>
                {!vehicle && m.kind === 'exit' && <option value="back">away from the camera</option>}
              </select>
            )}
            {m.kind === 'approach' && <CastSelect cast={cast.filter((c) => c.id !== m.who)} value={m.on} onChange={(v) => set(i, { on: v })} />}
            {(m.kind === 'sit' || m.kind === 'lie') && (
              <select value={m.on ?? ''} onChange={(e) => set(i, { on: e.target.value || undefined })} aria-label="Seat">
                <option value="">{seats.length ? 'nearest seat' : 'the floor'}</option>
                {seats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
                {seats.length > 0 && <option value="floor">the floor</option>}
              </select>
            )}
            {m.kind === 'getIn' && (
              <select value={m.on ?? ''} onChange={(e) => set(i, { on: e.target.value })} aria-label="Vehicle">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {getVehicleDef(v.type).name} ({v.id})
                  </option>
                ))}
              </select>
            )}
            {!vehicle && (m.kind === 'walk' || m.kind === 'enter' || m.kind === 'exit' || m.kind === 'sit' || m.kind === 'lie' || m.kind === 'approach' || m.kind === 'getIn') && (
              <>
                <label className="check" title="Run instead of walk">
                  <input type="checkbox" checked={!!m.run} onChange={(e) => set(i, { run: e.target.checked || undefined, sneak: undefined })} /> run
                </label>
                <label className="check" title="Creep along, crouched">
                  <input type="checkbox" checked={!!m.sneak} onChange={(e) => set(i, { sneak: e.target.checked || undefined, run: undefined })} /> sneak
                </label>
              </>
            )}
            <button className="icon-btn tiny" onClick={() => onChange(moves.filter((_, j) => j !== i))} aria-label="Remove move">
              ✕
            </button>
          </div>
        );
      })}
      <button className="btn tiny" onClick={() => onChange([...moves, { who: cast[0]?.id ?? '', kind: 'walk', x: 800 }])} disabled={!cast.length}>
        + move
      </button>
    </div>
  );
}

function BeatCard(props: {
  ep: Episode;
  scene: Scene;
  beat: Beat;
  index: number;
  current: boolean;
  voiced: boolean;
  pending: boolean;
  error?: string;
  onScene: Props['onScene'];
  onSeek: () => void;
  onPlay: () => void;
}) {
  const { ep, scene, beat, index, current, voiced, pending, error, onScene, onSeek, onPlay } = props;
  const set = (patch: Partial<Beat>, merge?: string) => onScene(updateBeat(scene, beat.id, patch), merge);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);
  const isLine = beat.text !== undefined;
  const color = castColor(ep, beat.who);
  return (
    <div ref={ref} className={`beat${current ? ' cur' : ''}${isLine ? '' : ' silent'}`} style={{ borderLeftColor: color }} onFocusCapture={onSeek} onClick={onSeek}>
      <div className="beat-top">
        <CastSelect cast={ep.cast} value={beat.who} onChange={(v) => set({ who: v })} allowNone={!isLine} />
        <select value={beat.mood ?? ''} onChange={(e) => set({ mood: (e.target.value || undefined) as Beat['mood'] })} aria-label="Mood" title="Face from this beat on">
          <option value="">face: —</option>
          {MOOD_LIST.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select value={beat.gesture ?? ''} onChange={(e) => set({ gesture: (e.target.value || undefined) as Beat['gesture'] })} aria-label="Gesture">
          <option value="">arms: —</option>
          {GESTURE_LIST.filter((g) => g.id !== 'none').map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <span className="spacer" />
        {isLine && (
          <button
            className={`icon-btn tiny voice-dot${voiced ? ' ok' : error ? ' err' : pending ? ' wait' : ''}`}
            title={voiced ? 'Play this line' : error ? `Voice failed: ${error}` : 'Not voiced yet'}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            {voiced ? '🔊' : error ? '⚠' : '…'}
          </button>
        )}
        <button className="icon-btn tiny" onClick={() => onScene(moveBeat(scene, index, -1))} aria-label="Move up" disabled={index === 0}>
          ↑
        </button>
        <button className="icon-btn tiny" onClick={() => onScene(moveBeat(scene, index, 1))} aria-label="Move down" disabled={index === scene.beats.length - 1}>
          ↓
        </button>
        <button className="icon-btn tiny" onClick={() => onScene(removeBeat(scene, beat.id))} aria-label="Delete beat">
          ✕
        </button>
      </div>
      {isLine ? (
        <textarea className="beat-text" value={beat.text} rows={Math.min(5, Math.max(1, Math.ceil((beat.text?.length ?? 0) / 46)))} onChange={(e) => set({ text: e.target.value }, `text-${beat.id}`)} aria-label="Line" />
      ) : (
        <div className="silent-row">
          <span className="muted small">Silent beat</span>
          <label className="inline">
            <input type="number" min={0.1} max={30} step={0.1} value={beat.duration ?? ''} placeholder="auto" onChange={(e) => set({ duration: e.target.value === '' ? undefined : Number(e.target.value) }, `dur-${beat.id}`)} /> s
          </label>
        </div>
      )}
      <div className="beat-row">
        {isLine && (
          <input className="delivery" value={beat.delivery ?? ''} placeholder="delivery: yelling, whispering…" onChange={(e) => set({ delivery: e.target.value }, `del-${beat.id}`)} aria-label="Delivery" />
        )}
        <ShotEditor shot={beat.shot} cast={ep.cast.filter((c) => scene.blocking.some((b) => b.who === c.id) || scene.beats.some((b) => b.who === c.id))} onChange={(s) => set({ shot: s })} />
      </div>
      <details className="more">
        <summary>
          More
          {[
            beat.action,
            beat.sfx,
            beat.effect,
            beat.caption,
            beat.moves?.length ? `${beat.moves.length} move${beat.moves.length > 1 ? 's' : ''}` : '',
            beat.hold ? `holds ${HELD.find((h) => h.id === beat.hold)?.name.toLowerCase() ?? beat.hold}` : '',
            beat.give ? `hands to ${ep.cast.find((c) => c.id === beat.give)?.name ?? beat.give}` : '',
            beat.hug ? `hugs ${ep.cast.find((c) => c.id === beat.hug)?.name ?? beat.hug}` : '',
            beat.becomes ? `becomes ${ep.cast.find((c) => c.id === beat.becomes)?.name ?? beat.becomes}` : '',
            beat.crowd ? `crowd: ${beat.crowd}` : '',
            beat.burst?.kind,
            beat.drift ? `${beat.drift.item} goes by` : '',
            beat.also?.length ? `+${beat.also.length} together` : '',
            beat.pauseAfter ? `${beat.pauseAfter}s pause` : '',
          ]
            .filter(Boolean)
            .map((x) => (
              <span key={String(x)} className="tag">
                {x}
              </span>
            ))}
        </summary>
        <div className="more-grid">
          <label>
            Action
            <select value={beat.action ?? ''} onChange={(e) => set({ action: (e.target.value || undefined) as Beat['action'] })}>
              <option value="">—</option>
              {ACTION_LIST.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sound
            <select value={beat.sfx ?? ''} onChange={(e) => set({ sfx: (e.target.value || undefined) as Beat['sfx'] })}>
              <option value="">—</option>
              {SFX_LIST.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Screen
            <select value={beat.effect ?? ''} onChange={(e) => set({ effect: (e.target.value || undefined) as Beat['effect'] })}>
              <option value="">—</option>
              {EFFECT_LIST.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pause after (s)
            <input type="number" min={0} max={10} step={0.1} value={beat.pauseAfter ?? ''} placeholder="auto" onChange={(e) => set({ pauseAfter: e.target.value === '' ? undefined : Number(e.target.value) }, `pause-${beat.id}`)} />
          </label>
          <label className="span2">
            Caption
            <input value={beat.caption ?? ''} placeholder="On-screen text, e.g. Three hours later…" onChange={(e) => set({ caption: e.target.value }, `cap-${beat.id}`)} />
          </label>
          <label>
            Holds
            <select value={beat.hold ?? ''} onChange={(e) => set({ hold: e.target.value || undefined })} title="What they hold from this beat on">
              <option value="">—</option>
              <option value="none">nothing (puts it away)</option>
              {HELD.filter((h) => h.id !== 'none').map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hands it to
            <CastSelect cast={ep.cast.filter((c) => c.id !== beat.who)} value={beat.give} onChange={(v) => set({ give: v })} allowNone />
          </label>
          <label>
            Hugs
            <CastSelect cast={ep.cast.filter((c) => c.id !== beat.who)} value={beat.hug} onChange={(v) => set({ hug: v })} allowNone />
          </label>
          <label>
            Turns into
            <select value={beat.becomes ?? ''} onChange={(e) => set({ becomes: e.target.value || undefined })}>
              <option value="">—</option>
              {ep.cast
                .filter((c) => c.id !== beat.who)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              <optgroup label="Creatures">
                {SIDEKICKS.filter((s) => s.id !== 'none').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label>
            Crowd
            <select value={beat.crowd ?? ''} onChange={(e) => set({ crowd: (e.target.value || undefined) as Beat['crowd'] })} disabled={!scene.crowd}>
              <option value="">—</option>
              {CROWD_LIST.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Smoke and fire
            <select value={beat.burst?.kind ?? ''} onChange={(e) => set({ burst: e.target.value ? { ...beat.burst, kind: e.target.value as NonNullable<Beat['burst']>['kind'] } : undefined })}>
              <option value="">—</option>
              {BURST_LIST.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Goes by on its own
            <select value={beat.drift?.item ?? ''} onChange={(e) => set({ drift: e.target.value ? { ...beat.drift, item: e.target.value } : undefined })}>
              <option value="">—</option>
              {HELD.filter((h) => h.id !== 'none').map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <div className="span2">
            <span className="lbl">Does it together with</span>
            <div className="chips">
              {ep.cast
                .filter((c) => c.id !== beat.who)
                .map((c) => {
                  const on = beat.also?.includes(c.id) ?? false;
                  return (
                    <button key={c.id} className="chip-btn" aria-pressed={on} onClick={() => set({ also: on ? beat.also?.filter((x) => x !== c.id) : [...(beat.also ?? []), c.id] })}>
                      {c.name}
                    </button>
                  );
                })}
            </div>
          </div>
          <label className="span2" title={isLine ? undefined : 'Just the eyes move: a side-eye'}>
            Looks at
            <CastSelect cast={ep.cast.filter((c) => c.id !== beat.who)} value={beat.lookAt} onChange={(v) => set({ lookAt: v })} allowNone />
          </label>
          <label className="span2" title="From this beat until they next walk">
            Turns to face
            <FaceSelect cast={ep.cast.filter((c) => c.id !== beat.who)} value={beat.face} onChange={(v) => set({ face: v })} />
          </label>
          <div className="span2">
            <span className="lbl">Movement</span>
            <MovesEditor moves={beat.moves ?? []} cast={ep.cast} scene={scene} onChange={(m) => set({ moves: m })} />
          </div>
        </div>
      </details>
    </div>
  );
}

export function BeatsPanel({ episode, sceneIndex, currentBeat, voiced, voiceStatus, onScene, onSeekBeat, onPlayLine }: Props) {
  const scene = episode.scenes[sceneIndex];
  if (!scene) return null;
  const add = (silent: boolean) => {
    const last = scene.beats[scene.beats.length - 1];
    const who = last?.who && silent ? last.who : scene.blocking[0]?.who ?? episode.cast[0]?.id;
    const at = currentBeat >= 0 ? currentBeat : scene.beats.length - 1;
    onScene(insertBeat(scene, at, silent ? { who, duration: 1 } : { who, text: '' }).scene);
  };
  return (
    <div className="beats-panel">
      <div className="scene-meta">
        <input className="scene-title" value={scene.title} onChange={(e) => onScene({ ...scene, title: e.target.value }, `title-${scene.id}`)} aria-label="Scene title" />
        {scene.description && <p className="muted small">{scene.description}</p>}
      </div>
      {scene.beats.length === 0 && <p className="empty-note">No beats yet. Add a line, or ask the chat to write some.</p>}
      {scene.beats.map((b, i) => (
        <BeatCard
          key={b.id}
          ep={episode}
          scene={scene}
          beat={b}
          index={i}
          current={i === currentBeat}
          voiced={voiced.has(b.id)}
          pending={voiceStatus.running}
          error={voiceStatus.errors.get(b.id)}
          onScene={onScene}
          onSeek={() => i !== currentBeat && onSeekBeat(i)}
          onPlay={() => onPlayLine(b.id)}
        />
      ))}
      <div className="row add-row">
        <button className="btn small" onClick={() => add(false)}>
          + Line
        </button>
        <button className="btn small" onClick={() => add(true)}>
          + Silent beat
        </button>
      </div>
    </div>
  );
}
