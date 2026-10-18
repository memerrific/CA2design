// Plant room design: heat sources feeding a low loss header, with secondary
// circuits (heating zones, cylinders, pool heat exchangers, AHU coils…) taking
// heat away. Works out flows, pipe sizes, pump duties, header size and the
// temperatures that result where primary and secondary flows don't match.

import { fluidState, flowForHeat, type FluidId } from './fluid';
import { analysePipe, autoSize, pipeSize, valveDropBar, type PipeMaterial } from './pipes';

export type CircuitType = 'heating' | 'ufh' | 'dhw' | 'pool' | 'ahu' | 'process' | 'other';

export const CIRCUIT_TYPES: { id: CircuitType; name: string; flow: number; dT: number }[] = [
  { id: 'heating', name: 'Radiator heating zone', flow: 70, dT: 20 },
  { id: 'ufh', name: 'Underfloor (via mixing)', flow: 70, dT: 20 },
  { id: 'dhw', name: 'Cylinder / calorifier coil', flow: 80, dT: 20 },
  { id: 'pool', name: 'Pool plate heat exchanger', flow: 80, dT: 20 },
  { id: 'ahu', name: 'AHU / LTHW coil', flow: 80, dT: 20 },
  { id: 'process', name: 'Process / other plant', flow: 80, dT: 20 },
  { id: 'other', name: 'Other', flow: 70, dT: 20 },
];

export interface PlantCircuit {
  id: string;
  name: string;
  type: CircuitType;
  loadKw: number;
  flowTemp: number;
  deltaT: number;
  diversityPct: number; // share of this load counted towards plant size
  material: PipeMaterial;
  sizeId: string; // '' = auto
  lengthM: number; // flow + return
  fittingsPct: number;
  terminalDropKpa: number; // coil / heat exchanger / emitter circuit resistance
  valveKv: number; // control or balancing valve on the circuit, 0 = none
  notes: string;
}

export interface HeatSource {
  id: string;
  name: string;
  kind: 'boiler' | 'heatpump' | 'other';
  count: number;
  outputKw: number; // each
  flowTemp: number;
  deltaT: number;
  minFlowLpm: number; // each, 0 = not set
  notes: string;
}

export interface PlantRoom {
  sources: HeatSource[];
  circuits: PlantCircuit[];
  primaryMaterial: PipeMaterial;
  primaryLengthM: number; // header to furthest source, flow + return
  primaryFittingsPct: number;
  headerMaxVelocity: number; // m/s
  primaryMarginPct: number; // primary flow above secondary, target
}

export const defaultPlantRoom = (): PlantRoom => ({
  sources: [],
  circuits: [],
  primaryMaterial: 'copper',
  primaryLengthM: 10,
  primaryFittingsPct: 50,
  headerMaxVelocity: 0.2,
  primaryMarginPct: 10,
});

// Typical internal diameters for header bodies (steel tube / fabricated headers).
export const HEADER_SIZES: { label: string; idMm: number }[] = [
  { label: 'DN50 (2")', idMm: 53.0 },
  { label: 'DN65 (2½")', idMm: 68.8 },
  { label: 'DN80 (3")', idMm: 80.8 },
  { label: 'DN100 (4")', idMm: 105.3 },
  { label: 'DN125 (5")', idMm: 130.0 },
  { label: 'DN150 (6")', idMm: 155.4 },
  { label: 'DN200 (8")', idMm: 206.5 },
  { label: 'DN250 (10")', idMm: 260.4 },
];

export interface CircuitResult {
  id: string;
  flowM3s: number;
  flowM3h: number;
  flowLpm: number;
  sizeLabel: string | null;
  sizeIdMm: number | null;
  velocity: number | null;
  paPerM: number | null;
  pipeKpa: number;
  valveKpa: number;
  totalKpa: number;
  headM: number;
  valveAuthority: number | null;
}

export interface PlantResult {
  circuits: CircuitResult[];
  connectedKw: number;
  diversifiedKw: number;
  installedKw: number;
  capacityMarginPct: number;
  secondaryM3s: number;
  primaryM3s: number;
  primaryRatio: number; // primary / secondary flow
  secondaryReturnTemp: number; // flow-weighted mean
  primaryFlowTemp: number; // flow-weighted mean
  // Temperatures once flows meet at the header:
  secondaryFlowTempAtHeader: number;
  returnTempToSources: number;
  headerFlowM3s: number;
  headerIdForVelocityMm: number;
  headerIdFor3dMm: number;
  headerIdRequiredMm: number;
  headerSuggestion: string | null;
  largestConnectionIdMm: number;
  primaryPipe: { sizeLabel: string | null; velocity: number | null; kpa: number; idMm: number | null };
  warnings: string[];
}

export function analysePlant(plant: PlantRoom, fluid: FluidId): PlantResult {
  const warnings: string[] = [];

  const circuits: CircuitResult[] = plant.circuits.map((c) => {
    const mean = c.flowTemp - c.deltaT / 2;
    const fs = fluidState(fluid, mean);
    const q = flowForHeat(c.loadKw * 1000, c.deltaT, fs);
    const size = c.sizeId ? pipeSize(c.sizeId) : autoSize(c.material, q, fluid, mean);
    const pr = size ? analysePipe({ sizeId: size.id, lengthM: c.lengthM, fittingsAllowancePct: c.fittingsPct, flowM3s: q, fluid, meanTemp: mean }) : null;
    const pipeKpa = pr ? pr.pressureDropPa / 1000 : 0;
    const valveKpa = c.valveKv > 0 ? valveDropBar(q * 3600, c.valveKv) * 100 : 0;
    const totalKpa = pipeKpa + valveKpa + c.terminalDropKpa;
    if (!size) warnings.push(`${c.name}: flow is beyond the largest ${c.material} size. Choose another material.`);
    if (pr && pr.velocity > 1.5) warnings.push(`${c.name}: velocity ${pr.velocity.toFixed(2)} m/s is high; expect noise and erosion.`);
    const authority = c.valveKv > 0 && totalKpa > 0 ? valveKpa / totalKpa : null;
    if (authority !== null && authority < 0.25) warnings.push(`${c.name}: control valve authority ${(authority * 100).toFixed(0)}% is low (aim for 25–50%). A smaller Kv would control better.`);
    return {
      id: c.id,
      flowM3s: q,
      flowM3h: q * 3600,
      flowLpm: q * 60000,
      sizeLabel: size ? size.label : null,
      sizeIdMm: size ? size.id_mm : null,
      velocity: pr ? pr.velocity : null,
      paPerM: pr ? pr.paPerM : null,
      pipeKpa,
      valveKpa,
      totalKpa,
      headM: (totalKpa * 1000) / (fs.rho * 9.81),
      valveAuthority: authority,
    };
  });

  const connectedKw = plant.circuits.reduce((a, c) => a + c.loadKw, 0);
  const diversifiedKw = plant.circuits.reduce((a, c) => a + (c.loadKw * c.diversityPct) / 100, 0);
  const installedKw = plant.sources.reduce((a, s) => a + s.count * s.outputKw, 0);
  const capacityMarginPct = diversifiedKw > 0 ? (installedKw / diversifiedKw - 1) * 100 : 0;
  if (plant.sources.length && installedKw < diversifiedKw) warnings.push(`Installed output ${installedKw.toFixed(1)} kW is below the diversified load ${diversifiedKw.toFixed(1)} kW.`);

  // Secondary side: every circuit can call at once, so the header sees the full flow.
  const secondaryM3s = circuits.reduce((a, c) => a + c.flowM3s, 0);
  const secondaryReturnTemp = secondaryM3s > 0 ? plant.circuits.reduce((a, c, i) => a + circuits[i].flowM3s * (c.flowTemp - c.deltaT), 0) / secondaryM3s : 0;

  // Primary side: each source at full output and its own ΔT.
  const prim = plant.sources.map((s) => {
    const fs = fluidState(fluid, s.flowTemp - s.deltaT / 2);
    const each = flowForHeat(s.outputKw * 1000, s.deltaT, fs);
    if (s.minFlowLpm > 0 && each * 60000 < s.minFlowLpm) warnings.push(`${s.name}: design flow ${(each * 60000).toFixed(1)} l/min is below its minimum ${s.minFlowLpm} l/min. Reduce the ΔT or check the manufacturer's data.`);
    return { q: each * s.count, t: s.flowTemp };
  });
  const primaryM3s = prim.reduce((a, x) => a + x.q, 0);
  const primaryFlowTemp = primaryM3s > 0 ? prim.reduce((a, x) => a + x.q * x.t, 0) / primaryM3s : 0;
  const primaryRatio = secondaryM3s > 0 ? primaryM3s / secondaryM3s : 0;

  // Mixing at the header (simple flow-weighted mixing, steady state).
  let secondaryFlowTempAtHeader = primaryFlowTemp;
  let returnTempToSources = secondaryReturnTemp;
  if (primaryM3s > 0 && secondaryM3s > 0) {
    if (secondaryM3s > primaryM3s) {
      // Secondary pulls return water back up through the header: flow temperature drops.
      secondaryFlowTempAtHeader = (primaryM3s * primaryFlowTemp + (secondaryM3s - primaryM3s) * secondaryReturnTemp) / secondaryM3s;
      warnings.push(
        `Secondary flow is ${((1 / primaryRatio - 1) * 100).toFixed(0)}% higher than primary, so circuits will see about ${secondaryFlowTempAtHeader.toFixed(1)} °C instead of ${primaryFlowTemp.toFixed(1)} °C. Increase primary flow (lower source ΔT or bigger pumps).`,
      );
    } else {
      // Surplus primary flow short-circuits back: return to the sources rises.
      returnTempToSources = (secondaryM3s * secondaryReturnTemp + (primaryM3s - secondaryM3s) * primaryFlowTemp) / primaryM3s;
      if (primaryRatio > 1 + (plant.primaryMarginPct + 20) / 100) {
        warnings.push(`Primary flow is ${((primaryRatio - 1) * 100).toFixed(0)}% above secondary; return to the sources rises to about ${returnTempToSources.toFixed(1)} °C, which cuts condensing / heat pump efficiency.`);
      }
    }
    for (const c of plant.circuits) {
      if (c.flowTemp > secondaryFlowTempAtHeader + 0.5) warnings.push(`${c.name} needs ${c.flowTemp} °C but the header supplies about ${secondaryFlowTempAtHeader.toFixed(1)} °C.`);
    }
  }

  // Header body: low velocity for separation, and the common "3 × connection" rule.
  const headerFlowM3s = Math.max(primaryM3s, secondaryM3s);
  const headerIdForVelocityMm = plant.headerMaxVelocity > 0 ? Math.sqrt((4 * headerFlowM3s) / (Math.PI * plant.headerMaxVelocity)) * 1000 : 0;

  // Primary pipework between sources and header.
  const pMean = primaryFlowTemp - (plant.sources[0]?.deltaT ?? 20) / 2;
  const pSize = primaryM3s > 0 ? autoSize(plant.primaryMaterial, primaryM3s, fluid, pMean) : undefined;
  const pRes = pSize ? analysePipe({ sizeId: pSize.id, lengthM: plant.primaryLengthM, fittingsAllowancePct: plant.primaryFittingsPct, flowM3s: primaryM3s, fluid, meanTemp: pMean }) : null;
  if (primaryM3s > 0 && !pSize) warnings.push(`Primary flow is beyond the largest ${plant.primaryMaterial} size. Choose another material.`);

  const largestConnectionIdMm = Math.max(0, pSize?.id_mm ?? 0, ...circuits.map((c) => c.sizeIdMm ?? 0));
  const headerIdFor3dMm = 3 * largestConnectionIdMm;
  const headerIdRequiredMm = Math.max(headerIdForVelocityMm, headerIdFor3dMm);
  const headerSuggestion = headerIdRequiredMm > 0 ? (HEADER_SIZES.find((h) => h.idMm >= headerIdRequiredMm)?.label ?? 'Larger than DN250: use a manufactured header and its selection table') : null;

  return {
    circuits,
    connectedKw,
    diversifiedKw,
    installedKw,
    capacityMarginPct,
    secondaryM3s,
    primaryM3s,
    primaryRatio,
    secondaryReturnTemp,
    primaryFlowTemp,
    secondaryFlowTempAtHeader,
    returnTempToSources,
    headerFlowM3s,
    headerIdForVelocityMm,
    headerIdFor3dMm,
    headerIdRequiredMm,
    headerSuggestion,
    largestConnectionIdMm,
    primaryPipe: { sizeLabel: pSize?.label ?? null, velocity: pRes?.velocity ?? null, kpa: pRes ? pRes.pressureDropPa / 1000 : 0, idMm: pSize?.id_mm ?? null },
    warnings,
  };
}
