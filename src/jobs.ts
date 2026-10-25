import type { ModuleId, Project } from './engine/model';
import { moduleOf } from './modules';

// The app is organised as categories → job types → steps. A job type picks
// which steps a project shows; every step works on the same project, so a job
// can change type later without losing anything.

export type CategoryId = 'design' | 'survey' | 'plant' | 'cooling' | 'solar' | 'business';

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  { id: 'design', name: 'System design', icon: 'heating', blurb: 'Heating, hot and cold water, conversions and underfloor: whole houses or just one part.' },
  { id: 'survey', name: 'Heat loss & survey', icon: 'heatloss', blurb: 'Room-by-room heat loss and site surveys on their own, with a printable report.' },
  { id: 'plant', name: 'Plant & commercial', icon: 'plantroom', blurb: 'Multi-boiler plant rooms, low loss headers and pool heating.' },
  { id: 'cooling', name: 'Air con & cooling', icon: 'aircon', blurb: 'Cooling loads from the same rooms, unit selection and F-gas records.' },
  { id: 'solar', name: 'Solar & battery', icon: 'solar', blurb: 'PV layout and yield, battery sizing and EV chargers.' },
  { id: 'business', name: 'Business', icon: 'coins', blurb: 'Your job board, price list, branding and where every number comes from.' },
];

export const categoryInfo = (id: string) => CATEGORIES.find((c) => c.id === id);

export interface StepDef {
  id: string;
  label: string;
  group: 'Survey' | 'Design' | 'Materials' | 'Finish';
  /** Shown in the "What this page does" box at the top of the step. */
  explain: string;
}

export const STEPS: Record<string, StepDef> = {
  overview: { id: 'overview', label: 'Overview', group: 'Survey', explain: 'The job’s details: customer, address, engineer and notes, plus the design conditions (outside temperature, location, house age) every calculation uses. The tick list shows which steps are done.' },
  plan: { id: 'plan', label: 'Floor plan', group: 'Survey', explain: 'Draw the rooms, or import a Polycam scan or plan image and trace over it. Then place radiators, underfloor and pipe runs on the plan. Floors and drawing layers are in the side panel (under the drawing on a phone).' },
  rooms: { id: 'rooms', label: 'Rooms', group: 'Survey', explain: 'Each room’s size, temperature, walls, windows, doors, floor and ceiling. The U-values come from the RdSAP tables for the house’s age unless you change them.' },
  heatloss: { id: 'heatloss', label: 'Heat loss', group: 'Design', explain: 'Room-by-room heat loss to BS EN 12831 using MCS design temperatures: fabric losses through every surface plus ventilation. The total is what the heat source has to deliver on the coldest design day.' },
  emitters: { id: 'emitters', label: 'Radiators', group: 'Design', explain: 'Checks each room’s radiators against its heat loss at your flow temperature, and suggests sizes where they fall short. Outputs are corrected from the catalogue ΔT50 figure to your real water and room temperatures.' },
  ufh: { id: 'ufh', label: 'Underfloor', group: 'Design', explain: 'Underfloor heating to EN 1264: floor build-up, pipe spacing, loop lengths and flow per loop, and whether each room’s floor can cover its heat loss.' },
  pipework: { id: 'pipework', label: 'Pipework', group: 'Design', explain: 'Pipe runs with their lengths and loads. Works out flow rates, picks pipe sizes, and gives pressure drop, velocity and valve Kv so you can balance the system and size the pump.' },
  dhw: { id: 'dhw', label: 'Hot water', group: 'Design', explain: 'Sizes the cylinder from the household, reads the cylinder’s data badge, and checks reheat time and the legionella cycle on the heat source you are fitting.' },
  equipment: { id: 'equipment', label: 'Equipment', group: 'Design', explain: 'The main kit for the job: heat pump or boiler, cylinder, pumps, controls and anything else, with model numbers for the materials list and handover pack.' },
  plant: { id: 'plant', label: 'Sources & circuits', group: 'Design', explain: 'Start from the loads leaving the plant room: each circuit’s kW and temperatures, and the boilers or heat pumps feeding them.' },
  header: { id: 'header', label: 'Header & pumps', group: 'Design', explain: 'Sizes the low loss header and each circuit pump, and shows the temperature each circuit really gets once primary and secondary flows mix.' },
  pool: { id: 'pool', label: 'Pool', group: 'Design', explain: 'Pool size, cover, location and use give the heat-up and running losses, the heat pump or plate heat exchanger duty, and the flow rates either side.' },
  pricing: { id: 'pricing', label: 'Materials', group: 'Materials', explain: 'Turns the design into a list of things to buy: pipe by size, fittings, radiators, underfloor and equipment, with quantities and where each one came from.' },
  merchant: { id: 'merchant', label: 'Merchant request', group: 'Materials', explain: 'Sends the materials list to merchants for prices, as a branded PDF, a CSV or a JSON file. No prices of yours are shown on it.' },
  handover: { id: 'handover', label: 'Handover pack', group: 'Finish', explain: 'The pack you leave with the customer: system summary, plans, room-by-room results, schedules, commissioning record and how to use the system. Choose the sections, then print or save as PDF.' },
  report: { id: 'report', label: 'Heat loss report', group: 'Finish', explain: 'A printable heat loss report for the customer or your records, in CA2 branding.' },
  'survey-report': { id: 'survey-report', label: 'Survey summary', group: 'Finish', explain: 'A printable summary of the survey: plans, rooms, heat loss and the equipment found on site.' },
  'plant-sheet': { id: 'plant-sheet', label: 'Design sheet', group: 'Finish', explain: 'A printable plant room design sheet for the job file.' },
  'pool-sheet': { id: 'pool-sheet', label: 'Design sheet', group: 'Finish', explain: 'A printable pool heating design sheet for the job file.' },
  'dhw-sheet': { id: 'dhw-sheet', label: 'Design sheet', group: 'Finish', explain: 'A printable hot water design sheet for the job file.' },
};

export interface JobType {
  id: string;
  category: CategoryId;
  name: string;
  short: string;
  icon: string;
  blurb: string;
  /** Which engine family the job belongs to (decides the overview and defaults). */
  module: ModuleId;
  steps: string[];
  finish: string;
  live: boolean;
  systemType?: string;
  /** Shown on the overview when a job type is an early version. */
  note?: string;
}

const PROPERTY = ['overview', 'plan', 'rooms', 'heatloss'];

export const JOB_TYPES: JobType[] = [
  // System design
  { id: 'whole', category: 'design', name: 'Whole house', short: 'Whole house', icon: 'heating', module: 'heating', blurb: 'Heating plus hot and cold water: survey, heat loss, radiators, underfloor, pipework, cylinder, materials and handover.', steps: [...PROPERTY, 'emitters', 'ufh', 'pipework', 'dhw', 'equipment', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'heating', category: 'design', name: 'Heating system only', short: 'Heating', icon: 'radiator', module: 'heating', blurb: 'Heat loss, radiators, underfloor, pipework and the heat source. No hot and cold plumbing.', steps: [...PROPERTY, 'emitters', 'ufh', 'pipework', 'equipment', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'boiler-hp', category: 'design', name: 'Boiler to heat pump', short: 'Boiler → HP', icon: 'swap', module: 'heating', systemType: 'Air source heat pump', blurb: 'Survey the existing system, check every radiator at heat pump temperatures, size the heat pump and cylinder.', steps: [...PROPERTY, 'emitters', 'pipework', 'dhw', 'equipment', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'oil-hp', category: 'design', name: 'Oil boiler to heat pump', short: 'Oil → HP', icon: 'oil', module: 'heating', systemType: 'Air source heat pump', blurb: 'As boiler to heat pump, for homes coming off oil.', note: 'Oil tank decommissioning notes and the oil-versus-heat-pump running cost comparison are coming in a later update.', steps: [...PROPERTY, 'emitters', 'pipework', 'dhw', 'equipment', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'boiler-swap', category: 'design', name: 'Boiler replacement', short: 'Boiler swap', icon: 'flame', module: 'heating', systemType: 'Other', blurb: 'Like for like: check the size against the heat loss, list the kit and materials, hand over.', note: 'The room list is optional here. Add rooms if you want to check the new boiler’s size against the heat loss.', steps: ['overview', 'rooms', 'heatloss', 'equipment', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'extension', category: 'design', name: 'Extension or renovation', short: 'Extension', icon: 'extension', module: 'heating', blurb: 'Only the new or changed rooms, joined to the existing system.', note: 'Add just the new or changed rooms. Joining them to existing pipework is coming in a later update.', steps: [...PROPERTY, 'emitters', 'ufh', 'pipework', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'ufh-only', category: 'design', name: 'Underfloor heating only', short: 'Underfloor', icon: 'ufh', module: 'heating', blurb: 'Room loads, EN 1264 loops, manifold and the materials list.', steps: [...PROPERTY, 'ufh', 'pricing', 'merchant'], finish: 'handover', live: true },
  { id: 'cylinder', category: 'design', name: 'Hot water cylinder', short: 'Cylinder', icon: 'dhw', module: 'dhw', blurb: 'Size the cylinder from the household, read the data badge, check reheat time on a heat pump.', steps: ['overview', 'dhw'], finish: 'dhw-sheet', live: true },
  { id: 'materials', category: 'design', name: 'Pipe runs & materials', short: 'Materials', icon: 'materials', module: 'materials', blurb: 'Pipe sizing, flow rates and Kv, then a materials list and a merchant request.', steps: ['overview', 'pipework', 'equipment', 'pricing'], finish: 'merchant', live: true },
  { id: 'bathroom', category: 'design', name: 'Bathroom / hot and cold', short: 'Bathroom', icon: 'bath', module: 'materials', blurb: 'Hot and cold material runs and costs for bathrooms and plumbing jobs.', steps: [], finish: 'merchant', live: false },
  // Heat loss & survey
  { id: 'heatloss', category: 'survey', name: 'Heat loss calculation', short: 'Heat loss', icon: 'heatloss', module: 'heatloss', blurb: 'Room-by-room heat loss with MCS design data and a printable report.', steps: PROPERTY, finish: 'report', live: true },
  { id: 'survey', category: 'survey', name: 'Site survey', short: 'Survey', icon: 'survey', module: 'survey', blurb: 'Plans, rooms, fabric and the existing equipment on site.', steps: ['overview', 'plan', 'rooms', 'equipment'], finish: 'survey-report', live: true },
  { id: 'estimate', category: 'survey', name: 'Quick budget estimate', short: 'Estimate', icon: 'clock', module: 'heatloss', blurb: 'A whole-house kW, suggested kit and BUS grant line from a few answers, before you visit.', steps: [], finish: 'report', live: false },
  // Plant & commercial
  { id: 'plantroom', category: 'plant', name: 'Plant room & low loss header', short: 'Plant room', icon: 'plantroom', module: 'plantroom', systemType: 'Multi-boiler plant room', blurb: 'Boiler cascades, low loss header, pumps, Kv and the temperatures circuits really get.', steps: ['overview', 'plant', 'header'], finish: 'plant-sheet', live: true },
  { id: 'pool', category: 'plant', name: 'Pool heating', short: 'Pool', icon: 'pool', module: 'pool', systemType: 'Pool heat pump', blurb: 'Heat-up and running losses, cover savings, and the heat pump or plate heat exchanger duty.', steps: ['overview', 'pool'], finish: 'pool-sheet', live: true },
  // Air con & cooling
  { id: 'cooling', category: 'cooling', name: 'Cooling loads', short: 'Cooling', icon: 'aircon', module: 'heating', blurb: 'Cooling loads from the rooms already surveyed, with sun and internal gains.', steps: [], finish: 'report', live: false },
  { id: 'splits', category: 'cooling', name: 'Split & multi-split', short: 'Splits', icon: 'aircon', module: 'heating', blurb: 'Indoor and outdoor unit selection from the loads.', steps: [], finish: 'report', live: false },
  { id: 'fgas', category: 'cooling', name: 'Refrigerant & F-gas records', short: 'F-gas', icon: 'service', module: 'heating', blurb: 'Pipe runs, extra charge, CO₂e, leak-check frequency and the F-gas log.', steps: [], finish: 'report', live: false },
  // Solar & battery
  { id: 'pv', category: 'solar', name: 'Solar PV & battery', short: 'Solar', icon: 'solar', module: 'heating', blurb: 'Array layout, yield, inverter and battery sizing, DNO paperwork.', steps: [], finish: 'report', live: false },
  { id: 'ev', category: 'solar', name: 'EV charger', short: 'EV', icon: 'ev', module: 'heating', blurb: 'Charger siting and the supply load check.', steps: [], finish: 'report', live: false },
];

export const jobInfo = (id: string) => JOB_TYPES.find((j) => j.id === id);

const LEGACY: Record<ModuleId, string> = {
  heating: 'heating',
  heatloss: 'heatloss',
  survey: 'survey',
  materials: 'materials',
  plantroom: 'plantroom',
  pool: 'pool',
  dhw: 'cylinder',
};

/** The job type of a project; projects made before job types existed map from their module. */
export function jobTypeOf(p: Project): JobType {
  return jobInfo(p.jobType ?? '') ?? jobInfo(LEGACY[moduleOf(p)])!;
}

/** Old #/m/<module> links point at the matching job type. */
export const jobForModule = (m: string) => LEGACY[m as ModuleId];

/** A job's name for display; blank names show as “Untitled job”. */
export const jobName = (p: Project) => p.name.trim() || 'Untitled job';
