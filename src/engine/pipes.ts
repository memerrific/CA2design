import { fluidState, flowForHeat, m3sToM3h, type FluidId } from './fluid';

export type PipeMaterial = 'copper' | 'pex' | 'mlcp' | 'steel' | 'pvc';

export interface PipeSize {
  id: string;
  material: PipeMaterial;
  label: string;
  od: number; // mm, nominal outside diameter
  id_mm: number; // mm, internal diameter
}

/** Absolute roughness, mm. */
export const ROUGHNESS: Record<PipeMaterial, number> = {
  copper: 0.0015,
  pex: 0.007,
  mlcp: 0.007,
  steel: 0.045,
  pvc: 0.0015,
};

export const MATERIAL_NAMES: Record<PipeMaterial, string> = {
  copper: 'Copper (EN 1057 R250)',
  pex: 'PE-X / PB',
  mlcp: 'Multilayer (MLCP)',
  steel: 'Steel (medium)',
  pvc: 'ABS / PVC-U (pool)',
};

// Internal diameters are typical wall thicknesses; check the manufacturer's data
// for the exact product being installed.
export const PIPE_SIZES: PipeSize[] = [
  { id: 'cu10', material: 'copper', label: '10 mm', od: 10, id_mm: 8.8 },
  { id: 'cu15', material: 'copper', label: '15 mm', od: 15, id_mm: 13.6 },
  { id: 'cu22', material: 'copper', label: '22 mm', od: 22, id_mm: 20.2 },
  { id: 'cu28', material: 'copper', label: '28 mm', od: 28, id_mm: 26.2 },
  { id: 'cu35', material: 'copper', label: '35 mm', od: 35, id_mm: 32.6 },
  { id: 'cu42', material: 'copper', label: '42 mm', od: 42, id_mm: 39.6 },
  { id: 'cu54', material: 'copper', label: '54 mm', od: 54, id_mm: 51.6 },
  { id: 'cu67', material: 'copper', label: '67 mm', od: 66.7, id_mm: 64.3 },
  { id: 'pex10', material: 'pex', label: '10 mm', od: 10, id_mm: 7.0 },
  { id: 'pex15', material: 'pex', label: '15 mm', od: 15, id_mm: 11.6 },
  { id: 'pex16', material: 'pex', label: '16 × 2.0', od: 16, id_mm: 12 },
  { id: 'pex20', material: 'pex', label: '20 × 2.0', od: 20, id_mm: 16 },
  { id: 'pex22', material: 'pex', label: '22 mm', od: 22, id_mm: 17.2 },
  { id: 'pex25', material: 'pex', label: '25 × 2.3', od: 25, id_mm: 20.4 },
  { id: 'pex28', material: 'pex', label: '28 mm', od: 28, id_mm: 22.4 },
  { id: 'pex32', material: 'pex', label: '32 × 2.9', od: 32, id_mm: 26.2 },
  { id: 'ml16', material: 'mlcp', label: '16 × 2.0', od: 16, id_mm: 12 },
  { id: 'ml20', material: 'mlcp', label: '20 × 2.0', od: 20, id_mm: 16 },
  { id: 'ml26', material: 'mlcp', label: '26 × 3.0', od: 26, id_mm: 20 },
  { id: 'ml32', material: 'mlcp', label: '32 × 3.0', od: 32, id_mm: 26 },
  { id: 'ml40', material: 'mlcp', label: '40 × 3.5', od: 40, id_mm: 33 },
  { id: 'ml50', material: 'mlcp', label: '50 × 4.0', od: 50, id_mm: 42 },
  { id: 'ml63', material: 'mlcp', label: '63 × 4.5', od: 63, id_mm: 54 },
  { id: 'st15', material: 'steel', label: 'DN15 (½")', od: 21.3, id_mm: 16.1 },
  { id: 'st20', material: 'steel', label: 'DN20 (¾")', od: 26.9, id_mm: 21.6 },
  { id: 'st25', material: 'steel', label: 'DN25 (1")', od: 33.7, id_mm: 27.2 },
  { id: 'st32', material: 'steel', label: 'DN32 (1¼")', od: 42.4, id_mm: 35.9 },
  { id: 'st40', material: 'steel', label: 'DN40 (1½")', od: 48.3, id_mm: 41.8 },
  { id: 'st50', material: 'steel', label: 'DN50 (2")', od: 60.3, id_mm: 53.0 },
  { id: 'st65', material: 'steel', label: 'DN65 (2½")', od: 76.1, id_mm: 68.8 },
  { id: 'st80', material: 'steel', label: 'DN80 (3")', od: 88.9, id_mm: 80.8 },
  { id: 'pvc32', material: 'pvc', label: '32 mm (1")', od: 32, id_mm: 28.4 },
  { id: 'pvc40', material: 'pvc', label: '40 mm (1¼")', od: 40, id_mm: 36.2 },
  { id: 'pvc50', material: 'pvc', label: '50 mm (1½")', od: 50, id_mm: 45.2 },
  { id: 'pvc63', material: 'pvc', label: '2" (63 mm)', od: 63, id_mm: 57 },
  { id: 'pvc75', material: 'pvc', label: '75 mm (2½")', od: 75, id_mm: 67.8 },
];

export function pipeSize(id: string): PipeSize | undefined {
  return PIPE_SIZES.find((p) => p.id === id);
}

/** Darcy friction factor: laminar below Re 2300, Swamee–Jain above. */
export function frictionFactor(re: number, relRough: number): number {
  if (re <= 0) return 0;
  if (re < 2300) return 64 / re;
  const t = Math.log10(relRough / 3.7 + 5.74 / re ** 0.9);
  return 0.25 / (t * t);
}

export interface PipeResult {
  flowM3s: number;
  flowLpm: number;
  flowM3h: number;
  velocity: number; // m/s
  reynolds: number;
  paPerM: number; // Pa per metre of straight pipe
  pressureDropPa: number; // including fittings allowance
  headM: number;
}

export interface PipeRunInput {
  sizeId: string;
  lengthM: number;
  fittingsAllowancePct: number;
  flowM3s: number;
  fluid: FluidId;
  meanTemp: number;
}

export function analysePipe(inp: PipeRunInput): PipeResult | null {
  const size = pipeSize(inp.sizeId);
  if (!size) return null;
  const fs = fluidState(inp.fluid, inp.meanTemp);
  const d = size.id_mm / 1000;
  const a = (Math.PI * d * d) / 4;
  const v = inp.flowM3s / a;
  const re = (v * d) / fs.nu;
  const f = frictionFactor(re, ROUGHNESS[size.material] / size.id_mm);
  const paPerM = (f / d) * ((fs.rho * v * v) / 2);
  const dp = paPerM * inp.lengthM * (1 + inp.fittingsAllowancePct / 100);
  return {
    flowM3s: inp.flowM3s,
    flowLpm: inp.flowM3s * 60000,
    flowM3h: m3sToM3h(inp.flowM3s),
    velocity: v,
    reynolds: re,
    paPerM,
    pressureDropPa: dp,
    headM: dp / (fs.rho * 9.81),
  };
}

export interface SizingLimits {
  maxVelocity: number; // m/s
  maxPaPerM: number;
}

export const DEFAULT_LIMITS: SizingLimits = { maxVelocity: 1.0, maxPaPerM: 200 };

/** Smallest pipe of `material` that meets both velocity and pressure-gradient limits. */
export function autoSize(
  material: PipeMaterial,
  flowM3s: number,
  fluid: FluidId,
  meanTemp: number,
  limits: SizingLimits = DEFAULT_LIMITS,
): PipeSize | undefined {
  const sizes = PIPE_SIZES.filter((p) => p.material === material).sort((a, b) => a.id_mm - b.id_mm);
  for (const s of sizes) {
    const r = analysePipe({ sizeId: s.id, lengthM: 1, fittingsAllowancePct: 0, flowM3s, fluid, meanTemp });
    if (r && r.velocity <= limits.maxVelocity && r.paPerM <= limits.maxPaPerM) return s;
  }
  return undefined;
}

/** Heat (W) and ΔT to flow, for convenience in the UI. */
export function flowFromHeat(watts: number, dT: number, fluid: FluidId, meanTemp: number): number {
  return flowForHeat(watts, dT, fluidState(fluid, meanTemp));
}

// ---- Valves (Kv) ----

/** Pressure drop across a valve, bar. Kv is m³/h at 1 bar. */
export function valveDropBar(flowM3h: number, kv: number): number {
  if (kv <= 0) return Infinity;
  return (flowM3h / kv) ** 2;
}

/** Kv needed to pass `flowM3h` at `dpBar` drop. */
export function requiredKv(flowM3h: number, dpBar: number): number {
  if (dpBar <= 0) return Infinity;
  return flowM3h / Math.sqrt(dpBar);
}

/** Valve authority: valve drop / (valve drop + circuit drop). 0.25–0.5 is the usual target. */
export function valveAuthority(valveDropPa: number, circuitDropPa: number): number {
  const total = valveDropPa + circuitDropPa;
  return total > 0 ? valveDropPa / total : 0;
}
