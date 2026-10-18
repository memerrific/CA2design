import type { ModuleId, Project } from './engine/model';

export interface ModuleInfo {
  id: ModuleId | string;
  name: string;
  short: string;
  blurb: string;
  live: boolean;
  group: 'project' | 'tool' | 'planned';
  covers: string[];
  /** Live tools whose data a full property project already contains. */
  partOfProperty?: boolean;
}

// The app's sections. The whole property project runs survey → handover; the
// tools do one job each and can be upgraded into, or imported by, each other.
export const MODULES: ModuleInfo[] = [
  {
    id: 'heating',
    name: 'Whole property project',
    short: 'Property',
    blurb: 'Survey to handover in one place: floor plans, room-by-room heat loss, radiators, underfloor, pipework, pricing and the handover pack.',
    live: true,
    group: 'project',
    covers: ['Heat pumps', 'Boiler replacements', 'Renovations', 'Commercial'],
  },
  {
    id: 'heatloss',
    name: 'Heat loss calculation',
    short: 'Heat loss',
    blurb: 'Room-by-room heat loss with MCS design data and a printable report.',
    live: true,
    group: 'tool',
    covers: ['BS EN 12831', 'MCS defaults', 'Report'],
    partOfProperty: true,
  },
  {
    id: 'survey',
    name: 'Site survey',
    short: 'Survey',
    blurb: 'Polycam plans, rooms, fabric, windows and the existing equipment on site.',
    live: true,
    group: 'tool',
    covers: ['Polycam DXF', 'Fabric', 'Existing plant'],
    partOfProperty: true,
  },
  {
    id: 'materials',
    name: 'Pipe runs & materials',
    short: 'Materials',
    blurb: 'Pipe sizing, flow rates and Kv, then a priced materials list and a merchant request.',
    live: true,
    group: 'tool',
    covers: ['Pipe sizing', 'Kv', 'Merchant RFQ'],
    partOfProperty: true,
  },
  {
    id: 'plantroom',
    name: 'Plant room & low loss header',
    short: 'Plant room',
    blurb: 'Start from the loads leaving the plant room: flows, pumps, Kv, header size and the temperatures circuits really get.',
    live: true,
    group: 'tool',
    covers: ['Boiler cascades', 'Cylinders', 'Pools', 'AHU coils'],
  },
  {
    id: 'pool',
    name: 'Pool heating',
    short: 'Pool',
    blurb: 'Heat-up and running losses, cover savings, and the heat pump or plate heat exchanger duty.',
    live: true,
    group: 'tool',
    covers: ['Indoor & outdoor', 'Covers', 'Plate HEX'],
  },
  {
    id: 'dhw',
    name: 'Hot water & cylinders',
    short: 'Hot water',
    blurb: 'Size the cylinder from the household, read the data badge, and check reheat times on a heat pump.',
    live: true,
    group: 'tool',
    covers: ['Cylinder sizing', 'Coil kW', 'Legionella'],
  },
  {
    id: 'aircon',
    name: 'Air conditioning & F-gas',
    short: 'Air con',
    blurb: 'Cooling loads, unit selection, refrigerant pipe runs and charge, CO₂e, leak-check frequency and F-gas records.',
    live: false,
    group: 'planned',
    covers: [],
  },
  {
    id: 'solar',
    name: 'Solar PV & battery',
    short: 'Solar',
    blurb: 'Array layout, yield estimate, inverter and battery sizing, DNO paperwork.',
    live: false,
    group: 'planned',
    covers: [],
  },
  {
    id: 'oil',
    name: 'Oil installations',
    short: 'Oil',
    blurb: 'Tank siting and separation checks, oil line sizing, commissioning paperwork.',
    live: false,
    group: 'planned',
    covers: [],
  },
  {
    id: 'service',
    name: 'Service & commissioning records',
    short: 'Service',
    blurb: 'Service sheets, combustion results, commissioning checklists and reminders.',
    live: false,
    group: 'planned',
    covers: [],
  },
];

export const moduleOf = (p: Project): ModuleId => p.module ?? 'heating';
export const moduleInfo = (id: string) => MODULES.find((m) => m.id === id);
