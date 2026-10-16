// Underfloor heating output for wet screed systems (BS EN 1264-2, type A),
// using the standard characteristic-curve method:
//   q = B · aB · aT^mT · aü^mü · aD^mD · ΔθH
// with tabulated factors interpolated. Results agree with manufacturer charts
// to within a few percent; final designs should still be checked against the
// chosen system supplier's data.

import { fluidState, flowForHeat, type FluidId } from './fluid';
import { pipeSize } from './pipes';

export interface FloorCovering {
  id: string;
  name: string;
  r: number; // m²K/W
}

export const FLOOR_COVERINGS: FloorCovering[] = [
  { id: 'none', name: 'Bare screed / polished', r: 0 },
  { id: 'tile', name: 'Ceramic / porcelain tile', r: 0.01 },
  { id: 'stone', name: 'Natural stone 20 mm', r: 0.01 },
  { id: 'vinyl', name: 'Vinyl / LVT', r: 0.025 },
  { id: 'laminate', name: 'Laminate 8 mm + underlay', r: 0.07 },
  { id: 'engineered', name: 'Engineered timber 15 mm', r: 0.1 },
  { id: 'carpet-thin', name: 'Thin carpet + underlay', r: 0.1 },
  { id: 'carpet', name: 'Carpet + underlay (max)', r: 0.15 },
];

export function covering(id: string): FloorCovering {
  return FLOOR_COVERINGS.find((c) => c.id === id) ?? FLOOR_COVERINGS[0];
}

const B0 = 6.7; // W/m²K, system constant for λR = 0.35, sR = 2 mm pipe
const ALPHA = 10.8; // W/m²K, surface heat transfer coefficient
const LAMBDA_U0 = 1.0;
const LAMBDA_SCREED = 1.2; // sand/cement

function lerp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  const i = xs.findIndex((v) => v >= x);
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + t * (ys[i] - ys[i - 1]);
}

const R_STEPS = [0, 0.05, 0.1, 0.15];
const A_T = [1.23, 1.188, 1.156, 1.134];
const T_STEPS = [0.05, 0.075, 0.1, 0.15, 0.2, 0.225, 0.3, 0.375];
const A_U: number[][] = [
  [1.069, 1.066, 1.063, 1.057, 1.051, 1.048, 1.04, 1.03],
  [1.056, 1.053, 1.05, 1.046, 1.041, 1.038, 1.031, 1.026],
  [1.043, 1.041, 1.039, 1.035, 1.032, 1.03, 1.024, 1.021],
  [1.037, 1.035, 1.033, 1.03, 1.028, 1.026, 1.021, 1.018],
];
const A_D: number[][] = [
  [1.013, 1.021, 1.029, 1.04, 1.046, 1.049, 1.053, 1.056],
  [1.013, 1.019, 1.025, 1.034, 1.04, 1.041, 1.043, 1.045],
  [1.012, 1.016, 1.022, 1.029, 1.035, 1.036, 1.04, 1.04],
  [1.011, 1.014, 1.018, 1.024, 1.03, 1.032, 1.034, 1.035],
];

function table2(tab: number[][], r: number, t: number): number {
  const byR = tab.map((row) => lerp(T_STEPS, row, t));
  return lerp(R_STEPS, byR, r);
}

/** Logarithmic mean heating medium differential, K. */
export function logMeanDt(flow: number, ret: number, room: number): number {
  const a = flow - room;
  const b = ret - room;
  if (a <= 0 || b <= 0) return 0;
  if (Math.abs(a - b) < 1e-6) return a;
  return (a - b) / Math.log(a / b);
}

export interface UfhInput {
  spacingMm: number;
  coveringR: number;
  screedCoverMm: number;
  pipeOdMm: number;
  flow: number;
  ret: number;
  room: number;
}

/** Heat flux density, W/m². */
export function ufhHeatFlux(i: UfhInput): number {
  const T = i.spacingMm / 1000;
  const su = i.screedCoverMm / 1000;
  const D = i.pipeOdMm / 1000;
  const r = Math.min(i.coveringR, 0.15);
  const aB = (1 / ALPHA + 0.045 / LAMBDA_U0) / (1 / ALPHA + su / LAMBDA_SCREED + i.coveringR);
  const aT = lerp(R_STEPS, A_T, r);
  const mT = 1 - T / 0.075;
  const aU = table2(A_U, r, T);
  const mU = 100 * (0.045 - su);
  const aD = table2(A_D, r, T);
  const mD = 250 * (D - 0.02);
  const dTH = logMeanDt(i.flow, i.ret, i.room);
  return B0 * aB * aT ** mT * aU ** mU * aD ** mD * dTH;
}

/** Mean floor surface temperature for a given heat flux (EN 1264 basic curve q = 8.92·Δθ^1.1). */
export function floorSurfaceTemp(q: number, room: number): number {
  if (q <= 0) return room;
  return room + (q / 8.92) ** (1 / 1.1);
}

export const MAX_SURFACE_TEMP = { occupied: 29, bathroom: 33, perimeter: 35 };

export interface UfhRoomInput {
  areaM2: number;
  activeAreaPct: number;
  spacingMm: number;
  coveringId: string;
  screedCoverMm: number;
  pipeSizeId: string;
  leadLengthM: number;
  maxLoopLengthM: number;
  flow: number;
  ret: number;
  room: number;
  requiredW: number;
  fluid: FluidId;
  isBathroom: boolean;
}

export interface UfhRoomResult {
  fluxWm2: number;
  outputW: number;
  surfaceTemp: number;
  maxSurfaceTemp: number;
  surfaceOk: boolean;
  coveragePct: number; // output / required
  pipeInRoomM: number;
  loops: number;
  loopLengthM: number;
  flowPerLoopLpm: number;
  totalFlowLpm: number;
}

export function designUfhRoom(i: UfhRoomInput): UfhRoomResult {
  const size = pipeSize(i.pipeSizeId);
  const od = size?.od ?? 16;
  const flux = ufhHeatFlux({
    spacingMm: i.spacingMm,
    coveringR: covering(i.coveringId).r,
    screedCoverMm: i.screedCoverMm,
    pipeOdMm: od,
    flow: i.flow,
    ret: i.ret,
    room: i.room,
  });
  const active = (i.areaM2 * i.activeAreaPct) / 100;
  const outputW = flux * active;
  const surfaceTemp = floorSurfaceTemp(flux, i.room);
  const maxSurfaceTemp = i.isBathroom ? MAX_SURFACE_TEMP.bathroom : MAX_SURFACE_TEMP.occupied;
  const pipeInRoomM = active / (i.spacingMm / 1000);
  // Split into equal loops so each stays under the max length including leads.
  let loops = Math.max(1, Math.ceil((pipeInRoomM + 2 * i.leadLengthM) / i.maxLoopLengthM));
  while (loops < 20 && pipeInRoomM / loops + 2 * i.leadLengthM > i.maxLoopLengthM) loops++;
  const loopLengthM = pipeInRoomM / loops + 2 * i.leadLengthM;
  const fs = fluidState(i.fluid, (i.flow + i.ret) / 2);
  const totalFlowLpm = flowForHeat(outputW, i.flow - i.ret, fs) * 60000;
  return {
    fluxWm2: flux,
    outputW,
    surfaceTemp,
    maxSurfaceTemp,
    surfaceOk: surfaceTemp <= maxSurfaceTemp,
    coveragePct: i.requiredW > 0 ? (outputW / i.requiredW) * 100 : 0,
    pipeInRoomM,
    loops,
    loopLengthM,
    flowPerLoopLpm: totalFlowLpm / loops,
    totalFlowLpm,
  };
}
