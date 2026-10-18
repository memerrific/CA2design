// Ground floor U-value from floor area and exposed perimeter, BS EN ISO 13370,
// with the parameters RdSAP 10 (June 2025) §5.12 uses:
//   soil λg = 1.5 W/m·K (clay), Rsi = 0.17, Rse = 0.04 m²K/W,
//   floor insulation λ = 0.035 W/m·K.
// Suspended floors: h = 0.3 m, v = 5 m/s, fw = 0.05, ε = 0.003 m²/m, Uw = 1.5 W/m²K,
//   deck resistance 0.2 m²K/W (+ insulation if present).

export type GroundFloorKind = 'solid' | 'suspended';

export interface GroundFloorInput {
  kind: GroundFloorKind;
  areaM2: number; // whole ground floor area (of the building part)
  exposedPerimeterM: number; // perimeter next to outside / unheated space
  wallThicknessMm: number;
  insulationMm: number; // all-over insulation, 0 if none
  insulationLambda?: number; // W/m·K, default 0.035
  soilLambda?: number; // W/m·K, default 1.5 (clay)
}

const RSI = 0.17;
const RSE = 0.04;

export function groundFloorU(i: GroundFloorInput): number {
  if (i.areaM2 <= 0 || i.exposedPerimeterM <= 0) return 0;
  const lg = i.soilLambda ?? 1.5;
  const w = i.wallThicknessMm / 1000;
  const rIns = i.insulationMm > 0 ? i.insulationMm / 1000 / (i.insulationLambda ?? 0.035) : 0;
  const B = (2 * i.areaM2) / i.exposedPerimeterM;

  if (i.kind === 'solid') {
    const dt = w + lg * (RSI + rIns + RSE);
    return dt < B ? ((2 * lg) / (Math.PI * B + dt)) * Math.log((Math.PI * B) / dt + 1) : lg / (0.457 * B + dt);
  }

  const h = 0.3;
  const v = 5;
  const fw = 0.05;
  const eps = 0.003;
  const uw = 1.5;
  const rf = 0.2 + rIns;
  const dg = w + lg * (RSI + RSE);
  const ug = ((2 * lg) / (Math.PI * B + dg)) * Math.log((Math.PI * B) / dg + 1);
  const ux = (2 * h * uw) / B + (1450 * eps * v * fw) / B;
  return 1 / (2 * RSI + rf + 1 / (ug + ux));
}

export const round2 = (v: number) => Math.round(v * 100) / 100;
