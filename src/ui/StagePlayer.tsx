import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import type { KitSet } from '../episode/types';
import { audioCues, locate, sampleEpisode, type ActorFrame, type ClipMap, type CompiledEpisode } from '../episode/timeline';
import { PlaybackEngine } from '../audio/engine';
import type { VoicedLine } from '../audio/voices';
import { FrameSvg } from '../render/FrameSvg';
import { pieceBounds } from '../sets/kit';

export interface PlayerHandle {
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  time: () => number;
}

interface Props {
  compiled: CompiledEpisode;
  clips: ClipMap;
  lines: ReadonlyMap<string, VoicedLine>;
  subtitles: boolean;
  editing: 'actors' | 'set';
  selectedActor: string | null;
  onSelectActor: (id: string | null) => void;
  onLocate: (loc: { scene: number; beat: number }) => void;
  onDragActor: (scene: number, castId: string, sceneT: number, x: number, depth: number) => void;
  onDragPiece: (scene: number, pieceId: string, x: number, y: number) => void;
  /** Extra controls on the right of the transport bar. */
  tools?: ReactNode;
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export const StagePlayer = forwardRef<PlayerHandle, Props>(function StagePlayer(
  { compiled, clips, lines, subtitles, editing, selectedActor, onSelectActor, onLocate, onDragActor, onDragPiece, tools },
  ref,
) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const engine = useRef(new PlaybackEngine());
  const svgRef = useRef<SVGSVGElement>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const duration = compiled.duration;

  const fallbackText = useCallback(
    (beatId: string) => {
      for (const sc of compiled.scenes) for (const b of sc.beats) if (b.beat.id === beatId) return b.beat.text ?? null;
      return null;
    },
    [compiled],
  );

  const startAt = useCallback(
    (from: number) => {
      const t0 = from >= duration - 0.05 ? 0 : from;
      engine.current.start(t0, audioCues(compiled), lines, fallbackText);
      setT(t0);
      setPlaying(true);
    },
    [compiled, lines, fallbackText, duration],
  );
  const pause = useCallback(() => {
    engine.current.stop();
    setPlaying(false);
  }, []);
  const seek = useCallback(
    (to: number) => {
      const x = Math.max(0, Math.min(duration, to));
      if (playing) startAt(x);
      else setT(x);
    },
    [playing, startAt, duration],
  );

  useImperativeHandle(ref, () => ({ seek, play: () => startAt(tRef.current), pause, toggle: () => (playing ? pause() : startAt(tRef.current)), time: () => tRef.current }), [
    seek,
    startAt,
    pause,
    playing,
  ]);

  // The audio clock drives the picture.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const now = engine.current.now();
      if (now >= duration) {
        engine.current.stop();
        setPlaying(false);
        setT(duration);
        return;
      }
      setT(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  // Edits while playing: reschedule the sound from where we are.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (engine.current.playing) engine.current.start(engine.current.now(), audioCues(compiled), lines, fallbackText);
  }, [compiled, lines, fallbackText]);

  useEffect(() => () => engine.current.stop(), []);
  useEffect(() => {
    if (t > duration) setT(duration);
  }, [t, duration]);

  const loc = useMemo(() => locate(compiled, t), [compiled, t]);
  const lastLoc = useRef('');
  useEffect(() => {
    const key = `${loc.scene}:${loc.beat}`;
    if (key !== lastLoc.current) {
      lastLoc.current = key;
      onLocate(loc);
    }
  }, [loc, onLocate]);

  // Space to play/pause, arrows to step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (playing) pause();
        else startAt(tRef.current);
      } else if (e.key === 'ArrowRight' && !e.ctrlKey) seek(tRef.current + (e.shiftKey ? 5 : 1));
      else if (e.key === 'ArrowLeft' && !e.ctrlKey) seek(tRef.current - (e.shiftKey ? 5 : 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, pause, startAt, seek]);

  const frame = useMemo(() => sampleEpisode(compiled, t, clips), [compiled, t, clips]);
  const sceneFrame = frame?.kind === 'scene' ? frame : null;
  const setEdit = editing === 'set' && !playing && sceneFrame?.scene.scene.set.kind === 'kit';

  /* ---- dragging ---- */
  const drag = useRef<{ kind: 'actor' | 'piece'; id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const toScene = (e: React.PointerEvent) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const startDrag = (kind: 'actor' | 'piece', id: string, ox: number, oy: number) => (e: React.PointerEvent) => {
    if (playing || !sceneFrame) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toScene(e);
    drag.current = { kind, id, dx: ox - p.x, dy: oy - p.y, moved: false };
    if (kind === 'actor') onSelectActor(id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !sceneFrame) return;
    const p = toScene(e);
    d.moved = true;
    const x = p.x + d.dx;
    const y = p.y + d.dy;
    if (d.kind === 'actor') onDragActor(sceneFrame.scene.index, d.id, sceneFrame.t, x, (sceneFrame.scene.groundY - y) / 90);
    else onDragPiece(sceneFrame.scene.index, d.id, x, y);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const renderActor = (a: ActorFrame, node: ReactNode) => (
    <g
      className={`actor-hit${playing ? '' : ' editable'}${selectedActor === a.castId ? ' selected' : ''}`}
      onPointerDown={editing === 'actors' ? startDrag('actor', a.castId, a.x, a.y) : undefined}
    >
      {selectedActor === a.castId && !playing && <ellipse cx={a.x} cy={a.y + 4} rx={110 * a.scale} ry={18 * a.scale} className="actor-ring" />}
      {node}
    </g>
  );

  const pieceOverlay =
    setEdit && sceneFrame ? (
      <g>
        {(sceneFrame.scene.scene.set as KitSet).pieces.map((p) => {
          const b = pieceBounds(sceneFrame.scene.scene.set as KitSet, p);
          return (
            <rect
              key={p.id}
              className="piece-handle"
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              onPointerDown={startDrag('piece', p.id, p.x, b.y + b.h)}
            >
              <title>{p.type}</title>
            </rect>
          );
        })}
      </g>
    ) : null;

  /* ---- scrubber ---- */
  const barRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const scrubTo = (e: React.PointerEvent) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return;
    seek(((e.clientX - r.left) / r.width) * duration);
  };

  return (
    <div className="player">
      <div className={`stage-frame${setEdit ? ' set-edit' : ''}`}>
        <FrameSvg
          frame={frame}
          subtitles={subtitles}
          renderActor={renderActor}
          sceneOverlay={pieceOverlay}
          freeCamera={setEdit}
          className="stage-svg"
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={() => !playing && onSelectActor(null)}
          svgRef={svgRef}
        />
        {!playing && t === 0 && (
          <button className="big-play" onClick={() => startAt(0)} aria-label="Play episode">
            ▶
          </button>
        )}
      </div>
      <div className="transport">
        <button className="btn play-btn" onClick={() => (playing ? pause() : startAt(t))} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="time">
          {fmt(t)} / {fmt(duration)}
        </span>
        <div
          className="scrub"
          ref={barRef}
          onPointerDown={(e) => {
            scrubbing.current = true;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            scrubTo(e);
          }}
          onPointerMove={(e) => scrubbing.current && scrubTo(e)}
          onPointerUp={() => (scrubbing.current = false)}
          role="slider"
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(t)}
          tabIndex={0}
        >
          {compiled.titleDuration > 0 && <div className="seg title-seg" style={{ left: 0, width: `${(compiled.titleDuration / duration) * 100}%` }} />}
          {compiled.scenes.map((sc) => (
            <div
              key={sc.scene.id}
              className={`seg${loc.scene === sc.index && t >= compiled.titleDuration ? ' cur' : ''}`}
              style={{ left: `${(sc.start / duration) * 100}%`, width: `${(sc.duration / duration) * 100}%` }}
              title={sc.scene.title}
            >
              {sc.beats
                .filter((b) => b.beat.text)
                .map((b) => (
                  <i key={b.beat.id} style={{ left: `${(b.start / sc.duration) * 100}%` }} />
                ))}
            </div>
          ))}
          <div className="head" style={{ left: `${(t / Math.max(0.001, duration)) * 100}%` }} />
        </div>
        {tools}
      </div>
    </div>
  );
});
