// Domestic hot water: cylinder sizing, coil / reheat performance, heat source
// DHW priority and legionella pasteurisation.
//
// Everything here is an energy balance on water with constant properties
// (ρ = 1 kg/L, cp = 4.186 kJ/kg·K → 1.163 Wh per litre per kelvin). The
// cylinder is treated as well mixed for reheat (no stratification), and coils
// use a single UA value calibrated from the data badge. Treat the results as
// design guidance; the manufacturer's data and MCS guidance take precedence.

// ---------------------------------------------------------------------------
// Constants and basic water energy
// ---------------------------------------------------------------------------

/** Nominal density used for DHW energy sums, kg/L. (0.988 at 50 °C — ~1% high.) */
export const DHW_RHO_KG_PER_L = 1.0;
/** Specific heat of water, J/kg·K. */
export const DHW_CP_J_PER_KG_K = 4186;
/** Energy per litre per kelvin, Wh/(L·K) ≈ 1.163. */
export const WH_PER_L_K = (DHW_RHO_KG_PER_L * DHW_CP_J_PER_KG_K) / 3600;

export const DEFAULT_COLD_FEED_C = 10;
export const DEFAULT_DELIVERY_C = 40;
/** HSE: store at ≥ 60 °C (HSG274 Part 2). */
export const PASTEURISATION_C = 60;

/** Standard UK cylinder capacities, litres. */
export const STANDARD_CYLINDER_SIZES_L = [90, 120, 150, 170, 180, 200, 210, 250, 300, 350, 400, 500];

/** Energy (kWh) to heat `litres` from `fromC` to `toC`: V·ρ·cp·ΔT. Negative ΔT gives 0. */
export function waterEnergyKWh(litres: number, fromC: number, toC: number): number {
  const dT = toC - fromC;
  if (litres <= 0 || dT <= 0) return 0;
  return (litres * WH_PER_L_K * dT) / 1000;
}

/** Average kW needed to deliver `energyKWh` in `minutes`. */
export function kwForReheat(energyKWh: number, minutes: number): number {
  if (minutes <= 0) return Infinity;
  return energyKWh / (minutes / 60);
}

/** Minutes to deliver `energyKWh` at a constant `kw`. Inverse of kwForReheat. */
export function minutesForReheat(energyKWh: number, kw: number): number {
  if (kw <= 0) return Infinity;
  return (energyKWh / kw) * 60;
}

// ---------------------------------------------------------------------------
// Mixing
// ---------------------------------------------------------------------------

/**
 * Fraction of a mixed draw-off that comes from the store:
 * f = (Tmix − Tcold) / (Thot − Tcold). Returns 1 if the store is not hotter
 * than the delivery temperature (the store cannot meet it; flagged by callers).
 */
export function hotFraction(storeC: number, mixC = DEFAULT_DELIVERY_C, coldC = DEFAULT_COLD_FEED_C): number {
  if (storeC <= coldC) return 1;
  const f = (mixC - coldC) / (storeC - coldC);
  return Math.min(1, Math.max(0, f));
}

/** Litres of stored water at `storeC` needed for `mixedL` at `mixC`. */
export function hotLitresForMixed(mixedL: number, storeC: number, mixC = DEFAULT_DELIVERY_C, coldC = DEFAULT_COLD_FEED_C): number {
  return mixedL * hotFraction(storeC, mixC, coldC);
}

/** Litres at `mixC` obtainable from `hotL` of stored water at `storeC`. */
export function mixedLitresFromHot(hotL: number, storeC: number, mixC = DEFAULT_DELIVERY_C, coldC = DEFAULT_COLD_FEED_C): number {
  const f = hotFraction(storeC, mixC, coldC);
  return f > 0 ? hotL / f : 0;
}

/** Volume at `toC` holding the same energy above cold feed as `litres` at `fromC`. */
export function equivalentVolumeL(litres: number, fromC: number, toC: number, coldC = DEFAULT_COLD_FEED_C): number {
  if (toC <= coldC) return Infinity;
  return (litres * (fromC - coldC)) / (toC - coldC);
}

// ---------------------------------------------------------------------------
// Demand sizing
// ---------------------------------------------------------------------------

export type ShowerType = 'electric' | 'eco' | 'mixer' | 'thermostatic' | 'power' | 'rainfall' | 'custom';

export const SHOWER_PRESETS: Record<ShowerType, { name: string; flowLpm: number; fromStore: boolean }> = {
  electric: { name: 'Electric (cold-fed, no stored hot water)', flowLpm: 7, fromStore: false },
  eco: { name: 'Eco / flow-limited mixer', flowLpm: 8, fromStore: true },
  mixer: { name: 'Mixer shower (unvented)', flowLpm: 10, fromStore: true },
  thermostatic: { name: 'Thermostatic bar mixer', flowLpm: 11, fromStore: true },
  power: { name: 'Pumped / power shower', flowLpm: 13, fromStore: true },
  rainfall: { name: 'Rainfall / large head', flowLpm: 16, fromStore: true },
  custom: { name: 'Custom', flowLpm: 10, fromStore: true },
};

export interface ShowerSpec {
  type: ShowerType;
  flowLpm?: number; // mixed flow at the head, overrides preset
  minutes?: number; // per shower, overrides input default
}

export interface BathSpec {
  litres: number; // fill volume at delivery temperature (typically 80–150 L)
}

export type UsagePattern = 'low' | 'normal' | 'high';
export type DhwHeatSource = 'boiler' | 'heatPump' | 'immersion';

export interface DhwDemandInput {
  occupants: number;
  bedrooms?: number;
  bathrooms?: number;
  showers: ShowerSpec[];
  baths: BathSpec[];
  usagePattern: UsagePattern;
  heatSource: DhwHeatSource;
  storageTempC: number;
  coldFeedC?: number; // default 10
  deliveryTempC?: number; // default 40
  showerMinutes?: number; // default 8
  peakShowers?: number; // override number of showers in the peak window
  peakBaths?: number; // override number of baths in the peak window
  otherDrawPerPersonL?: number; // basins/kitchen in the peak, litres at delivery temp; default 8
  peakWindowMinutes?: number; // default 60
  reheatKwDuringPeak?: number; // heat input credited during the peak; default 0 (conservative)
  usableFraction?: number; // share of the store usable before outlet temp drops; default 0.8
  simultaneousShowers?: number; // for the concurrent draw check; default min(bathrooms, showers)
  simultaneousMinutes?: number; // default = showerMinutes
}

export interface DemandLine {
  label: string;
  mixedL: number; // at delivery temperature
  hotL: number; // drawn from the store at storage temperature
}

export interface PeakDeliveryResult {
  showers: number;
  mixedFlowLpm: number;
  hotFlowLpm: number;
  minutes: number;
  hotL: number;
  usableL: number;
  minutesAvailable: number;
  ok: boolean;
}

export interface DhwDemandResult {
  hotFraction: number;
  lines: DemandLine[];
  peakMixedL: number;
  peakHotL: number;
  reheatCreditL: number;
  peakMethodL: number; // stored volume from the peak-period method
  perPersonMethodL: number; // stored volume from the litres-per-person rule
  bathroomGuideL: number | null; // rough bathroom-count guide, stored volume
  requiredStoredL: number; // max(peak, per person)
  recommendedSizeL: number; // next standard size up
  simultaneous: PeakDeliveryResult;
  warnings: string[];
}

/** Litres per person at a 60 °C reference (BS 6700 practice as reported: 45 L, no rapid reheat). */
export const LITRES_PER_PERSON_60C: Record<DhwHeatSource, number> = {
  boiler: 45,
  heatPump: 45, // same energy, but a lower store temp turns it into more litres (≈56 L at 50 °C)
  immersion: 45,
};

export const USAGE_FACTOR: Record<UsagePattern, number> = { low: 0.8, normal: 1, high: 1.25 };

/** Rough bathroom-count guide, litres at 60 °C. Approximate manufacturer guide figures. */
export function bathroomGuideL60(bathrooms: number): number | null {
  if (!bathrooms || bathrooms <= 0) return null;
  if (bathrooms <= 1) return 150;
  if (bathrooms <= 2) return 210;
  if (bathrooms <= 3) return 300;
  return 300 + (bathrooms - 3) * 75;
}

export function nextStandardSize(litres: number): number {
  for (const s of STANDARD_CYLINDER_SIZES_L) if (s >= litres - 1e-9) return s;
  return Math.ceil(litres / 50) * 50;
}

function showerFlow(s: ShowerSpec): number {
  const p = SHOWER_PRESETS[s.type] ?? SHOWER_PRESETS.custom;
  return p.fromStore ? (s.flowLpm ?? p.flowLpm) : 0;
}

/**
 * Can a cylinder support `flowsLpm` showers at once for `minutes`?
 * Hot needed = Σflow × minutes × f. Usable = V × usableFraction (+ reheat during the draw).
 */
export function peakDeliveryCheck(p: {
  cylinderL: number;
  storageTempC: number;
  flowsLpm: number[];
  minutes: number;
  coldFeedC?: number;
  deliveryTempC?: number;
  usableFraction?: number;
  reheatKw?: number;
}): PeakDeliveryResult {
  const cold = p.coldFeedC ?? DEFAULT_COLD_FEED_C;
  const mix = p.deliveryTempC ?? DEFAULT_DELIVERY_C;
  const f = hotFraction(p.storageTempC, mix, cold);
  const mixedFlow = p.flowsLpm.reduce((a, b) => a + b, 0);
  const hotFlow = mixedFlow * f;
  // Reheat input expressed as litres/min of store-temperature water.
  const dTstore = Math.max(1e-6, p.storageTempC - cold);
  const reheatLpm = ((p.reheatKw ?? 0) * 1000 * 60) / (WH_PER_L_K * 3600 * dTstore);
  const usableL = p.cylinderL * (p.usableFraction ?? 0.8);
  const hotL = hotFlow * p.minutes;
  const netDraw = hotFlow - reheatLpm;
  const minutesAvailable = netDraw <= 0 ? Infinity : usableL / netDraw;
  return {
    showers: p.flowsLpm.length,
    mixedFlowLpm: mixedFlow,
    hotFlowLpm: hotFlow,
    minutes: p.minutes,
    hotL,
    usableL,
    minutesAvailable,
    ok: minutesAvailable >= p.minutes,
  };
}

/**
 * Size a cylinder from the household's peak-period demand and a litres-per-person
 * check; take the larger and round up to a standard size.
 */
export function sizeCylinder(input: DhwDemandInput): DhwDemandResult {
  const cold = input.coldFeedC ?? DEFAULT_COLD_FEED_C;
  const mix = input.deliveryTempC ?? DEFAULT_DELIVERY_C;
  const Ts = input.storageTempC;
  const occ = Math.max(0, input.occupants);
  const showerMin = input.showerMinutes ?? 8;
  const usable = input.usableFraction ?? 0.8;
  const window = input.peakWindowMinutes ?? 60;
  const warnings: string[] = [];
  const f = hotFraction(Ts, mix, cold);

  if (Ts <= mix) warnings.push(`Storage ${Ts} °C cannot deliver ${mix} °C at the outlet.`);
  if (Ts < PASTEURISATION_C)
    warnings.push(`Stored below ${PASTEURISATION_C} °C — plan a periodic pasteurisation cycle (HSE HSG274 Part 2).`);

  const showers = input.showers.length ? input.showers : [{ type: 'mixer' as ShowerType }];
  const nShowers = input.peakShowers ?? (input.usagePattern === 'low' ? Math.ceil(occ / 2) : occ);
  const nBaths = input.peakBaths ?? (input.usagePattern === 'high' ? Math.min(1, input.baths.length) : 0);

  const lines: DemandLine[] = [];
  for (let i = 0; i < nShowers; i++) {
    const s = showers[i % showers.length];
    const mins = s.minutes ?? showerMin;
    const mixedL = showerFlow(s) * mins;
    lines.push({ label: `Shower ${i + 1} (${SHOWER_PRESETS[s.type]?.name ?? s.type}, ${mins} min)`, mixedL, hotL: mixedL * f });
  }
  for (let i = 0; i < nBaths; i++) {
    const b = input.baths[i % Math.max(1, input.baths.length)] ?? { litres: 100 };
    lines.push({ label: `Bath ${i + 1} (${b.litres} L)`, mixedL: b.litres, hotL: b.litres * f });
  }
  const other = (input.otherDrawPerPersonL ?? 8) * occ;
  if (other > 0) lines.push({ label: 'Basins / kitchen', mixedL: other, hotL: other * f });

  const peakMixedL = lines.reduce((a, l) => a + l.mixedL, 0);
  const peakHotL = lines.reduce((a, l) => a + l.hotL, 0);
  const reheatCreditL =
    Ts > cold ? ((input.reheatKwDuringPeak ?? 0) * 1000 * (window / 60)) / (WH_PER_L_K * (Ts - cold)) : 0;
  const peakMethodL = Math.max(0, peakHotL - reheatCreditL) / usable;

  const perPersonMethodL =
    equivalentVolumeL(LITRES_PER_PERSON_60C[input.heatSource] * USAGE_FACTOR[input.usagePattern], 60, Ts, cold) * occ;

  const g60 = bathroomGuideL60(input.bathrooms ?? 0);
  const bathroomGuideL = g60 == null ? null : equivalentVolumeL(g60, 60, Ts, cold);

  const requiredStoredL = Math.max(peakMethodL, perPersonMethodL);
  const recommendedSizeL = nextStandardSize(requiredStoredL);
  if (bathroomGuideL != null && bathroomGuideL > recommendedSizeL)
    warnings.push(`Bathroom-count guide suggests about ${Math.round(bathroomGuideL)} L at ${Ts} °C — check simultaneous use.`);
  if (input.bedrooms && occ < input.bedrooms)
    warnings.push('Fewer occupants than bedrooms — consider sizing for future occupancy (bedrooms + 1).');

  const storeShowers = showers.filter((s) => showerFlow(s) > 0);
  const nSim = input.simultaneousShowers ?? Math.max(1, Math.min(input.bathrooms ?? 1, storeShowers.length || 1));
  const simFlows = Array.from({ length: nSim }, (_, i) => showerFlow(storeShowers.length ? storeShowers[i % storeShowers.length] : { type: 'mixer' }));
  const simultaneous = peakDeliveryCheck({
    cylinderL: recommendedSizeL,
    storageTempC: Ts,
    flowsLpm: simFlows,
    minutes: input.simultaneousMinutes ?? showerMin,
    coldFeedC: cold,
    deliveryTempC: mix,
    usableFraction: usable,
    reheatKw: input.reheatKwDuringPeak,
  });
  if (!simultaneous.ok)
    warnings.push(`${nSim} simultaneous showers run the store out in ${simultaneous.minutesAvailable.toFixed(1)} min.`);
  if (simultaneous.mixedFlowLpm > 0)
    warnings.push(`Peak simultaneous flow ${simultaneous.mixedFlowLpm.toFixed(0)} l/min at the outlets — check mains flow and pressure (unvented).`);

  return {
    hotFraction: f,
    lines,
    peakMixedL,
    peakHotL,
    reheatCreditL,
    peakMethodL,
    perPersonMethodL,
    bathroomGuideL,
    requiredStoredL,
    recommendedSizeL,
    simultaneous,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Coil model: UA calibrated from the badge rating (LMTD ≡ ε-NTU with a
// uniform-temperature store)
// ---------------------------------------------------------------------------

export interface CoilRating {
  ratedKw: number;
  primaryFlowC?: number; // default 80 (BS EN 12897 rating basis)
  primaryFlowLpm?: number; // default 15
  /** Store temperature the rating corresponds to. Not on badges; default 37.5 °C = mean of a 15→60 °C test. */
  storeTempC?: number;
}

/** Log-mean temperature difference between a coil (in → out) and a store at uniform temperature. */
export function lmtd(primaryInC: number, primaryOutC: number, storeC: number): number {
  const a = primaryInC - storeC;
  const b = primaryOutC - storeC;
  if (a <= 0 || b <= 0) return 0;
  if (Math.abs(a - b) < 1e-9) return a;
  return (a - b) / Math.log(a / b);
}

/** Primary capacity rate ṁ·cp, W/K, for a flow in l/min. */
export function capacityRateWK(flowLpm: number): number {
  return ((flowLpm / 60) * DHW_RHO_KG_PER_L) * DHW_CP_J_PER_KG_K;
}

export interface CoilUAResult {
  uaWK: number;
  primaryReturnC: number;
  lmtdK: number;
  storeTempC: number;
  valid: boolean;
}

/** UA = P_rated / LMTD_rated. */
export function coilUA(r: CoilRating): CoilUAResult {
  const tIn = r.primaryFlowC ?? 80;
  const flow = r.primaryFlowLpm ?? 15;
  const tStore = r.storeTempC ?? 37.5;
  const C = capacityRateWK(flow);
  const tOut = tIn - (r.ratedKw * 1000) / C;
  const L = lmtd(tIn, tOut, tStore);
  const valid = L > 0 && tOut > tStore;
  return { uaWK: valid ? (r.ratedKw * 1000) / L : 0, primaryReturnC: tOut, lmtdK: L, storeTempC: tStore, valid };
}

export interface CoilOutput {
  kw: number;
  primaryReturnC: number;
  effectiveness: number;
  lmtdK: number;
}

/**
 * Coil output at new conditions: P = UA × LMTD. With the store at uniform
 * temperature this is P = ṁcp·ε·(Tin − Tstore), ε = 1 − exp(−UA/ṁcp).
 */
export function coilOutput(uaWK: number, primaryFlowC: number, primaryFlowLpm: number, storeC: number): CoilOutput {
  const C = capacityRateWK(primaryFlowLpm);
  if (uaWK <= 0 || C <= 0 || primaryFlowC <= storeC) return { kw: 0, primaryReturnC: primaryFlowC, effectiveness: 0, lmtdK: 0 };
  const eps = 1 - Math.exp(-uaWK / C);
  const w = C * eps * (primaryFlowC - storeC);
  const tOut = primaryFlowC - w / C;
  return { kw: w / 1000, primaryReturnC: tOut, effectiveness: eps, lmtdK: lmtd(primaryFlowC, tOut, storeC) };
}

export interface CoilReheatInput {
  uaWK: number;
  primaryFlowC: number; // max flow temp the source will run to
  primaryFlowLpm: number;
  volumeL: number;
  fromC: number;
  toC: number;
  sourceMaxKw?: number; // heat source output cap (e.g. heat pump capacity at that flow temp)
}

export interface CoilReheatResult {
  minutes: number;
  energyKWh: number;
  averageKw: number;
  startKw: number;
  endKw: number;
  sourceLimitedMinutes: number; // time the source cap rather than the coil limited output
  reachable: boolean;
}

/**
 * Reheat time with a coil whose output falls as the store warms. Well-mixed store,
 * heat capacity Cs = V·ρ·cp:
 *  - source-limited while ṁcp·ε·(Tp − T) > Pmax:   t = Cs·ΔT / Pmax
 *  - coil-limited above that:   t = Cs / (ṁcp·ε) · ln((Tp − Ta) / (Tp − Tb))
 * Unreachable if toC ≥ primary flow temperature.
 */
export function coilReheat(p: CoilReheatInput): CoilReheatResult {
  const energyKWh = waterEnergyKWh(p.volumeL, p.fromC, p.toC);
  const k = capacityRateWK(p.primaryFlowLpm) * (1 - Math.exp(-p.uaWK / Math.max(1e-9, capacityRateWK(p.primaryFlowLpm))));
  const Cs = p.volumeL * DHW_RHO_KG_PER_L * DHW_CP_J_PER_KG_K;
  const pmax = p.sourceMaxKw && p.sourceMaxKw > 0 ? p.sourceMaxKw * 1000 : Infinity;
  const Tp = p.primaryFlowC;
  const outW = (T: number) => Math.min(pmax, k * Math.max(0, Tp - T));
  if (energyKWh === 0) return { minutes: 0, energyKWh, averageKw: 0, startKw: outW(p.fromC) / 1000, endKw: outW(p.toC) / 1000, sourceLimitedMinutes: 0, reachable: true };
  if (p.toC >= Tp || k <= 0)
    return { minutes: Infinity, energyKWh, averageKw: 0, startKw: outW(p.fromC) / 1000, endKw: 0, sourceLimitedMinutes: 0, reachable: false };

  const Tsw = pmax === Infinity ? -Infinity : Tp - pmax / k;
  let t = 0;
  let tSrc = 0;
  let Ta = p.fromC;
  if (Ta < Tsw) {
    const Tb = Math.min(Tsw, p.toC);
    tSrc = (Cs * (Tb - Ta)) / pmax;
    t += tSrc;
    Ta = Tb;
  }
  if (Ta < p.toC) t += (Cs / k) * Math.log((Tp - Ta) / (Tp - p.toC));
  const minutes = t / 60;
  return {
    minutes,
    energyKWh,
    averageKw: kwForReheat(energyKWh, minutes),
    startKw: outW(p.fromC) / 1000,
    endKw: outW(p.toC) / 1000,
    sourceLimitedMinutes: tSrc / 60,
    reachable: true,
  };
}

/**
 * Calibrate UA from a badge reheat time instead of the kW rating (same well-mixed
 * model, no source cap): ε = Cs·ln((Tp − T0)/(Tp − T1)) / (ṁcp·t), UA = −ṁcp·ln(1 − ε).
 * Returns 0 if the time is impossibly short for the stated flow (ε ≥ 1).
 */
export function uaFromReheatTime(p: {
  volumeL: number;
  minutes: number;
  fromC?: number;
  toC?: number;
  primaryFlowC?: number;
  primaryFlowLpm?: number;
}): number {
  const T0 = p.fromC ?? 15;
  const T1 = p.toC ?? 60;
  const Tp = p.primaryFlowC ?? 80;
  const C = capacityRateWK(p.primaryFlowLpm ?? 15);
  if (p.minutes <= 0 || T1 >= Tp || C <= 0) return 0;
  const Cs = p.volumeL * DHW_RHO_KG_PER_L * DHW_CP_J_PER_KG_K;
  const eps = (Cs * Math.log((Tp - T0) / (Tp - T1))) / (C * p.minutes * 60);
  if (eps >= 1 || eps <= 0) return 0;
  return -C * Math.log(1 - eps);
}

/**
 * Crude alternative: scale the badge kW by temperature difference,
 * P ≈ P_rated × (Tp_new − Tstore) / (Tp_rated − Tstore). Kept for comparison;
 * coilUA/coilOutput is preferred.
 */
export function coilDerateLinear(ratedKw: number, ratedPrimaryC: number, newPrimaryC: number, storeC: number): number {
  if (ratedPrimaryC <= storeC || newPrimaryC <= storeC) return 0;
  return (ratedKw * (newPrimaryC - storeC)) / (ratedPrimaryC - storeC);
}

// ---------------------------------------------------------------------------
// Standing loss and ErP
// ---------------------------------------------------------------------------

/** Standing-loss test basis: store 65 °C, ambient 20 °C (ΔT 45 K), per BS EN 12897 / ErP practice. */
export const STANDING_LOSS_TEST_DT = 45;

export const kwhPer24hToW = (kwh: number) => (kwh * 1000) / 24;
export const wToKwhPer24h = (w: number) => (w * 24) / 1000;

/** Scale a rated standing loss (W at ΔT 45 K) to another store/ambient temperature. */
export function standingLossAtW(ratedW: number, storeC: number, ambientC = 20): number {
  return Math.max(0, (ratedW * (storeC - ambientC)) / STANDING_LOSS_TEST_DT);
}

export type ErpClass = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** ErP hot water storage tank class from standing loss S (W) and volume V (L), Reg. (EU) 812/2013 Annex II. */
export function erpClassFromLoss(standingLossW: number, volumeL: number): ErpClass {
  const v = Math.pow(volumeL, 0.4);
  const bands: [ErpClass, number, number][] = [
    ['A+', 5.5, 3.16],
    ['A', 8.5, 4.25],
    ['B', 12, 5.93],
    ['C', 16.66, 8.33],
    ['D', 21, 10.33],
    ['E', 26, 13.66],
    ['F', 31, 16.66],
  ];
  for (const [c, a, b] of bands) if (standingLossW < a + b * v) return c;
  return 'G';
}

// ---------------------------------------------------------------------------
// Data badge
// ---------------------------------------------------------------------------

/** Fields found on a UK unvented / heat pump cylinder data badge or datasheet. All optional. */
export interface CylinderBadge {
  manufacturer?: string;
  model?: string;
  serial?: string;
  capacityL?: number; // nominal storage capacity
  v40L?: number; // mixed water at 40 °C available (BS EN 16147 / ErP)
  coilAreaM2?: number; // primary (heat pump / boiler) coil surface area
  coilRatingKw?: number; // coil output at stated conditions
  coilRatedPrimaryFlowC?: number; // usually 80 °C
  coilRatedPrimaryFlowLpm?: number; // usually 15 l/min
  coilPressureLossKpa?: number; // primary side pressure drop at rated flow
  secondCoilAreaM2?: number; // solar / twin coil
  reheatMinutes?: number; // badge reheat (recovery) time
  reheatFromC?: number; // default 15
  reheatToC?: number; // default 60
  heatLossKwhPer24h?: number; // standing loss
  heatLossW?: number; // standing loss in watts (ErP label)
  erpClass?: ErpClass | string;
  immersionKw?: number; // usually 3 kW
  maxWorkingPressureBar?: number; // pressure reducing valve setting / operating pressure
  maxPrimaryPressureBar?: number; // coil max pressure
  maxInletPressureBar?: number; // max mains supply
  expansionRelief?: { bar?: number }; // expansion relief valve setting
  tpRelief?: { tempC?: number; bar?: number }; // T&P valve (e.g. 90 °C / 7 bar)
  expansionVesselL?: number;
  expansionVesselPrechargeBar?: number;
  weightFullKg?: number;
}

export interface BadgeDeriveOptions {
  storageTempC: number;
  coldFeedC?: number;
  ambientC?: number;
  primaryFlowC?: number; // the system's actual primary flow temp, e.g. 55 for a heat pump
  primaryFlowLpm?: number; // actual primary flow, defaults to badge rated flow
  sourceMaxKw?: number;
  coilRatingStoreTempC?: number; // assumed store temp behind the badge rating (default 37.5)
}

export interface BadgeDerived {
  energyContentKWh?: number; // cold feed → storage temp, full volume
  usableEnergyKWh?: number; // × 0.8 usable fraction (or from V40 when given)
  mixed40L?: number; // litres at 40 °C (from V40 if given, else 0.8 × V mixed)
  standingLossRatedW?: number;
  standingLossKwhPer24h?: number;
  standingLossAtStorageW?: number;
  erpClassFromLoss?: ErpClass;
  impliedReheatKw?: number; // badge reheat energy ÷ badge reheat time
  coilUAWK?: number; // from kW rating
  coilUAFromReheatWK?: number; // from badge reheat time
  coilWPerM2K?: number; // UA / area
  coilKwAtRated?: number; // check: should equal the badge kW
  coilKwAtSystem?: number; // at actual primary flow temp, store at (storage temp − 5)
  reheatAtSystem?: CoilReheatResult; // cold → storage temp at actual primary
  warnings: string[];
}

/** Work out what a badge implies. Fields are filled only where the inputs allow. */
export function deriveFromBadge(b: CylinderBadge, o: BadgeDeriveOptions): BadgeDerived {
  const cold = o.coldFeedC ?? DEFAULT_COLD_FEED_C;
  const amb = o.ambientC ?? 20;
  const out: BadgeDerived = { warnings: [] };
  const V = b.capacityL;

  if (V) {
    out.energyContentKWh = waterEnergyKWh(V, cold, o.storageTempC);
    out.usableEnergyKWh = out.energyContentKWh * 0.8;
    out.mixed40L = b.v40L ?? mixedLitresFromHot(V * 0.8, o.storageTempC, DEFAULT_DELIVERY_C, cold);
    if (b.v40L) out.warnings.push('V40 is measured at the test store temperature — it will be lower at a reduced storage temperature.');
  }

  const lossW = b.heatLossW ?? (b.heatLossKwhPer24h != null ? kwhPer24hToW(b.heatLossKwhPer24h) : undefined);
  if (lossW != null) {
    out.standingLossRatedW = lossW;
    out.standingLossKwhPer24h = wToKwhPer24h(lossW);
    out.standingLossAtStorageW = standingLossAtW(lossW, o.storageTempC, amb);
    if (V) out.erpClassFromLoss = erpClassFromLoss(lossW, V);
    if (b.erpClass && out.erpClassFromLoss && b.erpClass !== out.erpClassFromLoss)
      out.warnings.push(`Badge ErP class ${b.erpClass} differs from class ${out.erpClassFromLoss} implied by the stated loss.`);
  }

  const ratedC = b.coilRatedPrimaryFlowC ?? 80;
  const ratedLpm = b.coilRatedPrimaryFlowLpm ?? 15;
  const from = b.reheatFromC ?? 15;
  const to = b.reheatToC ?? 60;

  if (V && b.reheatMinutes) {
    out.impliedReheatKw = kwForReheat(waterEnergyKWh(V, from, to), b.reheatMinutes);
    const ua = uaFromReheatTime({ volumeL: V, minutes: b.reheatMinutes, fromC: from, toC: to, primaryFlowC: ratedC, primaryFlowLpm: ratedLpm });
    if (ua > 0) out.coilUAFromReheatWK = ua;
  }

  if (b.coilRatingKw) {
    const r = coilUA({ ratedKw: b.coilRatingKw, primaryFlowC: ratedC, primaryFlowLpm: ratedLpm, storeTempC: o.coilRatingStoreTempC });
    if (!r.valid) out.warnings.push('Coil rating is not consistent with the stated primary flow and temperature (return would be below store).');
    else {
      out.coilUAWK = r.uaWK;
      out.coilKwAtRated = coilOutput(r.uaWK, ratedC, ratedLpm, r.storeTempC).kw;
      if (b.coilAreaM2) out.coilWPerM2K = r.uaWK / b.coilAreaM2;
    }
  }
  if (!b.coilRatingKw && b.coilAreaM2) out.warnings.push('No coil kW rating — UA cannot be calibrated; area alone is only a rough guide.');

  const ua = out.coilUAWK ?? out.coilUAFromReheatWK;
  if (ua && o.primaryFlowC != null) {
    const lpm = o.primaryFlowLpm ?? ratedLpm;
    out.coilKwAtSystem = coilOutput(ua, o.primaryFlowC, lpm, o.storageTempC - 5).kw;
    if (V)
      out.reheatAtSystem = coilReheat({
        uaWK: ua,
        primaryFlowC: o.primaryFlowC,
        primaryFlowLpm: lpm,
        volumeL: V,
        fromC: cold,
        toC: o.storageTempC,
        sourceMaxKw: o.sourceMaxKw,
      });
    if (o.primaryFlowC - o.storageTempC < 5)
      out.warnings.push('Primary flow is less than 5 K above storage temperature — reheat will be very slow.');
    out.warnings.push('Coil output at other primary temperatures is an approximation from a single UA calibrated on the badge rating.');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Heat source sizing for DHW priority
// ---------------------------------------------------------------------------

export interface DhwPriorityInput {
  volumeL: number;
  fromC: number; // usually cold feed (worst case) or the post-peak store temp
  toC: number;
  targetReheatMinutes: number;
  standingLossW?: number; // at storage temp, added during the reheat
  sourceKw?: number; // actual heat source output, to work out actual reheat time
  coil?: { uaWK: number; primaryFlowC: number; primaryFlowLpm: number }; // limit by coil if given
  spaceHeatingLoadKw?: number; // design (or current) space heating demand
  reheatsPerDay?: number; // default 2
}

export interface DhwPriorityResult {
  energyKWh: number;
  minSourceKw: number; // to meet the target reheat time (no coil limit)
  coilCanMeetTarget: boolean | null;
  actualReheatMinutes: number | null;
  minutesAwayPerDay: number | null;
  fractionOfDay: number | null;
  heatingKWhDeferred: number | null;
  catchUpExtraKw: number | null; // extra kW over the rest of the day to make up the deferral
  warnings: string[];
}

export function dhwPriority(p: DhwPriorityInput): DhwPriorityResult {
  const warnings: string[] = [];
  const energyKWh = waterEnergyKWh(p.volumeL, p.fromC, p.toC);
  const lossKw = (p.standingLossW ?? 0) / 1000;
  const minSourceKw = kwForReheat(energyKWh, p.targetReheatMinutes) + lossKw;

  let actual: number | null = null;
  let coilCanMeetTarget: boolean | null = null;
  if (p.coil) {
    const r = coilReheat({ ...p.coil, volumeL: p.volumeL, fromC: p.fromC, toC: p.toC, sourceMaxKw: p.sourceKw });
    actual = r.minutes;
    coilCanMeetTarget = r.minutes <= p.targetReheatMinutes;
    if (!r.reachable) warnings.push('Target store temperature is not reachable at this primary flow temperature.');
    else if (r.sourceLimitedMinutes < r.minutes * 0.5)
      warnings.push('Reheat is mostly coil-limited: a bigger heat source will not shorten it much — a larger coil or higher flow temp will.');
  } else if (p.sourceKw) {
    actual = minutesForReheat(energyKWh, Math.max(1e-9, p.sourceKw - lossKw));
  }
  if (lossKw > 0 && p.coil) warnings.push('Standing loss is not included in the coil reheat time.');

  let minutesAwayPerDay: number | null = null;
  let fractionOfDay: number | null = null;
  let heatingKWhDeferred: number | null = null;
  let catchUpExtraKw: number | null = null;
  if (actual != null && Number.isFinite(actual)) {
    minutesAwayPerDay = actual * (p.reheatsPerDay ?? 2);
    fractionOfDay = minutesAwayPerDay / 1440;
    if (p.spaceHeatingLoadKw != null) {
      heatingKWhDeferred = (p.spaceHeatingLoadKw * minutesAwayPerDay) / 60;
      const hoursLeft = 24 - minutesAwayPerDay / 60;
      catchUpExtraKw = hoursLeft > 0 ? heatingKWhDeferred / hoursLeft : Infinity;
      if (p.sourceKw && p.spaceHeatingLoadKw + catchUpExtraKw > p.sourceKw)
        warnings.push('Heat source cannot both meet the design heat loss and recover the time spent on hot water.');
    }
  }
  return { energyKWh, minSourceKw, coilCanMeetTarget, actualReheatMinutes: actual, minutesAwayPerDay, fractionOfDay, heatingKWhDeferred, catchUpExtraKw, warnings };
}

// ---------------------------------------------------------------------------
// Legionella pasteurisation
// ---------------------------------------------------------------------------

export interface LegionellaInput {
  volumeL: number;
  storageTempC: number;
  targetC?: number; // default 60
  holdMinutes?: number; // default 60
  standingLossRatedW?: number; // badge loss (W at ΔT 45 K)
  ambientC?: number;
  heaterKw?: number; // immersion (usually 3 kW) or source used for the cycle
  cyclesPerWeek?: number; // default 1
  pricePerKWh?: number; // e.g. 0.25 £/kWh
}

export interface LegionellaResult {
  heatUpKWh: number;
  holdLossKWh: number;
  cycleKWh: number;
  heatUpMinutes: number | null;
  weeklyKWh: number;
  annualKWh: number;
  annualCost: number | null;
  warnings: string[];
}

/** Energy to lift the whole store from storage temp to 60 °C and hold it there. */
export function legionellaCycle(p: LegionellaInput): LegionellaResult {
  const target = p.targetC ?? PASTEURISATION_C;
  const hold = p.holdMinutes ?? 60;
  const warnings: string[] = [];
  const heatUpKWh = waterEnergyKWh(p.volumeL, p.storageTempC, target);
  const lossTargetW = p.standingLossRatedW != null ? standingLossAtW(p.standingLossRatedW, target, p.ambientC ?? 20) : 0;
  const lossStoreW = p.standingLossRatedW != null ? standingLossAtW(p.standingLossRatedW, p.storageTempC, p.ambientC ?? 20) : 0;
  // Extra loss over normal storage while hot: hold period, plus roughly half the heat-up period.
  const heatUpMinutes = p.heaterKw ? minutesForReheat(heatUpKWh, p.heaterKw) : null;
  const extraW = Math.max(0, lossTargetW - lossStoreW);
  const holdLossKWh = (lossTargetW * hold) / 60000 + (extraW * 0.5 * (heatUpMinutes ?? 0)) / 60000;
  const cycleKWh = heatUpKWh + holdLossKWh;
  const weeklyKWh = cycleKWh * (p.cyclesPerWeek ?? 1);
  const annualKWh = (weeklyKWh * 365) / 7;
  if (p.storageTempC >= target) warnings.push('Store is already at or above the pasteurisation temperature.');
  warnings.push('Energy after the cycle is not lost: hot water drawn later offsets normal heating, so net cost is lower than shown.');
  return {
    heatUpKWh,
    holdLossKWh,
    cycleKWh,
    heatUpMinutes,
    weeklyKWh,
    annualKWh,
    annualCost: p.pricePerKWh != null ? annualKWh * p.pricePerKWh : null,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Method notes
// ---------------------------------------------------------------------------

export interface DhwMethodNote {
  topic: string;
  source: string;
  confidence: 'exact' | 'method' | 'approx';
}

export const DHW_METHOD_NOTES: DhwMethodNote[] = [
  { topic: 'Energy to heat water E = V·ρ·cp·ΔT, using ρ = 1 kg/L and cp = 4.186 kJ/kg·K (1.163 Wh/L·K). Real density at 50–60 °C is ~1.2–1.7% lower.', source: 'Standard thermodynamics', confidence: 'exact' },
  { topic: 'Mixing to delivery temp: hot fraction f = (Tmix − Tcold)/(Thot − Tcold); default cold 10 °C, delivery 40 °C.', source: 'Energy balance', confidence: 'exact' },
  { topic: 'Litres per person: 45 L/person (no rapid reheat), down to 35 L/person for 10–15+ kW heat pumps with suitable coils, attributed to BS 6700. Treated here as a 60 °C reference and converted to the storage temperature.', source: 'Domestic HW cylinder selection guide (BS 6700 summary): https://renewableheatinghub.co.uk/wp-content/uploads/wpforo/attachments/213/1576-DomesticHWcylselectionguide.pdf', confidence: 'approx' },
  { topic: 'Peak-period method: showers × flow × minutes + baths + basins, divided by a usable fraction (default 0.8) for stratification and mixing losses.', source: 'Common installer practice; usable fraction is an assumption', confidence: 'method' },
  { topic: 'Shower flow presets (8–16 l/min) and 8 minute shower are typical figures, not standards. Electric showers are cold-fed and draw no stored water.', source: 'Typical manufacturer and Energy Saving Trust figures', confidence: 'approx' },
  { topic: 'Bathroom-count guide (1 bath 150 L, 2 baths 210 L, 3 baths 300 L at 60 °C) is a rough cross-check only.', source: 'Typical UK manufacturer sizing tables', confidence: 'approx' },
  { topic: 'Coil ratings are quoted to BS EN 12897 at 80 °C primary, 15 l/min, reheat 15→60 °C.', source: 'Mixergy install guide: https://support.mixergy.co.uk/hubfs/MDC0001-18%20Cylinder%20install%20guide.pdf; https://jettowel.electricaldealsdirect.co.uk/advicecentre/kw-ratings-coils-indirect-cylinders.html', confidence: 'method' },
  { topic: 'Coil UA = P_rated / LMTD_rated, then P = UA × LMTD at new conditions (equivalent to ε-NTU with a uniform store temperature). The store temperature behind the rating is not published; 37.5 °C (mean of 15→60) is assumed. UA is held constant when flow changes.', source: 'Heat exchanger LMTD / ε-NTU method; calibration assumptions are ours', confidence: 'approx' },
  { topic: 'Reheat with falling coil output: source-limited t = Cs·ΔT/Pmax, then coil-limited t = Cs/(ṁcp·ε)·ln((Tp−Ta)/(Tp−Tb)). Well-mixed store, no losses.', source: 'Lumped-capacitance tank model', confidence: 'method' },
  { topic: 'Heat pump coils: about 0.2 m² of true coil surface per kW of heat pump output; heat pump cylinders typically 3–4.5 m² vs 0.8–1.2 m² for boiler cylinders.', source: 'Kensa cylinder selection guide; Reonic: https://reonic.com/en-gb/blog/unvented-cylinder-sizing/', confidence: 'approx' },
  { topic: 'Legionella: store at ≥ 60 °C and distribute so outlets reach 50 °C within 1 minute. Below 60 °C storage, a periodic pasteurisation cycle is the usual mitigation (frequency and hold time are not fixed for domestic systems).', source: 'HSE: https://www.hse.gov.uk/legionnaires/hot-and-cold.htm (HSG274 Part 2)', confidence: 'method' },
  { topic: 'Standing loss rated at a 65 °C store / 20 °C ambient (ΔT 45 K), scaled linearly to other temperatures. kWh/24h = W × 0.024.', source: 'BS EN 12897 test basis as stated in manufacturer datasheets (e.g. Mixergy guide)', confidence: 'method' },
  { topic: 'ErP storage class bands from standing loss S < a + b·V^0.4 (A+ 5.5/3.16 … F 31/16.66).', source: 'Commission Delegated Regulation (EU) 812/2013, Annex II', confidence: 'approx' },
  { topic: 'DHW priority: time away from space heating = reheat time × reheats/day; deferred heat = heating load × that time. Ignores building thermal mass and weather compensation.', source: 'Simple energy accounting', confidence: 'approx' },
  { topic: 'MCS MIS 3005-D and MGD guidance on cylinder sizing could not be checked against the published text; check current MCS documents before relying on these figures for compliance.', source: 'https://mcscertified.com/standards-tools-library/', confidence: 'approx' },
];
