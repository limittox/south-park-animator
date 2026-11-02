import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioBufferSource, BufferTarget, CanvasSource, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import displayFontUrl from '@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff2?url';
import bodyFontUrl from '@fontsource/nunito/files/nunito-latin-900-normal.woff2?url';
import { audioCues, sampleEpisode, type ClipMap, type CompiledEpisode } from '../episode/timeline';
import { FLAT_CSS } from '../character/flat';
import { playSfx } from '../audio/sfx';
import { toAudioBuffer, type VoicedLine } from '../audio/voices';
import { FrameSvg } from './FrameSvg';

/*
 * Offline export: every frame is sampled from the same timeline the player uses, drawn as SVG,
 * rasterized onto a canvas and encoded with WebCodecs. Audio is mixed in an OfflineAudioContext.
 * Rendering is frame-exact, so nothing drops even if the machine is slow.
 */

const SAMPLE_RATE = 48000;

let fontCss: Promise<string> | null = null;
function inlineFonts(): Promise<string> {
  if (!fontCss) {
    const face = async (family: string, url: string, weight: number) => {
      const buf = await (await fetch(url)).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
    };
    fontCss = Promise.all([face('Luckiest Guy', displayFontUrl, 400), face('Nunito', bodyFontUrl, 900)])
      .then((x) => x.join(''))
      .catch(() => '');
  }
  return fontCss;
}

/** Mix every voice line and sound effect into one stereo track. */
export async function mixAudio(ep: CompiledEpisode, lines: ReadonlyMap<string, VoicedLine>): Promise<AudioBuffer> {
  const length = Math.ceil((ep.duration + 0.3) * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  for (const cue of audioCues(ep)) {
    if (cue.kind === 'line') {
      const line = lines.get(cue.beatId);
      if (!line) continue;
      const src = ctx.createBufferSource();
      src.buffer = toAudioBuffer(ctx, line);
      src.connect(bus);
      src.start(cue.t);
    } else if (cue.sfx) playSfx(ctx, bus, cue.sfx, cue.t);
  }
  return ctx.startRendering();
}

function sliceAudio(buf: AudioBuffer, from: number, to: number): AudioBuffer {
  const a = Math.min(buf.length, Math.floor(from * buf.sampleRate));
  const b = Math.min(buf.length, Math.floor(to * buf.sampleRate));
  const out = new AudioBuffer({ length: Math.max(1, b - a), numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(a, b), ch);
  return out;
}

/**
 * Drawing an SVG <img> straight onto a canvas makes Chromium keep a full-size raster of it (on the
 * GPU) until the next garbage collection, which an export hardly ever triggers: 8 MB a frame at
 * 1080p, gigabytes within a minute. An ImageBitmap's raster is ours to close once it's drawn.
 */
async function drawSvg(g: CanvasRenderingContext2D, markup: string, width: number, height: number): Promise<void> {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    const bmp = await createImageBitmap(img).catch(() => null);
    g.drawImage(bmp ?? img, 0, 0, width, height);
    bmp?.close();
  } finally {
    img.src = '';
    URL.revokeObjectURL(url);
  }
}

export interface ExportProgress {
  phase: 'audio' | 'video' | 'finishing';
  done: number;
  total: number;
}

export interface ExportOptions {
  compiled: CompiledEpisode;
  clips: ClipMap;
  lines: ReadonlyMap<string, VoicedLine>;
  height: 720 | 1080;
  fps?: number;
  subtitles: boolean;
  onProgress: (p: ExportProgress) => void;
  signal?: AbortSignal;
}

export async function exportEpisode({ compiled, clips, lines, height, fps = 30, subtitles, onProgress, signal }: ExportOptions): Promise<Blob> {
  const width = Math.round((height * 16) / 9 / 2) * 2;
  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height });
  if (!videoCodec) throw new Error("This browser can't encode video. Try a recent Chrome or Edge.");
  const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: SAMPLE_RATE });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d', { alpha: false });
  if (!g) throw new Error('Canvas is not available.');

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: fps });
  const audio = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  try {
    onProgress({ phase: 'audio', done: 0, total: 1 });
    const mixed = audio ? await mixAudio(compiled, lines) : null;
    const css = `<style>${await inlineFonts()}${FLAT_CSS}</style>`;
    const total = Math.ceil(compiled.duration * fps);
    let audioSent = 0;
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
      const t = i / fps;
      const frame = sampleEpisode(compiled, t, clips);
      const markup = renderToStaticMarkup(createElement(FrameSvg, { frame, subtitles, width, height, xmlns: 'http://www.w3.org/2000/svg' }));
      g.fillStyle = '#000';
      g.fillRect(0, 0, width, height);
      await drawSvg(g, markup.replace(/^<svg([^>]*)>/, `<svg$1>${css}`), width, height);
      await video.add(t, 1 / fps);
      // Feed audio in one-second slices alongside the pictures so the muxer can interleave.
      if (audio && mixed) {
        while (audioSent < Math.min(t + 1, compiled.duration)) {
          const next = Math.min(audioSent + 1, compiled.duration);
          await audio.add(sliceAudio(mixed, audioSent, next));
          audioSent = next;
        }
      }
      if (i % 3 === 0) onProgress({ phase: 'video', done: i, total });
    }
    if (audio && mixed && audioSent < compiled.duration) await audio.add(sliceAudio(mixed, audioSent, compiled.duration));
    onProgress({ phase: 'finishing', done: total, total });
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('The video came out empty.');
  return new Blob([buffer], { type: 'video/mp4' });
}
