import { useEffect, useState } from 'react';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

let next = 1;
const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l(toasts));
}

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const t = { id: next++, text, kind };
  toasts = [...toasts, t].slice(-4);
  emit();
  window.setTimeout(
    () => {
      toasts = toasts.filter((x) => x.id !== t.id);
      emit();
    },
    kind === 'error' ? 7000 : 3500,
  );
}

export function Toasts() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setList);
    return () => void listeners.delete(setList);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
