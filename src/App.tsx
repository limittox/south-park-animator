import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Episode } from './episode/types';
import { compileEpisode } from './episode/timeline';
import { listEpisodes, useEpisodeEditor, type EpisodeEditor } from './store/episodes';
import { useSettings } from './store/settings';
import { useVoiceBank } from './audio/useVoiceBank';
import { ScriptView } from './ui/ScriptView';
import { Studio } from './ui/Studio';
import { SettingsModal } from './ui/SettingsModal';
import { ExportModal } from './ui/ExportModal';
import { EpisodesModal } from './ui/EpisodesModal';
import { Toasts } from './ui/toast';

const LAST_KEY = 'ptstudio.last.v1';

export default function App() {
  const settings = useSettings();
  const editor = useEpisodeEditor();
  const { episode } = editor;
  const bank = useVoiceBank(episode, settings);
  const [view, setView] = useState<'script' | 'studio'>('script');
  const [modal, setModal] = useState<'settings' | 'export' | 'episodes' | null>(null);
  const [booted, setBooted] = useState(false);

  // Reopen the last episode.
  useEffect(() => {
    const last = localStorage.getItem(LAST_KEY);
    void listEpisodes().then((list) => {
      const ep = list.find((e) => e.id === last);
      if (ep) {
        editor.load(ep);
        setView('studio');
      }
      setBooted(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(
    (ep: Episode) => {
      editor.load(ep);
      localStorage.setItem(LAST_KEY, ep.id);
      setView('studio');
      setModal(null);
    },
    [editor],
  );

  // Ctrl+Z / Ctrl+Y everywhere except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        editor.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  const compiled = useMemo(() => (episode && modal === 'export' ? compileEpisode(episode, bank.clips) : null), [episode, modal, bank.clips]);
  const inStudio = view === 'studio' && episode;

  return (
    <div className="app">
      <header className="topbar">
        <button className="logo" onClick={() => setView(episode ? 'studio' : 'script')} aria-label="Paper Town Studios">
          <span className="logo-mark" aria-hidden>
            🎬
          </span>
          <span className="logo-text">
            Paper Town <b>Studios</b>
          </span>
        </button>
        {inStudio && (
          <input
            className="ep-title"
            value={episode.title}
            onChange={(e) => editor.set((ep) => ({ ...ep, title: e.target.value }), { merge: 'title' })}
            aria-label="Episode title"
          />
        )}
        <span className="spacer" />
        {inStudio && (
          <>
            <button className="icon-btn" onClick={editor.undo} disabled={!editor.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button className="icon-btn" onClick={editor.redo} disabled={!editor.canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
              ↷
            </button>
            <button className="btn small" onClick={() => setView('script')}>
              📜 Script
            </button>
          </>
        )}
        <button className="btn small" onClick={() => setModal('episodes')}>
          📂 Episodes
        </button>
        {inStudio && (
          <button className="btn small red" onClick={() => setModal('export')}>
            ⬇ Export MP4
          </button>
        )}
        <button className="icon-btn" onClick={() => setModal('settings')} title="Settings" aria-label="Settings">
          ⚙
        </button>
      </header>

      {!booted ? null : inStudio ? (
        <Studio editor={editor as EpisodeEditor & { episode: Episode }} settings={settings} bank={bank} onOpenSettings={() => setModal('settings')} />
      ) : (
        <ScriptView settings={settings} onEpisode={open} onOpenSettings={() => setModal('settings')} />
      )}

      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'episodes' && (
        <EpisodesModal
          currentId={episode?.id ?? null}
          onOpen={open}
          onNew={() => {
            setView('script');
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'export' && compiled && (
        <ExportModal
          compiled={compiled}
          clips={bank.clips}
          lines={bank.lines}
          missingVoices={settings.apiKey ? bank.missing : 0}
          voicing={bank.status.running}
          onVoice={() => void bank.generate()}
          onClose={() => setModal(null)}
        />
      )}
      <Toasts />
    </div>
  );
}
