import { useSyncExternalStore } from 'react';
import { scopedKey } from './account';
import type { AgeBand } from './data/climate';
import { designTemperature, station } from './data/climate';
import { ageBandDefaults } from './engine/heatloss';
import type { FluidId } from './engine/fluid';
import type { Project } from './engine/model';

// App preferences for this device: appearance, explanations and the defaults
// every new job starts with. Company details live in the main store because
// they are part of the printed packs.

export type Theme = 'system' | 'light' | 'dark';

export interface JobDefaults {
  engineer: string;
  flowTemp: number;
  deltaT: number;
  marginPct: number;
  fluid: FluidId;
  ageBand: AgeBand;
  stationId: string;
  percentile: '99.6' | '99';
  stage: string;
}

export interface Prefs {
  theme: Theme;
  largeText: boolean;
  compact: boolean;
  reduceMotion: boolean;
  explanations: boolean;
  defaults: JobDefaults;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  largeText: false,
  compact: false,
  reduceMotion: false,
  explanations: true,
  defaults: {
    engineer: '',
    flowTemp: 45,
    deltaT: 5,
    marginPct: 0,
    fluid: 'water',
    ageBand: 'C',
    stationId: 'london',
    percentile: '99.6',
    stage: 'enquiry',
  },
};

const KEY = scopedKey('prefs.v1');
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_PREFS, ...raw, defaults: { ...DEFAULT_PREFS.defaults, ...raw.defaults } };
  } catch {
    return DEFAULT_PREFS;
  }
}

let prefs = load();

export const prefsStore = {
  get: () => prefs,
  set(patch: Partial<Prefs>) {
    prefs = { ...prefs, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* kept for this visit only */
    }
    applyPrefs();
    listeners.forEach((l) => l());
  },
  setDefaults(patch: Partial<JobDefaults>) {
    prefsStore.set({ defaults: { ...prefs.defaults, ...patch } });
  },
  reset() {
    prefsStore.set(DEFAULT_PREFS);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const usePrefs = () => useSyncExternalStore(prefsStore.subscribe, prefsStore.get);

const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/** The theme actually showing, after "match this device" is resolved. */
export const resolvedTheme = (): 'light' | 'dark' => (prefs.theme === 'system' ? (darkQuery?.matches ? 'dark' : 'light') : prefs.theme);

/** Put the appearance settings on <html> so the CSS can follow them. */
export function applyPrefs() {
  const root = document.documentElement;
  const theme = resolvedTheme();
  root.dataset.theme = theme;
  root.dataset.text = prefs.largeText ? 'large' : 'normal';
  root.dataset.density = prefs.compact ? 'compact' : 'comfortable';
  root.dataset.motion = prefs.reduceMotion ? 'reduce' : 'normal';
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121315' : '#f6f6f7');
}

darkQuery?.addEventListener('change', () => prefs.theme === 'system' && applyPrefs());

/** Fill a brand-new job with your defaults. Job types that need their own values (plant rooms) set them afterwards. */
export function applyJobDefaults(p: Project) {
  const d = prefs.defaults;
  p.engineer = d.engineer;
  p.stage = d.stage;
  const s = p.settings;
  s.flowTemp = d.flowTemp;
  s.deltaT = d.deltaT;
  s.marginPct = d.marginPct;
  s.fluid = d.fluid;
  s.ageBand = d.ageBand;
  Object.assign(s, ageBandDefaults(d.ageBand));
  const st = station(d.stationId);
  if (st) {
    s.stationId = st.id;
    s.percentile = d.percentile;
    s.externalTemp = designTemperature(st, s.altitude ?? 0, d.percentile);
    s.locationName = `${st.location} (${st.station})`;
  }
}
