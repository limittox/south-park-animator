import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CastMember, Episode, MoodId, Scene } from '../episode/types';
import { compileEpisode, compileScene, sampleScene, transitionTime, type CompiledEpisode } from '../episode/timeline';
import { repositionActor, setMoodAt, toggleFlip, updateScene } from '../episode/edit';
import { emptyScene, newId } from '../episode/normalize';
import { MOOD_LIST } from '../episode/catalog';
import { getScene } from '../scenes/backgrounds';
import { getPieceDef } from '../sets/kit';
import { FrameSvg } from '../render/FrameSvg';
import { audioContext, toAudioBuffer } from '../audio/voices';
import type { useVoiceBank } from '../audio/useVoiceBank';
import type { EpisodeEditor } from '../store/episodes';
import { updateSettings, type Settings } from '../store/settings';
import { StagePlayer, type PlayerHandle } from './StagePlayer';
import { BeatsPanel } from './BeatsPanel';
import { CastPanel } from './CastPanel';
import { SetPanel } from './SetPanel';
import { ChatPanel } from './ChatPanel';
import { toast } from './toast';

type Tab = 'beats' | 'cast' | 'set' | 'chat';

interface Props {
  editor: EpisodeEditor & { episode: Episode };
  settings: Settings;
  bank: ReturnType<typeof useVoiceBank>;
  onOpenSettings: () => void;
}

const SceneThumb = memo(function SceneThumb({ scene, cast }: { scene: Scene; cast: CastMember[] }) {
  const frame = useMemo(() => {
    const castMap = new Map(cast.map((c) => [c.id, c]));
    const sc = compileScene(scene, 0, 0, castMap, new Map());
    const ep = { episode: {} as Episode, cast: castMap, titleDuration: 0, scenes: [sc], duration: sc.duration } as CompiledEpisode;
    return { ...sampleScene(sc, ep, Math.max(0.01, scene.hold)), camera: { x: 0, y: 100, w: 1600, h: 900 } };
  }, [scene, cast]);
  return <FrameSvg frame={frame} className="thumb-svg" aria-hidden />;
});

function setName(scene: Scene): string {
  if (scene.set.kind === 'preset') return getScene(scene.set.preset).name;
  const main = scene.set.pieces.map((p) => getPieceDef(p.type)?.name).filter(Boolean)[0];
  return `${scene.set.place === 'interior' ? 'Indoors' : 'Outdoors'}${main ? ` · ${main}` : ''}`;
}

export function Studio({ editor, settings, bank, onOpenSettings }: Props) {
  const { episode, set } = editor;
  const compiled = useMemo(() => compileEpisode(episode, bank.clips), [episode, bank.clips]);
  const compiledRef = useRef(compiled);
  compiledRef.current = compiled;
  const player = useRef<PlayerHandle>(null);
  const [loc, setLoc] = useState({ scene: 0, beat: -1 });
  const [tab, setTab] = useState<Tab>('beats');
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const sceneIndex = Math.min(Math.max(0, loc.scene), episode.scenes.length - 1);
  const scene = episode.scenes[sceneIndex];

  const onScene = useCallback((s: Scene, merge?: string) => set((ep) => updateScene(ep, sceneIndex, () => s), { merge }), [set, sceneIndex]);

  const onDragActor = useCallback(
    (si: number, castId: string, sceneT: number, x: number, depth: number) => {
      const cs = compiledRef.current.scenes[si];
      if (cs) set((ep) => updateScene(ep, si, (s) => repositionActor(s, cs, castId, sceneT, x, depth)), { merge: `drag-${castId}-${si}` });
    },
    [set],
  );
  const onDragPiece = useCallback(
    (si: number, pieceId: string, x: number, y: number) =>
      set(
        (ep) =>
          updateScene(ep, si, (s) =>
            s.set.kind === 'kit' ? { ...s, set: { ...s.set, pieces: s.set.pieces.map((p) => (p.id === pieceId ? { ...p, x: Math.round(x), y: Math.round(y) } : p)) } } : s,
          ),
        { merge: `piece-${pieceId}` },
      ),
    [set],
  );

  const seekScene = (i: number) => {
    const sc = compiled.scenes[i];
    if (sc) player.current?.seek(sc.start + transitionTime(sc) + 0.001);
    setLoc({ scene: i, beat: -1 });
  };
  const seekBeat = (bi: number) => {
    const sc = compiled.scenes[sceneIndex];
    const b = sc?.beats[bi];
    if (b) player.current?.seek(sc.start + b.start + 0.001);
  };
  const playLine = (beatId: string) => {
    const line = bank.lines.get(beatId);
    if (!line) return toast(settings.apiKey ? 'That line is still being voiced.' : 'Add your OpenRouter key in Settings to voice lines.');
    const ctx = audioContext();
    const src = ctx.createBufferSource();
    src.buffer = toAudioBuffer(ctx, line);
    src.connect(ctx.destination);
    src.start();
  };

  // After adding or moving a scene, jump to it once the timeline has been rebuilt.
  const goTo = useRef<string | null>(null);
  useEffect(() => {
    const id = goTo.current;
    if (!id) return;
    goTo.current = null;
    const i = compiled.scenes.findIndex((s) => s.scene.id === id);
    if (i >= 0) {
      player.current?.seek(compiled.scenes[i].start + transitionTime(compiled.scenes[i]) + 0.001);
      setLoc({ scene: i, beat: -1 });
    }
  }, [compiled]);

  const insertAfter = (s: Scene) => {
    goTo.current = s.id;
    set((ep) => {
      const scenes = [...ep.scenes];
      scenes.splice(sceneIndex + 1, 0, s);
      return { ...ep, scenes };
    });
  };
  const addScene = () => insertAfter({ ...emptyScene(sceneIndex + 1), set: scene?.set ?? emptyScene(0).set });
  const duplicateScene = () => {
    const copy = structuredClone(scene);
    insertAfter({ ...copy, id: newId('s'), title: `${copy.title} (copy)`, beats: copy.beats.map((b) => ({ ...b, id: newId('b') })) });
  };
  const moveScene = (dir: -1 | 1) => {
    const j = sceneIndex + dir;
    if (j < 0 || j >= episode.scenes.length) return;
    goTo.current = scene.id;
    set((ep) => {
      const scenes = [...ep.scenes];
      [scenes[sceneIndex], scenes[j]] = [scenes[j], scenes[sceneIndex]];
      return { ...ep, scenes };
    });
  };
  const deleteScene = () => {
    if (episode.scenes.length <= 1) return;
    if (scene.beats.length && !confirm(`Delete "${scene.title}" and its ${scene.beats.length} beats?`)) return;
    set((ep) => ({ ...ep, scenes: ep.scenes.filter((_, i) => i !== sceneIndex) }));
  };

  const voiced = useMemo(() => new Set(bank.lines.keys()), [bank.lines]);
  const selected = selectedActor ? episode.cast.find((c) => c.id === selectedActor) : null;

  // Say why voicing failed once a run ends, not just how many lines did.
  const voiceError = bank.status.errors.values().next().value;
  const wasVoicing = useRef(false);
  useEffect(() => {
    const n = bank.status.errors.size;
    if (wasVoicing.current && !bank.status.running && voiceError) toast(`${n} line${n === 1 ? '' : 's'} couldn't be voiced: ${voiceError}`, 'error');
    wasVoicing.current = bank.status.running;
  }, [bank.status, voiceError]);

  const voiceChip = !settings.apiKey ? (
    <button className="chip warn" onClick={onOpenSettings} title="Without a key, your browser's own voice reads the lines and the video is silent">
      🔇 Stand-in voices
    </button>
  ) : bank.status.running ? (
    <span className="chip live">
      🎙 Voicing {bank.status.done}/{bank.status.total}
    </span>
  ) : bank.missing > 0 ? (
    <button className="chip warn" onClick={() => void bank.generate()} title={voiceError ? `Last error: ${voiceError}` : 'Voice the remaining lines'}>
      🎙 Voice {bank.missing} line{bank.missing === 1 ? '' : 's'}
      {bank.status.errors.size ? ` (${bank.status.errors.size} failed)` : ''}
    </button>
  ) : (
    <span className="chip ok">🎙 All voiced</span>
  );

  return (
    <main className="studio">
      <nav className="scenes-rail panel" aria-label="Scenes">
        <div className="rail-head">
          <h3 className="side-title">Scenes</h3>
          <button className="btn tiny" onClick={addScene} title="Add a scene after this one">
            + Scene
          </button>
        </div>
        <ol className="scene-list">
          {episode.scenes.map((s, i) => (
            <li key={s.id}>
              <button className={`scene-card${i === sceneIndex ? ' cur' : ''}`} onClick={() => seekScene(i)}>
                <SceneThumb scene={s} cast={episode.cast} />
                <span className="scene-num">{i + 1}</span>
                <span className="scene-name">{s.title}</span>
                <span className="muted tiny-text">
                  {setName(s)} · {Math.round(compiled.scenes[i]?.duration ?? 0)}s
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="row tight rail-tools">
          <button className="icon-btn tiny" onClick={() => moveScene(-1)} disabled={sceneIndex === 0} aria-label="Move scene up">
            ↑
          </button>
          <button className="icon-btn tiny" onClick={() => moveScene(1)} disabled={sceneIndex >= episode.scenes.length - 1} aria-label="Move scene down">
            ↓
          </button>
          <button className="btn tiny" onClick={duplicateScene}>
            Duplicate
          </button>
          <button className="btn tiny danger" onClick={deleteScene} disabled={episode.scenes.length <= 1}>
            Delete
          </button>
        </div>
      </nav>

      <section className="stage-col">
        <StagePlayer
          ref={player}
          compiled={compiled}
          lines={bank.lines}
          subtitles={settings.subtitles}
          editing={tab === 'set' ? 'set' : 'actors'}
          selectedActor={selectedActor}
          onSelectActor={setSelectedActor}
          onLocate={setLoc}
          onDragActor={onDragActor}
          onDragPiece={onDragPiece}
          tools={
            <>
              {voiceChip}
              <button className="chip" aria-pressed={settings.subtitles} onClick={() => updateSettings({ subtitles: !settings.subtitles })} title="Subtitles">
                CC
              </button>
            </>
          }
        />
        {selected && scene ? (
          <div className="actor-bar panel">
            <b>{selected.name}</b>
            <span className="muted small">face from {loc.beat >= 0 ? `beat ${loc.beat + 1}` : 'the start'}:</span>
            <div className="chips">
              {MOOD_LIST.map((m) => (
                <button key={m.id} className="chip-btn" onClick={() => onScene(setMoodAt(scene, loc.beat, selected.id, m.id as MoodId))} title={m.desc}>
                  {m.label}
                </button>
              ))}
            </div>
            <button className="btn tiny" onClick={() => onScene(toggleFlip(scene, selected.id))}>
              Flip
            </button>
            <button className="icon-btn tiny" onClick={() => setSelectedActor(null)} aria-label="Done">
              ✕
            </button>
          </div>
        ) : (
          <p className="hint muted small">
            {tab === 'set' && scene?.set.kind === 'kit' ? 'Paused: drag set pieces to move them.' : 'Paused: drag characters to move them, click one to change their face.'} Space plays, arrows step.
          </p>
        )}
      </section>

      <aside className="inspector panel">
        <div className="tabs" role="tablist">
          {(
            [
              ['beats', 'Beats'],
              ['cast', 'Cast'],
              ['set', 'Set'],
              ['chat', 'Chat ✨'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'beats' && (
            <BeatsPanel
              episode={episode}
              sceneIndex={sceneIndex}
              currentBeat={loc.beat}
              voiced={voiced}
              voiceStatus={bank.status}
              onScene={onScene}
              onSeekBeat={seekBeat}
              onPlayLine={playLine}
            />
          )}
          {tab === 'cast' && <CastPanel episode={episode} settings={settings} onEpisode={(ep, merge) => set(ep, { merge })} />}
          {tab === 'set' && scene && <SetPanel scene={scene} cast={episode.cast} onScene={onScene} />}
          {tab === 'chat' && <ChatPanel episode={episode} sceneIndex={sceneIndex} settings={settings} onApply={(ep) => set(ep)} onRevert={(ep) => set(ep)} onOpenSettings={onOpenSettings} />}
        </div>
      </aside>
    </main>
  );
}
