import { useState, type ReactNode } from 'react';
import { Icon } from './icons';

const KEY = 'ca2d.explain.hidden';

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/** "What this page does" box. Hiding it is remembered per page; a small link brings it back. */
export function Explain({ id, children, title = 'What this page does' }: { id: string; children: ReactNode; title?: string }) {
  const [hidden, setHidden] = useState(() => readHidden().includes(id));
  const set = (h: boolean) => {
    setHidden(h);
    try {
      const list = readHidden().filter((x) => x !== id);
      localStorage.setItem(KEY, JSON.stringify(h ? [...list, id] : list));
    } catch {
      /* not remembered */
    }
  };

  if (hidden)
    return (
      <button className="explain-open no-print" onClick={() => set(false)}>
        <Icon name="info" size={15} /> {title}
      </button>
    );
  return (
    <aside className="explain no-print" aria-label={title}>
      <Icon name="info" size={18} />
      <div>
        <b>{title}</b>
        <div className="explain-body">{children}</div>
      </div>
      <button className="explain-hide" onClick={() => set(true)} aria-label="Hide this explanation">
        Got it
      </button>
    </aside>
  );
}
