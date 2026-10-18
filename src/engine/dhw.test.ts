import {
  capacityRateWK,
  coilDerateLinear,
  coilOutput,
  coilReheat,
  coilUA,
  deriveFromBadge,
  dhwPriority,
  equivalentVolumeL,
  erpClassFromLoss,
  hotFraction,
  hotLitresForMixed,
  kwForReheat,
  kwhPer24hToW,
  legionellaCycle,
  lmtd,
  minutesForReheat,
  mixedLitresFromHot,
  nextStandardSize,
  peakDeliveryCheck,
  sizeCylinder,
  standingLossAtW,
  uaFromReheatTime,
  waterEnergyKWh,
  DHW_METHOD_NOTES,
} from './dhw';

describe('water energy', () => {
  it('matches V × ρ × cp × ΔT by hand', () => {
    // 210 L × 1 kg/L × 4186 J/kgK × 40 K = 35,162,400 J = 9.7673 kWh
    expect(waterEnergyKWh(210, 10, 50)).toBeCloseTo((210 * 4186 * 40) / 3.6e6, 9);
    expect(waterEnergyKWh(210, 10, 50)).toBeCloseTo(9.767, 3);
    expect(waterEnergyKWh(100, 50, 40)).toBe(0);
  });

  it('reheat time is the inverse of kW', () => {
    const e = waterEnergyKWh(200, 10, 55);
    const kw = kwForReheat(e, 45);
    expect(minutesForReheat(e, kw)).toBeCloseTo(45, 9);
    expect(minutesForReheat(e, 2 * kw)).toBeCloseTo(22.5, 9);
    expect(minutesForReheat(e, 0)).toBe(Infinity);
  });
});

describe('mixing', () => {
  it('hot fraction from an energy balance', () => {
    // (40 − 10)/(50 − 10) = 0.75
    expect(hotFraction(50, 40, 10)).toBeCloseTo(0.75, 12);
    expect(hotFraction(60, 40, 10)).toBeCloseTo(0.6, 12);
    expect(hotLitresForMixed(100, 50)).toBeCloseTo(75, 9);
    expect(mixedLitresFromHot(75, 50)).toBeCloseTo(100, 9);
    // 45 L at 60 °C ≡ 56.25 L at 50 °C above 10 °C cold
    expect(equivalentVolumeL(45, 60, 50, 10)).toBeCloseTo(56.25, 9);
  });

  it('peak delivery check: two 10 l/min showers for 8 min at 50 °C', () => {
    const r = peakDeliveryCheck({ cylinderL: 210, storageTempC: 50, flowsLpm: [10, 10], minutes: 8 });
    expect(r.hotFlowLpm).toBeCloseTo(15, 9);
    expect(r.hotL).toBeCloseTo(120, 9);
    expect(r.usableL).toBeCloseTo(168, 9);
    expect(r.minutesAvailable).toBeCloseTo(11.2, 9);
    expect(r.ok).toBe(true);
  });
});

describe('cylinder sizing', () => {
  it('family of 4, 2 baths, heat pump at 50 °C', () => {
    const r = sizeCylinder({
      occupants: 4,
      bedrooms: 4,
      bathrooms: 2,
      showers: [{ type: 'mixer' }, { type: 'mixer' }],
      baths: [{ litres: 100 }],
      usagePattern: 'normal',
      heatSource: 'heatPump',
      storageTempC: 50,
    });
    // 4 showers × 80 L + 32 L basins = 352 L at 40 °C → 264 L at 50 °C → /0.8 = 330 L
    expect(r.peakMixedL).toBeCloseTo(352, 9);
    expect(r.peakHotL).toBeCloseTo(264, 9);
    expect(r.peakMethodL).toBeCloseTo(330, 9);
    expect(r.perPersonMethodL).toBeCloseTo(225, 9);
    expect(r.recommendedSizeL).toBe(350);
    expect(nextStandardSize(211)).toBe(250);
  });
});

describe('coil UA model', () => {
  const rating = { ratedKw: 19, primaryFlowC: 80, primaryFlowLpm: 15 };
  const ua = coilUA(rating);

  it('LMTD by hand', () => {
    expect(lmtd(80, 60, 40)).toBeCloseTo(20 / Math.log(2), 9);
  });

  it('reproduces the badge rating at rated conditions', () => {
    expect(ua.valid).toBe(true);
    expect(ua.primaryReturnC).toBeCloseTo(80 - 19000 / capacityRateWK(15), 9);
    expect(coilOutput(ua.uaWK, 80, 15, 37.5).kw).toBeCloseTo(19, 6);
    expect(ua.uaWK * ua.lmtdK).toBeCloseTo(19000, 6);
  });

  it('gives less output at heat pump primary temperatures', () => {
    const p55 = coilOutput(ua.uaWK, 55, 15, 37.5).kw;
    const p50 = coilOutput(ua.uaWK, 50, 15, 37.5).kw;
    expect(p55).toBeLessThan(19);
    expect(p50).toBeLessThan(p55);
    // Same store temp: output scales with (Tp − Tstore) at fixed flow.
    expect(p55 / 19).toBeCloseTo((55 - 37.5) / (80 - 37.5), 9);
    expect(coilDerateLinear(19, 80, 55, 37.5)).toBeCloseTo(p55, 9);
    expect(coilOutput(ua.uaWK, 50, 15, 50).kw).toBe(0);
  });

  it('reheat with no source cap at rated conditions is close to constant-kW estimate', () => {
    const r = coilReheat({ uaWK: ua.uaWK, primaryFlowC: 80, primaryFlowLpm: 15, volumeL: 210, fromC: 15, toC: 60 });
    expect(r.reachable).toBe(true);
    // Average output ≈ output at 37.5 °C store when output is linear in T
    expect(r.averageKw).toBeGreaterThan(17);
    expect(r.averageKw).toBeLessThan(19.5);
    const unreachable = coilReheat({ uaWK: ua.uaWK, primaryFlowC: 50, primaryFlowLpm: 15, volumeL: 210, fromC: 10, toC: 50 });
    expect(unreachable.reachable).toBe(false);
  });

  it('source cap: constant kW phase matches E / P', () => {
    const r = coilReheat({ uaWK: 1e9, primaryFlowC: 80, primaryFlowLpm: 1e6, volumeL: 200, fromC: 10, toC: 50, sourceMaxKw: 5 });
    expect(r.minutes).toBeCloseTo(minutesForReheat(waterEnergyKWh(200, 10, 50), 5), 6);
  });

  it('UA from a reheat time round-trips through coilReheat', () => {
    const uaT = uaFromReheatTime({ volumeL: 210, minutes: 35 });
    const r = coilReheat({ uaWK: uaT, primaryFlowC: 80, primaryFlowLpm: 15, volumeL: 210, fromC: 15, toC: 60 });
    expect(r.minutes).toBeCloseTo(35, 6);
  });
});

describe('badge', () => {
  it('derives energy, loss, UA and heat pump reheat', () => {
    const d = deriveFromBadge(
      { capacityL: 210, coilAreaM2: 3, coilRatingKw: 19, coilRatedPrimaryFlowC: 80, coilRatedPrimaryFlowLpm: 15, heatLossKwhPer24h: 1.6 },
      { storageTempC: 50, primaryFlowC: 55, sourceMaxKw: 8 },
    );
    expect(d.energyContentKWh).toBeCloseTo(waterEnergyKWh(210, 10, 50), 9);
    expect(d.standingLossRatedW).toBeCloseTo(66.667, 2);
    expect(d.standingLossAtStorageW).toBeCloseTo(66.667 * 30 / 45, 2);
    expect(d.coilKwAtRated).toBeCloseTo(19, 6);
    expect(d.coilKwAtSystem!).toBeLessThan(19);
    expect(d.reheatAtSystem!.minutes).toBeGreaterThan(minutesForReheat(d.energyContentKWh!, 8));
  });

  it('kWh/24h ↔ W and ErP class', () => {
    expect(kwhPer24hToW(2.4)).toBeCloseTo(100, 9);
    expect(standingLossAtW(90, 65, 20)).toBeCloseTo(90, 9);
    // 210 L: V^0.4 ≈ 8.48 → class B limit ≈ 62.3 W, C limit ≈ 87.3 W
    expect(erpClassFromLoss(60, 210)).toBe('B');
    expect(erpClassFromLoss(70, 210)).toBe('C');
  });
});

describe('DHW priority and legionella', () => {
  it('min kW for a reheat time and time away from heating', () => {
    const r = dhwPriority({ volumeL: 210, fromC: 10, toC: 50, targetReheatMinutes: 60, sourceKw: 8, spaceHeatingLoadKw: 6, reheatsPerDay: 2 });
    expect(r.minSourceKw).toBeCloseTo(9.767, 3);
    expect(r.actualReheatMinutes).toBeCloseTo(minutesForReheat(r.energyKWh, 8), 9);
    expect(r.heatingKWhDeferred).toBeCloseTo((6 * r.minutesAwayPerDay!) / 60, 9);
  });

  it('pasteurisation energy 50 → 60 °C', () => {
    const r = legionellaCycle({ volumeL: 210, storageTempC: 50, heaterKw: 3 });
    expect(r.heatUpKWh).toBeCloseTo((210 * 4186 * 10) / 3.6e6, 9);
    expect(r.heatUpMinutes).toBeCloseTo((r.heatUpKWh / 3) * 60, 9);
    expect(r.annualKWh).toBeCloseTo((r.cycleKWh * 365) / 7, 9);
  });

  it('method notes are present', () => {
    expect(DHW_METHOD_NOTES.length).toBeGreaterThan(5);
  });
});
