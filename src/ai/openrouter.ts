/*
 * OpenRouter from the browser: chat completions (streamed, JSON out) for the director,
 * and the speech endpoint for voices. OpenRouter allows cross-origin calls, so there's no server.
 */

const BASE = 'https://openrouter.ai/api/v1';

export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function headers(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'https://localhost',
    'X-Title': 'Paper Town Studios',
  };
}

async function failure(res: Response): Promise<AiError> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    msg = body?.error?.message ?? body?.message ?? msg;
  } catch {
    /* not JSON */
  }
  if (res.status === 401) msg = 'OpenRouter rejected the API key. Check it in Settings.';
  if (res.status === 402) msg = 'Your OpenRouter account is out of credits.';
  if (res.status === 429) msg = 'OpenRouter is rate-limiting requests. Wait a moment and try again.';
  return new AiError(msg, res.status);
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  /** Called as text streams in, with everything received so far. */
  onText?: (text: string) => void;
}

/** Stream a chat completion and return the full text. */
export async function chat({ apiKey, model, messages, maxTokens = 32000, signal, onText }: ChatOptions): Promise<string> {
  if (!apiKey) throw new AiError('Add your OpenRouter API key in Settings first.');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(apiKey),
    signal,
    body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
  });
  if (!res.ok || !res.body) throw await failure(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      // Lines starting with ':' are keep-alive comments.
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data);
        if (chunk.error) throw new AiError(chunk.error.message ?? 'The model returned an error.');
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          text += delta;
          onText?.(text);
        }
      } catch (e) {
        if (e instanceof AiError) throw e;
      }
    }
  }
  if (!text.trim()) throw new AiError('The model sent back an empty answer. Try again or pick another model in Settings.');
  return text;
}

/** Pull a JSON object out of a model's answer, tolerating code fences, chatter and trailing commas. */
export function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('The model did not return JSON.');
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new AiError('The model returned broken JSON. Try again.');
    }
  }
}

/** Ask for JSON; if the answer doesn't parse, ask once more with the parse error. */
export async function chatJson(opts: ChatOptions): Promise<unknown> {
  const text = await chat(opts);
  try {
    return extractJson(text);
  } catch (e) {
    const retry = await chat({
      ...opts,
      messages: [
        ...opts.messages,
        { role: 'assistant', content: text.slice(0, 60000) },
        { role: 'user', content: `That was not valid JSON (${(e as Error).message}). Reply again with only the complete JSON object.` },
      ],
    });
    return extractJson(retry);
  }
}

/* ---------------------------------------------------------------- speech */

/** OpenRouter offers both, but some providers only return one (Gemini: pcm, MiniMax: mp3). */
export type SpeechFormat = 'mp3' | 'pcm';

export interface SpeechOptions {
  apiKey: string;
  model: string;
  input: string;
  voice: string;
  instructions?: string;
  format?: SpeechFormat;
  signal?: AbortSignal;
}

export async function speech({ apiKey, model, input, voice, instructions, format = 'mp3', signal }: SpeechOptions): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  if (!apiKey) throw new AiError('Add your OpenRouter API key in Settings to generate voices.');
  const res = await fetch(`${BASE}/audio/speech`, {
    method: 'POST',
    headers: headers(apiKey),
    signal,
    body: JSON.stringify({ model, input, voice, response_format: format, ...(instructions ? { instructions } : {}) }),
  });
  if (!res.ok) throw await failure(res);
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get('content-type') ?? '' };
}

/* ---------------------------------------------------------------- models */

export interface ModelInfo {
  id: string;
  name: string;
  voices: string[];
  /** USD per million input tokens (or characters, for speech models). */
  inPrice: number;
  outPrice: number;
}

const modelCache = new Map<string, Promise<ModelInfo[]>>();

/** Public model list (no key needed). */
export function listModels(kind: 'text' | 'speech'): Promise<ModelInfo[]> {
  let p = modelCache.get(kind);
  if (!p) {
    p = fetch(`${BASE}/models${kind === 'speech' ? '?output_modalities=speech' : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new AiError('Could not load the model list.'))))
      .then((body: { data: { id: string; name?: string; supported_voices?: string[]; architecture?: { output_modalities?: string[] }; pricing?: { prompt?: string; completion?: string } }[] }) =>
        body.data
          .filter((m) => (kind === 'speech' ? true : (m.architecture?.output_modalities ?? ['text']).join() === 'text' && !m.id.endsWith(':batch')))
          .map((m) => ({
            id: m.id,
            name: m.name ?? m.id,
            voices: m.supported_voices ?? [],
            inPrice: Number(m.pricing?.prompt ?? 0) * 1e6,
            outPrice: Number(m.pricing?.completion ?? 0) * 1e6,
          })),
      );
    p.catch(() => modelCache.delete(kind));
    modelCache.set(kind, p);
  }
  return p;
}

export interface KeyInfo {
  label: string;
  usage: number;
  limit: number | null;
}

export async function checkKey(apiKey: string): Promise<KeyInfo> {
  const res = await fetch(`${BASE}/key`, { headers: headers(apiKey) });
  if (!res.ok) throw await failure(res);
  const body = await res.json();
  return { label: body.data?.label ?? 'API key', usage: Number(body.data?.usage ?? 0), limit: body.data?.limit ?? null };
}
