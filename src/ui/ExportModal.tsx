import { useEffect, useRef, useState } from 'react';
import type { ClipMap, CompiledEpisode } from '../episode/timeline';
import type { VoicedLine } from '../audio/voices';
import type { ExportProgress } from '../render/exportVideo';
import { downloadBlob, safeFileName } from '../lib/download';
import { updateSettings, useSettings } from '../store/settings';
import { Modal } from './Modal';

interface Props {
  compiled: CompiledEpisode;
  clips: ClipMap;
  lines: ReadonlyMap<string, VoicedLine>;
  missingVoices: number;
  voicing: boolean;
  onVoice: () => void;
  onClose: () => void;
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

export function ExportModal({ compiled, clips, lines, missingVoices, voicing, onVoice, onClose }: Props) {
  const s = useSettings();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const started = useRef(0);

  useEffect(() => () => {
    abort.current?.abort();
  }, []);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const run = async () => {
    setError('');
    setResult(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    started.current = performance.now();
    setProgress({ phase: 'audio', done: 0, total: 1 });
    try {
      // The encoder and the static renderer load only when someone exports.
      const { exportEpisode } = await import('../render/exportVideo');
      const blob = await exportEpisode({ compiled, clips, lines, height: s.exportHeight, subtitles: s.subtitles, onProgress: setProgress, signal: ctrl.signal });
      setResult({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const pct = progress ? (progress.phase === 'video' ? progress.done / progress.total : progress.phase === 'finishing' ? 1 : 0) : 0;
  const elapsed = (performance.now() - started.current) / 1000;
  const eta = pct > 0.03 ? elapsed / pct - elapsed : null;
  const filename = `${safeFileName(compiled.episode.title)}.mp4`;

  return (
    <Modal title="Export video" onClose={onClose}>
      {result ? (
        <div className="export-done">
          <video src={result.url} controls className="export-video" />
          <div className="row">
            <button className="btn red big" onClick={() => downloadBlob(result.blob, filename)}>
              ⬇ Download {filename}
            </button>
            <span className="muted small">{(result.blob.size / 1e6).toFixed(1)} MB</span>
          </div>
        </div>
      ) : progress ? (
        <div className="export-run">
          <p>
            {progress.phase === 'audio' ? 'Mixing the soundtrack…' : progress.phase === 'finishing' ? 'Wrapping up the file…' : `Drawing frame ${progress.done} of ${progress.total}…`}
          </p>
          <div className="bar">
            <div style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
          <p className="muted small">{eta !== null ? `About ${fmt(eta)} left.` : 'Warming up…'} Keep this tab in front: browsers slow down background tabs a lot.</p>
          <button className="btn small" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="export-setup">
          <p>
            <b>{compiled.episode.title}</b>: {compiled.scenes.length} scene{compiled.scenes.length === 1 ? '' : 's'}, {fmt(compiled.duration)} long.
          </p>
          {missingVoices > 0 && (
            <div className="warn-box">
              {missingVoices} line{missingVoices === 1 ? ' has' : 's have'} no voice yet and will be silent in the video.
              <button className="btn small" onClick={onVoice} disabled={voicing}>
                {voicing ? 'Voicing…' : 'Voice them now'}
              </button>
            </div>
          )}
          <div className="field-grid">
            <label>
              Size
              <select value={s.exportHeight} onChange={(e) => updateSettings({ exportHeight: Number(e.target.value) as 720 | 1080 })}>
                <option value={720}>1280 × 720</option>
                <option value={1080}>1920 × 1080</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={s.subtitles} onChange={(e) => updateSettings({ subtitles: e.target.checked })} /> Burn in subtitles
            </label>
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn red big" onClick={run}>
            🎬 Render MP4
          </button>
          <p className="muted small">Rendering happens on this computer and runs at about real time, as long as this tab stays in front.</p>
        </div>
      )}
    </Modal>
  );
}
