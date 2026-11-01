import { useRef, useState } from 'react';
import type { CharacterState } from '../types';
import type { Episode } from '../episode/types';
import { CharacterSvg } from '../character/Character';
import { parseScript, SAMPLE_SCRIPT } from '../episode/parseScript';
import { applyCrew, directScript, type DirectorProgress } from '../ai/director';
import { creatorCrew, loadCrew, parseCrewFile, parseShareLink, saveCrew } from '../store/episodes';
import type { Settings } from '../store/settings';
import { toast } from './toast';

const DRAFT_KEY = 'ptstudio.draft.v1';

interface Props {
  settings: Settings;
  onEpisode: (ep: Episode) => void;
  onOpenSettings: () => void;
}

export function ScriptView({ settings, onEpisode, onOpenSettings }: Props) {
  const [script, setScript] = useState(() => localStorage.getItem(DRAFT_KEY) ?? '');
  const [crew, setCrew] = useState<CharacterState[]>(loadCrew);
  const [busy, setBusy] = useState<DirectorProgress | null>(null);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasKey = !!settings.apiKey;

  const updateScript = (s: string) => {
    setScript(s);
    try {
      localStorage.setItem(DRAFT_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const updateCrew = (next: CharacterState[]) => {
    setCrew(next);
    saveCrew(next);
  };
  const addCrew = (list: CharacterState[]) => {
    const names = new Set(crew.map((c) => c.name.toLowerCase()));
    const fresh = list.filter((c) => !names.has(c.name.toLowerCase()));
    updateCrew([...crew, ...fresh]);
    toast(fresh.length ? `Added ${fresh.length} character${fresh.length > 1 ? 's' : ''} to your crew.` : 'Those characters are already in your crew.');
  };

  const quickBuild = () => {
    if (!script.trim()) return;
    onEpisode(applyCrew(parseScript(script), crew.map((c) => ({ name: c.name, look: c }))));
  };

  const direct = async () => {
    if (!script.trim()) return;
    setError('');
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy({ castChars: 0, sceneChars: 0 });
    try {
      const ep = await directScript(script, settings, crew.map((c) => ({ name: c.name, look: c })), (p) => setBusy(p), ctrl.signal);
      onEpisode(ep);
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const words = script.trim() ? script.trim().split(/\s+/).length : 0;

  return (
    <main className="script-view">
      <section className="panel script-panel">
        <div className="script-head">
          <h1>
            Paste a script. <span>Get a cartoon.</span>
          </h1>
          <p>
            Any format works: <code>NAME: line</code>, screenplay style, or loose prose with stage directions. Scene headings like <code>INT. CLASSROOM - DAY</code>{' '}
            pick or build the set. Put acting notes in brackets: <code>BENNY: (whispering) Psst.</code>
          </p>
        </div>
        <textarea
          className="script-input"
          value={script}
          onChange={(e) => updateScript(e.target.value)}
          placeholder={'EXT. BUS STOP - MORNING\nThree kids wait for the bus.\n\nDEX: I can\'t feel my toes.\nBENNY: (excited) Dude, that means they fell off!'}
          spellCheck
          aria-label="Script"
        />
        <div className="script-actions">
          <span className="muted small">{words ? `${words} words` : 'Empty'}</span>
          <button className="btn small" onClick={() => updateScript(SAMPLE_SCRIPT)}>
            Load the sample script
          </button>
          <span className="spacer" />
          <button className="btn" onClick={quickBuild} disabled={!script.trim() || !!busy} title="Turn the script into scenes without the AI director">
            Quick build (no AI)
          </button>
          {hasKey ? (
            <button className="btn red big" onClick={direct} disabled={!script.trim() || !!busy}>
              🎬 Make the episode
            </button>
          ) : (
            <button className="btn red big" onClick={onOpenSettings}>
              🔑 Add OpenRouter key
            </button>
          )}
        </div>
        {error && (
          <div className="error-box">
            <b>The director hit a snag:</b> {error}
            <div className="row">
              <button className="btn small" onClick={direct}>
                Try again
              </button>
              <button className="btn small" onClick={quickBuild}>
                Quick build instead
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="script-side">
        <section className="panel">
          <h3 className="side-title">Your crew</h3>
          <p className="muted small">
            Characters you made in the Character Creator. When the script uses one of their names, they play the part. Everyone else gets designed for you.
          </p>
          {crew.length > 0 ? (
            <div className="crew-grid">
              {crew.map((c, i) => (
                <div key={i} className="crew-chip" title={c.name}>
                  <CharacterSvg c={c} className="crew-svg" />
                  <span>{c.name}</span>
                  <button className="icon-btn tiny" aria-label={`Remove ${c.name}`} onClick={() => updateCrew(crew.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-note">No crew yet.</p>
          )}
          <div className="row wrap">
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              Import crew file
            </button>
            {creatorCrew().length > 0 && (
              <button className="btn small" onClick={() => addCrew(creatorCrew())}>
                Use my creator crew
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                addCrew(parseCrewFile(await f.text()));
              } catch {
                toast("That file isn't a crew export from the Character Creator.", 'error');
              }
            }}
          />
          <div className="field">
            <span className="lbl">Or paste a share link</span>
            <div className="row">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…#c=…" aria-label="Character share link" />
              <button
                className="btn small"
                disabled={!link.trim()}
                onClick={() => {
                  const c = parseShareLink(link);
                  if (!c) return toast("That doesn't look like a character share link.", 'error');
                  addCrew([c]);
                  setLink('');
                }}
              >
                Add
              </button>
            </div>
          </div>
        </section>
        <section className="panel how">
          <h3 className="side-title">How it works</h3>
          <ol>
            <li>The AI director reads your script, designs the cast from the creator's paper parts and casts their voices.</li>
            <li>It storyboards every scene: sets, blocking, faces, gestures, camera cuts and comic pauses.</li>
            <li>Every line is voiced. Kids get the classic sped-up, pitched-up treatment.</li>
            <li>Watch it, drag people around, edit any beat, or tell the chat what to change. Then export an MP4.</li>
          </ol>
        </section>
      </aside>

      {busy && (
        <div className="modal-back">
          <div className="panel directing">
            <div className="clapper" aria-hidden>
              🎬
            </div>
            <h2>The director is on it…</h2>
            <ul>
              <li className={busy.castChars ? 'live' : ''}>
                Designing the cast and casting voices {busy.castChars ? <span className="muted">({Math.round(busy.castChars / 4)} tokens)</span> : '…'}
              </li>
              <li className={busy.sceneChars ? 'live' : ''}>
                Storyboarding scenes {busy.sceneChars ? <span className="muted">({Math.round(busy.sceneChars / 4)} tokens)</span> : '…'}
              </li>
            </ul>
            <p className="muted small">Long scripts take a minute or two.</p>
            <button className="btn small" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
