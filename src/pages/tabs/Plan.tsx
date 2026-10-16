import { useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import { go } from '../../App';
import { normalisePlan, parseDxf, pointInPolygon } from '../../engine/dxf';
import { detectAdjacency, roomFromPolygon } from '../../engine/factory';
import { polygonArea } from '../../engine/heatloss';
import type { PlanUnderlay, Pt } from '../../engine/model';
import { readFile } from '../../store';
import { Card, fmt, Pill } from '../../ui/fields';
import { useProject } from '../ProjectView';
import { ask } from '../../ui/dialog';
import { LEVELS } from './Rooms';

type Tool = 'select' | 'draw' | 'measure';

export function lossColour(wPerM2: number): string {
  // 0 → cool blue, 120+ W/m² → CA2 orange/red
  const t = Math.max(0, Math.min(1, wPerM2 / 120));
  const h = 210 - t * 195;
  return `hsl(${h} 75% 55% / 0.35)`;
}

export function PlanTab() {
  const { project: p, update, loss } = useProject();
  const usedLevels = [...new Set([...Object.keys(p.plans), ...p.rooms.map((r) => r.level)])];
  const [level, setLevel] = useState(usedLevels[0] ?? 'Ground');
  const [tool, setTool] = useState<Tool>('select');
  const [draft, setDraft] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [view, setView] = useState<{ x: number; y: number; w: number } | null>(null);
  const [msg, setMsg] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);

  const plan: PlanUnderlay = p.plans[level] ?? { lines: [], labels: [] };
  const rooms = p.rooms.filter((r) => r.level === level && r.polygon);

  const bounds = useMemo(() => {
    const pts: Pt[] = [...plan.lines.flat(), ...rooms.flatMap((r) => r.polygon!)];
    if (plan.image) pts.push([plan.image.x, plan.image.y], [plan.image.x + plan.image.widthM, plan.image.y + plan.image.heightM]);
    if (!pts.length) return { x: -1, y: -1, w: 12, h: 10 };
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX - 1, y: minY - 1, w: Math.max(...xs) - minX + 2, h: Math.max(...ys) - minY + 2 };
  }, [plan, rooms]);

  const vb = view ?? { x: bounds.x, y: bounds.y, w: Math.max(bounds.w, (bounds.h * 16) / 10) };
  const vh = (vb.w * 10) / 16;
  const px = vb.w / 900; // metres per screen pixel, roughly

  const snapPts = useMemo(() => [...plan.lines.flat(), ...p.rooms.filter((r) => r.level === level).flatMap((r) => r.polygon ?? [])], [plan, p.rooms, level]);

  const toWorld = (e: MouseEvent): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const w = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [w.x, w.y];
  };

  const snap = (q: Pt): Pt => {
    let best: Pt | null = null;
    let bd = 12 * px;
    for (const s of snapPts) {
      const d = Math.hypot(s[0] - q[0], s[1] - q[1]);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) return best;
    // Square up to the previous point when nearly horizontal/vertical.
    const last = draft[draft.length - 1];
    if (last) {
      if (Math.abs(q[0] - last[0]) < 8 * px) return [last[0], q[1]];
      if (Math.abs(q[1] - last[1]) < 8 * px) return [q[0], last[1]];
    }
    return [Math.round(q[0] * 20) / 20, Math.round(q[1] * 20) / 20];
  };

  const finishRoom = async (poly: Pt[]) => {
    setDraft([]);
    if (poly.length < 3 || polygonArea(poly) < 0.3) return;
    const label = plan.labels.find((l) => pointInPolygon(l.at, poly))?.text;
    const name = await ask.prompt('Room name', label ?? `Room ${p.rooms.length + 1}`);
    if (!name) return;
    update((d) => {
      d.rooms.push(roomFromPolygon(name, poly, level, guessType(name)));
      const same = detectAdjacency(d.rooms.filter((r) => r.level === level));
      d.rooms = d.rooms.map((r) => same.find((s) => s.id === r.id) ?? r);
    });
  };

  const onClick = async (e: MouseEvent) => {
    if (drag.current?.moved) return;
    const q = snap(toWorld(e));
    if (tool === 'draw') {
      if (draft.length >= 3 && Math.hypot(q[0] - draft[0][0], q[1] - draft[0][1]) < 12 * px) finishRoom(draft);
      else setDraft([...draft, q]);
    } else if (tool === 'measure') {
      if (draft.length === 0) setDraft([q]);
      else {
        const measured = Math.hypot(q[0] - draft[0][0], q[1] - draft[0][1]);
        setDraft([]);
        const real = await ask.prompt(`Measured ${measured.toFixed(3)} m on the plan.\nEnter the real length in metres to rescale the underlay, or cancel to keep it.`);
        const v = parseFloat(real ?? '');
        if (v > 0 && measured > 0) rescaleUnderlay(v / measured);
      }
    } else {
      const hit = rooms.find((r) => pointInPolygon(toWorld(e), r.polygon!));
      if (hit) go(`p/${p.id}/rooms`);
    }
  };

  const rescaleUnderlay = (k: number) =>
    update((d) => {
      const pl = d.plans[level];
      if (!pl) return;
      pl.lines = pl.lines.map(([a, b]) => [[a[0] * k, a[1] * k], [b[0] * k, b[1] * k]]);
      pl.labels = pl.labels.map((l) => ({ ...l, at: [l.at[0] * k, l.at[1] * k] }));
      if (pl.image) pl.image = { ...pl.image, x: pl.image.x * k, y: pl.image.y * k, widthM: pl.image.widthM * k, heightM: pl.image.heightM * k };
    });

  const importDxf = async (file: File) => {
    const text = await readFile(file, 'text');
    const parsed = normalisePlan(parseDxf(text));
    if (!parsed.lines.length) {
      setMsg('No lines found in that file. In Polycam, export the floor plan as DXF.');
      return;
    }
    update((d) => {
      d.plans[level] = { ...(d.plans[level] ?? { labels: [] }), lines: parsed.lines, labels: parsed.labels };
    });
    setView(null);
    const auto = parsed.polygons.filter((poly) => polygonArea(poly) > 1 && polygonArea(poly) < 400);
    setMsg(`Imported ${parsed.lines.length} lines (units: ${parsed.unitsName}).`);
    if (auto.length && await ask.confirm(`Found ${auto.length} closed shapes that look like rooms. Create rooms from them?`)) {
      update((d) => {
        auto.forEach((poly, i) => {
          const label = parsed.labels.find((l) => pointInPolygon(l.at, poly))?.text;
          d.rooms.push(roomFromPolygon(label ?? `Room ${i + 1}`, poly, level, guessType(label ?? '')));
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
      const widthM = parseFloat(await ask.prompt('How wide is this plan image in real life (metres)? You can fine-tune with the Measure tool afterwards.', '10') ?? '');
      if (!(widthM > 0)) return;
      const heightM = (widthM * img.height) / img.width;
      update((d) => {
        d.plans[level] = { ...(d.plans[level] ?? { lines: [], labels: [] }), image: { dataUrl, x: 0, y: 0, widthM, heightM } };
      });
      setView(null);
    };
    img.src = dataUrl;
  };

  const onWheel = (e: WheelEvent) => {
    const [wx, wy] = toWorld(e as unknown as MouseEvent);
    const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setView({ x: wx - (wx - vb.x) * k, y: wy - (wy - vb.y) * k, w: vb.w * k });
  };

  const onDown = (e: MouseEvent) => {
    if (e.button === 1 || tool === 'select' || e.shiftKey) drag.current = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false };
  };
  const onMove = (e: MouseEvent) => {
    if (drag.current) {
      const dx = (e.clientX - drag.current.sx) * (vb.w / (svgRef.current?.clientWidth || 900));
      const dy = (e.clientY - drag.current.sy) * (vb.w / (svgRef.current?.clientWidth || 900));
      if (Math.abs(dx) + Math.abs(dy) > 2 * px) drag.current.moved = true;
      setView({ x: drag.current.vx - dx, y: drag.current.vy - dy, w: vb.w });
    }
    if (tool !== 'select') setCursor(snap(toWorld(e)));
  };
  const onUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };

  const sw = 1.5 * px;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Floor plan</p>
          <h1>Import from Polycam & trace rooms</h1>
        </div>
      </div>

      <Card>
        <div className="toolbar">
          <div className="seg">
            {[...new Set([...usedLevels, level])].map((l) => (
              <button key={l} className={l === level ? 'on' : ''} onClick={() => (setLevel(l), setView(null), setDraft([]))}>
                {l}
              </button>
            ))}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setLevel(e.target.value);
                  setView(null);
                }
              }}
            >
              <option value="">+ Level</option>
              {LEVELS.filter((l) => !usedLevels.includes(l)).map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="seg">
            <button className={tool === 'select' ? 'on' : ''} onClick={() => (setTool('select'), setDraft([]))}>
              Pan / select
            </button>
            <button className={tool === 'draw' ? 'on' : ''} onClick={() => (setTool('draw'), setDraft([]))}>
              Draw room
            </button>
            <button className={tool === 'measure' ? 'on' : ''} onClick={() => (setTool('measure'), setDraft([]))}>
              Measure / scale
            </button>
          </div>
          <div className="actions">
            <label className="btn ghost sm">
              Import DXF
              <input type="file" accept=".dxf" hidden onChange={(e) => e.target.files?.[0] && importDxf(e.target.files[0])} />
            </label>
            <label className="btn ghost sm">
              Import image
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && importImage(e.target.files[0])} />
            </label>
            <button className="btn ghost sm" onClick={() => setView(null)}>
              Fit
            </button>
            {(plan.lines.length > 0 || plan.image) && (
              <button
                className="btn ghost sm danger"
                onClick={async () =>
                  (await ask.confirm('Remove the imported underlay for this level? Rooms stay.', { danger: true })) &&
                  update((d) => {
                    delete d.plans[level];
                  })
                }
              >
                Clear underlay
              </button>
            )}
          </div>
        </div>
        {msg && <p className="muted small">{msg}</p>}
        <p className="muted small">
          {tool === 'draw'
            ? draft.length
              ? 'Click each corner. Click the first point to close the room. Points snap to plan corners. Esc to cancel.'
              : 'Click the first corner of a room.'
            : tool === 'measure'
              ? 'Click two points a known distance apart, then enter the real length to set the scale.'
              : 'Drag to pan, scroll to zoom, click a room to edit it.'}
        </p>
        <div className="plan-wrap" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && setDraft([])}>
          <svg
            ref={svgRef}
            className={`plan tool-${tool}`}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vh}`}
            onClick={onClick}
            onWheel={onWheel}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={() => setCursor(null)}
          >
            <defs>
              <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                <path d="M 1 0 L 0 0 0 1" fill="none" stroke="var(--grid)" strokeWidth={px} />
              </pattern>
            </defs>
            <rect x={vb.x - vb.w} y={vb.y - vh} width={vb.w * 3} height={vh * 3} fill="url(#grid)" />
            {plan.image && <image href={plan.image.dataUrl} x={plan.image.x} y={plan.image.y} width={plan.image.widthM} height={plan.image.heightM} opacity={0.6} />}
            {plan.lines.map(([a, b], i) => (
              <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--plan-line)" strokeWidth={sw} />
            ))}
            {rooms.map((r) => {
              const rl = loss.byId.get(r.id);
              const cx = r.polygon!.reduce((s, q) => s + q[0], 0) / r.polygon!.length;
              const cy = r.polygon!.reduce((s, q) => s + q[1], 0) / r.polygon!.length;
              return (
                <g key={r.id}>
                  <polygon points={r.polygon!.map((q) => q.join(',')).join(' ')} fill={lossColour(rl?.wPerM2 ?? 0)} stroke="var(--orange)" strokeWidth={sw * 1.5} />
                  {r.polygon!.map((q, i) => {
                    const n = r.polygon![(i + 1) % r.polygon!.length];
                    const w = r.walls[i];
                    if (!w || w.boundary === 'room') return null;
                    return <line key={i} x1={q[0]} y1={q[1]} x2={n[0]} y2={n[1]} stroke={w.boundary === 'external' ? 'var(--ink)' : 'var(--muted-ink)'} strokeWidth={sw * 4} />;
                  })}
                  <text x={cx} y={cy} fontSize={Math.min(0.35, vb.w / 50)} textAnchor="middle" className="plan-label">
                    {r.name}
                  </text>
                  <text x={cx} y={cy + Math.min(0.4, vb.w / 45)} fontSize={Math.min(0.3, vb.w / 60)} textAnchor="middle" className="plan-sub">
                    {fmt(rl?.totalW ?? 0)} W · {fmt(r.area, 1)} m²
                  </text>
                </g>
              );
            })}
            {plan.labels.map((l, i) => (
              <text key={i} x={l.at[0]} y={l.at[1]} fontSize={Math.min(0.25, vb.w / 70)} className="plan-dxf-label">
                {l.text}
              </text>
            ))}
            {draft.length > 0 && (
              <polyline
                points={[...draft, ...(cursor ? [cursor] : [])].map((q) => q.join(',')).join(' ')}
                fill="none"
                stroke="var(--orange)"
                strokeWidth={sw * 2}
                strokeDasharray={`${4 * px} ${3 * px}`}
              />
            )}
            {draft.map((q, i) => (
              <circle key={i} cx={q[0]} cy={q[1]} r={4 * px} fill={i === 0 ? 'var(--orange)' : 'var(--ink)'} />
            ))}
            {cursor && tool !== 'select' && <circle cx={cursor[0]} cy={cursor[1]} r={3 * px} fill="none" stroke="var(--orange)" strokeWidth={sw} />}
            {cursor && draft.length > 0 && (
              <text x={cursor[0] + 6 * px} y={cursor[1] - 6 * px} fontSize={12 * px} className="plan-sub">
                {Math.hypot(cursor[0] - draft[draft.length - 1][0], cursor[1] - draft[draft.length - 1][1]).toFixed(2)} m
              </text>
            )}
          </svg>
        </div>
        <div className="legend">
          <span>
            <i style={{ background: lossColour(20) }} /> low W/m²
          </span>
          <span>
            <i style={{ background: lossColour(70) }} /> medium
          </span>
          <span>
            <i style={{ background: lossColour(120) }} /> high
          </span>
          <span>
            <i className="bar ext" /> external wall
          </span>
          <span>
            <i className="bar other" /> ground / unheated / neighbour
          </span>
        </div>
      </Card>

      <Card title="Getting plans out of Polycam">
        <ol className="steps">
          <li>Scan the property in Polycam using Room / LiDAR mode, one floor at a time.</li>
          <li>
            Open the scan, choose <b>Floor plan</b>, then export as <b>DXF</b>. If DXF isn't offered on your plan, export the floor plan image (PNG/JPG) instead.
          </li>
          <li>Pick the level above, then use <b>Import DXF</b> (or <b>Import image</b>). Closed room outlines are turned into rooms automatically.</li>
          <li>
            Trace any rooms that weren't detected with <b>Draw room</b>. Corners snap to the plan. Walls shared with another room are set as internal; the rest
            start as external.
          </li>
          <li>Check one known dimension with <b>Measure / scale</b>, then fill in constructions, windows and doors on the Rooms tab.</li>
        </ol>
        <p className="muted small">
          {rooms.length} traced rooms on this level. <Pill tone="info">Tip</Pill> Polycam measures to the inside face of walls, which is what the heat loss
          areas use.
        </p>
      </Card>
    </div>
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
  if (/hall|landing|stair/.test(n)) return 'hall';
  if (/wc|cloak|toilet/.test(n)) return 'wc';
  if (/util/.test(n)) return 'utility';
  if (/study|office/.test(n)) return 'study';
  if (/plant|boiler/.test(n)) return 'plant';
  if (/pool/.test(n)) return 'pool';
  if (/store|cupboard|airing/.test(n)) return 'store';
  if (/conserv|orangery/.test(n)) return 'conservatory';
  return 'living';
}
