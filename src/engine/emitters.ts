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

// Steel panel radiator outputs at ΔT50 (75/65/20 °C), W per metre of length,
// from Stelrad Compact published specification sheets. Heights between the
// listed ones are interpolated; 900 mm is extrapolated. Check the chosen
// manufacturer's current EN 442 data before ordering.
export const RAD_TYPES: { id: RadiatorType; name: string; wPerM: Record<number, number> }[] = [
  { id: '11', name: 'Type 11 (K1)', wPerM: { 300: 509, 450: 756, 600: 980 } },
  { id: '21', name: 'Type 21 (P+)', wPerM: { 300: 745, 450: 1055, 600: 1345 } },
  { id: '22', name: 'Type 22 (K2)', wPerM: { 300: 982, 450: 1371, 600: 1732, 700: 1961 } },
  { id: '33', name: 'Type 33 (K3)', wPerM: { 300: 1349, 500: 2056, 600: 2389, 700: 2712 } },
];

export const RAD_HEIGHTS: { mm: number }[] = [{ mm: 300 }, { mm: 400 }, { mm: 450 }, { mm: 500 }, { mm: 600 }, { mm: 700 }, { mm: 900 }];

export const RAD_LENGTHS = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000];

/** W per metre at ΔT50 for a type and height, interpolating the published heights. */
export function radiatorWPerM(type: RadiatorType, heightMm: number): number {
  const t = RAD_TYPES.find((r) => r.id === type);
  if (!t) return 0;
  const pts = Object.entries(t.wPerM)
    .map(([h, w]) => [Number(h), w] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const seg = (i: number) => {
    const [h0, w0] = pts[i];
    const [h1, w1] = pts[i + 1];
    return w0 + ((heightMm - h0) * (w1 - w0)) / (h1 - h0);
  };
  if (heightMm <= pts[0][0]) return (pts[0][1] * heightMm) / pts[0][0];
  for (let i = 0; i < pts.length - 1; i++) if (heightMm <= pts[i + 1][0]) return seg(i);
  return seg(pts.length - 2);
}

export function radiatorDt50(type: RadiatorType, heightMm: number, lengthMm: number): number {
  return (radiatorWPerM(type, heightMm) * lengthMm) / 1000;
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
