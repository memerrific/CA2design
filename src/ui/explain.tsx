import { useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { scopedKey } from '../account';
import { usePrefs } from '../prefs';

const KEY = scopedKey('explain.hidden');

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/** "What this page does" box. Hiding it is remembered per page; a small link brings it back. */
export function Explain({ id, children, title = 'What this page does' }: { id: string; children: ReactNode; title?: string }) {
  const { explanations } = usePrefs();
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

  if (!explanations) return null;
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

/** Bring back every explanation that was hidden with "Got it". */
export function showAllExplanations() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function hiddenExplanationCount(): number {
  return readHidden().length;
}
