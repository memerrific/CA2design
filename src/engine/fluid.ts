// Heat transfer fluid properties.
// Water uses standard correlations; glycol mixes use approximate multipliers
// against water at the same temperature (good enough for sizing, not for
// manufacturer-grade hydraulics).

export type FluidId = 'water' | 'meg20' | 'meg30' | 'mpg25';

export interface FluidInfo {
  id: FluidId;
  name: string;
  cpFactor: number; // multiplier on water specific heat
  densityFactor: number;
  viscosityFactor: number;
}

export const FLUIDS: FluidInfo[] = [
  { id: 'water', name: 'Water', cpFactor: 1, densityFactor: 1, viscosityFactor: 1 },
  { id: 'meg20', name: 'Ethylene glycol 20%', cpFactor: 0.93, densityFactor: 1.025, viscosityFactor: 1.6 },
  { id: 'meg30', name: 'Ethylene glycol 30%', cpFactor: 0.89, densityFactor: 1.04, viscosityFactor: 2.0 },
  { id: 'mpg25', name: 'Propylene glycol 25%', cpFactor: 0.94, densityFactor: 1.02, viscosityFactor: 2.1 },
];

export function fluidInfo(id: FluidId): FluidInfo {
  return FLUIDS.find((f) => f.id === id) ?? FLUIDS[0];
}

/** Water density, kg/m³ (Tanaka et al. form, valid 0–100 °C). */
export function waterDensity(t: number): number {
  return 1000 * (1 - ((t + 288.9414) / (508929.2 * (t + 68.12963))) * (t - 3.9863) ** 2);
}

/** Water dynamic viscosity, Pa·s (Vogel equation). */
export function waterViscosity(t: number): number {
  return 2.414e-5 * 10 ** (247.8 / (t + 273.15 - 140));
}

export interface FluidState {
  rho: number; // kg/m³
  cp: number; // J/kg·K
  nu: number; // kinematic viscosity m²/s
}

export function fluidState(id: FluidId, meanTemp: number): FluidState {
  const f = fluidInfo(id);
  const rho = waterDensity(meanTemp) * f.densityFactor;
  const mu = waterViscosity(meanTemp) * f.viscosityFactor;
  return { rho, cp: 4186 * f.cpFactor, nu: mu / rho };
}

/** Volumetric flow (m³/s) needed to carry `watts` at temperature drop `dT`. */
export function flowForHeat(watts: number, dT: number, fs: FluidState): number {
  if (dT <= 0) return 0;
  return watts / (fs.rho * fs.cp * dT);
}

export const m3sToLpm = (q: number) => q * 60000;
export const m3sToM3h = (q: number) => q * 3600;
export const m3sToLps = (q: number) => q * 1000;
