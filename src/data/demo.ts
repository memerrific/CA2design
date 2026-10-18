import { detectAdjacency, newProject, roomFromPolygon, uid } from '../engine/factory';
import type { Pt } from '../engine/model';
import { roomType } from './rooms';
import { defaultPlantRoom } from '../engine/plant';

/** A small example semi so the app can be explored without a survey. */
export function demoProject() {
  const p = newProject('Example: 1930s semi, Worthing');
  p.customer = { name: 'Example customer', address: '1 Example Road, Worthing', postcode: 'BN11', phone: '', email: '' };
  p.reference = 'DEMO-001';
  p.engineer = 'Callum';
  const ground: [string, string, Pt[]][] = [
    ['Lounge', 'living', [[0, 0], [4.2, 0], [4.2, 4.0], [0, 4.0]]],
    ['Kitchen / diner', 'kitchen-diner', [[0, 4.0], [4.2, 4.0], [4.2, 8.5], [0, 8.5]]],
    ['Hall', 'hall', [[4.2, 0], [6.0, 0], [6.0, 5.0], [4.2, 5.0]]],
    ['WC', 'wc', [[4.2, 5.0], [6.0, 5.0], [6.0, 6.5], [4.2, 6.5]]],
  ];
  const first: [string, string, Pt[]][] = [
    ['Bedroom 1', 'bedroom', [[0, 0], [4.2, 0], [4.2, 4.0], [0, 4.0]]],
    ['Bedroom 2', 'bedroom', [[0, 4.0], [4.2, 4.0], [4.2, 7.5], [0, 7.5]]],
    ['Landing', 'hall', [[4.2, 0], [6.0, 0], [6.0, 3.5], [4.2, 3.5]]],
    ['Bathroom', 'bathroom', [[4.2, 3.5], [6.0, 3.5], [6.0, 6.5], [4.2, 6.5]]],
  ];
  const make = (defs: [string, string, Pt[]][], level: string) =>
    defs.map(([name, type, poly]) => {
      const r = roomFromPolygon(name, poly, level, type);
      const t = roomType(type);
      r.designTemp = t.temp;
      r.ach = t.ach;
      r.walls = r.walls.map((w) => ({ ...w, fabricId: 'w-cavity-filled' }));
      if (level === 'Ground') {
        r.floor = { fabricId: 'f-suspended-timber', boundary: 'ground' };
        r.ceiling = { fabricId: 'r-intermediate', boundary: 'room' };
        r.height = 2.6;
      } else {
        r.floor = { fabricId: 'f-intermediate', boundary: 'room' };
        r.ceiling = { fabricId: 'r-loft-270', boundary: 'unheated' };
        r.height = 2.4;
      }
      return r;
    });
  let rooms = [...detectAdjacency(make(ground, 'Ground')), ...detectAdjacency(make(first, 'First'))];
  // Party wall on the right-hand side of the hall and landing.
  rooms = rooms.map((r) => ({
    ...r,
    walls: r.walls.map((w, i) => {
      const poly = r.polygon!;
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (w.boundary === 'external' && a[0] === 6 && b[0] === 6) return { ...w, boundary: 'neighbour' as const, fabricId: 'w-party-solid', name: 'Party wall' };
      return w;
    }),
  }));
  const add = (name: string, wall: number, o: { kind: 'window' | 'door'; w: number; h: number; fab: string; label: string }) => {
    const r = rooms.find((x) => x.name === name)!;
    r.walls[wall].openings.push({ id: uid(), kind: o.kind, name: o.label, width: o.w, height: o.h, count: 1, fabricId: o.fab });
  };
  add('Lounge', 0, { kind: 'window', w: 2.4, h: 1.5, fab: 'g-double', label: 'Bay window' });
  add('Kitchen / diner', 2, { kind: 'door', w: 2.4, h: 2.1, fab: 'd-patio-double', label: 'Patio doors' });
  add('Kitchen / diner', 3, { kind: 'window', w: 1.2, h: 1.0, fab: 'g-double', label: 'Window' });
  add('Hall', 0, { kind: 'door', w: 0.9, h: 2.0, fab: 'd-composite', label: 'Front door' });
  add('Bedroom 1', 0, { kind: 'window', w: 2.0, h: 1.3, fab: 'g-double', label: 'Window' });
  add('Bedroom 2', 2, { kind: 'window', w: 1.4, h: 1.2, fab: 'g-double', label: 'Window' });
  add('Bathroom', 2, { kind: 'window', w: 0.8, h: 0.9, fab: 'g-double', label: 'Obscure window' });

  // Ceilings of ground floor rooms face the room above.
  const above: Record<string, string> = { Lounge: 'Bedroom 1', 'Kitchen / diner': 'Bedroom 2', Hall: 'Landing', WC: 'Bathroom' };
  rooms = rooms.map((r) => {
    if (above[r.name]) return { ...r, ceiling: { ...r.ceiling, adjacentRoomId: rooms.find((x) => x.name === above[r.name])!.id } };
    const below = Object.entries(above).find(([, v]) => v === r.name)?.[0];
    if (below) return { ...r, floor: { ...r.floor, adjacentRoomId: rooms.find((x) => x.name === below)!.id } };
    return r;
  });

  const kd = rooms.find((r) => r.name === 'Kitchen / diner')!;
  kd.ufh = { ...kd.ufh, enabled: true, covering: 'tile', spacing: 150, leadLength: 2 };
  for (const r of rooms) {
    if (r.name === 'Kitchen / diner') continue;
    r.emitters.push({ id: uid(), kind: 'radiator', name: 'Existing radiator', status: 'existing', type: '11', height: 600, length: r.area > 10 ? 1200 : 600, quantity: 1 });
  }
  p.rooms = rooms;
  p.plans = {};
  p.equipment = [
    { id: uid(), category: 'Heat pump', make: '', model: '', serial: '', location: 'Rear garden', outputKw: 6, notes: '' },
    { id: uid(), category: 'Hot water cylinder', make: '', model: '', serial: '', location: 'Airing cupboard', notes: '200 L' },
  ];
  p.pipes = [
    { id: uid(), name: 'Primary flow & return', material: 'copper', sizeId: '', lengthM: 16, fittingsPct: 30, loadW: 0, roomIds: rooms.map((r) => r.id), isIndex: true },
    { id: uid(), name: 'First floor branch', material: 'copper', sizeId: '', lengthM: 12, fittingsPct: 30, loadW: 0, roomIds: rooms.filter((r) => r.level === 'First').map((r) => r.id), isIndex: true },
  ];
  return p;
}

/** Example plant room: boiler cascade on a low loss header serving cylinders and a pool. */
export function demoPlantRoom() {
  const p = newProject('Example: boiler cascade, 5 cylinders + pool');
  p.module = 'plantroom';
  p.reference = 'DEMO-PR-01';
  p.engineer = 'Callum';
  p.systemType = 'Multi-boiler plant room';
  p.settings.flowTemp = 80;
  p.settings.deltaT = 20;
  const plant = defaultPlantRoom();
  plant.sources = [{ id: uid(), name: 'Wall-hung boilers', kind: 'boiler', count: 3, outputKw: 30, flowTemp: 80, deltaT: 20, minFlowLpm: 0, notes: '' }];
  const cyl = (n: number) => ({
    id: uid(),
    name: `Cylinder ${n}`,
    type: 'dhw' as const,
    loadKw: 10,
    flowTemp: 80,
    deltaT: 20,
    diversityPct: 100,
    material: 'copper' as const,
    sizeId: '',
    lengthM: 12,
    fittingsPct: 40,
    terminalDropKpa: 8,
    valveKv: 0,
    notes: '',
  });
  plant.circuits = [1, 2, 3, 4, 5].map(cyl);
  plant.circuits.push({ ...cyl(6), name: 'Pool plate heat exchanger', type: 'pool', loadKw: 20, lengthM: 30, terminalDropKpa: 20, valveKv: 2.5 });
  p.plant = plant;
  return p;
}
