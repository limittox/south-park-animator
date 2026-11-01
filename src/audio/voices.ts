import type { Beat, CastMember } from '../episode/types';
import type { LineClip } from '../episode/timeline';
import { AiError, speech, type SpeechFormat } from '../ai/openrouter';
import { dbGet, dbPut } from '../store/db';
import { envelope, pcm16ToFloat, processVoice, trimSilence } from './dsp';

/** A synthesized, processed line ready to play and lip-sync. */
export interface VoicedLine {
  /** Everything that went into it; a changed signature means re-voice. */
  sig: string;
  clip: LineClip;
  samples: Float32Array;
  sampleRate: number;
}

let ac: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!ac) ac = new AudioContext({ sampleRate: 48000 });
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

/* ------------------------------------------------------------------ requests */

type DirectionMode = 'instructions' | 'tags' | 'none';

/**
 * How each speech model takes acting directions. Gemini reads its input word for word, so its
 * directions must go in `instructions`; OpenRouter turns them into Fish Audio's [tags] itself.
 */
export function directionMode(model: string): DirectionMode {
  if (model.startsWith('google/') || model.startsWith('openai/') || model.startsWith('fish-audio/')) return 'instructions';
  if (/^elevenlabs\/eleven-v[34]/.test(model) || model.startsWith('x-ai/')) return 'tags';
  return 'none';
}

/** Gemini and HeyGen only return raw PCM; everyone else is asked for MP3, which carries its own sample rate. */
export function speechFormat(model: string): SpeechFormat {
  return model.startsWith('google/') || model.startsWith('heygen/') ? 'pcm' : 'mp3';
}

/** Spoken text plus direction for one line, shaped for the chosen model. */
export function speechRequest(model: string, member: CastMember, beat: Pick<Beat, 'text' | 'delivery'>): { input: string; instructions?: string } {
  const text = (beat.text ?? '').trim();
  const style = member.voice.style.trim();
  const delivery = beat.delivery?.trim();
  switch (directionMode(model)) {
    case 'instructions':
      return { input: text, instructions: [style && `Voice: ${style}.`, delivery && `Delivery: ${delivery}.`].filter(Boolean).join(' ') || undefined };
    case 'tags':
      return { input: delivery ? `[${delivery}] ${text}` : text };
    default:
      return { input: text };
  }
}

export function lineSignature(model: string, member: CastMember, beat: Beat): string {
  const v = member.voice;
  return JSON.stringify([model, v.voice, v.pitch, v.tempo, v.style, beat.delivery ?? '', beat.text ?? '']);
}

function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36) + s.length.toString(36);
}

/* ------------------------------------------------------------------ synthesis */

interface CachedSpeech {
  bytes: ArrayBuffer;
  contentType: string;
}

/** Raw speech from OpenRouter, cached forever by what was asked for (pitch and tempo are applied later, for free). */
async function fetchSpeech(apiKey: string, model: string, voice: string, req: { input: string; instructions?: string }, signal?: AbortSignal): Promise<CachedSpeech> {
  const key = hash(JSON.stringify([model, voice, req.input, req.instructions ?? '']));
  try {
    const hit = await dbGet<CachedSpeech>('tts', key);
    if (hit?.bytes?.byteLength) return hit;
  } catch {
    /* storage unavailable: just fetch */
  }
  const ask = (format: SpeechFormat) => speech({ apiKey, model, voice, input: req.input, instructions: req.instructions, format, signal });
  const format = speechFormat(model);
  let res: CachedSpeech;
  try {
    res = await ask(format);
  } catch (e) {
    // Formats vary by provider: a model we don't know about may only offer the other one.
    if (!(e instanceof AiError && e.status === 400 && /mp3|pcm|format/i.test(e.message))) throw e;
    res = await ask(format === 'pcm' ? 'mp3' : 'pcm');
  }
  try {
    await dbPut('tts', key, res);
  } catch {
    /* full: still use it */
  }
  return res;
}

async function decode(bytes: ArrayBuffer, contentType: string): Promise<{ samples: Float32Array; sampleRate: number }> {
  const rate = Number(/rate=(\d+)/i.exec(contentType)?.[1]) || 24000;
  if (/pcm|l16|raw/i.test(contentType)) return { samples: pcm16ToFloat(bytes), sampleRate: rate };
  try {
    const buf = await audioContext().decodeAudioData(bytes.slice(0));
    const samples = new Float32Array(buf.length);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) samples[i] += d[i] / buf.numberOfChannels;
    }
    return { samples, sampleRate: buf.sampleRate };
  } catch {
    return { samples: pcm16ToFloat(bytes), sampleRate: rate };
  }
}

export async function voiceLine(apiKey: string, model: string, member: CastMember, beat: Beat, signal?: AbortSignal): Promise<VoicedLine> {
  const req = speechRequest(model, member, beat);
  const raw = await fetchSpeech(apiKey, model, member.voice.voice, req, signal);
  const { samples, sampleRate } = await decode(raw.bytes, raw.contentType);
  const trimmed = trimSilence(samples, sampleRate);
  const processed = processVoice(trimmed, sampleRate, member.voice.pitch, member.voice.tempo);
  return {
    sig: lineSignature(model, member, beat),
    clip: { duration: processed.length / sampleRate, env: envelope(processed, sampleRate) },
    samples: processed,
    sampleRate,
  };
}

const bufferCache = new WeakMap<VoicedLine, AudioBuffer>();

export function toAudioBuffer(ctx: BaseAudioContext, line: VoicedLine): AudioBuffer {
  const cached = ctx instanceof AudioContext ? bufferCache.get(line) : undefined;
  if (cached) return cached;
  const buf = ctx.createBuffer(1, Math.max(1, line.samples.length), line.sampleRate);
  buf.copyToChannel(line.samples as Float32Array<ArrayBuffer>, 0);
  if (ctx instanceof AudioContext) bufferCache.set(line, buf);
  return buf;
}
