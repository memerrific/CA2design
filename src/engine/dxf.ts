// Minimal DXF reader for floor plans exported from Polycam (and most CAD tools).
// Reads LINE, LWPOLYLINE, POLYLINE/VERTEX, ARC (as chords), TEXT/MTEXT and expands
// INSERTed blocks. Coordinates are converted to metres using $INSUNITS.

import type { Pt } from './model';

export interface DxfPlan {
  lines: [Pt, Pt][];
  polygons: Pt[][]; // closed polylines, candidate rooms
  labels: { at: Pt; text: string }[];
  unitsToMetres: number;
  unitsName: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

type Pair = { code: number; value: string };

const UNIT_SCALE: Record<number, [number, string]> = {
  0: [1, 'unitless (assumed metres)'],
  1: [0.0254, 'inches'],
  2: [0.3048, 'feet'],
  4: [0.001, 'millimetres'],
  5: [0.01, 'centimetres'],
  6: [1, 'metres'],
};

function pairs(text: string): Pair[] {
  const lines = text.split(/\r?\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    out.push({ code, value: lines[i + 1].trim() });
  }
  return out;
}

interface Entity {
  type: string;
  props: Pair[];
}

function num(e: Entity, code: number, def = 0): number {
  const p = e.props.find((x) => x.code === code);
  return p ? parseFloat(p.value) : def;
}

function str(e: Entity, code: number): string {
  return e.props.find((x) => x.code === code)?.value ?? '';
}

/** Split a flat list of pairs into entities (each starting at a code-0 pair). */
function entities(ps: Pair[]): Entity[] {
  const out: Entity[] = [];
  let cur: Entity | null = null;
  for (const p of ps) {
    if (p.code === 0) {
      cur = { type: p.value, props: [] };
      out.push(cur);
    } else if (cur) cur.props.push(p);
  }
  return out;
}

type Xform = (p: Pt) => Pt;
const identity: Xform = (p) => p;

function cleanMText(s: string): string {
  return s
    .replace(/\\P/g, ' ')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

export function parseDxf(text: string): DxfPlan {
  const ps = pairs(text);

  // Header: units
  let insUnits = 0;
  for (let i = 0; i < ps.length - 1; i++) {
    if (ps[i].code === 9 && ps[i].value === '$INSUNITS') {
      insUnits = parseInt(ps[i + 1].value, 10) || 0;
      break;
    }
  }
  const [scale, unitsName] = UNIT_SCALE[insUnits] ?? [1, 'unknown (assumed metres)'];

  // Split sections
  const sections = new Map<string, Pair[]>();
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].code === 0 && ps[i].value === 'SECTION' && ps[i + 1]?.code === 2) {
      const name = ps[i + 1].value;
      const start = i + 2;
      let j = start;
      while (j < ps.length && !(ps[j].code === 0 && ps[j].value === 'ENDSEC')) j++;
      sections.set(name, ps.slice(start, j));
      i = j;
    }
  }

  // Blocks
  const blocks = new Map<string, { base: Pt; ents: Entity[] }>();
  const blockEnts = entities(sections.get('BLOCKS') ?? []);
  for (let i = 0; i < blockEnts.length; i++) {
    const e = blockEnts[i];
    if (e.type !== 'BLOCK') continue;
    const name = str(e, 2);
    const base: Pt = [num(e, 10), num(e, 20)];
    const ents: Entity[] = [];
    i++;
    while (i < blockEnts.length && blockEnts[i].type !== 'ENDBLK') ents.push(blockEnts[i++]);
    blocks.set(name, { base, ents });
  }

  const out: DxfPlan = { lines: [], polygons: [], labels: [], unitsToMetres: scale, unitsName, bounds: null };
  const toM = (p: Pt): Pt => [p[0] * scale, p[1] * scale];

  const walk = (ents: Entity[], xf: Xform, depth: number) => {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      switch (e.type) {
        case 'LINE':
          out.lines.push([toM(xf([num(e, 10), num(e, 20)])), toM(xf([num(e, 11), num(e, 21)]))]);
          break;
        case 'LWPOLYLINE': {
          const xs = e.props.filter((p) => p.code === 10).map((p) => parseFloat(p.value));
          const ys = e.props.filter((p) => p.code === 20).map((p) => parseFloat(p.value));
          const pts = xs.map((x, k) => toM(xf([x, ys[k] ?? 0])));
          const closed = (num(e, 70) & 1) === 1;
          addPoly(pts, closed);
          break;
        }
        case 'POLYLINE': {
          const closed = (num(e, 70) & 1) === 1;
          const pts: Pt[] = [];
          i++;
          while (i < ents.length && ents[i].type === 'VERTEX') {
            pts.push(toM(xf([num(ents[i], 10), num(ents[i], 20)])));
            i++;
          }
          addPoly(pts, closed);
          break;
        }
        case 'ARC': {
          const cx = num(e, 10);
          const cy = num(e, 20);
          const r = num(e, 40);
          const a0 = (num(e, 50) * Math.PI) / 180;
          let a1 = (num(e, 51) * Math.PI) / 180;
          if (a1 < a0) a1 += Math.PI * 2;
          const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 12)));
          let prev: Pt = toM(xf([cx + r * Math.cos(a0), cy + r * Math.sin(a0)]));
          for (let k = 1; k <= steps; k++) {
            const a = a0 + ((a1 - a0) * k) / steps;
            const p = toM(xf([cx + r * Math.cos(a), cy + r * Math.sin(a)]));
            out.lines.push([prev, p]);
            prev = p;
          }
          break;
        }
        case 'TEXT':
        case 'MTEXT': {
          const t = e.type === 'MTEXT' ? cleanMText(e.props.filter((p) => p.code === 3 || p.code === 1).map((p) => p.value).join('')) : str(e, 1);
          if (t) out.labels.push({ at: toM(xf([num(e, 10), num(e, 20)])), text: t });
          break;
        }
        case 'INSERT': {
          if (depth > 8) break;
          const b = blocks.get(str(e, 2));
          if (!b) break;
          const ix = num(e, 10);
          const iy = num(e, 20);
          const sx = num(e, 41, 1);
          const sy = num(e, 42, 1);
          const rot = (num(e, 50) * Math.PI) / 180;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const inner: Xform = ([x, y]) => {
            const lx = (x - b.base[0]) * sx;
            const ly = (y - b.base[1]) * sy;
            return xf([ix + lx * c - ly * s, iy + lx * s + ly * c]);
          };
          walk(b.ents, inner, depth + 1);
          break;
        }
      }
    }
  };

  function addPoly(pts: Pt[], closed: boolean) {
    if (pts.length < 2) return;
    // Some exporters close by repeating the first point instead of setting the flag.
    const first = pts[0];
    const last = pts[pts.length - 1];
    const repeats = pts.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6;
    const ring = repeats ? pts.slice(0, -1) : pts;
    for (let k = 0; k < ring.length - 1; k++) out.lines.push([ring[k], ring[k + 1]]);
    if (closed || repeats) {
      out.lines.push([ring[ring.length - 1], ring[0]]);
      if (ring.length >= 3) out.polygons.push(ring);
    }
  }

  walk(entities(sections.get('ENTITIES') ?? []), identity, 0);

  const all = out.lines.flat();
  if (all.length) {
    out.bounds = {
      minX: Math.min(...all.map((p) => p[0])),
      minY: Math.min(...all.map((p) => p[1])),
      maxX: Math.max(...all.map((p) => p[0])),
      maxY: Math.max(...all.map((p) => p[1])),
    };
  }
  return out;
}

/** Flip Y so plans read the right way up in SVG (DXF is Y-up) and move to the origin. */
export function normalisePlan(plan: DxfPlan): DxfPlan {
  if (!plan.bounds) return plan;
  const { minX, maxY } = plan.bounds;
  const f = (p: Pt): Pt => [p[0] - minX, maxY - p[1]];
  const lines = plan.lines.map(([a, b]) => [f(a), f(b)] as [Pt, Pt]);
  const polygons = plan.polygons.map((poly) => poly.map(f));
  const labels = plan.labels.map((l) => ({ ...l, at: f(l.at) }));
  const all = lines.flat();
  return {
    ...plan,
    lines,
    polygons,
    labels,
    bounds: {
      minX: Math.min(...all.map((p) => p[0])),
      minY: Math.min(...all.map((p) => p[1])),
      maxX: Math.max(...all.map((p) => p[0])),
      maxY: Math.max(...all.map((p) => p[1])),
    },
  };
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from point p to segment ab. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
