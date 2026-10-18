import { correctionFactor, meanDeltaT, radiatorDt50, suggestRadiator } from './emitters';
import { parseDxf, normalisePlan } from './dxf';
import { detectAdjacency, newProject, newRoom, roomFromPolygon } from './factory';
import { projectHeatLoss, roomHeatLoss } from './heatloss';
import { analysePipe, autoSize, flowFromHeat, requiredKv, valveDropBar } from './pipes';
import { designUfhRoom, floorSurfaceTemp, logMeanDt, ufhHeatFlux } from './ufh';

describe('heat loss', () => {
  it('matches a hand calculation for a simple room', () => {
    const p = newProject();
    p.settings.externalTemp = -2;
    p.settings.thermalBridgeU = 0;
    p.settings.thermalBridgeInternalU = 0;
    p.settings.airPermeability = 0;
    const r = newRoom('Lounge', 'living');
    r.area = 20;
    r.height = 2.5;
    r.ach = 1;
    r.walls = [{ id: 'w', name: 'Front', length: 5, fabricId: 'w-cavity-unfilled', boundary: 'external', openings: [
      { id: 'o', kind: 'window', name: 'Bay', width: 2, height: 1.25, count: 1, fabricId: 'g-double-old' },
    ] }];
    r.floor = { fabricId: 'f-solid-uninsulated', boundary: 'ground' };
    r.ceiling = { fabricId: 'r-intermediate', boundary: 'room' }; // no adjacent room set → 0 K
    p.rooms = [r];
    const l = roomHeatLoss(p, r);
    const dT = 21 - -2;
    const wall = 1.5 * (12.5 - 2.5) * dT;
    const win = 2.8 * 2.5 * dT;
    const floor = 0.7 * 20 * 1.45 * (21 - p.settings.meanExternalTemp);
    const vent = 0.33 * 1 * 50 * dT;
    expect(l.fabricW).toBeCloseTo(wall + win + floor, 6);
    expect(l.ventilationW).toBeCloseTo(vent, 6);
    expect(l.totalW).toBeCloseTo(wall + win + floor + vent, 6);
  });

  it('adds thermal bridging, the floor void and infiltration like MCS', () => {
    const p = newProject();
    p.settings.externalTemp = -3;
    const down = newRoom('Lounge', 'living', 'Ground');
    const up = newRoom('Bed', 'bedroom', 'First');
    for (const r of [down, up]) {
      r.area = 16;
      r.height = 2.4;
      r.walls = [{ id: 'w' + r.id, name: 'Front', length: 4, fabricId: 'w-cavity-unfilled', boundary: 'external', openings: [] }];
      r.ceiling = { fabricId: 'r-intermediate', boundary: 'room' };
      r.floor = { fabricId: 'f-intermediate', boundary: 'room' };
    }
    p.rooms = [down, up];
    p.settings.airPermeability = 0;
    const L = projectHeatLoss(p);
    const wallDown = L.byId.get(down.id)!.elements[0];
    const wallUp = L.byId.get(up.id)!.elements[0];
    // Thermal bridging 0.15 (age band C) on external elements.
    expect(wallDown.u).toBeCloseTo(1.5 + 0.15, 6);
    // Floor void 0.25 m on the lower storey only.
    expect(wallDown.area).toBeCloseTo(4 * 2.65, 6);
    expect(wallUp.area).toBeCloseTo(4 * 2.4, 6);
    // Minimum 0.5 ACH.
    expect(L.byId.get(down.id)!.airflowM3h).toBeCloseTo(0.5 * 16 * 2.4, 6);
    // Infiltration share takes over when it is larger.
    p.settings.airPermeability = 12;
    p.settings.infiltrationFactor = 0.2;
    const L2 = projectHeatLoss(p);
    const share = (12 * L2.envelopeArea * 0.2 * L2.byId.get(down.id)!.envelopeArea) / L2.envelopeArea;
    expect(L2.byId.get(down.id)!.airflowM3h).toBeCloseTo(share, 6);
    expect(L2.byId.get(down.id)!.airflowSource).toBe('infiltration');
  });

  it('uses the calculated ground floor U-value', () => {
    const p = newProject();
    const r = newRoom('Kitchen', 'kitchen', 'Ground');
    r.area = 50;
    r.walls = [
      { id: 'a', name: 'A', length: 10, fabricId: 'w-cavity-unfilled', boundary: 'external', openings: [] },
      { id: 'b', name: 'B', length: 10, fabricId: 'w-cavity-unfilled', boundary: 'external', openings: [] },
    ];
    p.rooms = [r];
    const L = projectHeatLoss(p);
    expect(L.ground.area).toBe(50);
    expect(L.ground.perimeter).toBe(20);
    const floor = L.byId.get(r.id)!.elements.find((e) => e.kind === 'floor')!;
    expect(floor.u).toBeCloseTo(L.ground.u + 0.15, 6);
    expect(L.ground.u).toBeGreaterThan(0.5);
    expect(L.ground.u).toBeLessThan(0.75);
  });

  it('treats walls to warmer rooms as gains', () => {
    const p = newProject();
    const a = newRoom('Bed', 'bedroom');
    const b = newRoom('Bath', 'bathroom');
    a.walls = [{ id: 'x', name: 'To bath', length: 2, fabricId: 'w-int-stud', boundary: 'room', adjacentRoomId: b.id, openings: [] }];
    a.floor = { fabricId: 'f-intermediate', boundary: 'room' };
    a.ceiling = { fabricId: 'r-intermediate', boundary: 'room' };
    a.ach = 0;
    p.rooms = [a, b];
    expect(roomHeatLoss(p, a).fabricW).toBeLessThan(0);
  });
});

describe('radiators', () => {
  it('corrects output from ΔT50', () => {
    expect(correctionFactor(50)).toBeCloseTo(1);
    const dT = meanDeltaT(45, 40, 21);
    expect(dT).toBeCloseTo(21.5);
    expect(correctionFactor(dT)).toBeCloseTo((21.5 / 50) ** 1.3, 6);
  });
  it('sizes a radiator that meets the load', () => {
    const s = suggestRadiator(1000, 21.5, 600)!;
    expect(s.output).toBeGreaterThanOrEqual(1000);
    expect(radiatorDt50('22', 600, 1000)).toBeCloseTo(1732);
    expect(radiatorDt50('22', 450, 1000)).toBeCloseTo(1371);
    expect(radiatorDt50('33', 600, 600)).toBeCloseTo(2389 * 0.6);
    // 500 mm K2 sits between the 450 and 600 figures.
    expect(radiatorDt50('22', 500, 1000)).toBeCloseTo(1371 + (50 * (1732 - 1371)) / 150);
  });
});

describe('underfloor', () => {
  it('gives sensible fluxes for tile and carpet', () => {
    const base = { spacingMm: 150, screedCoverMm: 45, pipeOdMm: 16, flow: 40, ret: 35, room: 21 };
    const tile = ufhHeatFlux({ ...base, coveringR: 0.01 });
    const carpet = ufhHeatFlux({ ...base, coveringR: 0.15 });
    expect(tile).toBeGreaterThan(70);
    expect(tile).toBeLessThan(100);
    expect(carpet).toBeLessThan(tile);
    expect(logMeanDt(40, 35, 21)).toBeCloseTo(5 / Math.log(19 / 14));
    expect(floorSurfaceTemp(100, 20)).toBeCloseTo(20 + (100 / 8.92) ** (1 / 1.1));
  });
  it('splits long loops', () => {
    const r = designUfhRoom({ areaM2: 40, activeAreaPct: 100, spacingMm: 150, coveringId: 'tile', screedCoverMm: 45, pipeSizeId: 'pex16', leadLengthM: 5, maxLoopLengthM: 100, flow: 40, ret: 35, room: 21, requiredW: 2000, fluid: 'water', isBathroom: false });
    expect(r.loops).toBe(3);
    expect(r.loopLengthM).toBeLessThanOrEqual(100);
  });
});

describe('pipes and valves', () => {
  it('computes flow, velocity and pressure drop', () => {
    const q = flowFromHeat(10000, 5, 'water', 42.5); // 10 kW at ΔT5 ≈ 0.48 l/s
    expect(q * 1000).toBeCloseTo(0.48, 1);
    const r = analysePipe({ sizeId: 'cu28', lengthM: 10, fittingsAllowancePct: 0, flowM3s: q, fluid: 'water', meanTemp: 42.5 })!;
    expect(r.velocity).toBeCloseTo(q / (Math.PI * 0.0262 ** 2 / 4), 6);
    expect(r.paPerM).toBeGreaterThan(200);
    expect(r.paPerM).toBeLessThan(500);
    expect(autoSize('copper', q, 'water', 42.5)?.id).toBe('cu35');
  });
  it('handles Kv', () => {
    expect(valveDropBar(2, 4)).toBeCloseTo(0.25);
    expect(requiredKv(2, 0.25)).toBeCloseTo(4);
  });
});

describe('dxf import', () => {
  const dxf = [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LWPOLYLINE', '8', 'Rooms', '90', '4', '70', '1',
    '10', '0', '20', '0', '10', '4000', '20', '0', '10', '4000', '20', '3000', '10', '0', '20', '3000',
    '0', 'LWPOLYLINE', '8', 'Rooms', '90', '4', '70', '1',
    '10', '4000', '20', '0', '10', '7000', '20', '0', '10', '7000', '20', '3000', '10', '4000', '20', '3000',
    '0', 'TEXT', '10', '2000', '20', '1500', '1', 'Kitchen',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');

  it('reads polylines in millimetres and finds shared walls', () => {
    const plan = normalisePlan(parseDxf(dxf));
    expect(plan.unitsName).toBe('millimetres');
    expect(plan.polygons).toHaveLength(2);
    expect(plan.labels[0].text).toBe('Kitchen');
    const rooms = detectAdjacency(plan.polygons.map((p, i) => roomFromPolygon(`R${i}`, p, 'Ground')));
    expect(rooms[0].area).toBeCloseTo(12);
    const internal = rooms[0].walls.filter((w) => w.boundary === 'room');
    expect(internal).toHaveLength(1);
    expect(internal[0].adjacentRoomId).toBe(rooms[1].id);
    expect(rooms[0].walls.filter((w) => w.boundary === 'external')).toHaveLength(3);
  });
});

describe('materials takeoff and pricing', () => {
  it('builds pipe, UFH, radiator and equipment lines from the design', async () => {
    const { demoProject } = await import('../data/demo');
    const { projectHeatLoss } = await import('./heatloss');
    const { buildTakeoff, priceProject, merchantCsv } = await import('./takeoff');
    const p = demoProject();
    p.rooms[0].emitters.push({ id: 'n', kind: 'radiator', name: 'New', status: 'new', type: '22', height: 600, length: 1200, quantity: 2 });
    const loss = projectHeatLoss(p);
    const lines = buildTakeoff(p, loss);
    const pipe = lines.filter((l) => l.key.startsWith('pipe:'));
    // 16 m + 12 m of runs with 10% waste, rounded up per size.
    expect(pipe.reduce((a, l) => a + l.qty, 0)).toBeGreaterThanOrEqual(Math.ceil(28 * 1.1));
    expect(lines.find((l) => l.key === 'rad:22:600:1200')?.qty).toBe(2);
    expect(lines.find((l) => l.key === 'rad-valves')?.qty).toBe(2);
    expect(lines.some((l) => l.key.startsWith('ufh-manifold:'))).toBe(true);
    expect(lines.filter((l) => l.category === 'Equipment')).toHaveLength(2);

    p.pricing = { ...(await import('./takeoff')).defaultPricing(p), overrides: { 'rad-valves': { exclude: true } }, labour: [{ id: 'l', description: 'Eng', days: 2, dayRate: 250 }] };
    const r = priceProject(p, loss, { 'rad:22:600:1200': 100, 'rad-valves': 30 });
    expect(r.materials).toBe(200);
    expect(r.sundries).toBeCloseTo(30);
    expect(r.markup).toBeCloseTo(46);
    expect(r.labour).toBe(500);
    expect(r.total).toBeCloseTo((200 + 30 + 46 + 500) * 1.2);
    const csv = merchantCsv(r.lines);
    expect(csv).toContain('Panel radiator Type 22 (K2) 600 × 1200 mm,2,each');
    expect(csv).not.toContain('Radiator valve set');
  });
});

describe('plant room', () => {
  it('sizes flows, header and mixing for a boiler cascade', async () => {
    const { analysePlant, defaultPlantRoom } = await import('./plant');
    const plant = defaultPlantRoom();
    plant.sources = [{ id: 'b', name: 'Boilers', kind: 'boiler', count: 3, outputKw: 30, flowTemp: 80, deltaT: 20, minFlowLpm: 0, notes: '' }];
    const circ = (id: string, kw: number) => ({ id, name: id, type: 'dhw' as const, loadKw: kw, flowTemp: 80, deltaT: 20, diversityPct: 100, material: 'copper' as const, sizeId: '', lengthM: 20, fittingsPct: 30, terminalDropKpa: 10, valveKv: 0, notes: '' });
    plant.circuits = [circ('c1', 30), circ('c2', 30), circ('c3', 10)];
    const r = analysePlant(plant, 'water');
    expect(r.connectedKw).toBe(70);
    expect(r.installedKw).toBe(90);
    // Primary 90 kW vs secondary 70 kW at the same ΔT → ratio ≈ 90/70.
    expect(r.primaryRatio).toBeCloseTo(90 / 70, 2);
    // Surplus primary mixes back: return = (70·60 + 20·80)/90.
    expect(r.returnTempToSources).toBeCloseTo((70 * 60 + 20 * 80) / 90, 0);
    expect(r.secondaryFlowTempAtHeader).toBeCloseTo(80, 1);
    // Header id for 0.2 m/s: sqrt(4Q/(π·0.2)).
    expect(r.headerIdForVelocityMm).toBeCloseTo(Math.sqrt((4 * r.primaryM3s) / (Math.PI * 0.2)) * 1000, 6);
    expect(r.headerIdRequiredMm).toBeGreaterThanOrEqual(r.headerIdFor3dMm);
    expect(r.circuits[0].totalKpa).toBeGreaterThan(10);

    // Undersized primary: secondary pulls return water through, flow temp drops.
    plant.sources[0].count = 2;
    const r2 = analysePlant(plant, 'water');
    expect(r2.secondaryFlowTempAtHeader).toBeCloseTo((60 * 80 + 10 * 60) / 70, 0);
    expect(r2.warnings.some((w) => w.includes('below the diversified load'))).toBe(true);
  });
});

describe('design climate', () => {
  it('applies the MCS altitude rule and finds the nearest station', async () => {
    const { designTemperature, nearestStation, station } = await import('../data/climate');
    const heathrow = station('london')!;
    expect(designTemperature(heathrow, 0)).toBe(-3.0);
    expect(designTemperature(heathrow, 124)).toBe(-3.0); // only 99 m above the station
    expect(designTemperature(heathrow, 125)).toBe(-3.6);
    expect(designTemperature(heathrow, 230)).toBe(-4.2);
    expect(designTemperature(heathrow, 0, '99')).toBe(-1.7);
    // Worthing
    expect(nearestStation(50.82, -0.37).id).toBe('london');
    // Plymouth
    expect(nearestStation(50.37, -4.14).id).toBe('plymouth');
  });
  it('matches RdSAP 10 ground floor examples in shape', async () => {
    const { groundFloorU } = await import('./groundfloor');
    const solid = groundFloorU({ kind: 'solid', areaM2: 100, exposedPerimeterM: 30, wallThicknessMm: 250, insulationMm: 0 });
    const insulated = groundFloorU({ kind: 'solid', areaM2: 100, exposedPerimeterM: 30, wallThicknessMm: 250, insulationMm: 100 });
    expect(insulated).toBeLessThan(solid);
    // Bigger floor, same perimeter → lower U.
    expect(groundFloorU({ kind: 'solid', areaM2: 200, exposedPerimeterM: 30, wallThicknessMm: 250, insulationMm: 0 })).toBeLessThan(solid);
  });
});
