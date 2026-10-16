// In-app replacements for confirm() / prompt() / alert(). Native dialogs are
// blocked in some embedded views, and these match the app's look.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface Req {
  kind: 'confirm' | 'prompt' | 'alert';
  message: string;
  value: string;
  danger?: boolean;
  resolve: (v: string | boolean | null) => void;
}

let current: Req | null = null;
const subs = new Set<() => void>();
const set = (r: Req | null) => {
  current = r;
  subs.forEach((s) => s());
};

export const ask = {
  confirm(message: string, opts: { danger?: boolean } = {}): Promise<boolean> {
    return new Promise((resolve) => set({ kind: 'confirm', message, value: '', danger: opts.danger, resolve: (v) => resolve(v === true) }));
  },
  prompt(message: string, value = ''): Promise<string | null> {
    return new Promise((resolve) => set({ kind: 'prompt', message, value, resolve: (v) => resolve(typeof v === 'string' ? v : null) }));
  },
  alert(message: string): Promise<void> {
    return new Promise((resolve) => set({ kind: 'alert', message, value: '', resolve: () => resolve() }));
  },
};

export function Dialogs() {
  const req = useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => current,
  );
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    setText(req.value);
    setTimeout(() => (req.kind === 'prompt' ? inputRef.current?.select() : okRef.current?.focus()), 0);
  }, [req]);

  if (!req) return null;
  const close = (v: string | boolean | null) => {
    set(null);
    req.resolve(v);
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close(req.kind === 'confirm' ? false : null)}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault();
          close(req.kind === 'prompt' ? text : true);
        }}
        onKeyDown={(e) => e.key === 'Escape' && close(req.kind === 'confirm' ? false : null)}
      >
        <p style={{ whiteSpace: 'pre-line' }}>{req.message}</p>
        {req.kind === 'prompt' && <input id="dialog-input" ref={inputRef} type="text" value={text} onChange={(e) => setText(e.target.value)} />}
        <div className="actions end">
          {req.kind !== 'alert' && (
            <button type="button" className="btn ghost" onClick={() => close(req.kind === 'confirm' ? false : null)}>
              Cancel
            </button>
          )}
          <button ref={okRef} type="submit" className={`btn ${req.danger ? 'danger-solid' : ''}`}>
            {req.kind === 'alert' ? 'OK' : req.danger ? 'Delete' : 'OK'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** True in the hosted preview, where printing and downloads are blocked. */
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === '1';
