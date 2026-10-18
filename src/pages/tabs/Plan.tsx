import { useEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent, type ReactNode, type WheelEvent } from 'react';
import { go } from '../../App';
import { roomEmitterOutput } from '../../engine/design';
import { distToSegment, normalisePlan, parseDxf, pointInPolygon } from '../../engine/dxf';
import { emitterDt50, RAD_TYPES, suggestRadiator } from '../../engine/emitters';
import { detectAdjacency, roomFromPolygon, uid } from '../../engine/factory';
import { polygonArea, settingsOf } from '../../engine/heatloss';
import type { Emitter, PlanPipe, PlanUnderlay, Project, Pt, RadiatorType, Room } from '../../engine/model';
import { PIPE_SIZES, pipeSize } from '../../engine/pipes';
import { readFile, store } from '../../store';
import { ask } from '../../ui/dialog';
import { fmt, NumField, Select, TextField } from '../../ui/fields';
import { planUi, usePlanUi, type Selection } from '../../ui/planUi';
import { useProject } from '../ProjectView';
import { LEVELS } from './Rooms';

type Tool = 'select' | 'room' | 'radiator' | 'ufh' | 'pipe' | 'valve' | 'text' | 'measure';

export function lossColour(wPerM2: number): string {
  // 0 → cool blue, 120+ W/m² → CA2 orange/red
  const t = Math.max(0, Math.min(1, wPerM2 / 120));
  const h = 210 - t * 195;
  return `hsl(${h} 75% 55% / 0.35)`;
}

/** Warm tint for rooms on the dark canvas: stronger copper for higher W/m². */
function roomTint(wPerM2: number): string {
  const t = Math.max(0, Math.min(1, wPerM2 / 120));
  return `rgba(224, 119, 58, ${(0.04 + t * 0.2).toFixed(3)})`;
}

// ---------- geometry ----------

const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const polyLen = (pts: Pt[]) => pts.slice(1).reduce((s, q, i) => s + len(pts[i], q), 0);

function inwardNormal(poly: Pt[], i: number): Pt {
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const L = len(a, b) || 1;
  const n: Pt = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  const mid: Pt = [(a[0] + b[0]) / 2 + n[0] * 0.05, (a[1] + b[1]) / 2 + n[1] * 0.05];
  return pointInPolygon(mid, poly) ? n : [-n[0], -n[1]];
}

/** Nearest wall of a room to a point: index, distance along the wall, distance from it. */
function nearestWall(poly: Pt[], q: Pt) {
  let best = { i: 0, along: 0, dist: Infinity };
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const L = len(a, b);
    if (!L) return;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / (L * L)));
    const d = distToSegment(q, a, b);
    if (d < best.dist) best = { i, along: t * L, dist: d };
  });
  return best;
}

const emitterLengthM = (e: Emitter) => (e.kind === 'radiator' ? (e.length ?? 1000) / 1000 : 0.6) * Math.max(1, e.quantity);

/** Where an emitter sits on the plan: placed by the user, or auto on the longest external wall. */
function emitterPlacement(room: Room, e: Emitter, idxInRoom: number) {
  const poly = room.polygon!;
  let wi = e.wallIndex;
  let auto = false;
  if (wi === undefined || wi >= poly.length) {
    auto = true;
    const ext = room.walls.map((w, i) => ({ i, l: w.length, ext: w.boundary === 'external' })).filter((w) => w.i < poly.length);
    const pick = [...ext].sort((a, b) => Number(b.ext) - Number(a.ext) || b.l - a.l)[idxInRoom % Math.max(1, ext.length)] ?? { i: 0 };
    wi = pick.i;
  }
  const a = poly[wi];
  const b = poly[(wi + 1) % poly.length];
  const L = len(a, b) || 1;
  const u: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n = inwardNormal(poly, wi);
  const rl = Math.min(emitterLengthM(e), L - 0.1);
  const off = Math.max(rl / 2 + 0.05, Math.min(L - rl / 2 - 0.05, e.offsetM ?? L / 2));
  const c: Pt = [a[0] + u[0] * off + n[0] * 0.14, a[1] + u[1] * off + n[1] * 0.14];
  const half = rl / 2;
  const depth = 0.1;
  const p1: Pt = [c[0] - u[0] * half - n[0] * (depth / 2), c[1] - u[1] * half - n[1] * (depth / 2)];
  const corners: Pt[] = [p1, [p1[0] + u[0] * rl, p1[1] + u[1] * rl], [p1[0] + u[0] * rl + n[0] * depth, p1[1] + u[1] * rl + n[1] * depth], [p1[0] + n[0] * depth, p1[1] + n[1] * depth]];
  return { wi, auto, center: c, corners, u, n, wallLen: L, offset: off, label: [c[0] + n[0] * 0.5, c[1] + n[1] * 0.5] as Pt };
}

function radiatorTag(p: Project, emitterId: string): string {
  let n = 0;
  for (const r of p.rooms) for (const e of r.emitters) {
    if (e.status === 'replace') continue;
    n++;
    if (e.id === emitterId) return `RA-${String(n).padStart(2, '0')}`;
  }
  return 'RA';
}

/** Fin positions drawn across a radiator symbol. */
const finsFor = (e: Emitter) => [...Array(Math.max(2, Math.round(emitterLengthM(e) / 0.12))).keys()];

function centroid(poly: Pt[]): Pt {
  return [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length];
}

// ---------- component ----------

export function PlanTab() {
  const { project: p, update, loss } = useProject();
  const ui = usePlanUi();
  const usedLevels = [...new Set([...Object.keys(p.plans), ...p.rooms.map((r) => r.level)])];
  const level = usedLevels.includes(ui.level) || p.rooms.length === 0 ? ui.level : usedLevels[0];
  const L = ui.layers;
  const sel = ui.selection;
  const select = (s: Selection) => planUi.set({ selection: s });

  const [tool, setTool] = useState<Tool>('select');
  const [pipeKind, setPipeKind] = useState<'flow' | 'return'>('flow');
  const [draft, setDraft] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [view, setView] = useState<{ x: number; y: number; w: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [widthPx, setWidthPx] = useState(900);
  const [emDrag, setEmDrag] = useState<{ roomId: string; emId: string; offset: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth || 900));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        setDraft([]);
        select(null);
      }
      if (e.key === 'Enter' && tool === 'pipe' && draft.length >= 2) finishPipe(draft);
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) void deleteSelection();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo(p.id);
        else store.undo(p.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const plan: PlanUnderlay = p.plans[level] ?? { lines: [], labels: [] };
  const rooms = p.rooms.filter((r) => r.level === level && r.polygon);
  const pipes = plan.pipes ?? [];

  const bounds = useMemo(() => {
    const pts: Pt[] = [...plan.lines.flat(), ...rooms.flatMap((r) => r.polygon!)];
    if (plan.image) pts.push([plan.image.x, plan.image.y], [plan.image.x + plan.image.widthM, plan.image.y + plan.image.heightM]);
    if (!pts.length) return { x: -2, y: -2, w: 16, h: 10, minX: 0, minY: 0, maxX: 12, maxY: 8, empty: true };
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX - 2, y: minY - 2, w: maxX - minX + 4, h: maxY - minY + 4, minX, minY, maxX, maxY, empty: false };
  }, [plan, rooms]);

  const fitView = (() => {
    const w = Math.max(bounds.w, (bounds.h * 16) / 10);
    return { x: bounds.x + bounds.w / 2 - w / 2, y: bounds.y + bounds.h / 2 - (w * 10) / 16 / 2, w };
  })();
  const vb = view ?? fitView;
  const vh = (vb.w * 10) / 16;
  const px = vb.w / widthPx; // metres per screen pixel
  const fitW = Math.max(bounds.w, (bounds.h * 16) / 10);
  const zoomPct = Math.round((fitW / vb.w) * 100);

  const levelRoomsAll = p.rooms.filter((r) => r.level === level);
  const snapPts = useMemo(
    () => [...plan.lines.flat(), ...levelRoomsAll.flatMap((r) => r.polygon ?? []), ...pipes.flatMap((x) => x.pts)],
    [plan, levelRoomsAll, pipes],
  );

  const toWorld = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const w = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [w.x, w.y];
  };

  const snap = (q: Pt): Pt => {
    let best: Pt | null = null;
    let bd = 10 * px;
    for (const s of snapPts) {
      const d = len(s, q);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) return best;
    const last = draft[draft.length - 1];
    if (last) {
      if (Math.abs(q[0] - last[0]) < 8 * px) return [last[0], q[1]];
      if (Math.abs(q[1] - last[1]) < 8 * px) return [q[0], last[1]];
    }
    return [Math.round(q[0] * 20) / 20, Math.round(q[1] * 20) / 20];
  };

  const setPlan = (fn: (pl: PlanUnderlay) => void) =>
    update((d) => {
      const pl = d.plans[level] ?? { lines: [], labels: [] };
      fn(pl);
      d.plans[level] = pl;
    });

  // ----- actions -----

  const finishRoom = async (poly: Pt[]) => {
    setDraft([]);
    if (poly.length < 3 || polygonArea(poly) < 0.3) return;
    const label = plan.labels.find((l) => pointInPolygon(l.at, poly))?.text;
    const name = await ask.prompt('Room name', label ?? `Room ${p.rooms.length + 1}`);
    if (!name) return;
    update((d) => {
      d.rooms.push(roomFromPolygon(name, poly, level, guessType(name), settingsOf(d).ageBand));
      const same = detectAdjacency(d.rooms.filter((r) => r.level === level));
      d.rooms = d.rooms.map((r) => same.find((s) => s.id === r.id) ?? r);
    });
  };

  const finishPipe = (pts: Pt[]) => {
    setDraft([]);
    if (pts.length < 2 || polyLen(pts) < 0.05) return;
    const id = uid();
    setPlan((pl) => void (pl.pipes = [...(pl.pipes ?? []), { id, kind: pipeKind, pts }]));
    select({ kind: 'pipe', id });
  };

  const placeRadiator = (q: Pt) => {
    const room = rooms.find((r) => pointInPolygon(q, r.polygon!)) ?? rooms.find((r) => nearestWall(r.polygon!, q).dist < 0.4);
    if (!room) return setMsg('Click inside a room, near the wall where the radiator goes.');
    const w = nearestWall(room.polygon!, q);
    const ri = p.rooms.findIndex((r) => r.id === room.id);
    const unplaced = room.emitters.findIndex((e) => e.status !== 'replace' && e.wallIndex === undefined);
    let emId = '';
    update((d) => {
      const r = d.rooms[ri];
      if (unplaced >= 0) {
        r.emitters[unplaced].wallIndex = w.i;
        r.emitters[unplaced].offsetM = w.along;
        emId = r.emitters[unplaced].id;
      } else {
        const s = settingsOf(d);
        const out = roomEmitterOutput(d, r);
        const need = Math.max(0, (loss.byId.get(r.id)?.totalW ?? 0) - out.total);
        const sug = suggestRadiator(need || 500, out.dT, 600, s.radiatorExponent);
        emId = uid();
        r.emitters.push({
          id: emId,
          kind: 'radiator',
          name: 'New radiator',
          status: 'new',
          type: sug?.type ?? '22',
          height: sug?.height ?? 600,
          length: sug?.length ?? 1000,
          quantity: 1,
          wallIndex: w.i,
          offsetM: w.along,
        });
      }
    });
    select({ kind: 'emitter', id: emId || room.emitters[unplaced]?.id, roomId: room.id });
  };

  const hitTest = (q: Pt): Selection => {
    const tol = 8 * px;
    if (L.notes) for (const n of plan.notes ?? []) if (len(n.at, q) < tol * 2) return { kind: 'note', id: n.id };
    if (L.notes) for (const v of plan.valves ?? []) if (len(v.at, q) < tol * 1.5) return { kind: 'valve', id: v.id };
    if (L.emitters)
      for (const r of rooms)
        for (const [i, e] of r.emitters.filter((x) => x.status !== 'replace').entries()) {
          const pl = emitterPlacement(r, e, i);
          if (pointInPolygon(q, pl.corners) || len(pl.center, q) < tol * 1.5) return { kind: 'emitter', id: e.id, roomId: r.id };
        }
    for (const pipe of pipes) {
      if (!L[pipe.kind]) continue;
      for (let i = 1; i < pipe.pts.length; i++) if (distToSegment(q, pipe.pts[i - 1], pipe.pts[i]) < tol) return { kind: 'pipe', id: pipe.id };
    }
    const room = rooms.find((r) => pointInPolygon(q, r.polygon!));
    return room ? { kind: 'room', id: room.id } : null;
  };

  const onClick = async (e: RMouseEvent) => {
    if (drag.current?.moved) return;
    const raw = toWorld(e);
    const q = snap(raw);
    switch (tool) {
      case 'room':
        if (draft.length >= 3 && len(q, draft[0]) < 12 * px) void finishRoom(draft);
        else setDraft([...draft, q]);
        break;
      case 'pipe':
        if (draft.length >= 2 && len(q, draft[draft.length - 1]) < 6 * px) finishPipe(draft);
        else setDraft([...draft, q]);
        break;
      case 'measure':
        if (draft.length === 0) setDraft([q]);
        else {
          const measured = len(q, draft[0]);
          setDraft([]);
          const real = await ask.prompt(`Measured ${measured.toFixed(3)} m on the plan.\nTo rescale the background plan, enter the real length in metres. Cancel to keep it.`);
          const v = parseFloat(real ?? '');
          if (v > 0 && measured > 0) rescaleUnderlay(v / measured);
        }
        break;
      case 'radiator':
        placeRadiator(raw);
        break;
      case 'ufh': {
        const room = rooms.find((r) => pointInPolygon(raw, r.polygon!));
        if (room) {
          const ri = p.rooms.findIndex((r) => r.id === room.id);
          update((d) => void (d.rooms[ri].ufh.enabled = !d.rooms[ri].ufh.enabled));
          select({ kind: 'room', id: room.id });
        }
        break;
      }
      case 'valve': {
        const id = uid();
        setPlan((pl) => void (pl.valves = [...(pl.valves ?? []), { id, at: q, name: `Valve ${(pl.valves?.length ?? 0) + 1}` }]));
        select({ kind: 'valve', id });
        break;
      }
      case 'text': {
        const text = await ask.prompt('Note text', '');
        if (text) {
          const id = uid();
          setPlan((pl) => void (pl.notes = [...(pl.notes ?? []), { id, at: raw, text }]));
          select({ kind: 'note', id });
        }
        break;
      }
      default:
        select(hitTest(raw));
    }
  };

  const onDoubleClick = () => {
    if (tool === 'pipe' && draft.length >= 2) finishPipe(draft);
    if (tool === 'select' && sel?.kind === 'room') go(`p/${p.id}/rooms`);
  };

  const rescaleUnderlay = (k: number) =>
    update((d) => {
      const pl = d.plans[level];
      if (!pl) return;
      pl.lines = pl.lines.map(([a, b]) => [[a[0] * k, a[1] * k], [b[0] * k, b[1] * k]]);
      pl.labels = pl.labels.map((l) => ({ ...l, at: [l.at[0] * k, l.at[1] * k] }));
      if (pl.image) pl.image = { ...pl.image, x: pl.image.x * k, y: pl.image.y * k, widthM: pl.image.widthM * k, heightM: pl.image.heightM * k };
    });

  const deleteSelection = async () => {
    if (!sel) return;
    if (sel.kind === 'pipe') setPlan((pl) => void (pl.pipes = (pl.pipes ?? []).filter((x) => x.id !== sel.id)));
    if (sel.kind === 'note') setPlan((pl) => void (pl.notes = (pl.notes ?? []).filter((x) => x.id !== sel.id)));
    if (sel.kind === 'valve') setPlan((pl) => void (pl.valves = (pl.valves ?? []).filter((x) => x.id !== sel.id)));
    if (sel.kind === 'emitter')
      update((d) => {
        for (const r of d.rooms) {
          const e = r.emitters.find((x) => x.id === sel.id);
          if (e) {
            e.wallIndex = undefined;
            e.offsetM = undefined;
          }
        }
      });
    if (sel.kind === 'room') {
      const r = p.rooms.find((x) => x.id === sel.id);
      if (r && (await ask.confirm(`Delete ${r.name} and everything in it?`, { danger: true }))) update((d) => void (d.rooms = d.rooms.filter((x) => x.id !== sel.id)));
      else return;
    }
    select(null);
  };

  const importDxf = async (file: File) => {
    const text = await readFile(file, 'text');
    const parsed = normalisePlan(parseDxf(text));
    if (!parsed.lines.length) {
      setMsg('No lines found in that file. In Polycam, export the floor plan as DXF.');
      return;
    }
    setPlan((pl) => {
      pl.lines = parsed.lines;
      pl.labels = parsed.labels;
    });
    setView(null);
    const auto = parsed.polygons.filter((poly) => polygonArea(poly) > 1 && polygonArea(poly) < 400);
    setMsg(`Imported ${parsed.lines.length} lines (units: ${parsed.unitsName}).`);
    if (auto.length && (await ask.confirm(`Found ${auto.length} closed shapes that look like rooms. Create rooms from them?`))) {
      update((d) => {
        auto.forEach((poly, i) => {
          const label = parsed.labels.find((l) => pointInPolygon(l.at, poly))?.text;
          d.rooms.push(roomFromPolygon(label ?? `Room ${i + 1}`, poly, level, guessType(label ?? ''), settingsOf(d).ageBand));
        });
        const same = detectAdjacency(d.rooms.filter((r) => r.level === level));
        d.rooms = d.rooms.map((r) => same.find((s) => s.id === r.id) ?? r);
      });
    }
  };

  const importImage = async (file: File) => {
    const dataUrl = await readFile(file, 'dataUrl');
    const img = new Image();
    img.onload = async () => {
      const widthM = parseFloat((await ask.prompt('How wide is this plan image in real life (metres)? Fine-tune with Dimension → rescale afterwards.', '10')) ?? '');
      if (!(widthM > 0)) return;
      const heightM = (widthM * img.height) / img.width;
      setPlan((pl) => void (pl.image = { dataUrl, x: 0, y: 0, widthM, heightM }));
      setView(null);
    };
    img.src = dataUrl;
  };

  // ----- pan / zoom / drag -----

  const zoomAt = (wx: number, wy: number, k: number) => setView({ x: wx - (wx - vb.x) * k, y: wy - (wy - vb.y) * k, w: vb.w * k });
  const onWheel = (e: WheelEvent) => {
    const [wx, wy] = toWorld(e);
    zoomAt(wx, wy, e.deltaY > 0 ? 1.15 : 1 / 1.15);
  };
  const onDown = (e: RMouseEvent) => {
    const q = toWorld(e);
    if (tool === 'select' && sel?.kind === 'emitter') {
      const room = p.rooms.find((r) => r.id === sel.roomId);
      const em = room?.emitters.find((x) => x.id === sel.id);
      if (room?.polygon && em) {
        const pl = emitterPlacement(room, em, room.emitters.filter((x) => x.status !== 'replace').indexOf(em));
        if (pointInPolygon(q, pl.corners) || len(pl.center, q) < 12 * px) {
          setEmDrag({ roomId: room.id, emId: em.id, offset: pl.offset });
          drag.current = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false };
          return;
        }
      }
    }
    if (e.button === 1 || tool === 'select' || e.shiftKey) drag.current = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false };
  };
  const onMove = (e: RMouseEvent) => {
    if (emDrag) {
      const room = p.rooms.find((r) => r.id === emDrag.roomId)!;
      const em = room.emitters.find((x) => x.id === emDrag.emId)!;
      const pl = emitterPlacement(room, em, 0);
      const poly = room.polygon!;
      const a = poly[pl.wi];
      const q = toWorld(e);
      const along = (q[0] - a[0]) * pl.u[0] + (q[1] - a[1]) * pl.u[1];
      if (drag.current) drag.current.moved = true;
      setEmDrag({ ...emDrag, offset: Math.max(0, Math.min(pl.wallLen, along)) });
      return;
    }
    if (drag.current) {
      const k = vb.w / (svgRef.current?.clientWidth || 900);
      const dx = (e.clientX - drag.current.sx) * k;
      const dy = (e.clientY - drag.current.sy) * k;
      if (Math.abs(dx) + Math.abs(dy) > 2 * px) drag.current.moved = true;
      setView({ x: drag.current.vx - dx, y: drag.current.vy - dy, w: vb.w });
    }
    if (tool !== 'select') setCursor(snap(toWorld(e)));
  };
  const onUp = () => {
    if (emDrag) {
      const { roomId, emId, offset } = emDrag;
      const room = p.rooms.find((r) => r.id === roomId)!;
      const em = room.emitters.find((x) => x.id === emId)!;
      const wi = emitterPlacement(room, em, room.emitters.indexOf(em)).wi;
      const ri = p.rooms.indexOf(room);
      update((d) => {
        const x = d.rooms[ri].emitters.find((y) => y.id === emId)!;
        x.wallIndex = wi;
        x.offsetM = Math.round(offset * 100) / 100;
      });
      setEmDrag(null);
    }
    setTimeout(() => (drag.current = null), 0);
  };

  // ----- drawing helpers -----

  const fs = 12 * px;
  const sw = 1.2 * px;
  const scaleBar = (() => {
    const target = 120 * px;
    const nice = [0.5, 1, 2, 5, 10, 20, 50].find((n) => n >= target) ?? 50;
    return { m: nice, px: nice / px };
  })();

  const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
    { id: 'select', label: 'Select', icon: <path d="M5 3l12 8-6 1-3 6z" /> },
    { id: 'room', label: 'Room', icon: <path d="M4 4h16v16H4z" strokeDasharray="3 2" /> },
    { id: 'radiator', label: 'Radiator', icon: <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12M3 9h18M3 15h18" /> },
    { id: 'ufh', label: 'UFH', icon: <path d="M4 5h16v4H4v4h16v4H4" /> },
    { id: 'pipe', label: 'Pipe', icon: <path d="M3 17h7V7h11" /> },
    { id: 'valve', label: 'Valve', icon: <path d="M4 8l8 4-8 4zM20 8l-8 4 8 4zM12 12V5M9 5h6" /> },
    { id: 'text', label: 'Text', icon: <path d="M5 5h14M12 5v14" /> },
    { id: 'measure', label: 'Dimension', icon: <path d="M3 12h18M3 8v8M21 8v8" /> },
  ];

  const toolHint: Record<Tool, string> = {
    select: 'Click a room, radiator or pipe to edit it. Drag a selected radiator along its wall. Drag empty space to pan, scroll to zoom.',
    room: draft.length ? 'Click each corner; click the first point to close the room. Esc cancels.' : 'Click the first corner of the room. Corners snap to the plan.',
    radiator: 'Click just inside a room, next to the wall the radiator goes on.',
    ufh: 'Click a room to switch underfloor heating on or off.',
    pipe: draft.length ? 'Click to add bends. Double-click, Enter, or click the last point again to finish.' : `Drawing ${pipeKind} pipe. Click to start; points snap to pipe ends and corners.`,
    valve: 'Click to place a valve.',
    text: 'Click where the note goes.',
    measure: 'Click two points to measure. You can then rescale the background plan.',
  };

  const bboxDims = !bounds.empty && rooms.length > 0;
  const rb = rooms.length
    ? {
        minX: Math.min(...rooms.flatMap((r) => r.polygon!.map((q) => q[0]))),
        maxX: Math.max(...rooms.flatMap((r) => r.polygon!.map((q) => q[0]))),
        minY: Math.min(...rooms.flatMap((r) => r.polygon!.map((q) => q[1]))),
        maxY: Math.max(...rooms.flatMap((r) => r.polygon!.map((q) => q[1]))),
      }
    : null;

  return (
    <div className="canvas-page">
      <div className="canvas-toolbar">
        <div className="tool-group">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool ${tool === t.id ? 'on' : ''}`} onClick={() => (setTool(t.id), setDraft([]))} title={t.label}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {t.icon}
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
          <span className="tool-sep" />
          <button className="tool" onClick={() => store.undo(p.id)} disabled={!store.canUndo(p.id)} title="Undo (Ctrl+Z)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" />
            </svg>
            <span>Undo</span>
          </button>
          <button className="tool" onClick={() => store.redo(p.id)} disabled={!store.canRedo(p.id)} title="Redo (Ctrl+Shift+Z)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2" />
            </svg>
            <span>Redo</span>
          </button>
        </div>
        <div className="tool-right">
          {tool === 'pipe' && (
            <div className="seg sm">
              <button className={pipeKind === 'flow' ? 'on flow' : ''} onClick={() => setPipeKind('flow')}>
                Flow
              </button>
              <button className={pipeKind === 'return' ? 'on return' : ''} onClick={() => setPipeKind('return')}>
                Return
              </button>
            </div>
          )}
          <select value={level} onChange={(e) => (planUi.set({ level: e.target.value, selection: null }), setView(null))} aria-label="Floor">
            {[...new Set([...usedLevels, level, ...LEVELS])].map((l) => (
              <option key={l} value={l}>
                {l} floor
              </option>
            ))}
          </select>
          <label className="btn ghost sm">
            Import DXF
            <input type="file" accept=".dxf" hidden onChange={(e) => e.target.files?.[0] && importDxf(e.target.files[0])} />
          </label>
          <label className="btn ghost sm">
            Import image
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && importImage(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div className="canvas-body">
        <div className="canvas-wrap" tabIndex={0}>
          <svg
            ref={svgRef}
            className={`plan2 tool-${tool}`}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vh}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={() => (setCursor(null), onUp())}
          >
            <defs>
              <pattern id="grid-minor" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
                <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="var(--grid)" strokeWidth={px * 0.8} />
              </pattern>
              <pattern id="grid-major" width="5" height="5" patternUnits="userSpaceOnUse">
                <rect width="5" height="5" fill="url(#grid-minor)" />
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--grid)" strokeWidth={px * 1.6} />
              </pattern>
              {rooms.map((r) => (
                <clipPath key={r.id} id={`clip-${r.id}`}>
                  <polygon points={r.polygon!.map((q) => q.join(',')).join(' ')} />
                </clipPath>
              ))}
            </defs>
            <rect x={vb.x - vb.w} y={vb.y - vh} width={vb.w * 3} height={vh * 3} fill="url(#grid-major)" />

            {L.underlay && plan.image && <image href={plan.image.dataUrl} x={plan.image.x} y={plan.image.y} width={plan.image.widthM} height={plan.image.heightM} opacity={0.35} />}
            {L.underlay && plan.lines.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--plan-line)" strokeWidth={sw} opacity={0.6} />)}

            {/* Rooms */}
            {rooms.map((r) => {
              const rl = loss.byId.get(r.id);
              const isSel = sel?.kind === 'room' && sel.id === r.id;
              return (
                <g key={r.id}>
                  <polygon points={r.polygon!.map((q) => q.join(',')).join(' ')} fill={roomTint(rl?.wPerM2 ?? 0)} stroke="none" />
                  {L.ufh && r.ufh.enabled && <UfhLoops room={r} sw={sw} />}
                  {L.outlines &&
                    r.polygon!.map((q, i) => {
                      const n = r.polygon![(i + 1) % r.polygon!.length];
                      const w = r.walls[i];
                      const ext = w && w.boundary !== 'room';
                      return (
                        <line
                          key={i}
                          x1={q[0]}
                          y1={q[1]}
                          x2={n[0]}
                          y2={n[1]}
                          stroke={ext ? 'var(--text)' : 'var(--muted)'}
                          strokeWidth={ext ? 0.22 : 0.08}
                          strokeLinecap="square"
                          opacity={ext ? 0.9 : 0.7}
                        />
                      );
                    })}
                  {isSel && <polygon points={r.polygon!.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--orange)" strokeWidth={sw * 2.5} strokeDasharray={`${6 * px} ${4 * px}`} />}
                  {L.dims &&
                    isSel &&
                    r.polygon!.map((q, i) => {
                      const n = r.polygon![(i + 1) % r.polygon!.length];
                      const nn = inwardNormal(r.polygon!, i);
                      const m: Pt = [(q[0] + n[0]) / 2 + nn[0] * 0.35, (q[1] + n[1]) / 2 + nn[1] * 0.35];
                      return (
                        <text key={`d${i}`} x={m[0]} y={m[1]} fontSize={fs * 0.85} textAnchor="middle" dominantBaseline="middle" className="dim-text">
                          {fmt(len(q, n) * 1000)}
                        </text>
                      );
                    })}
                </g>
              );
            })}

            {/* Room labels on top of patterns */}
            {rooms.map((r) => {
              const rl = loss.byId.get(r.id);
              const c = centroid(r.polygon!);
              return (
                <g key={`l${r.id}`} className="room-tag" pointerEvents="none">
                  <text x={c[0]} y={c[1] - fs * 0.6} fontSize={fs * 1.35} textAnchor="middle" className="room-name">
                    {r.name}
                  </text>
                  <text x={c[0]} y={c[1] + fs * 0.8} fontSize={fs} textAnchor="middle" className="room-sub">
                    {fmt(r.area, 1)} m²
                  </text>
                  <text x={c[0]} y={c[1] + fs * 2} fontSize={fs} textAnchor="middle" className="room-sub">
                    {fmt((rl?.totalW ?? 0) / 1000, 1)} kW
                  </text>
                  {r.ufh.enabled && L.ufh && (
                    <text x={c[0]} y={c[1] + fs * 3.3} fontSize={fs * 0.85} textAnchor="middle" className="ufh-tag">
                      UFH {r.ufh.spacing} mm
                    </text>
                  )}
                </g>
              );
            })}

            {/* Overall dimensions */}
            {L.dims && bboxDims && rb && (
              <g className="dims">
                <DimLine a={[rb.minX, rb.minY - 0.9]} b={[rb.maxX, rb.minY - 0.9]} fs={fs} sw={sw} />
                <DimLine a={[rb.minX - 0.9, rb.maxY]} b={[rb.minX - 0.9, rb.minY]} fs={fs} sw={sw} vertical />
              </g>
            )}

            {/* Pipes */}
            {pipes.map((pipe) =>
              L[pipe.kind] ? (
                <g key={pipe.id}>
                  <polyline
                    points={pipe.pts.map((q) => q.join(',')).join(' ')}
                    fill="none"
                    stroke={pipe.kind === 'flow' ? 'var(--flow)' : 'var(--return)'}
                    strokeWidth={Math.max(0.05, 3 * px)}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {sel?.kind === 'pipe' && sel.id === pipe.id && (
                    <polyline points={pipe.pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--orange)" strokeWidth={Math.max(0.12, 8 * px)} opacity={0.35} />
                  )}
                </g>
              ) : null,
            )}

            {/* Emitters */}
            {L.emitters &&
              rooms.map((r) =>
                r.emitters
                  .filter((e) => e.status !== 'replace')
                  .map((e, i) => {
                    const dragging = emDrag?.emId === e.id;
                    const em = dragging ? { ...e, offsetM: emDrag!.offset } : e;
                    const pl = emitterPlacement(r, em, i);
                    const isSel = sel?.kind === 'emitter' && sel.id === e.id;
                    const out = emitterDt50(e);
                    return (
                      <g key={e.id} className="emitter">
                        <polygon
                          points={pl.corners.map((q) => q.join(',')).join(' ')}
                          fill={e.status === 'new' ? 'rgba(224,119,58,0.35)' : 'rgba(236,228,216,0.18)'}
                          stroke={isSel ? 'var(--orange)' : e.status === 'new' ? 'var(--orange)' : 'var(--text)'}
                          strokeWidth={isSel ? sw * 2.4 : sw * 1.3}
                          strokeDasharray={pl.auto ? `${4 * px} ${3 * px}` : undefined}
                        />
                        {e.kind === 'radiator' &&
                          finsFor(e).map((k, _i, arr) => {
                            const t = (k + 0.5) / arr.length;
                            const s0: Pt = [pl.corners[0][0] + (pl.corners[1][0] - pl.corners[0][0]) * t, pl.corners[0][1] + (pl.corners[1][1] - pl.corners[0][1]) * t];
                            return <line key={k} x1={s0[0]} y1={s0[1]} x2={s0[0] + pl.n[0] * 0.1} y2={s0[1] + pl.n[1] * 0.1} stroke="currentColor" strokeWidth={sw * 0.6} opacity={0.6} />;
                          })}
                        <text x={pl.label[0]} y={pl.label[1]} fontSize={fs * 0.8} textAnchor="middle" className="em-tag">
                          {radiatorTag(p, e.id)}
                        </text>
                        <text x={pl.label[0]} y={pl.label[1] + fs * 0.95} fontSize={fs * 0.75} textAnchor="middle" className="em-sub">
                          {e.kind === 'radiator' ? `${e.height}×${e.length} · ${fmt(out / 1000, 1)} kW` : `${fmt(out / 1000, 1)} kW`}
                        </text>
                      </g>
                    );
                  }),
              )}

            {/* Valves and notes */}
            {L.notes &&
              (plan.valves ?? []).map((v) => {
                const s = 6 * px;
                const isSel = sel?.kind === 'valve' && sel.id === v.id;
                return (
                  <g key={v.id} className="valve">
                    <path
                      d={`M${v.at[0] - s},${v.at[1] - s * 0.7} L${v.at[0] + s},${v.at[1] + s * 0.7} L${v.at[0] + s},${v.at[1] - s * 0.7} L${v.at[0] - s},${v.at[1] + s * 0.7} Z`}
                      fill="var(--bg)"
                      stroke={isSel ? 'var(--orange)' : 'var(--text)'}
                      strokeWidth={sw * 1.4}
                    />
                    <text x={v.at[0]} y={v.at[1] - s * 1.6} fontSize={fs * 0.75} textAnchor="middle" className="em-sub">
                      {v.name}
                    </text>
                  </g>
                );
              })}
            {L.notes &&
              (plan.notes ?? []).map((n) => (
                <text key={n.id} x={n.at[0]} y={n.at[1]} fontSize={fs} className={`note-text ${sel?.kind === 'note' && sel.id === n.id ? 'on' : ''}`}>
                  {n.text}
                </text>
              ))}

            {/* Draft */}
            {draft.length > 0 && (
              <polyline
                points={[...draft, ...(cursor ? [cursor] : [])].map((q) => q.join(',')).join(' ')}
                fill="none"
                stroke={tool === 'pipe' ? (pipeKind === 'flow' ? 'var(--flow)' : 'var(--return)') : 'var(--orange)'}
                strokeWidth={tool === 'pipe' ? Math.max(0.05, 3 * px) : sw * 2}
                strokeDasharray={tool === 'pipe' ? undefined : `${4 * px} ${3 * px}`}
              />
            )}
            {draft.map((q, i) => (
              <circle key={i} cx={q[0]} cy={q[1]} r={4 * px} fill={i === 0 ? 'var(--orange)' : 'var(--text)'} />
            ))}
            {cursor && tool !== 'select' && <circle cx={cursor[0]} cy={cursor[1]} r={3.5 * px} fill="none" stroke="var(--orange)" strokeWidth={sw} />}
            {cursor && draft.length > 0 && (
              <text x={cursor[0] + 8 * px} y={cursor[1] - 8 * px} fontSize={fs} className="dim-text">
                {(len(cursor, draft[draft.length - 1]) * 1000).toFixed(0)} mm{tool === 'pipe' ? ` · total ${(polyLen([...draft, cursor])).toFixed(2)} m` : ''}
              </text>
            )}
          </svg>

          <Compass deg={p.northDeg ?? 0} onRotate={() => update((d) => void (d.northDeg = ((d.northDeg ?? 0) + 45) % 360))} />
          <div className="scale-bar">
            <div style={{ width: scaleBar.px }} />
            <span>{scaleBar.m} m</span>
          </div>
          <div className="zoom-ctl">
            <button onClick={() => zoomAt(vb.x + vb.w / 2, vb.y + vh / 2, 1 / 1.25)} aria-label="Zoom in">
              +
            </button>
            <span>{zoomPct}%</span>
            <button onClick={() => zoomAt(vb.x + vb.w / 2, vb.y + vh / 2, 1.25)} aria-label="Zoom out">
              −
            </button>
            <button onClick={() => setView(null)} aria-label="Fit to screen">
              ⤢
            </button>
          </div>
          {bounds.empty && rooms.length === 0 && (
            <div className="canvas-empty">
              <h3>Start the floor plan</h3>
              <p>Import a Polycam DXF or a plan image, or pick the Room tool and click the corners of each room.</p>
            </div>
          )}
        </div>
        <PlanProperties level={level} pipes={pipes} onDelete={deleteSelection} />
      </div>
      <p className="canvas-hint">
        {msg ? `${msg} ` : ''}
        {toolHint[tool]}
      </p>
    </div>
  );
}

function DimLine({ a, b, fs, sw, vertical }: { a: Pt; b: Pt; fs: number; sw: number; vertical?: boolean }) {
  const d = len(a, b);
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const t = 0.18;
  const tick = (q: Pt) => (vertical ? <line x1={q[0] - t} y1={q[1]} x2={q[0] + t} y2={q[1]} /> : <line x1={q[0]} y1={q[1] - t} x2={q[0]} y2={q[1] + t} />);
  return (
    <g stroke="var(--muted)" strokeWidth={sw}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      {tick(a)}
      {tick(b)}
      <text
        x={m[0]}
        y={m[1]}
        fontSize={fs}
        textAnchor="middle"
        className="dim-text"
        stroke="none"
        transform={vertical ? `rotate(-90 ${m[0]} ${m[1]}) translate(0 ${-fs * 0.5})` : `translate(0 ${-fs * 0.5})`}
      >
        {fmt(d * 1000)}
      </text>
    </g>
  );
}

function UfhLoops({ room, sw }: { room: Room; sw: number }) {
  const poly = room.polygon!;
  const xs = poly.map((q) => q[0]);
  const ys = poly.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) + 0.15, Math.max(...xs) - 0.15, Math.min(...ys) + 0.15, Math.max(...ys) - 0.15];
  const s = Math.max(0.1, room.ufh.spacing / 1000) * 2; // draw every other run so loops stay readable
  const pts: Pt[] = [];
  let k = 0;
  for (let y = y0; y <= y1; y += s, k++) {
    if (k % 2 === 0) pts.push([x0, y], [x1, y]);
    else pts.push([x1, y], [x0, y]);
  }
  return (
    <g clipPath={`url(#clip-${room.id})`}>
      <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--orange)" strokeWidth={sw * 1.1} opacity={0.55} />
    </g>
  );
}

function Compass({ deg, onRotate }: { deg: number; onRotate: () => void }) {
  return (
    <button className="compass" onClick={onRotate} title="North arrow. Click to rotate 45°.">
      <svg viewBox="-30 -30 60 60" aria-hidden="true" style={{ transform: `rotate(${deg}deg)` }}>
        <circle r="22" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <path d="M0,-24 L5,0 L0,4 L-5,0 Z" fill="var(--orange)" />
        <path d="M0,24 L5,0 L0,-4 L-5,0 Z" fill="currentColor" opacity="0.6" />
        <path d="M-24,0 L0,4 L24,0 L0,-4 Z" fill="currentColor" opacity="0.25" />
        <text y="-25" textAnchor="middle" fontSize="8" fill="currentColor">
          N
        </text>
      </svg>
    </button>
  );
}

// ---------- properties panel ----------

function PlanProperties({ level, pipes, onDelete }: { level: string; pipes: PlanPipe[]; onDelete: () => void }) {
  const { project: p, update, loss } = useProject();
  const { selection: sel } = usePlanUi();
  const s = settingsOf(p);

  const setPlan = (fn: (pl: PlanUnderlay) => void) =>
    update((d) => {
      const pl = d.plans[level] ?? { lines: [], labels: [] };
      fn(pl);
      d.plans[level] = pl;
    });

  const header = (title: string, sub?: string) => (
    <header className="props-head">
      <div>
        <h3>{title}</h3>
        {sub && <small>{sub}</small>}
      </div>
      {sel && (
        <button className="link danger" onClick={onDelete} title={sel.kind === 'emitter' ? 'Remove from plan' : 'Delete'}>
          {sel.kind === 'emitter' ? 'Unplace' : 'Delete'}
        </button>
      )}
    </header>
  );

  if (sel?.kind === 'room') {
    const ri = p.rooms.findIndex((r) => r.id === sel.id);
    const r = p.rooms[ri];
    if (!r) return <aside className="props" />;
    const rl = loss.byId.get(r.id)!;
    const out = roomEmitterOutput(p, r);
    return (
      <aside className="props">
        {header(r.name, `${r.level} floor`)}
        <TextField label="Name" value={r.name} onChange={(v) => update((d) => void (d.rooms[ri].name = v))} />
        <div className="grid2">
          <NumField label="Design temp" unit="°C" value={r.designTemp} onChange={(v) => update((d) => void (d.rooms[ri].designTemp = v))} />
          <NumField label="Height" unit="m" step={0.05} value={r.height} onChange={(v) => update((d) => void (d.rooms[ri].height = v))} />
        </div>
        <dl className="props-list">
          <dt>Floor area</dt>
          <dd>{fmt(r.area, 1)} m²</dd>
          <dt>Heat loss</dt>
          <dd>
            <b>{fmt(rl.totalW)} W</b> · {fmt(rl.wPerM2)} W/m²
          </dd>
          <dt>Emitter output</dt>
          <dd className={out.total >= rl.totalW ? 'ok-text' : 'bad-text'}>
            {fmt(out.total)} W at {s.flowTemp} °C ({rl.totalW > 0 ? fmt((out.total / rl.totalW) * 100) : '–'}%)
          </dd>
        </dl>
        <label className="check-row">
          <input type="checkbox" checked={r.ufh.enabled} onChange={(e) => update((d) => void (d.rooms[ri].ufh.enabled = e.target.checked))} /> Underfloor heating
        </label>
        <div className="props-actions">
          <a className="btn ghost sm" href={`#/p/${p.id}/rooms`}>
            Walls & fabric →
          </a>
          <a className="btn ghost sm" href={`#/p/${p.id}/emitters`}>
            Radiators →
          </a>
        </div>
      </aside>
    );
  }

  if (sel?.kind === 'emitter') {
    const ri = p.rooms.findIndex((r) => r.emitters.some((e) => e.id === sel.id));
    const r = p.rooms[ri];
    const e = r?.emitters.find((x) => x.id === sel.id);
    if (!r || !e) return <aside className="props" />;
    const ei = r.emitters.indexOf(e);
    const set = (fn: (x: Emitter) => void) => update((d) => fn(d.rooms[ri].emitters[ei]));
    const dT = roomEmitterOutput(p, r).dT;
    const dt50 = emitterDt50(e);
    const atDesign = dt50 * Math.max(0, dT / 50) ** s.radiatorExponent;
    const sizes = PIPE_SIZES.filter((x) => x.material === 'copper' || x.material === 'pex' || x.material === 'mlcp');
    return (
      <aside className="props">
        {header(radiatorTag(p, e.id), r.name)}
        <h5>General</h5>
        <div className="grid2">
          <Select
            label="Status"
            value={e.status}
            onChange={(v) => set((x) => void (x.status = v))}
            options={[
              { value: 'existing', label: 'Existing' },
              { value: 'new', label: 'New' },
              { value: 'replace', label: 'Replace' },
            ]}
          />
          {e.kind === 'radiator' && (
            <Select<RadiatorType> label="Type" value={e.type ?? '22'} onChange={(v) => set((x) => void (x.type = v))} options={RAD_TYPES.map((t) => ({ value: t.id, label: t.name }))} />
          )}
          {e.kind === 'radiator' && <NumField label="Height" unit="mm" step={50} value={e.height} onChange={(v) => set((x) => void (x.height = v))} />}
          {e.kind === 'radiator' && <NumField label="Length" unit="mm" step={100} value={e.length} onChange={(v) => set((x) => void (x.length = v))} />}
          <NumField label="Quantity" step={1} value={e.quantity} onChange={(v) => set((x) => void (x.quantity = v))} />
        </div>
        <dl className="props-list">
          <dt>Output (ΔT50)</dt>
          <dd>{fmt(dt50)} W</dd>
          <dt>At {s.flowTemp} °C flow</dt>
          <dd>
            <b>{fmt(atDesign)} W</b>
          </dd>
        </dl>
        <h5>Positioning</h5>
        <div className="grid2">
          <Select
            label="Wall"
            value={String(e.wallIndex ?? '')}
            onChange={(v) => set((x) => void (x.wallIndex = v === '' ? undefined : Number(v)))}
            options={[{ value: '', label: 'Not placed (auto)' }, ...r.walls.map((w, i) => ({ value: String(i), label: `${w.name} (${fmt(w.length, 2)} m)` }))]}
          />
          <NumField label="Centre from corner" unit="mm" step={50} value={e.offsetM !== undefined ? Math.round(e.offsetM * 1000) : undefined} onChange={(v) => set((x) => void (x.offsetM = v / 1000))} />
        </div>
        <h5>Pipework</h5>
        <div className="grid2">
          <Select label="Flow pipe" value={e.flowSizeId ?? ''} onChange={(v) => set((x) => void (x.flowSizeId = v || undefined))} options={[{ value: '', label: '–' }, ...sizes.map((x) => ({ value: x.id, label: `${x.material} ${x.label}` }))]} />
          <Select label="Return pipe" value={e.returnSizeId ?? ''} onChange={(v) => set((x) => void (x.returnSizeId = v || undefined))} options={[{ value: '', label: '–' }, ...sizes.map((x) => ({ value: x.id, label: `${x.material} ${x.label}` }))]} />
        </div>
        <p className="muted small">Drag the radiator along its wall with the Select tool.</p>
      </aside>
    );
  }

  if (sel?.kind === 'pipe') {
    const pipe = pipes.find((x) => x.id === sel.id);
    if (!pipe) return <aside className="props" />;
    const set = (fn: (x: PlanPipe) => void) => setPlan((pl) => void fn((pl.pipes ?? []).find((x) => x.id === sel.id)!));
    const length = polyLen(pipe.pts);
    const run = p.pipes.find((x) => x.id === pipe.runId);
    return (
      <aside className="props">
        {header(`${pipe.kind === 'flow' ? 'Flow' : 'Return'} pipe`, `${fmt(length, 2)} m drawn`)}
        <div className="grid2">
          <Select
            label="Type"
            value={pipe.kind}
            onChange={(v) => set((x) => void (x.kind = v))}
            options={[
              { value: 'flow', label: 'Flow' },
              { value: 'return', label: 'Return' },
            ]}
          />
          <Select label="Size" value={pipe.sizeId ?? ''} onChange={(v) => set((x) => void (x.sizeId = v || undefined))} options={[{ value: '', label: run ? 'From run' : '–' }, ...PIPE_SIZES.map((x) => ({ value: x.id, label: `${x.material} ${x.label}` }))]} />
        </div>
        <h5>Counts towards pipe run</h5>
        <Select
          value={pipe.runId ?? ''}
          onChange={(v) => set((x) => void (x.runId = v || undefined))}
          options={[{ value: '', label: 'Not linked' }, ...p.pipes.map((x) => ({ value: x.id, label: x.name }))]}
        />
        <div className="props-actions">
          <button
            className="btn ghost sm"
            onClick={() =>
              update((d) => {
                const id = uid();
                d.pipes.push({ id, name: `Run ${d.pipes.length + 1}`, material: pipeSize(pipe.sizeId ?? '')?.material ?? 'copper', sizeId: pipe.sizeId ?? '', lengthM: 0, fittingsPct: 30, loadW: 0, roomIds: [], isIndex: false });
                const pl = d.plans[level]!;
                pl.pipes = (pl.pipes ?? []).map((x) => (x.id === pipe.id ? { ...x, runId: id } : x));
              })
            }
          >
            New run from this pipe
          </button>
          <a className="btn ghost sm" href={`#/p/${p.id}/pipework`}>
            Pipe runs →
          </a>
        </div>
        <p className="muted small">
          Linked pipes set the run's length automatically (flow + return), which then feeds pipe sizing and the materials list.
          {run ? ` “${run.name}” is ${fmt(pipes.filter((x) => x.runId === run.id).reduce((a, x) => a + polyLen(x.pts), 0), 1)} m on this floor.` : ''}
        </p>
      </aside>
    );
  }

  if (sel?.kind === 'note' || sel?.kind === 'valve') {
    const plan = p.plans[level];
    const item = sel.kind === 'note' ? plan?.notes?.find((x) => x.id === sel.id) : plan?.valves?.find((x) => x.id === sel.id);
    if (!item) return <aside className="props" />;
    const value = 'text' in item ? item.text : item.name;
    return (
      <aside className="props">
        {header(sel.kind === 'note' ? 'Note' : 'Valve')}
        <TextField
          label={sel.kind === 'note' ? 'Text' : 'Name'}
          value={value}
          onChange={(v) =>
            setPlan((pl) => {
              if (sel.kind === 'note') pl.notes = (pl.notes ?? []).map((x) => (x.id === sel.id ? { ...x, text: v } : x));
              else pl.valves = (pl.valves ?? []).map((x) => (x.id === sel.id ? { ...x, name: v } : x));
            })
          }
        />
      </aside>
    );
  }

  // Nothing selected: floor summary.
  const rooms = p.rooms.filter((r) => r.level === level);
  const flowM = pipes.filter((x) => x.kind === 'flow').reduce((a, x) => a + polyLen(x.pts), 0);
  const retM = pipes.filter((x) => x.kind === 'return').reduce((a, x) => a + polyLen(x.pts), 0);
  const unplaced = rooms.reduce((a, r) => a + r.emitters.filter((e) => e.status !== 'replace' && e.wallIndex === undefined).length, 0);
  return (
    <aside className="props">
      {header(`${level} floor`)}
      <dl className="props-list">
        <dt>Rooms</dt>
        <dd>{rooms.length}</dd>
        <dt>Heat loss</dt>
        <dd>
          <b>{fmt(rooms.reduce((a, r) => a + (loss.byId.get(r.id)?.totalW ?? 0), 0) / 1000, 2)} kW</b>
        </dd>
        <dt>Flow pipe drawn</dt>
        <dd>{fmt(flowM, 1)} m</dd>
        <dt>Return pipe drawn</dt>
        <dd>{fmt(retM, 1)} m</dd>
        <dt>Emitters not placed</dt>
        <dd>{unplaced ? `${unplaced} (shown dashed)` : 'None'}</dd>
      </dl>
      <p className="muted small">Select a room, radiator or pipe to edit it here.</p>
    </aside>
  );
}

function guessType(name: string): string {
  const n = name.toLowerCase();
  if (/en.?suite/.test(n)) return 'ensuite';
  if (/bath|shower/.test(n)) return 'bathroom';
  if (/bed/.test(n)) return 'bedroom';
  if (/kitchen.*(din|family)|open plan/.test(n)) return 'kitchen-diner';
  if (/kitchen/.test(n)) return 'kitchen';
  if (/din/.test(n)) return 'dining';
  if (/landing/.test(n)) return 'landing';
  if (/hall|stair/.test(n)) return 'hall';
  if (/wc|cloak|toilet/.test(n)) return 'wc';
  if (/util/.test(n)) return 'utility';
  if (/study|office/.test(n)) return 'study';
  if (/plant|boiler/.test(n)) return 'plant';
  if (/pool/.test(n)) return 'pool';
  if (/store|cupboard|airing/.test(n)) return 'store';
  if (/conserv|orangery/.test(n)) return 'conservatory';
  return 'living';
}
