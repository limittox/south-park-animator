import type { CastMember } from '../episode/types';
import { FACE_LIST } from '../episode/catalog';

/** Which way someone faces: at the camera, away from it, side on, or toward someone else. `start` is for the start of a scene, where the camera is the default. */
export function FaceSelect({ cast, value, onChange, start }: { cast: CastMember[]; value?: string; onChange: (v: string | undefined) => void; start?: boolean }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Facing">
      <option value="">{start ? 'The camera' : '— no change —'}</option>
      {FACE_LIST.filter((f) => !start || f.id !== 'front').map((f) => (
        <option key={f.id} value={f.id} title={f.desc}>
          {f.label}
        </option>
      ))}
      {cast.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
