import { waterDensity } from './fluid';
import {
  analysePool,
  defaultPoolInputs,
  evaporationKgS,
  heatUpEnergyKwh,
  latentHeat,
  poolLosses,
  satVapourPressure,
  type PoolInputs,
} from './pool';

const indoor = (): PoolInputs => ({ ...defaultPoolInputs(), coverHoursPerDay: 0 });
const outdoor = (): PoolInputs => ({
  ...defaultPoolInputs(),
  type: 'outdoor',
  length: 10,
  width: 5,
  avgDepth: 1.5,
  waterTemp: 27,
  airTemp: 12,
  rh: 75,
  windSpeed: 2,
  coverHoursPerDay: 14,
});

describe('pool', () => {
  it('saturation vapour pressure matches steam tables', () => {
    expect(satVapourPressure(29)).toBeCloseTo(4.006, 1);
    expect(satVapourPressure(30)).toBeCloseTo(4.247, 1);
  });

  it('heat-up energy ≈ V × 1.16 kWh/m³K', () => {
    const v = 8 * 4 * 1.4;
    const e = heatUpEnergyKwh(v, 10, 29);
    const hand = (v * waterDensity(19.5) * 4186 * 19) / 3.6e6;
    expect(e).toBeCloseTo(hand, 9);
    expect(e).toBeCloseTo(v * 1.163 * 19, -1); // within a few kWh of the rule of thumb
    const r = analysePool(indoor());
    expect(r.volume).toBeCloseTo(44.8, 6);
    expect(r.heatUpLiftKw).toBeCloseTo(e / 72, 9);
  });

  it('evaporation matches a hand calculation of the ASHRAE equation', () => {
    const pw = 0.61094 * Math.exp((17.625 * 29) / (29 + 243.04));
    const pa = 0.6 * 0.61094 * Math.exp((17.625 * 30) / (30 + 243.04));
    const hand = (32 * (pw - pa) * (0.089 + 0.0782 * 0.1) * 0.5) / (2501 - 2.361 * 29);
    expect(evaporationKgS(32, 29, 30, 60, 0.1, 0.5)).toBeCloseTo(hand, 12);
    const l = poolLosses(indoor(), 29, false);
    expect(l.evaporationKw).toBeCloseTo(hand * latentHeat(29), 9);
    expect(l.evaporationKgH).toBeCloseTo(hand * 3600, 9);
  });

  it('a cover reduces losses and daily energy', () => {
    const p = outdoor();
    const r = analysePool(p);
    expect(r.covered.totalKw).toBeLessThan(r.uncovered.totalKw);
    expect(r.maintenanceWithCoverKw).toBeLessThan(r.maintenanceUncoveredKw);
    expect(r.dailyKwh).toBeLessThan(r.dailyKwhUncovered);
    const none = analysePool({ ...p, coverHoursPerDay: 0 });
    expect(none.maintenanceWithCoverKw).toBeCloseTo(none.maintenanceUncoveredKw, 9);
  });

  it('outdoor losses exceed indoor for the same water temperature', () => {
    const i = analysePool({ ...indoor(), length: 10, width: 5, waterTemp: 27, airTemp: 28 });
    const o = analysePool({ ...outdoor(), coverHoursPerDay: 0 });
    expect(o.maintenanceUncoveredKw).toBeGreaterThan(i.maintenanceUncoveredKw * 2);
  });

  it('duty is the larger of heat-up and maintenance plus margin', () => {
    for (const p of [indoor(), outdoor(), { ...outdoor(), heatUpHours: 12 }, { ...outdoor(), heatUpHours: 1000 }]) {
      const r = analysePool(p);
      expect(r.dutyKw).toBeCloseTo(Math.max(r.heatUpKw, r.maintenanceKw) * (1 + p.marginPct / 100), 9);
      expect(r.governing).toBe(r.heatUpKw >= r.maintenanceKw ? 'heatup' : 'maintenance');
    }
    expect(analysePool({ ...outdoor(), heatUpHours: 1000 }).governing).toBe('maintenance');
    expect(analysePool({ ...outdoor(), heatUpHours: 12 }).governing).toBe('heatup');
  });

  it('works out HX flows from duty', () => {
    const r = analysePool(indoor());
    // 80/60 primary: Q = P/(ρ cp ΔT)
    expect(r.primaryFlowLpm).toBeCloseTo((r.dutyKw * 1000 / (waterDensity(70) * 4186 * 20)) * 60000, 6);
    expect(r.poolSideFlowLpm).toBeGreaterThan(r.primaryFlowLpm);
  });
});
