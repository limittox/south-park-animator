import { useEffect, useMemo, useState } from 'react';
import { checkKey, listModels, type KeyInfo, type ModelInfo } from '../ai/openrouter';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../store/settings';
import { dbClear } from '../store/db';
import { Modal } from './Modal';
import { toast } from './toast';

function useModels(kind: 'text' | 'speech') {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    listModels(kind).then(setModels, (e) => setError((e as Error).message));
  }, [kind]);
  return { models, error };
}

function ModelPicker({ label, value, models, onChange, unit }: { label: string; value: string; models: ModelInfo[]; onChange: (id: string) => void; unit: string }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? models.filter((m) => m.id.toLowerCase().includes(s) || m.name.toLowerCase().includes(s)) : models;
    return list.slice(0, 200);
  }, [models, q]);
  const cur = models.find((m) => m.id === value);
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" aria-label={`Filter ${label}`} className="filter" />
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          {!cur && <option value={value}>{value}</option>}
          {shown.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {cur && (
        <span className="muted small">
          {cur.id} · ${cur.inPrice.toFixed(2)} in{cur.outPrice ? ` / $${cur.outPrice.toFixed(2)} out` : ''} per million {unit}
          {cur.voices.length ? ` · ${cur.voices.length} voices` : ''}
        </span>
      )}
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const [show, setShow] = useState(false);
  const [key, setKey] = useState<KeyInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const text = useModels('text');
  const speech = useModels('speech');

  const test = async () => {
    setChecking(true);
    setKey(null);
    try {
      setKey(await checkKey(s.apiKey));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="field">
        <span className="lbl">OpenRouter API key</span>
        <div className="row">
          <input
            type={show ? 'text' : 'password'}
            value={s.apiKey}
            onChange={(e) => {
              updateSettings({ apiKey: e.target.value.trim() });
              setKey(null);
            }}
            placeholder="sk-or-…"
            autoComplete="off"
            spellCheck={false}
            aria-label="OpenRouter API key"
          />
          <button className="btn small" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
          <button className="btn small blue" onClick={test} disabled={!s.apiKey || checking}>
            {checking ? 'Checking…' : 'Test'}
          </button>
        </div>
        <span className="muted small">
          Stored only in this browser and sent only to OpenRouter. Get one at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
            openrouter.ai/keys
          </a>
          .
        </span>
        {key && (
          <span className="ok-note">
            ✓ Key works. Used ${key.usage.toFixed(2)}
            {key.limit !== null ? ` of $${Number(key.limit).toFixed(2)}` : ''}.
          </span>
        )}
      </div>

      <ModelPicker label="Director model (writes the storyboard)" value={s.llmModel} models={text.models} onChange={(id) => updateSettings({ llmModel: id })} unit="tokens" />
      <ModelPicker label="Voice model (text to speech)" value={s.ttsModel} models={speech.models} onChange={(id) => updateSettings({ ttsModel: id })} unit="characters/tokens" />
      {(text.error || speech.error) && <p className="muted small">Couldn't load the model list ({text.error || speech.error}). You can still type a model id.</p>}

      <div className="field-grid">
        <label className="check span2">
          <input type="checkbox" checked={s.autoVoice} onChange={(e) => updateSettings({ autoVoice: e.target.checked })} /> Voice new and changed lines automatically
        </label>
        <label className="check span2">
          <input type="checkbox" checked={s.subtitles} onChange={(e) => updateSettings({ subtitles: e.target.checked })} /> Show subtitles
        </label>
        <label>
          Video size
          <select value={s.exportHeight} onChange={(e) => updateSettings({ exportHeight: Number(e.target.value) as 720 | 1080 })}>
            <option value={720}>720p</option>
            <option value={1080}>1080p</option>
          </select>
        </label>
      </div>

      <div className="row wrap">
        <button
          className="btn small"
          onClick={async () => {
            await dbClear('tts');
            toast('Voice cache cleared. Lines will be re-voiced next time.');
          }}
        >
          Clear saved voices
        </button>
        <button className="btn small" onClick={() => updateSettings({ llmModel: DEFAULT_SETTINGS.llmModel, ttsModel: DEFAULT_SETTINGS.ttsModel })}>
          Reset models
        </button>
      </div>
    </Modal>
  );
}
