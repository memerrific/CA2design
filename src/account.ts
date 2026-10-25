// Accounts on this device. Each account has its own jobs, prices, company
// details and settings, kept in this browser under keys that start with
// "ca2d.u.<account id>.". There are no passwords: an account is a name and an
// email, so anyone using this device can open it. Nothing is sent anywhere.

export interface Account {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const ACCOUNTS = 'ca2d.accounts.v1';
const SESSION = 'ca2d.session.v1';

/** Keys used before accounts existed. Moved into (or cleared for) the first account. */
const LEGACY = ['projects.v1', 'company.v1', 'prices.v1', 'prefs.v1', 'explain.hidden', 'planui.v1', 'rail'];

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

export const listAccounts = (): Account[] => read<Account[]>(ACCOUNTS, []);

function sessionId(): string | null {
  const id = read<string | null>(SESSION, null);
  return id && listAccounts().some((a) => a.id === id) ? id : null;
}

/** The signed-in account, fixed for this page load (signing in or out reloads the page). */
export const currentAccount: Account | null = listAccounts().find((a) => a.id === sessionId()) ?? null;

/** Storage key for the signed-in account, e.g. scopedKey('projects.v1'). */
export function scopedKey(name: string): string {
  return currentAccount ? `ca2d.u.${currentAccount.id}.${name}` : `ca2d.guest.${name}`;
}

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const emailTaken = (email: string, exceptId?: string) => listAccounts().some((a) => a.id !== exceptId && a.email.toLowerCase() === email.trim().toLowerCase());

/** How many jobs were saved on this device before accounts existed. */
export function legacyJobCount(): number {
  return read<unknown[]>('ca2d.projects.v1', []).length;
}

export type LegacyChoice = 'move' | 'delete';

export function createAccount(input: { name: string; email: string; company: string; legacy?: LegacyChoice }): Account {
  const acc: Account = {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    name: input.name.trim(),
    email: input.email.trim(),
    createdAt: new Date().toISOString(),
  };
  write(ACCOUNTS, [...listAccounts(), acc]);
  const key = (n: string) => `ca2d.u.${acc.id}.${n}`;

  if (input.legacy) {
    for (const n of LEGACY) {
      try {
        const v = localStorage.getItem(`ca2d.${n}`);
        if (v !== null && input.legacy === 'move') localStorage.setItem(key(n), v);
        localStorage.removeItem(`ca2d.${n}`);
      } catch {
        /* skip */
      }
    }
  }
  // Start the new account with its company name and the person as engineer on new jobs.
  const company = read<Record<string, unknown>>(key('company.v1'), {});
  if (input.company.trim()) write(key('company.v1'), { ...company, name: input.company.trim() });
  const prefs = read<{ defaults?: Record<string, unknown> }>(key('prefs.v1'), {});
  write(key('prefs.v1'), { ...prefs, defaults: { ...prefs.defaults, engineer: prefs.defaults?.engineer || acc.name } });
  return acc;
}

export function updateAccount(id: string, patch: Partial<Pick<Account, 'name' | 'email'>>) {
  write(
    ACCOUNTS,
    listAccounts().map((a) => (a.id === id ? { ...a, ...patch } : a)),
  );
}

export function signIn(id: string) {
  write(SESSION, id);
  window.location.hash = '/';
  window.location.reload();
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION);
  } catch {
    /* ignore */
  }
  window.location.hash = '/';
  window.location.reload();
}

/** Remove an account and everything saved under it on this device. */
export function deleteAccount(id: string) {
  try {
    const prefix = `ca2d.u.${id}.`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  write(
    ACCOUNTS,
    listAccounts().filter((a) => a.id !== id),
  );
  if (currentAccount?.id === id) signOut();
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
