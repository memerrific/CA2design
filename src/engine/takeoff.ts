// Materials takeoff: turns the design into a list of things to buy, then prices it.
// Every generated line has a stable key so hand edits (overrides) and the
// company price list survive design changes.

import { analyseRun, runLength, ufhOutput } from './design';
import { RAD_TYPES } from './emitters';
import type { ProjectLoss } from './heatloss';
import type { LineOverride, PriceLine, Pricing, Project, Room } from './model';
import { MATERIAL_NAMES, pipeSize } from './pipes';

export interface TakeoffLine {
  key: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  source: string; // where the quantity came from, shown to the user
}

export const CATEGORY_ORDER = ['Pipework', 'Pipe insulation', 'Underfloor heating', 'Radiators', 'Valves', 'Equipment', 'Extras'];

export function defaultPricing(p: Pick<Project, 'customer'>): Pricing {
  return {
    wastePct: 10,
    sundriesPct: 15,
    markupPct: 20,
    vatPct: 20,
    includeInsulation: true,
    overrides: {},
    extras: [],
    labour: [],
    deliveryAddress: [p.customer.address, p.customer.postcode].filter(Boolean).join('\n'),
    requiredBy: '',
    merchantNotes: '',
  };
}

export const pricingOf = (p: Project): Pricing => ({ ...defaultPricing(p), ...p.pricing });

const roundUp = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

function perimeter(r: Room): number {
  if (r.polygon && r.polygon.length > 2) {
    return r.polygon.reduce((a, q, i) => {
      const n = r.polygon![(i + 1) % r.polygon!.length];
      return a + Math.hypot(n[0] - q[0], n[1] - q[1]);
    }, 0);
  }
  return r.walls.reduce((a, w) => a + w.length, 0);
}

export function buildTakeoff(p: Project, loss: ProjectLoss): TakeoffLine[] {
  const pr = pricingOf(p);
  const waste = 1 + pr.wastePct / 100;
  const lines: TakeoffLine[] = [];
  const add = (l: TakeoffLine) => {
    const existing = lines.find((x) => x.key === l.key);
    if (existing) {
      existing.qty += l.qty;
      existing.source += `; ${l.source}`;
    } else lines.push(l);
  };

  // Pipework, from designed runs (sizes as auto-sized or chosen).
  for (const run of p.pipes) {
    const a = analyseRun(p, loss, run);
    const len = runLength(p, run);
    if (!a.size || len <= 0) continue;
    const label = `${MATERIAL_NAMES[run.material]} ${a.size.label}`;
    add({ key: `pipe:${a.size.id}`, category: 'Pipework', description: `${label} pipe`, qty: len, unit: 'm', source: `${run.name} ${Math.round(len * 10) / 10} m${len !== run.lengthM ? ' (drawn)' : ''}` });
    if (pr.includeInsulation) {
      add({ key: `lag:${a.size.id}`, category: 'Pipe insulation', description: `Pipe insulation to suit ${a.size.label} ${run.material === 'copper' ? 'copper' : MATERIAL_NAMES[run.material]}`, qty: len, unit: 'm', source: run.name });
    }
  }

  // Underfloor heating.
  const ufhRooms = p.rooms.filter((r) => r.ufh.enabled);
  const loopsPerManifold = new Map<string, number>();
  for (const r of ufhRooms) {
    const res = ufhOutput(p, r)!;
    const size = pipeSize(r.ufh.pipeSizeId);
    const pipeM = res.loops * res.loopLengthM;
    add({
      key: `ufh-pipe:${r.ufh.pipeSizeId}`,
      category: 'Underfloor heating',
      description: `UFH pipe ${size ? `${size.material.toUpperCase()} ${size.label}` : r.ufh.pipeSizeId}`,
      qty: pipeM,
      unit: 'm',
      source: `${r.name}: ${res.loops} × ${Math.round(res.loopLengthM)} m`,
    });
    add({ key: 'ufh-actuator', category: 'Underfloor heating', description: 'UFH manifold actuator (one per loop)', qty: res.loops, unit: 'each', source: r.name });
    add({ key: 'ufh-stat', category: 'Underfloor heating', description: 'UFH room thermostat', qty: 1, unit: 'each', source: r.name });
    add({ key: 'ufh-edge', category: 'Underfloor heating', description: 'UFH perimeter edge insulation strip', qty: perimeter(r), unit: 'm', source: r.name });
    add({ key: 'ufh-fixings', category: 'Underfloor heating', description: 'UFH clip rail / staples (by area)', qty: (r.area * r.ufh.activeAreaPct) / 100, unit: 'm²', source: r.name });
    loopsPerManifold.set(r.ufh.manifoldId, (loopsPerManifold.get(r.ufh.manifoldId) ?? 0) + res.loops);
  }
  for (const [mid, ports] of loopsPerManifold) {
    const m = p.manifolds.find((x) => x.id === mid);
    add({ key: `ufh-manifold:${ports}`, category: 'Underfloor heating', description: `UFH manifold, ${ports}-port, with flow meters`, qty: 1, unit: 'each', source: m?.name ?? 'Manifold' });
  }

  // New radiators and their valves.
  let newRads = 0;
  for (const r of p.rooms) {
    for (const e of r.emitters) {
      if (e.status !== 'new') continue;
      if (e.kind === 'radiator' && e.type && e.height && e.length) {
        const t = RAD_TYPES.find((x) => x.id === e.type)?.name ?? `Type ${e.type}`;
        add({ key: `rad:${e.type}:${e.height}:${e.length}`, category: 'Radiators', description: `Panel radiator ${t} ${e.height} × ${e.length} mm`, qty: e.quantity, unit: 'each', source: r.name });
      } else {
        add({ key: `emitter:${e.name}:${e.ratedDt50 ?? 0}`, category: 'Radiators', description: `${e.name} (${e.ratedDt50 ?? 0} W at ΔT50)`, qty: e.quantity, unit: 'each', source: r.name });
      }
      newRads += e.quantity;
    }
  }
  if (newRads) {
    add({ key: 'rad-valves', category: 'Radiators', description: 'Radiator valve set (TRV + lockshield)', qty: newRads, unit: 'pair', source: `${newRads} new emitters` });
    add({ key: 'rad-brackets', category: 'Radiators', description: 'Radiator brackets & fixings', qty: newRads, unit: 'set', source: `${newRads} new emitters` });
  }

  // Valves from the balancing schedule.
  for (const v of p.valves) {
    add({ key: `valve:${v.name.trim().toLowerCase()}:${v.kv}`, category: 'Valves', description: `${v.name} (Kv ${v.kv})`, qty: 1, unit: 'each', source: 'Valve schedule' });
  }

  // Equipment.
  for (const e of p.equipment) {
    const name = [e.make, e.model].filter(Boolean).join(' ');
    add({
      key: `equip:${e.category}:${name}`.toLowerCase(),
      category: 'Equipment',
      description: `${e.category}${name ? `: ${name}` : ''}${e.outputKw ? ` (${e.outputKw} kW)` : ''}`,
      qty: 1,
      unit: 'each',
      source: e.location || 'Equipment list',
    });
  }

  // Waste allowance on anything sold by the metre, then round to sensible units.
  for (const l of lines) {
    if (l.unit === 'm') l.qty = roundUp(l.qty * waste, 1);
    else if (l.unit === 'm²') l.qty = roundUp(l.qty, 1);
    else l.qty = Math.ceil(l.qty);
    if (l.key.startsWith('pipe:cu')) l.source += ` (≈ ${Math.ceil(l.qty / 3)} × 3 m lengths)`;
  }

  return lines.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

export interface PricedLine {
  key: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
  notes: string;
  source: string;
  auto: boolean; // generated from the design (vs. an extra added by hand)
  excluded: boolean;
  edited: boolean;
}

export interface PricingResult {
  lines: PricedLine[];
  materials: number;
  sundries: number;
  markup: number;
  labour: number;
  net: number;
  vat: number;
  total: number;
}

export function priceProject(p: Project, loss: ProjectLoss, priceList: Record<string, number>): PricingResult {
  const pr = pricingOf(p);
  const auto: PricedLine[] = buildTakeoff(p, loss).map((l) => {
    const o: LineOverride = pr.overrides[l.key] ?? {};
    const qty = o.qty ?? l.qty;
    const unitCost = priceList[l.key] ?? 0;
    return {
      ...l,
      qty,
      unitCost,
      total: o.exclude ? 0 : qty * unitCost,
      notes: o.notes ?? '',
      auto: true,
      excluded: !!o.exclude,
      edited: o.qty !== undefined,
    };
  });
  const extras: PricedLine[] = pr.extras.map((x: PriceLine) => ({
    key: `extra:${x.id}`,
    category: x.category || 'Extras',
    description: x.description,
    qty: x.qty,
    unit: x.unit,
    unitCost: x.unitCost,
    total: x.qty * x.unitCost,
    notes: x.notes,
    source: 'Added by hand',
    auto: false,
    excluded: false,
    edited: false,
  }));
  const lines = [...auto, ...extras];
  const materials = lines.reduce((a, l) => a + l.total, 0);
  const sundries = (materials * pr.sundriesPct) / 100;
  const markup = ((materials + sundries) * pr.markupPct) / 100;
  const labour = pr.labour.reduce((a, l) => a + l.days * l.dayRate, 0);
  const net = materials + sundries + markup + labour;
  const vat = (net * pr.vatPct) / 100;
  return { lines, materials, sundries, markup, labour, net, vat, total: net + vat };
}

/** CSV for merchants: no prices, one row per item. */
export function merchantCsv(lines: PricedLine[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Category', 'Description', 'Quantity', 'Unit', 'Notes']];
  for (const l of lines) if (!l.excluded && l.qty > 0) rows.push([l.category, l.description, String(l.qty), l.unit, l.notes]);
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
