import type { ModuleId, Project } from './engine/model';

export interface ModuleInfo {
  id: string;
  name: string;
  blurb: string;
  live: boolean;
  covers: string[];
}

// The app's sections. Live ones open a project list; planned ones show what
// they'll do so the roadmap is visible in one place.
export const MODULES: ModuleInfo[] = [
  {
    id: 'heating',
    name: 'Heating design',
    blurb: 'Survey to handover for a building: room-by-room heat loss, radiators, underfloor, pipework, pricing and the handover pack.',
    live: true,
    covers: ['Heat pumps', 'Oil & boiler replacements', 'Extensions & renovations', 'Commercial spaces'],
  },
  {
    id: 'plantroom',
    name: 'Plant room & low loss header',
    blurb: 'Start from the loads leaving the plant room: circuit flows, pipe sizes, pump duties, Kv, header size and the temperatures the header will actually deliver.',
    live: true,
    covers: ['Boiler cascades', 'Cylinders & calorifiers', 'Pool heat exchangers', 'AHU coils'],
  },
  {
    id: 'aircon',
    name: 'Air conditioning & F-gas',
    blurb: 'Cooling loads, unit selection, refrigerant pipe runs and additional charge, CO₂e, leak-check frequency and F-gas records.',
    live: false,
    covers: ['Split & multi-split', 'VRF', 'Leak-check log'],
  },
  {
    id: 'pool',
    name: 'Pool heating',
    blurb: 'Heat-up and running loads, evaporation and cover savings, pool heat pump or plate heat exchanger sizing.',
    live: false,
    covers: ['Indoor & outdoor pools', 'Hot tubs', 'Pool heat pumps'],
  },
  {
    id: 'dhw',
    name: 'Hot water & cylinders',
    blurb: 'Peak demand, cylinder and coil sizing, reheat times, legionella control and unvented G3 records.',
    live: false,
    covers: ['Unvented cylinders', 'Thermal stores', 'Calorifiers'],
  },
  {
    id: 'large',
    name: 'Churches & large spaces',
    blurb: 'Tall, intermittently heated buildings: height corrections, preheat time, stratification and zoning.',
    live: false,
    covers: ['Churches & halls', 'Warehouses', 'Workshops'],
  },
  {
    id: 'solar',
    name: 'Solar PV & battery',
    blurb: 'Array layout, yield estimate, inverter and battery sizing, DNO paperwork.',
    live: false,
    covers: ['Roof & ground mount', 'Battery storage'],
  },
  {
    id: 'oil',
    name: 'Oil installations',
    blurb: 'Tank siting and separation checks, oil supply line sizing, and the commissioning and landlord paperwork.',
    live: false,
    covers: ['Tank replacement', 'Boiler installs'],
  },
  {
    id: 'service',
    name: 'Service & commissioning records',
    blurb: 'Service sheets, combustion results, commissioning checklists and annual reminders.',
    live: false,
    covers: ['Boilers', 'Heat pumps', 'Unvented'],
  },
];

export const moduleOf = (p: Project): ModuleId => p.module ?? 'heating';
export const moduleInfo = (id: string) => MODULES.find((m) => m.id === id);
