import { useEffect, useState } from 'react';
import type { CastMember, Episode } from '../episode/types';
import { CharacterSvg } from '../character/Character';
import { getGeo } from '../character/geometry';
import { normalizeCastMember, isKidBody, DEFAULT_ADULT_VOICE, DEFAULT_KID_VOICE } from '../episode/normalize';
import { randomCharacter } from '../lib/random';
import { encodeCharacter } from '../lib/share';
import { listModels } from '../ai/openrouter';
import { redesignCharacter } from '../ai/director';
import { voiceLine, audioContext, toAudioBuffer } from '../audio/voices';
import { CREATOR_URL, loadCrew, parseShareLink } from '../store/episodes';
import type { Settings } from '../store/settings';
import { toast } from './toast';

interface Props {
  episode: Episode;
  settings: Settings;
  onEpisode: (ep: Episode, merge?: string) => void;
}

function headBox(m: CastMember): string {
  const g = getGeo(m.look.body, m.look.headShape);
  const size = Math.max(g.headRx, g.headRy) * 3;
  return `${g.headCx - size / 2} ${g.headCy - size * 0.48} ${size} ${size}`;
}

function useVoices(model: string): string[] {
  const [voices, setVoices] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    listModels('speech')
      .then((list) => live && setVoices(list.find((m) => m.id === model)?.voices ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [model]);
  return voices;
}

function CastCard({ m, episode, settings, voices, onChange, onRemove, inUse }: { m: CastMember; episode: Episode; settings: Settings; voices: string[]; onChange: (m: CastMember, merge?: string) => void; onRemove: () => void; inUse: boolean }) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState<'' | 'design' | 'voice'>('');
  const [link, setLink] = useState('');
  const crew = loadCrew();

  const testVoice = async () => {
    if (!settings.apiKey) return toast('Add your OpenRouter key in Settings to hear voices.', 'error');
    setBusy('voice');
    try {
      const sample = episode.scenes.flatMap((s) => s.beats).find((b) => b.who === m.id && b.text)?.text ?? `Hi, I'm ${m.name}.`;
      const line = await voiceLine(settings.apiKey, settings.ttsModel, m, { id: 'test', text: sample });
      const ctx = audioContext();
      const src = ctx.createBufferSource();
      src.buffer = toAudioBuffer(ctx, line);
      src.connect(ctx.destination);
      src.start();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };

  const redesign = async () => {
    if (!ask.trim()) return;
    if (!settings.apiKey) return toast('Add your OpenRouter key in Settings to redesign with AI.', 'error');
    setBusy('design');
    try {
      onChange(await redesignCharacter(m, ask, settings));
      setAsk('');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };

  const voiceOptions = voices.includes(m.voice.voice) || !m.voice.voice ? voices : [m.voice.voice, ...voices];

  return (
    <div className={`cast-card${open ? ' open' : ''}`}>
      <button className="cast-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <CharacterSvg c={m.look} viewBox={headBox(m)} className="cast-face" />
        <span className="cast-name">
          <b>{m.name}</b>
          <span className="muted small">{m.bio || (isKidBody(m.look.body) ? 'kid' : 'grown-up')}</span>
        </span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="cast-body">
          <div className="cast-preview">
            <CharacterSvg c={m.look} className="cast-full" />
          </div>
          <label className="field">
            <span className="lbl">Name in the script</span>
            <input value={m.name} onChange={(e) => onChange({ ...m, name: e.target.value, look: { ...m.look, name: e.target.value } }, `name-${m.id}`)} />
          </label>
          <label className="field">
            <span className="lbl">Who they are</span>
            <input value={m.bio} onChange={(e) => onChange({ ...m, bio: e.target.value }, `bio-${m.id}`)} />
          </label>

          <h4>Voice</h4>
          <div className="voice-grid">
            <label>
              Voice
              {voiceOptions.length ? (
                <select value={m.voice.voice} onChange={(e) => onChange({ ...m, voice: { ...m.voice, voice: e.target.value } })}>
                  {voiceOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={m.voice.voice} onChange={(e) => onChange({ ...m, voice: { ...m.voice, voice: e.target.value } }, `voice-${m.id}`)} />
              )}
            </label>
            <label>
              Pitch {m.voice.pitch > 0 ? '+' : ''}
              {m.voice.pitch} st
              <input type="range" min={-8} max={10} step={0.5} value={m.voice.pitch} onChange={(e) => onChange({ ...m, voice: { ...m.voice, pitch: Number(e.target.value) } }, `pitch-${m.id}`)} />
            </label>
            <label>
              Speed ×{m.voice.tempo.toFixed(2)}
              <input type="range" min={0.6} max={1.5} step={0.05} value={m.voice.tempo} onChange={(e) => onChange({ ...m, voice: { ...m.voice, tempo: Number(e.target.value) } }, `tempo-${m.id}`)} />
            </label>
          </div>
          <label className="field">
            <span className="lbl">Acting note</span>
            <input value={m.voice.style} placeholder="a whiny, nasal nine-year-old" onChange={(e) => onChange({ ...m, voice: { ...m.voice, style: e.target.value } }, `style-${m.id}`)} />
          </label>
          <button className="btn small" onClick={testVoice} disabled={busy === 'voice'}>
            {busy === 'voice' ? 'Voicing…' : '▶ Test voice'}
          </button>

          <h4>Look</h4>
          <div className="row">
            <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void redesign()} placeholder="Describe a change: older, cowboy hat, purple coat…" aria-label="Redesign request" />
            <button className="btn small blue" onClick={redesign} disabled={busy === 'design' || !ask.trim()}>
              {busy === 'design' ? 'Drawing…' : '✨ Redesign'}
            </button>
          </div>
          <div className="row wrap">
            <button className="btn small" onClick={() => onChange({ ...m, look: { ...randomCharacter(Math.random, false, m.look), name: m.name } })}>
              🎲 Random look
            </button>
            <a className="btn small" href={`${CREATOR_URL}#c=${encodeCharacter(m.look)}`} target="_blank" rel="noreferrer">
              Edit in the Character Creator ↗
            </a>
            {crew.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const c = crew[Number(e.target.value)];
                  if (c) onChange({ ...m, look: { ...c, name: m.name } });
                }}
                aria-label="Use a crew character's look"
              >
                <option value="">Use a crew look…</option>
                {crew.map((c, i) => (
                  <option key={i} value={i}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="row">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a share link from the creator" aria-label="Share link" />
            <button
              className="btn small"
              disabled={!link.trim()}
              onClick={() => {
                const c = parseShareLink(link);
                if (!c) return toast("That isn't a character share link.", 'error');
                onChange({ ...m, look: { ...c, name: m.name } });
                setLink('');
              }}
            >
              Apply
            </button>
          </div>
          <button className="btn small ghost danger" onClick={onRemove} disabled={inUse} title={inUse ? 'They still have lines or blocking in a scene' : undefined}>
            Remove from cast
          </button>
        </div>
      )}
    </div>
  );
}

export function CastPanel({ episode, settings, onEpisode }: Props) {
  const voices = useVoices(settings.ttsModel);
  const [newName, setNewName] = useState('');
  const used = (id: string) => episode.scenes.some((s) => s.blocking.some((b) => b.who === id) || s.beats.some((b) => b.who === id || b.moves?.some((mv) => mv.who === id)));
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    const m = normalizeCastMember({ name }, new Set(episode.cast.map((c) => c.id)));
    if (!m) return;
    m.voice = isKidBody(m.look.body) ? { ...DEFAULT_KID_VOICE } : { ...DEFAULT_ADULT_VOICE };
    onEpisode({ ...episode, cast: [...episode.cast, m] });
    setNewName('');
  };
  return (
    <div className="cast-panel">
      {episode.cast.map((m) => (
        <CastCard
          key={m.id}
          m={m}
          episode={episode}
          settings={settings}
          voices={voices}
          inUse={used(m.id)}
          onChange={(next, merge) => onEpisode({ ...episode, cast: episode.cast.map((c) => (c.id === m.id ? next : c)) }, merge)}
          onRemove={() => onEpisode({ ...episode, cast: episode.cast.filter((c) => c.id !== m.id) })}
        />
      ))}
      <div className="row add-row">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New character's name" aria-label="New character's name" />
        <button className="btn small" onClick={add} disabled={!newName.trim()}>
          + Add
        </button>
      </div>
    </div>
  );
}
