import { dbGet, dbPut } from '../store/db';
import { newId } from '../episode/normalize';

/*
 * Video files shown on a set's TV. The file lives in IndexedDB; the scene only keeps its key.
 * Frames are handed to the SVG one at a time as data URLs, because that is the only kind of
 * picture an SVG keeps when the exporter rasterizes it.
 */

/** Plenty for a TV that's about a seventh of the frame wide, and small enough to encode every frame. */
const FRAME_W = 480;

/** Store a file the user picked and return what the scene should remember about it. */
export async function saveScreenVideo(file: File): Promise<{ id: string; name: string }> {
  const id = newId('v');
  // shortcut: files stay in storage after a scene stops using them (undo may still need them); add a sweep if storage fills up.
  await dbPut('media', id, file);
  return { id, name: file.name };
}

const players = new Map<string, Promise<HTMLVideoElement | null>>();

/** The stored file as a silent, looping <video> that's ready to seek. Null if it's gone or the browser can't play it. */
export function loadScreenVideo(id: string): Promise<HTMLVideoElement | null> {
  let p = players.get(id);
  if (!p) {
    p = dbGet<Blob>('media', id)
      .then((blob) => {
        if (!blob) return null;
        return new Promise<HTMLVideoElement | null>((resolve) => {
          const v = document.createElement('video');
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          v.preload = 'auto';
          v.onloadeddata = () => resolve(v);
          v.onerror = () => resolve(null);
          v.src = URL.createObjectURL(blob);
        });
      })
      .catch(() => null);
    players.set(id, p);
  }
  return p;
}

let canvas: HTMLCanvasElement | null = null;

/** What the video is showing right now. */
export function grabFrame(v: HTMLVideoElement): string | undefined {
  if (!v.videoWidth) return undefined;
  canvas ??= document.createElement('canvas');
  const h = Math.round((FRAME_W * v.videoHeight) / v.videoWidth);
  if (canvas.width !== FRAME_W || canvas.height !== h) {
    canvas.width = FRAME_W;
    canvas.height = h;
  }
  canvas.getContext('2d')!.drawImage(v, 0, 0, FRAME_W, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/** Where a looping video is, `t` seconds into its scene. */
export const loopTime = (v: HTMLVideoElement, t: number) => (v.duration > 0 && Number.isFinite(v.duration) ? t % v.duration : 0);

/**
 * The exact picture `t` seconds into the scene.
 * shortcut: seeks the <video> once per frame, which is slow on long, high-resolution clips; decode sequentially (mediabunny) if exports drag.
 */
export async function seekFrame(v: HTMLVideoElement, t: number): Promise<string | undefined> {
  const target = loopTime(v, t);
  if (Math.abs(v.currentTime - target) > 0.001) {
    await new Promise<void>((resolve) => {
      // A seek that never lands must not hang the export.
      const timer = setTimeout(resolve, 3000);
      v.addEventListener(
        'seeked',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      v.currentTime = target;
    });
  }
  return grabFrame(v);
}
