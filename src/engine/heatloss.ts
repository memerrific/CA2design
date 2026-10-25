// Room-by-room design heat loss, following the structure of BS EN 12831-1 as
// implemented in the MCS Heat Load Calculator:
//   fabric       Φ_T = Σ (U + ΔU_tb) · A · (θint − θadj)
//   ventilation  Φ_V = 0.33 · max(n_min · V, infiltration share) · (θint − θe)
// Defaults (design temperatures, U-values, thermal bridging, air change rates)
// follow the MCS documentation, RdSAP 10 and CIBSE DHDG 2026 as listed there.
// It is a design aid: sign-off still needs a competent person checking inputs.

import type { Fabric } from '../data/fabrics';
import { FABRICS } from '../data/fabrics';
import { defaultWallThickness, thermalBridgingExternal, thermalBridgingInternal, type AgeBand } from '../data/climate';
import { groundFloorU } from './groundfloor';
import type { Boundary, GroundFloorSettings, Project, ProjectSettings, Room, Surface, Wall } from './model';

export interface ElementLoss {
  label: string;
  kind: string;
  area: number;
  u: number;
  dT: number;
  watts: number;
}

export interface RoomLoss {
  roomId: string;
  fabricW: number;
  ventilationW: number;
  totalW: number; // includes margin
  volume: number;
  airflowM3h: number;
  airflowSource: 'minimum' | 'infiltration';
  envelopeArea: number; // external envelope area of this room, m²
  wPerM2: number;
  elements: ElementLoss[];
}

/** EN 12831 ground loss factor f_g1 (annual variation of external temperature). */
export const GROUND_FACTOR = 1.45;
/** ρ·cp of air, Wh/(m³·K). */
const AIR_HEAT = 0.33;

export type FullSettings = Required<Omit<ProjectSettings, 'groundFloor' | 'meanRegion'>> & { groundFloor: GroundFloorSettings; meanRegion?: string };

/** Project settings with defaults filled in for fields older projects don't have. */
export function settingsOf(p: Pick<Project, 'settings'>): FullSettings {
  const s = p.settings;
  const band: AgeBand = s.ageBand ?? 'C';
  return {
    ...s,
    ageBand: band,
    stationId: s.stationId ?? '',
    altitude: s.altitude ?? 0,
    percentile: s.percentile ?? '99.6',
    thermalBridgeInternalU: s.thermalBridgeInternalU ?? thermalBridgingInternal(band),
    airPermeability: s.airPermeability ?? 12,
    infiltrationFactor: s.infiltrationFactor ?? 0.05,
    floorVoidAddM: s.floorVoidAddM ?? 0.25,
    groundFloor: s.groundFloor ?? { kind: 'solid', insulationMm: 0, wallThicknessMm: defaultWallThickness('cavity', band) },
  };
}

/** Defaults to apply when the age band changes. */
export function ageBandDefaults(band: AgeBand) {
  return { thermalBridgeU: thermalBridgingExternal(band), thermalBridgeInternalU: thermalBridgingInternal(band) };
}

export function fabricLookup(project: Pick<Project, 'customFabrics'>) {
  const all = [...FABRICS, ...project.customFabrics];
  const map = new Map(all.map((f) => [f.id, f]));
  return (id: string): Fabric | undefined => map.get(id);
}

const isExternalish = (b: Boundary) => b === 'external' || b === 'ground' || b === 'unheated';

// ---- Ground floor ----

const LEVEL_ORDER = ['Basement', 'Ground', 'First', 'Second', 'Third', 'Outbuilding'];

function lowestLevel(rooms: Room[]): string {
  const levels = [...new Set(rooms.map((r) => r.level))];
  return levels.sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))[0] ?? 'Ground';
}

function topLevel(rooms: Room[]): string {
  const levels = [...new Set(rooms.filter((r) => r.level !== 'Outbuilding').map((r) => r.level))];
  return levels.sort((a, b) => LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a))[0] ?? 'Ground';
}

export interface GroundFloorResult {
  area: number;
  perimeter: number;
  u: number;
  autoArea: number;
  autoPerimeter: number;
}

/** Ground floor U-value for the whole building from area and exposed perimeter. */
export function groundFloorFor(p: Project): GroundFloorResult {
  const gs = settingsOf(p).groundFloor;
  const ground = p.rooms.filter((r) => r.floor.boundary === 'ground');
  const autoArea = ground.reduce((a, r) => a + (r.floor.area ?? r.area), 0);
  const autoPerimeter = ground.reduce(
    (a, r) => a + r.walls.filter((w) => w.boundary === 'external' || w.boundary === 'unheated').reduce((b, w) => b + w.length, 0),
    0,
  );
  const area = gs.areaOverride || autoArea;
  const perimeter = gs.perimeterOverride || autoPerimeter;
  const u = groundFloorU({ kind: gs.kind, areaM2: area, exposedPerimeterM: perimeter, wallThicknessMm: gs.wallThicknessMm, insulationMm: gs.insulationMm });
  return { area, perimeter, u, autoArea, autoPerimeter };
}

// ---- Rooms ----

function deltaT(project: Project, s: FullSettings, room: Room, boundary: Boundary, adjacentRoomId?: string, customTemp?: number): number {
  const ti = room.designTemp;
  if (customTemp !== undefined && customTemp !== null && !Number.isNaN(customTemp)) return ti - customTemp;
  switch (boundary) {
    case 'external':
      return ti - s.externalTemp;
    case 'ground':
      return GROUND_FACTOR * (ti - s.meanExternalTemp);
    case 'unheated':
      return ti - s.unheatedTemp;
    case 'neighbour':
      return ti - s.neighbourTemp;
    case 'room': {
      const adj = project.rooms.find((r) => r.id === adjacentRoomId);
      return adj ? ti - adj.designTemp : 0;
    }
  }
}

export function wallGrossArea(wall: Wall, room: Room, extraHeight = 0): number {
  return wall.length * ((wall.height ?? room.height) + (wall.height === undefined ? extraHeight : 0));
}

export function openingArea(wall: Wall): number {
  return wall.openings.reduce((a, o) => a + o.width * o.height * o.count, 0);
}

interface Ctx {
  s: FullSettings;
  fab: (id: string) => Fabric | undefined;
  groundU: number;
  top: string;
}

function context(project: Project): Ctx {
  return { s: settingsOf(project), fab: fabricLookup(project), groundU: groundFloorFor(project).u, top: topLevel(project.rooms) };
}

function roomFabric(project: Project, room: Room, c: Ctx): { elements: ElementLoss[]; envelope: number } {
  const elements: ElementLoss[] = [];
  let envelope = 0;
  const add = (label: string, kind: string, area: number, fabricId: string, boundary: Boundary, adj?: string, custom?: number) => {
    const f = c.fab(fabricId);
    if (!f || area <= 0) return;
    const base = f.calculated === 'ground-floor' ? c.groundU : f.u;
    const tb = isExternalish(boundary) ? c.s.thermalBridgeU : c.s.thermalBridgeInternalU;
    const u = base + tb;
    const dT = deltaT(project, c.s, room, boundary, adj, custom);
    if (isExternalish(boundary)) envelope += area;
    elements.push({ label, kind, area, u, dT, watts: u * area * dT });
  };

  // Storeys below the top get the floor void added to external wall heights (MCS, net internal dimensions).
  const voidAdd = room.level !== c.top ? c.s.floorVoidAddM : 0;
  for (const w of room.walls) {
    const extra = w.boundary === 'external' || w.boundary === 'unheated' || w.boundary === 'neighbour' ? voidAdd : 0;
    const net = Math.max(0, wallGrossArea(w, room, extra) - openingArea(w));
    add(w.name, 'wall', net, w.fabricId, w.boundary, w.adjacentRoomId, w.customTemp);
    for (const o of w.openings) {
      add(`${o.name} (${w.name})`, o.kind, o.width * o.height * o.count, o.fabricId, w.boundary, w.adjacentRoomId, w.customTemp);
    }
  }
  const surf = (label: string, kind: string, s: Surface) => add(label, kind, s.area ?? room.area, s.fabricId, s.boundary, s.adjacentRoomId, s.customTemp);
  surf('Floor', 'floor', room.floor);
  surf('Ceiling / roof', 'ceiling', room.ceiling);
  return { elements, envelope };
}

export interface ProjectLoss {
  rooms: RoomLoss[];
  totalW: number;
  fabricW: number;
  ventilationW: number;
  area: number;
  envelopeArea: number;
  infiltrationM3h: number;
  ground: GroundFloorResult;
  byId: Map<string, RoomLoss>;
}

export function projectHeatLoss(project: Project): ProjectLoss {
  const c = context(project);
  const fabric = project.rooms.map((r) => roomFabric(project, r, c));
  const envelopeArea = fabric.reduce((a, f) => a + f.envelope, 0);
  // Building infiltration from air permeability, shared out by each room's external envelope.
  const infiltrationM3h = c.s.airPermeability * envelopeArea * c.s.infiltrationFactor;

  const rooms: RoomLoss[] = project.rooms.map((room, i) => {
    const { elements, envelope } = fabric[i];
    const fabricW = elements.reduce((a, e) => a + e.watts, 0);
    const volume = room.area * room.height;
    const minFlow = room.ach * volume;
    const infShare = envelopeArea > 0 ? (infiltrationM3h * envelope) / envelopeArea : 0;
    const airflowM3h = Math.max(minFlow, infShare);
    const ventilationW = AIR_HEAT * airflowM3h * (room.designTemp - c.s.externalTemp);
    const totalW = (fabricW + ventilationW) * (1 + c.s.marginPct / 100);
    return {
      roomId: room.id,
      fabricW,
      ventilationW,
      totalW,
      volume,
      airflowM3h,
      airflowSource: infShare > minFlow ? 'infiltration' : 'minimum',
      envelopeArea: envelope,
      wPerM2: room.area > 0 ? totalW / room.area : 0,
      elements,
    };
  });

  return {
    rooms,
    totalW: rooms.reduce((a, r) => a + r.totalW, 0),
    fabricW: rooms.reduce((a, r) => a + r.fabricW, 0),
    ventilationW: rooms.reduce((a, r) => a + r.ventilationW, 0),
    area: project.rooms.reduce((a, r) => a + r.area, 0),
    envelopeArea,
    infiltrationM3h,
    ground: groundFloorFor(project),
    byId: new Map(rooms.map((r) => [r.roomId, r])),
  };
}

/** Single room, in the context of its project. */
export function roomHeatLoss(project: Project, room: Room): RoomLoss {
  return projectHeatLoss(project).byId.get(room.id)!;
}

export { lowestLevel };

// ---- Geometry helpers for imported plans ----

export function polygonArea(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function segLength(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
