// All data lives in the browser (localStorage). Nothing is sent anywhere.
// Projects can be exported/imported as JSON files for backup or moving devices.

import { useSyncExternalStore } from 'react';
import { DEFAULT_COMPANY } from './engine/factory';
import { ask } from './ui/dialog';
import type { CompanyProfile, Project } from './engine/model';

const KEY_PROJECTS = 'ca2d.projects.v1';
const KEY_COMPANY = 'ca2d.company.v1';
const KEY_PRICES = 'ca2d.prices.v1';

interface State {
  projects: Project[];
  company: CompanyProfile;
  /** Company price list: unit cost (ex VAT) by takeoff line key. Shared by all projects. */
  prices: Record<string, number>;
}

function load(): State {
  let projects: Project[] = [];
  let company = DEFAULT_COMPANY;
  let prices: Record<string, number> = {};
  try {
    projects = JSON.parse(localStorage.getItem(KEY_PROJECTS) || '[]');
  } catch {
    /* empty or blocked storage */
  }
  try {
    company = { ...DEFAULT_COMPANY, ...JSON.parse(localStorage.getItem(KEY_COMPANY) || '{}') };
  } catch {
    /* ignore */
  }
  try {
    prices = JSON.parse(localStorage.getItem(KEY_PRICES) || '{}');
  } catch {
    /* ignore */
  }
  return { projects, company, prices };
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(state.projects));
    localStorage.setItem(KEY_COMPANY, JSON.stringify(state.company));
    localStorage.setItem(KEY_PRICES, JSON.stringify(state.prices));
  } catch (e) {
    console.warn('Could not save', e);
    void ask.alert('Could not save to this browser (storage full or blocked). Export your project to keep a copy.');
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
  upsertProject(p: Project) {
    const updated = { ...p, updatedAt: new Date().toISOString() };
    const exists = state.projects.some((x) => x.id === p.id);
    state = {
      ...state,
      projects: exists ? state.projects.map((x) => (x.id === p.id ? updated : x)) : [updated, ...state.projects],
    };
    emit();
  },
  deleteProject(id: string) {
    state = { ...state, projects: state.projects.filter((p) => p.id !== id) };
    emit();
  },
  setPrice(key: string, unitCost: number) {
    state = { ...state, prices: { ...state.prices, [key]: unitCost } };
    emit();
  },
  setCompany(c: CompanyProfile) {
    state = { ...state, company: c };
    emit();
  },
};

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadJson(filename: string, data: unknown) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function readFile(file: File, as: 'text' | 'dataUrl'): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    if (as === 'text') r.readAsText(file);
    else r.readAsDataURL(file);
  });
}
