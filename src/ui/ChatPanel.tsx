import { useEffect, useRef, useState } from 'react';
import type { Episode } from '../episode/types';
import { editWithChat, type ChatTurn } from '../ai/director';
import type { Settings } from '../store/settings';

interface Msg extends ChatTurn {
  id: number;
  scope: string;
  /** The episode before this change, for undo. */
  before?: Episode;
  error?: boolean;
}

interface Props {
  episode: Episode;
  sceneIndex: number;
  settings: Settings;
  onApply: (ep: Episode) => void;
  onRevert: (ep: Episode) => void;
  onOpenSettings: () => void;
}

const SUGGESTIONS = [
  'Cut to a close-up on the punchline',
  'Make the second line angrier, with fists',
  'Move everyone closer together',
  'Make it night time',
  'Add a long awkward pause before the last line',
  'Have someone walk in from the left and gasp',
];

// Conversations survive switching tabs.
const threads = new Map<string, Msg[]>();
let nextId = 1;

export function ChatPanel({ episode, sceneIndex, settings, onApply, onRevert, onOpenSettings }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>(() => threads.get(episode.id) ?? []);
  const [text, setText] = useState('');
  const [wholeEpisode, setWholeEpisode] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threads.set(episode.id, msgs);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, episode.id]);
  useEffect(() => setMsgs(threads.get(episode.id) ?? []), [episode.id]);

  const scene = episode.scenes[sceneIndex];
  const scopeLabel = wholeEpisode ? 'Whole episode' : `Scene ${sceneIndex + 1}: ${scene?.title ?? ''}`;

  const send = async (request: string) => {
    if (!request.trim() || busy !== null) return;
    const before = episode;
    const userMsg: Msg = { id: nextId++, role: 'user', text: request.trim(), scope: scopeLabel };
    setMsgs((m) => [...m, userMsg]);
    setText('');
    setBusy(0);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const history: ChatTurn[] = msgs.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
      const res = await editWithChat({
        episode,
        sceneIndex: wholeEpisode ? null : sceneIndex,
        request: request.trim(),
        history,
        settings,
        signal: ctrl.signal,
        onText: (t) => setBusy(t.length),
      });
      onApply(res.episode);
      setMsgs((m) => [...m, { id: nextId++, role: 'assistant', text: res.reply, scope: scopeLabel, before }]);
    } catch (e) {
      if (!ctrl.signal.aborted) setMsgs((m) => [...m, { id: nextId++, role: 'assistant', text: (e as Error).message, scope: scopeLabel, error: true }]);
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  if (!settings.apiKey) {
    return (
      <div className="chat-panel">
        <div className="empty-note">
          <p>Tell the director what to change in plain English: "make him angrier", "add a close-up", "move the scene to a hospital".</p>
          <button className="btn red" onClick={onOpenSettings}>
            🔑 Add your OpenRouter key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="seg-toggle small" role="tablist" aria-label="What to change">
        <button role="tab" aria-selected={!wholeEpisode} onClick={() => setWholeEpisode(false)}>
          This scene
        </button>
        <button role="tab" aria-selected={wholeEpisode} onClick={() => setWholeEpisode(true)}>
          Whole episode
        </button>
      </div>
      <div className="chat-list" ref={listRef}>
        {msgs.length === 0 && (
          <div className="chat-hello">
            <p>
              Watching <b>{scopeLabel}</b>. What should change?
            </p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip-btn" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.role}${m.error ? ' error' : ''}`}>
            {m.role === 'user' && <span className="msg-scope">{m.scope}</span>}
            <p>{m.text}</p>
            {m.before && (
              <button className="btn tiny" onClick={() => m.before && onRevert(m.before)} title="Put the episode back the way it was before this change">
                ↶ Undo this change
              </button>
            )}
          </div>
        ))}
        {busy !== null && (
          <div className="msg assistant thinking">
            <p>
              Reworking {wholeEpisode ? 'the episode' : 'the scene'}… {busy > 0 && <span className="muted">({Math.round(busy / 4)} tokens)</span>}
            </p>
            <button className="btn tiny" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          </div>
        )}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder={wholeEpisode ? 'e.g. Give the whole thing a darker ending' : 'e.g. Benny should faint when the teacher yells'}
          rows={2}
          aria-label="Feedback for the director"
        />
        <button className="btn red" type="submit" disabled={!text.trim() || busy !== null}>
          Send
        </button>
      </form>
    </div>
  );
}
