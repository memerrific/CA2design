// Radiator output correction and sizing.
// Catalogue outputs are quoted at ΔT50 (mean water 75 °C, room 20 °C).
// At other conditions: Φ = Φ50 · (ΔT / 50)^n, n ≈ 1.3 for panel radiators.

import type { Emitter, RadiatorType } from './model';

/** Mean water-to-air temperature difference, K (arithmetic, as used in catalogues). */
export function meanDeltaT(flow: number, ret: number, room: number): number {
  return (flow + ret) / 2 - room;
}

export function correctionFactor(dT: number, n = 1.3): number {
  if (dT <= 0) return 0;
  return (dT / 50) ** n;
}

// Generic steel panel radiator outputs at ΔT50, W per metre of length at 600 mm
// high, with height multipliers. Typical of UK compact panels; use the chosen
// manufacturer's tables for the final selection.
export const RAD_TYPES: { id: RadiatorType; name: string; wPerM600: number }[] = [
  { id: '11', name: 'Type 11 (K1)', wPerM600: 1000 },
  { id: '21', name: 'Type 21 (P+)', wPerM600: 1400 },
  { id: '22', name: 'Type 22 (K2)', wPerM600: 1850 },
  { id: '33', name: 'Type 33 (K3)', wPerM600: 2600 },
];

export const RAD_HEIGHTS: { mm: number; factor: number }[] = [
  { mm: 300, factor: 0.56 },
  { mm: 400, factor: 0.71 },
  { mm: 450, factor: 0.78 },
  { mm: 500, factor: 0.85 },
  { mm: 600, factor: 1.0 },
  { mm: 700, factor: 1.13 },
  { mm: 900, factor: 1.4 },
];

export const RAD_LENGTHS = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000];

export function radiatorDt50(type: RadiatorType, heightMm: number, lengthMm: number): number {
  const t = RAD_TYPES.find((r) => r.id === type);
  if (!t) return 0;
  const hs = [...RAD_HEIGHTS].sort((a, b) => a.mm - b.mm);
  let factor: number;
  if (heightMm <= hs[0].mm) factor = (hs[0].factor * heightMm) / hs[0].mm;
  else if (heightMm >= hs[hs.length - 1].mm) factor = (hs[hs.length - 1].factor * heightMm) / hs[hs.length - 1].mm;
  else {
    const i = hs.findIndex((h) => h.mm >= heightMm);
    const a = hs[i - 1];
    const b = hs[i];
    factor = a.factor + ((heightMm - a.mm) / (b.mm - a.mm)) * (b.factor - a.factor);
  }
  return (t.wPerM600 * factor * lengthMm) / 1000;
}

export function emitterDt50(e: Emitter): number {
  if (e.kind === 'custom') return (e.ratedDt50 ?? 0) * e.quantity;
  if (!e.type || !e.height || !e.length) return 0;
  return radiatorDt50(e.type, e.height, e.length) * e.quantity;
}

export function emitterOutput(e: Emitter, dT: number, n = 1.3): number {
  return emitterDt50(e) * correctionFactor(dT, n);
}

export interface RadSuggestion {
  type: RadiatorType;
  height: number;
  length: number;
  quantity: number;
  dt50: number;
  output: number;
}

/**
 * Radiator of the given height that covers `watts` at mean ΔT `dT`.
 * Prefers the slimmest type that fits within `maxLength`, shortest length
 * first; falls back to two or three radiators when one won't do.
 */
export function suggestRadiator(
  watts: number,
  dT: number,
  height: number,
  n = 1.3,
  allowed: RadiatorType[] = ['11', '21', '22', '33'],
  maxLength = 1600,
): RadSuggestion | null {
  const cf = correctionFactor(dT, n);
  if (cf <= 0 || watts <= 0) return null;
  const needed = watts / cf;
  for (const quantity of [1, 2, 3]) {
    for (const type of allowed) {
      for (const length of RAD_LENGTHS.filter((l) => l <= maxLength)) {
        const dt50 = radiatorDt50(type, height, length) * quantity;
        if (dt50 >= needed) return { type, height, length, quantity, dt50, output: dt50 * cf };
      }
    }
  }
  return null;
}
