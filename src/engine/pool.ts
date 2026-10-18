// Swimming pool heating: heat-up energy, steady surface losses and the heat
// pump / plate heat exchanger duty that results.
//
// Units throughout: lengths m, areas m², volumes m³, temperatures °C,
// vapour pressures kPa, wind / air speed m/s, powers kW, energy kWh.
//
// Solar gain is deliberately ignored (design is for a dull UK heating-season
// day / night, so the result errs on the safe side). Heat from pool pumps,
// bathers and lighting is also ignored.

import { fluidState, flowForHeat, m3sToLpm, m3sToM3h, waterDensity, type FluidId } from './fluid';

export type PoolType = 'indoor' | 'outdoor';
export type PoolActivity = 'residential' | 'hotel' | 'public' | 'hydrotherapy';

// ASHRAE Applications Handbook (Natatoriums) typical activity factors applied
// to the evaporation equation. Residential 0.5, hotel 0.8, public/school 1.0,
// therapy 0.65. These are industry consensus values, not measured constants.
export const POOL_ACTIVITY: { id: PoolActivity; name: string; factor: number }[] = [
  { id: 'residential', name: 'Residential / private', factor: 0.5 },
  { id: 'hotel', name: 'Hotel / club', factor: 0.8 },
  { id: 'public', name: 'Public / school', factor: 1.0 },
  { id: 'hydrotherapy', name: 'Hydrotherapy', factor: 0.65 },
];

export function activityFactor(a: PoolActivity): number {
  return POOL_ACTIVITY.find((x) => x.id === a)?.factor ?? 1;
}

export interface PoolInputs {
  type: PoolType;
  length: number; // m
  width: number; // m
  avgDepth: number; // m
  volumeOverride: number; // m³, 0 = use L × W × depth
  waterTemp: number; // target °C
  fillTemp: number; // starting / mains make-up water °C
  airTemp: number; // indoor hall temp, or outdoor design air temp for the season
  rh: number; // relative humidity, 0–100 %
  windSpeed: number; // m/s at the water surface (outdoor). Indoor uses indoorAirSpeed.
  indoorAirSpeed: number; // m/s over the water in a hall, typically 0.05–0.15
  cloudFraction: number; // outdoor only, 0 = clear night sky, 1 = overcast
  coverHoursPerDay: number; // 0–24
  coverEvapReduction: number; // 0–1 fraction of evaporation stopped while covered
  coverConvRadReduction: number; // 0–1 fraction of convection + radiation stopped while covered
  activity: PoolActivity;
  heatUpHours: number; // time allowed for initial heat-up from fillTemp
  makeupFractionPerDay: number; // fraction of pool volume replaced per day (backwash, splash, dilution)
  groundTemp: number; // °C, UK undisturbed ground ≈ 10–12
  shellU: number; // W/m²K, pool shell to ground (insulated ≈ 0.3–0.5, bare concrete ≈ 1–1.5)
  marginPct: number; // added to the governing duty
  primaryFluid: FluidId;
  primaryFlowTemp: number; // boiler / heat pump primary into the plate HX
  primaryDeltaT: number;
  poolSideDeltaT: number; // temperature rise of pool water through the HX / heat pump
}

export const defaultPoolInputs = (): PoolInputs => ({
  type: 'indoor',
  length: 8,
  width: 4,
  avgDepth: 1.4,
  volumeOverride: 0,
  waterTemp: 29,
  fillTemp: 10,
  airTemp: 30,
  rh: 60,
  windSpeed: 2,
  indoorAirSpeed: 0.1,
  cloudFraction: 0.5,
  coverHoursPerDay: 0,
  coverEvapReduction: 0.9,
  coverConvRadReduction: 0.5,
  activity: 'residential',
  heatUpHours: 72,
  makeupFractionPerDay: 0.02,
  groundTemp: 10,
  shellU: 0.5,
  marginPct: 10,
  primaryFluid: 'water',
  primaryFlowTemp: 80,
  primaryDeltaT: 20,
  poolSideDeltaT: 3,
});

const SIGMA = 5.670374e-8; // Stefan–Boltzmann, W/m²K⁴
const EPS_WATER = 0.95; // long-wave emissivity of water
const GAMMA = 0.0646; // psychrometric constant at 101.3 kPa, kPa/K
const CP_WATER = 4186; // J/kg·K, same value fluidState uses

/** Saturation vapour pressure over water, kPa (Magnus form, Alduchov & Eskridge 1996). */
export function satVapourPressure(t: number): number {
  return 0.61094 * Math.exp((17.625 * t) / (t + 243.04));
}

/** Latent heat of vaporisation of water, kJ/kg (linear fit, ±0.1 % over 0–40 °C). */
export function latentHeat(t: number): number {
  return 2501 - 2.361 * t;
}

/**
 * ASHRAE evaporation, kg/s: W = A·(pw − pa)·(0.089 + 0.0782·V)/Y × Fa
 * A m², p kPa, V m/s, Y kJ/kg. The heat carried off is W·Y, so the
 * latent heat cancels: q_evap (kW) = A·(pw − pa)·(0.089 + 0.0782·V)·Fa.
 */
export function evaporationKgS(
  area: number, waterTemp: number, airTemp: number, rh: number, v: number, fa: number,
): number {
  const dp = satVapourPressure(waterTemp) - (rh / 100) * satVapourPressure(airTemp);
  return (Math.max(0, dp) * area * (0.089 + 0.0782 * v) * fa) / latentHeat(waterTemp);
}

/** Clear-sky temperature, °C (Swinbank 1963: T_sky = 0.0552·T_air^1.5, K), blended to air temp by cloud. */
export function skyTemp(airTemp: number, cloudFraction: number): number {
  const ta = airTemp + 273.15;
  const clear = 0.0552 * ta ** 1.5;
  const c = Math.min(1, Math.max(0, cloudFraction));
  return clear + c * (ta - clear) - 273.15;
}

export interface PoolLosses {
  evaporationKw: number;
  convectionKw: number; // negative = gain from warmer hall air
  radiationKw: number; // negative = gain from warmer surroundings
  conductionKw: number;
  makeupKw: number;
  totalKw: number;
  evaporationKgH: number;
}

export interface PoolResult {
  surfaceArea: number; // m²
  shellArea: number; // m², floor + walls in contact with ground
  volume: number; // m³
  heatUpKwh: number; // sensible energy fill → target
  heatUpLiftKw: number; // heatUpKwh / heatUpHours
  heatUpLossesKw: number; // average losses at mean water temp during heat-up
  heatUpKw: number; // lift + losses
  uncovered: PoolLosses; // design condition, no cover all day
  covered: PoolLosses; // design condition while the cover is on
  maintenanceUncoveredKw: number; // 24 h with no cover
  maintenanceWithCoverKw: number; // daily average with the cover schedule
  maintenanceKw: number; // the one used for sizing (daily average)
  governing: 'heatup' | 'maintenance';
  dutyKw: number; // max(heat-up, maintenance) × (1 + margin)
  dailyKwh: number; // maintenance energy per day with the cover schedule
  dailyKwhUncovered: number;
  evaporationLitresPerDay: number; // with cover schedule
  primaryFlowLpm: number;
  primaryFlowM3h: number;
  poolSideFlowLpm: number;
  poolSideFlowM3h: number;
}

/** Steady losses at a given water temperature with a given cover state. */
export function poolLosses(p: PoolInputs, waterTemp: number, covered: boolean): PoolLosses {
  const area = p.length * p.width;
  const shell = area + 2 * (p.length + p.width) * p.avgDepth;
  const v = p.type === 'outdoor' ? p.windSpeed : p.indoorAirSpeed;
  const fa = activityFactor(p.activity);
  const evapCut = covered ? 1 - clamp01(p.coverEvapReduction) : 1;
  const crCut = covered ? 1 - clamp01(p.coverConvRadReduction) : 1;
  const dT = waterTemp - p.airTemp;

  const kgS = evaporationKgS(area, waterTemp, p.airTemp, p.rh, v, fa) * evapCut;
  const evaporationKw = kgS * latentHeat(waterTemp);

  let hConv: number; // W/m²K
  let tSurround: number; // °C for long-wave exchange
  if (p.type === 'outdoor') {
    // Bowen ratio: convective and evaporative transfer share the same wind
    // function, so h = γ × (0.089 + 0.0782·V) kW/m²kPa → W/m²K.
    hConv = GAMMA * (0.089 + 0.0782 * v) * 1000;
    tSurround = skyTemp(p.airTemp, p.cloudFraction);
  } else {
    // Free convection, heated horizontal surface facing up (turbulent):
    // h ≈ 1.52·|ΔT|^⅓ W/m²K. Hall surfaces taken at air temperature.
    hConv = 1.52 * Math.abs(dT) ** (1 / 3);
    tSurround = p.airTemp;
  }
  const convectionKw = (hConv * area * dT * crCut) / 1000;
  const radiationKw =
    (EPS_WATER * SIGMA * area * ((waterTemp + 273.15) ** 4 - (tSurround + 273.15) ** 4) * crCut) / 1000;
  const conductionKw = (p.shellU * shell * (waterTemp - p.groundTemp)) / 1000;

  const vol = poolVolume(p);
  const rho = waterDensity(p.fillTemp);
  const makeupKw = (vol * p.makeupFractionPerDay * rho * CP_WATER * (waterTemp - p.fillTemp)) / 86400 / 1000;

  return {
    evaporationKw,
    convectionKw,
    radiationKw,
    conductionKw,
    makeupKw,
    totalKw: evaporationKw + convectionKw + radiationKw + conductionKw + makeupKw,
    evaporationKgH: kgS * 3600,
  };
}

export function poolVolume(p: PoolInputs): number {
  return p.volumeOverride > 0 ? p.volumeOverride : p.length * p.width * p.avgDepth;
}

/** Sensible heat to raise the volume from fill to target, kWh (ρ at mean temp, cp 4186 J/kg·K). */
export function heatUpEnergyKwh(volume: number, fromT: number, toT: number): number {
  const rho = waterDensity((fromT + toT) / 2);
  return (volume * rho * CP_WATER * (toT - fromT)) / 3.6e6;
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

export function analysePool(p: PoolInputs): PoolResult {
  const surfaceArea = p.length * p.width;
  const shellArea = surfaceArea + 2 * (p.length + p.width) * p.avgDepth;
  const volume = poolVolume(p);
  const fc = clamp01(p.coverHoursPerDay / 24);

  const uncovered = poolLosses(p, p.waterTemp, false);
  const covered = poolLosses(p, p.waterTemp, true);
  const avg = (u: number, c: number) => u * (1 - fc) + c * fc;
  const maintenanceUncoveredKw = uncovered.totalKw;
  const maintenanceWithCoverKw = avg(uncovered.totalKw, covered.totalKw);
  // The pool's thermal mass (≈1.16 kWh/K per m³) easily rides through the
  // uncovered hours, so plant is sized on the daily average load.
  const maintenanceKw = maintenanceWithCoverKw;

  const heatUpKwh = Math.max(0, heatUpEnergyKwh(volume, p.fillTemp, p.waterTemp));
  const heatUpLiftKw = p.heatUpHours > 0 ? heatUpKwh / p.heatUpHours : 0;
  const tMean = (p.fillTemp + p.waterTemp) / 2;
  const lu = poolLosses(p, tMean, false).totalKw;
  const lc = poolLosses(p, tMean, true).totalKw;
  const heatUpLossesKw = Math.max(0, avg(lu, lc));
  const heatUpKw = heatUpLiftKw + heatUpLossesKw;

  const governing = heatUpKw >= maintenanceKw ? 'heatup' : 'maintenance';
  const dutyKw = Math.max(heatUpKw, maintenanceKw, 0) * (1 + p.marginPct / 100);

  const prim = fluidState(p.primaryFluid, p.primaryFlowTemp - p.primaryDeltaT / 2);
  const qp = flowForHeat(dutyKw * 1000, p.primaryDeltaT, prim);
  const pool = fluidState('water', p.waterTemp);
  const qs = flowForHeat(dutyKw * 1000, p.poolSideDeltaT, pool);

  return {
    surfaceArea,
    shellArea,
    volume,
    heatUpKwh,
    heatUpLiftKw,
    heatUpLossesKw,
    heatUpKw,
    uncovered,
    covered,
    maintenanceUncoveredKw,
    maintenanceWithCoverKw,
    maintenanceKw,
    governing,
    dutyKw,
    dailyKwh: maintenanceWithCoverKw * 24,
    dailyKwhUncovered: maintenanceUncoveredKw * 24,
    evaporationLitresPerDay:
      (avg(uncovered.evaporationKgH, covered.evaporationKgH) * 24 * 1000) / waterDensity(p.waterTemp),
    primaryFlowLpm: m3sToLpm(qp),
    primaryFlowM3h: m3sToM3h(qp),
    poolSideFlowLpm: m3sToLpm(qs),
    poolSideFlowM3h: m3sToM3h(qs),
  };
}

export interface PoolMethodNote {
  topic: string;
  source: string;
  confidence: 'exact' | 'method' | 'approx';
}

export const POOL_METHOD_NOTES: PoolMethodNote[] = [
  {
    topic: 'Heat-up energy: V × ρ × cp × ΔT (≈1.16 kWh per m³ per K), plus average losses at the mean water temperature during heat-up',
    source: 'Basic thermodynamics; water density from Tanaka et al. (fluid.ts), cp 4.186 kJ/kg·K',
    confidence: 'exact',
  },
  {
    topic: 'Evaporation: W = A·(pw − pa)·(0.089 + 0.0782·V)/Y × activity factor (kg/s, kPa, m/s, kJ/kg)',
    source: 'ASHRAE Handbook – HVAC Applications, Natatoriums chapter (SI form as quoted in https://www.cfd-online.com/Forums/cfx/157728-equation-evaporation-loads-pools.html and https://thermexcel.com/english/program/pool.htm)',
    confidence: 'method',
  },
  {
    topic: 'Activity factors: residential 0.5, hotel 0.8, public 1.0, therapy 0.65. Not experimentally validated; field data scatter widely',
    source: 'ASHRAE Applications Handbook; ASHRAE RP-1566 work statement https://www.ashrae.org/file%20library/technical%20resources/research/research%20project%20bidding/1566-trp.pdf; field study https://www.e3s-conferences.org/10.1051/e3sconf/202236214004',
    confidence: 'approx',
  },
  {
    topic: 'Saturation vapour pressure: Magnus form 0.61094·exp(17.625T/(T+243.04)) kPa',
    source: 'Alduchov & Eskridge (1996), J. Appl. Meteorology 35(4)',
    confidence: 'exact',
  },
  {
    topic: 'Outdoor convection from the Bowen ratio (same wind function as evaporation, γ = 0.0646 kPa/K)',
    source: 'Bowen (1926) heat/mass transfer analogy; standard open-water energy balance method',
    confidence: 'method',
  },
  {
    topic: 'Indoor convection: free convection h ≈ 1.52·ΔT^⅓ W/m²K; becomes a small gain when the hall is warmer than the water (normal design practice is hall 1–2 K above water)',
    source: 'Simplified turbulent free-convection correlation for air over a heated horizontal surface (heat transfer textbooks, e.g. Holman)',
    confidence: 'approx',
  },
  {
    topic: 'Radiation: ε = 0.95 to the sky (outdoor) using Swinbank clear-sky temperature blended to air temperature by cloud fraction; indoor to hall surfaces assumed at air temperature (near zero)',
    source: 'Swinbank (1963), Q. J. R. Meteorol. Soc. 89; cloud blend is a simplification',
    confidence: 'approx',
  },
  {
    topic: 'Conduction to ground: U × (floor + wall area) × (water − ground temp). Small allowance only; real ground warms up over time',
    source: 'Engineering allowance',
    confidence: 'approx',
  },
  {
    topic: 'Make-up water heating: daily replaced fraction × V × ρcp × (water − fill temp)',
    source: 'Basic thermodynamics. Public pools: fresh water per bather per DIN 19643 / PWTAG guidance sets the fraction',
    confidence: 'method',
  },
  {
    topic: 'Cover: cuts evaporation (default 90 %) and part of convection/radiation (default 50 %) for the covered hours; covers can cut pool heating cost by 50–70 %',
    source: 'US DOE https://www.energy.gov/energysaver/swimming-pool-covers; EnergyPlus Engineering Reference (Indoor Swimming Pool) applies separate cover factors per loss',
    confidence: 'approx',
  },
  {
    topic: 'Plant sized on max(heat-up kW, daily average maintenance kW) × (1 + margin). Solar gain, bather and pump heat ignored',
    source: 'Design convention (pool thermal mass buffers the uncovered hours)',
    confidence: 'method',
  },
];
