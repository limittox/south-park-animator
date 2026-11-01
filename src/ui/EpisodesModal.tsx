import { useEffect, useState } from 'react';
import type { Episode } from '../episode/types';
import { deleteEpisode, listEpisodes, saveEpisode } from '../store/episodes';
import { newId } from '../episode/normalize';
import { Modal } from './Modal';

interface Props {
  currentId: string | null;
  onOpen: (ep: Episode) => void;
  onNew: () => void;
  onClose: () => void;
}

export function EpisodesModal({ currentId, onOpen, onNew, onClose }: Props) {
  const [list, setList] = useState<Episode[] | null>(null);
  const refresh = () => void listEpisodes().then(setList);
  useEffect(refresh, []);

  return (
    <Modal title="Your episodes" onClose={onClose}>
      <button className="btn red" onClick={onNew}>
        + New episode from a script
      </button>
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="empty-note">Nothing saved yet.</p>
      ) : (
        <ul className="episode-list">
          {list.map((ep) => (
            <li key={ep.id} className={ep.id === currentId ? 'cur' : ''}>
              <button className="ep-open" onClick={() => onOpen(ep)}>
                <b>{ep.title}</b>
                <span className="muted small">
                  {ep.scenes.length} scene{ep.scenes.length === 1 ? '' : 's'} · {ep.cast.length} characters · {new Date(ep.updatedAt).toLocaleString()}
                </span>
              </button>
              <button
                className="btn tiny"
                onClick={async () => {
                  await saveEpisode({ ...structuredClone(ep), id: newId('e'), title: `${ep.title} (copy)`, updatedAt: Date.now() });
                  refresh();
                }}
              >
                Duplicate
              </button>
              <button
                className="btn tiny danger"
                disabled={ep.id === currentId}
                onClick={async () => {
                  if (!confirm(`Delete "${ep.title}"? This can't be undone.`)) return;
                  await deleteEpisode(ep.id);
                  refresh();
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
