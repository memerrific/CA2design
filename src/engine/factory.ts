import { defaultRoomTemp, roomType } from '../data/rooms';
import type { AgeBand } from '../data/climate';
import { distToSegment } from './dxf';
import { polygonArea, segLength } from './heatloss';
import type { CompanyProfile, HandoverSection, Project, Pt, Room, Wall } from './model';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_COMMISSIONING = [
  'System flushed (method / product)',
  'Inhibitor added (product / dose)',
  'Cold fill pressure (bar)',
  'Expansion vessel pre-charge (bar)',
  'Pressure relief valve setting (bar)',
  'Heat pump / boiler flow temperature set (°C)',
  'Weather compensation curve',
  'Measured system ΔT at commissioning (K)',
  'Primary flow rate (l/min)',
  'Cylinder thermostat / DHW setpoint (°C)',
  'Legionella cycle schedule',
  'Antifreeze / glycol concentration',
  'Combustion analysis (oil): CO₂ % / CO ppm / ratio',
  'Electrical isolation & RCD test',
  'Controls and programmer set up with customer',
];

export const DEFAULT_HANDOVER: HandoverSection[] = [
  { id: 'cover', title: 'Cover', kind: 'cover', enabled: true },
  { id: 'summary', title: 'System summary', kind: 'summary', enabled: true },
  { id: 'plan', title: 'Floor plans', kind: 'plan', enabled: true },
  { id: 'heatloss', title: 'Room-by-room heat loss', kind: 'heatloss', enabled: true },
  { id: 'emitters', title: 'Radiator schedule', kind: 'emitters', enabled: true },
  { id: 'ufh', title: 'Underfloor heating schedule', kind: 'ufh', enabled: true },
  { id: 'pipework', title: 'Pipework schedule', kind: 'pipework', enabled: true },
  { id: 'valves', title: 'Valves & balancing (Kv)', kind: 'valves', enabled: true },
  { id: 'equipment', title: 'Installed equipment', kind: 'equipment', enabled: true },
  { id: 'commissioning', title: 'Commissioning record', kind: 'commissioning', enabled: true },
  {
    id: 'using',
    title: 'Using your system',
    kind: 'text',
    enabled: true,
    body:
      'Your system is designed to run low and slow. Leave the heating on with a steady setpoint rather than switching it on and off; the weather compensation will adjust the flow temperature automatically as the outside temperature changes.\n\nRadiator valves have been balanced at commissioning. Please do not adjust lockshield valves or underfloor flow meters.',
  },
  {
    id: 'maintenance',
    title: 'Maintenance & warranty',
    kind: 'text',
    enabled: true,
    body:
      'Annual service recommended to keep warranties valid. Keep the area around the outdoor unit clear of leaves and snow. Check system pressure monthly; it should read between 1.0 and 1.5 bar when cold.\n\nWarranty registration details are listed with the installed equipment.',
  },
];

export function newProject(name = 'New project'): Project {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name,
    reference: '',
    systemType: 'Air source heat pump',
    createdAt: now,
    updatedAt: now,
    customer: { name: '', address: '', postcode: '', phone: '', email: '' },
    engineer: '',
    settings: {
      externalTemp: -3.0,
      locationName: 'London (Heathrow)',
      stationId: 'london',
      altitude: 0,
      percentile: '99.6',
      meanExternalTemp: 10.2,
      neighbourTemp: 10,
      unheatedTemp: 7,
      ageBand: 'C',
      thermalBridgeU: 0.15,
      thermalBridgeInternalU: 0.1,
      airPermeability: 12,
      infiltrationFactor: 0.05,
      floorVoidAddM: 0.25,
      groundFloor: { kind: 'solid', insulationMm: 0, wallThicknessMm: 250 },
      marginPct: 0,
      flowTemp: 45,
      deltaT: 5,
      fluid: 'water',
      radiatorExponent: 1.3,
    },
    customFabrics: [],
    rooms: [],
    manifolds: [{ id: 'm1', name: 'Manifold 1', location: '' }],
    pipes: [],
    valves: [],
    equipment: [],
    commissioning: DEFAULT_COMMISSIONING.map((label) => ({ id: uid(), label, value: '' })),
    handover: DEFAULT_HANDOVER.map((s) => ({ ...s })),
    plans: {},
    notes: '',
  };
}

export function newWall(n: number, length = 3, external = true): Wall {
  return {
    id: uid(),
    name: `Wall ${n}`,
    length,
    fabricId: external ? 'w-cavity-filled' : 'w-int-stud',
    boundary: external ? 'external' : 'room',
    openings: [],
  };
}

export function newRoom(name: string, typeId = 'living', level = 'Ground', band: AgeBand = 'C'): Room {
  const t = roomType(typeId);
  return {
    id: uid(),
    name,
    typeId,
    level,
    designTemp: defaultRoomTemp(typeId, band),
    ach: t.ach,
    area: 12,
    height: 2.4,
    walls: [newWall(1, 4), newWall(2, 3)],
    floor: { fabricId: level === 'Ground' ? 'f-ground-calc' : 'f-intermediate', boundary: level === 'Ground' ? 'ground' : 'room' },
    ceiling: { fabricId: 'r-loft-270', boundary: 'external' },
    emitters: [],
    ufh: {
      enabled: false,
      manifoldId: 'm1',
      spacing: 150,
      covering: 'tile',
      activeAreaPct: 90,
      leadLength: 3,
      pipeSizeId: 'pex16',
      screedCover: 45,
      maxLoopLength: 100,
    },
    notes: '',
  };
}

/** Make a room from a traced or imported polygon, one wall per edge. */
export function roomFromPolygon(name: string, poly: Pt[], level: string, typeId = 'living', band: AgeBand = 'C'): Room {
  const r = newRoom(name, typeId, level, band);
  r.polygon = poly;
  r.area = round(polygonArea(poly), 2);
  r.walls = poly.map((p, i) => ({ ...newWall(i + 1, round(segLength(p, poly[(i + 1) % poly.length]), 2)) }));
  return r;
}

/**
 * Mark walls that sit on another room's wall as internal and link them, leaving
 * the rest external. Runs over all rooms with polygons on the same level.
 */
export function detectAdjacency(rooms: Room[], tol = 0.35): Room[] {
  return rooms.map((room) => {
    if (!room.polygon) return room;
    const poly = room.polygon;
    const walls = room.walls.map((w, i) => {
      if (i >= poly.length) return w;
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const other of rooms) {
        if (other.id === room.id || !other.polygon || other.level !== room.level) continue;
        const op = other.polygon;
        for (let k = 0; k < op.length; k++) {
          if (distToSegment(mid, op[k], op[(k + 1) % op.length]) < tol) {
            return { ...w, boundary: 'room' as const, adjacentRoomId: other.id, fabricId: w.boundary === 'external' ? 'w-int-stud' : w.fabricId, name: `To ${other.name}` };
          }
        }
      }
      return w;
    });
    return { ...room, walls };
  });
}

export const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export const DEFAULT_COMPANY: CompanyProfile = {
  name: 'CA2 Mechanical & Electrical',
  tagline: 'Heating · Plumbing · Renewables',
  address: '',
  phone: '',
  email: '',
  website: '',
  accreditations: 'OFTEC · NICEIC · Heat Geek trained',
  footer: 'This pack was prepared from the survey and design information available at handover. Keep it with the property documents.',
};
