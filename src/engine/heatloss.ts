// Room-by-room design heat loss, following the structure of BS EN 12831-1:
//   fabric loss   Φ_T = Σ U·A·(θint − θadj)   (with a ground-floor treatment)
//   ventilation   Φ_V = 0.33 · n · V · (θint − θe)
// It is a design aid: sign-off still needs a competent person checking inputs.

import type { Fabric } from '../data/fabrics';
import { FABRICS } from '../data/fabrics';
import type { Boundary, Project, Room, Surface, Wall } from './model';

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
  wPerM2: number;
  elements: ElementLoss[];
}

const GROUND_FACTOR = 1.45; // EN 12831 f_g1, annual variation of external temperature

export function fabricLookup(project: Pick<Project, 'customFabrics'>) {
  const all = [...FABRICS, ...project.customFabrics];
  const map = new Map(all.map((f) => [f.id, f]));
  return (id: string): Fabric | undefined => map.get(id);
}

/** Temperature difference across an element, K. */
function deltaT(project: Project, room: Room, boundary: Boundary, adjacentRoomId?: string, customTemp?: number): number {
  const s = project.settings;
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

const isExternalish = (b: Boundary) => b === 'external' || b === 'ground' || b === 'unheated';

export function wallGrossArea(wall: Wall, room: Room): number {
  return wall.length * (wall.height ?? room.height);
}

export function openingArea(wall: Wall): number {
  return wall.openings.reduce((a, o) => a + o.width * o.height * o.count, 0);
}

export function roomHeatLoss(project: Project, room: Room): RoomLoss {
  const fab = fabricLookup(project);
  const tb = project.settings.thermalBridgeU;
  const elements: ElementLoss[] = [];

  const add = (label: string, kind: string, area: number, fabricId: string, boundary: Boundary, adj?: string, custom?: number) => {
    const f = fab(fabricId);
    if (!f || area <= 0) return;
    const u = f.u + (isExternalish(boundary) ? tb : 0);
    const dT = deltaT(project, room, boundary, adj, custom);
    elements.push({ label, kind, area, u, dT, watts: u * area * dT });
  };

  for (const w of room.walls) {
    const net = Math.max(0, wallGrossArea(w, room) - openingArea(w));
    add(w.name, 'wall', net, w.fabricId, w.boundary, w.adjacentRoomId, w.customTemp);
    for (const o of w.openings) {
      add(`${o.name} (${w.name})`, o.kind, o.width * o.height * o.count, o.fabricId, w.boundary, w.adjacentRoomId, w.customTemp);
    }
  }

  const surf = (label: string, kind: string, s: Surface) =>
    add(label, kind, s.area ?? room.area, s.fabricId, s.boundary, s.adjacentRoomId, s.customTemp);
  surf('Floor', 'floor', room.floor);
  surf('Ceiling / roof', 'ceiling', room.ceiling);

  const fabricW = elements.reduce((a, e) => a + e.watts, 0);
  const volume = room.area * room.height;
  const ventilationW = 0.33 * room.ach * volume * (room.designTemp - project.settings.externalTemp);
  const totalW = (fabricW + ventilationW) * (1 + project.settings.marginPct / 100);
  return {
    roomId: room.id,
    fabricW,
    ventilationW,
    totalW,
    volume,
    wPerM2: room.area > 0 ? totalW / room.area : 0,
    elements,
  };
}

export interface ProjectLoss {
  rooms: RoomLoss[];
  totalW: number;
  fabricW: number;
  ventilationW: number;
  area: number;
  byId: Map<string, RoomLoss>;
}

export function projectHeatLoss(project: Project): ProjectLoss {
  const rooms = project.rooms.map((r) => roomHeatLoss(project, r));
  return {
    rooms,
    totalW: rooms.reduce((a, r) => a + r.totalW, 0),
    fabricW: rooms.reduce((a, r) => a + r.fabricW, 0),
    ventilationW: rooms.reduce((a, r) => a + r.ventilationW, 0),
    area: project.rooms.reduce((a, r) => a + r.area, 0),
    byId: new Map(rooms.map((r) => [r.roomId, r])),
  };
}

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
