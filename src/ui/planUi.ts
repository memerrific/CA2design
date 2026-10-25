// View state for the floor plan canvas, shared between the plan and the
// sidebar's floors / layers panels. Remembered per browser.

import { scopedKey } from '../account';
import { useSyncExternalStore } from 'react';

export type LayerId = 'outlines' | 'dims' | 'emitters' | 'flow' | 'return' | 'ufh' | 'notes' | 'underlay';

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'outlines', name: 'Room outlines' },
  { id: 'dims', name: 'Dimensions' },
  { id: 'emitters', name: 'Radiators / emitters' },
  { id: 'flow', name: 'Pipework (flow)' },
  { id: 'return', name: 'Pipework (return)' },
  { id: 'ufh', name: 'Underfloor heating' },
  { id: 'notes', name: 'Annotations' },
  { id: 'underlay', name: 'Background plan' },
];

export type Selection = { kind: 'room' | 'emitter' | 'pipe' | 'note' | 'valve'; id: string; roomId?: string } | null;

interface PlanUi {
  level: string;
  layers: Record<LayerId, boolean>;
  selection: Selection;
}

const KEY = scopedKey('planui.v1');
let ui: PlanUi = {
  level: 'Ground',
  layers: { outlines: true, dims: true, emitters: true, flow: true, return: true, ufh: true, notes: true, underlay: true },
  selection: null,
};
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (saved.layers) ui = { ...ui, layers: { ...ui.layers, ...saved.layers } };
} catch {
  /* storage blocked */
}
const subs = new Set<() => void>();

export const planUi = {
  get: () => ui,
  set(patch: Partial<PlanUi>) {
    ui = { ...ui, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify({ layers: ui.layers }));
    } catch {
      /* ignore */
    }
    subs.forEach((s) => s());
  },
  toggleLayer(id: LayerId) {
    planUi.set({ layers: { ...ui.layers, [id]: !ui.layers[id] } });
  },
};

export function usePlanUi(): PlanUi {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => ui,
  );
}
