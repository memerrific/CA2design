import type { FluidId } from './fluid';
import type { Fabric } from '../data/fabrics';
import type { PipeMaterial } from './pipes';
import type { PlantRoom } from './plant';
import type { PoolInputs } from './pool';
import type { CylinderBadge, DhwDemandInput } from './dhw';
import type { AgeBand } from '../data/climate';
import type { GroundFloorKind } from './groundfloor';

export type Pt = [number, number];

/** What is on the other side of a building element. */
export type Boundary =
  | 'external' // outside air
  | 'ground' // ground floor / basement wall
  | 'unheated' // garage, loft void, unheated store
  | 'neighbour' // heated neighbouring property
  | 'room'; // another room in this design

export interface Opening {
  id: string;
  kind: 'window' | 'door' | 'rooflight';
  name: string;
  width: number; // m
  height: number; // m
  count: number;
  fabricId: string;
}

export interface Wall {
  id: string;
  name: string;
  length: number; // m
  height?: number; // m, defaults to room height
  fabricId: string;
  boundary: Boundary;
  adjacentRoomId?: string;
  customTemp?: number;
  openings: Opening[];
}

export interface Surface {
  fabricId: string;
  boundary: Boundary;
  adjacentRoomId?: string;
  customTemp?: number;
  area?: number; // defaults to room floor area
}

export type RadiatorType = '11' | '21' | '22' | '33';

export interface Emitter {
  id: string;
  kind: 'radiator' | 'custom';
  name: string;
  status: 'existing' | 'new' | 'replace';
  // radiator
  type?: RadiatorType;
  height?: number; // mm
  length?: number; // mm
  // custom (e.g. fan coil, towel rail) – rated output at ΔT50
  ratedDt50?: number;
  quantity: number;
  // Position on the floor plan: which wall of the room, and distance (m) from
  // that wall's start corner to the emitter's centre. Unset = not placed.
  wallIndex?: number;
  offsetM?: number;
  flowSizeId?: string;
  returnSizeId?: string;
}

export interface UfhDesign {
  enabled: boolean;
  manifoldId: string;
  spacing: number; // mm
  covering: string; // floor covering id
  activeAreaPct: number; // % of floor area with pipe
  leadLength: number; // m, one way, manifold to room
  pipeSizeId: string; // pex16 etc
  screedCover: number; // mm of screed above pipe
  maxLoopLength: number; // m
}

export interface Room {
  id: string;
  name: string;
  typeId: string;
  level: string;
  designTemp: number;
  ach: number;
  area: number; // m²
  height: number; // m
  polygon?: Pt[]; // m, from floor plan
  walls: Wall[];
  floor: Surface;
  ceiling: Surface;
  emitters: Emitter[];
  ufh: UfhDesign;
  notes: string;
}

export interface PipeRun {
  id: string;
  name: string;
  material: PipeMaterial;
  sizeId: string; // '' = auto
  lengthM: number; // flow + return length
  fittingsPct: number;
  loadW: number; // heat carried; 0 = take from linked rooms
  roomIds: string[];
  isIndex: boolean; // part of the index circuit
  useDrawn?: boolean; // take the length from pipes drawn on the plan (default when any are linked)
}

export interface Valve {
  id: string;
  name: string;
  kv: number;
  flowM3h: number; // 0 = from linked pipe run
  pipeRunId?: string;
  notes: string;
}

export interface Equipment {
  id: string;
  category: string;
  make: string;
  model: string;
  serial: string;
  location: string;
  outputKw?: number;
  notes: string;
}

export interface CommissioningField {
  id: string;
  label: string;
  value: string;
}

export interface HandoverSection {
  id: string;
  title: string;
  kind:
    | 'cover'
    | 'summary'
    | 'plan'
    | 'heatloss'
    | 'emitters'
    | 'ufh'
    | 'pipework'
    | 'valves'
    | 'equipment'
    | 'commissioning'
    | 'text';
  enabled: boolean;
  body?: string; // for text sections
}

export interface PlanPipe {
  id: string;
  kind: 'flow' | 'return';
  pts: Pt[]; // m, plan coordinates
  sizeId?: string;
  runId?: string; // pipe run this drawn length counts towards
}

export interface PlanNote {
  id: string;
  at: Pt;
  text: string;
}

export interface PlanValve {
  id: string;
  at: Pt;
  name: string;
}

export interface PlanUnderlay {
  // Lines (m) from a DXF import and an optional raster image.
  lines: [Pt, Pt][];
  labels: { at: Pt; text: string }[];
  pipes?: PlanPipe[];
  notes?: PlanNote[];
  valves?: PlanValve[];
  image?: { dataUrl: string; x: number; y: number; widthM: number; heightM: number };
}

export interface PriceLine {
  id: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  notes: string;
}

export interface LabourLine {
  id: string;
  description: string;
  days: number;
  dayRate: number;
}

/** Changes made by hand to a line generated from the design. */
export interface LineOverride {
  qty?: number;
  exclude?: boolean;
  notes?: string;
}

export interface Pricing {
  wastePct: number; // added to pipe and UFH pipe lengths
  sundriesPct: number; // fittings & consumables, % of materials
  markupPct: number; // on materials
  vatPct: number;
  includeInsulation: boolean;
  overrides: Record<string, LineOverride>;
  extras: PriceLine[];
  labour: LabourLine[];
  deliveryAddress: string;
  requiredBy: string;
  merchantNotes: string;
}

export interface ProjectSettings {
  externalTemp: number;
  locationName: string;
  meanExternalTemp: number; // annual mean, used for ground losses
  neighbourTemp: number;
  unheatedTemp: number;
  thermalBridgeU: number; // ΔU added to external elements
  marginPct: number;
  flowTemp: number;
  deltaT: number; // system flow–return difference
  fluid: FluidId;
  radiatorExponent: number;
  // Added with the MCS / RdSAP data. Optional so older saved projects still load;
  // read them through settingsOf() in heatloss.ts.
  ageBand?: AgeBand;
  stationId?: string;
  altitude?: number; // m above sea level
  percentile?: '99.6' | '99';
  thermalBridgeInternalU?: number; // ΔU added to internal & party elements
  airPermeability?: number; // q50, m³/(h·m²) at 50 Pa; 0 = ignore infiltration
  infiltrationFactor?: number; // q50 → natural infiltration ratio
  floorVoidAddM?: number; // added to external wall heights below the top storey
  groundFloor?: GroundFloorSettings;
}

export interface GroundFloorSettings {
  kind: GroundFloorKind;
  insulationMm: number;
  wallThicknessMm: number;
  areaOverride?: number; // m², default: sum of ground-floor room areas
  perimeterOverride?: number; // m, default: sum of external ground-floor wall lengths
}

export interface Customer {
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
}

export type ModuleId = 'heating' | 'heatloss' | 'survey' | 'materials' | 'plantroom' | 'pool' | 'dhw';

export interface Project {
  id: string;
  module?: ModuleId; // absent = 'heating' (projects made before modules existed)
  jobType?: string; // see src/jobs.ts; absent = mapped from module
  stage?: string; // job stage on the projects board; absent = 'enquiry'
  plant?: PlantRoom;
  pool?: PoolInputs;
  dhw?: DhwProject;
  name: string;
  reference: string;
  systemType: string;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  engineer: string;
  settings: ProjectSettings;
  customFabrics: Fabric[];
  rooms: Room[];
  manifolds: { id: string; name: string; location: string }[];
  pipes: PipeRun[];
  valves: Valve[];
  equipment: Equipment[];
  commissioning: CommissioningField[];
  handover: HandoverSection[];
  plans: Record<string, PlanUnderlay>; // keyed by level
  pricing?: Pricing; // absent on projects saved before pricing existed
  photo?: string; // downscaled property photo (data URL)
  northDeg?: number; // plan rotation of north, degrees clockwise
  notes: string;
}

export interface CompanyProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  accreditations: string;
  logoDataUrl?: string;
  footer: string;
}

export interface DhwProject {
  demand: DhwDemandInput;
  badge: CylinderBadge;
  primaryFlowC: number; // the system's real primary flow temperature
  primaryFlowLpm: number;
  sourceKw: number; // heat source output available for hot water
  targetReheatMinutes: number;
  spaceHeatingLoadKw: number;
  photos: string[]; // data URLs of the cylinder badge, downscaled
}
