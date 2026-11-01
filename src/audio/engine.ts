import type { AudioCue } from '../episode/timeline';
import { audioContext, toAudioBuffer, type VoicedLine } from './voices';
import { playSfx, sfxDuration } from './sfx';

/*
 * Live playback. The audio clock is the master clock: the player asks `now()` every frame,
 * so pictures can never drift from voices. Lines that have no synthesized audio yet
 * (no API key) are read by the browser's own speech voice as a stand-in.
 */
export class PlaybackEngine {
  private bus: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private timers: number[] = [];
  private ctxStart = 0;
  private epStart = 0;
  playing = false;

  start(fromT: number, cues: AudioCue[], lines: ReadonlyMap<string, VoicedLine>, fallbackText: (beatId: string) => string | null): void {
    this.stop();
    const ctx = audioContext();
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    this.bus = bus;
    this.ctxStart = ctx.currentTime + 0.06;
    this.epStart = fromT;
    this.playing = true;
    for (const cue of cues) {
      const when = this.ctxStart + (cue.t - fromT);
      if (cue.kind === 'line') {
        const line = lines.get(cue.beatId);
        if (line) {
          if (cue.t + line.clip.duration <= fromT) continue;
          const src = ctx.createBufferSource();
          src.buffer = toAudioBuffer(ctx, line);
          src.connect(bus);
          src.start(Math.max(this.ctxStart, when), Math.max(0, fromT - cue.t));
          this.sources.push(src);
        } else if (cue.t >= fromT && 'speechSynthesis' in window) {
          const text = fallbackText(cue.beatId);
          if (!text) continue;
          this.timers.push(
            window.setTimeout(() => {
              const u = new SpeechSynthesisUtterance(text);
              u.rate = 1.1;
              window.speechSynthesis.speak(u);
            }, (cue.t - fromT) * 1000),
          );
        }
      } else if (cue.sfx && cue.t + sfxDuration(cue.sfx) > fromT && cue.t >= fromT - 0.05) {
        playSfx(ctx, bus, cue.sfx, Math.max(this.ctxStart, when));
      }
    }
  }

  /** Episode time right now. */
  now(): number {
    if (!this.playing) return this.epStart;
    return this.epStart + Math.max(0, audioContext().currentTime - this.ctxStart);
  }

  stop(): void {
    if (this.playing) this.epStart = this.now();
    this.playing = false;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already finished */
      }
    }
    this.sources = [];
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    if (this.bus) {
      // Disconnecting the bus also silences synthesized effects already scheduled on it.
      this.bus.disconnect();
      this.bus = null;
    }
  }
}
