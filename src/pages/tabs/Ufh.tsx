import { uid } from '../../engine/factory';
import { PIPE_SIZES } from '../../engine/pipes';
import { designUfhRoom, FLOOR_COVERINGS } from '../../engine/ufh';
import { Card, fmt, NumField, Pill, Select, Stat, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';
import { roomEmitterOutput, ufhInputs } from './Emitters';

const SPACINGS = [100, 125, 150, 175, 200, 225, 250, 300];

export function UfhTab() {
  const { project: p, loss, update } = useProject();
  const s = p.settings;
  const ufhRooms = p.rooms.map((r, i) => ({ r, i })).filter(({ r }) => r.ufh.enabled);

  const results = new Map(
    ufhRooms.map(({ r }) => {
      const rads = roomEmitterOutput(p, r).rads;
      const need = Math.max(0, loss.byId.get(r.id)!.totalW - rads);
      return [r.id, designUfhRoom({ ...ufhInputs(p, r), requiredW: need })];
    }),
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Underfloor heating</p>
          <h1>
            Loops, outputs & flow rates at {s.flowTemp}/{s.flowTemp - s.deltaT} °C
          </h1>
        </div>
      </div>

      <Card
        title="Manifolds"
        actions={
          <button
            className="btn ghost sm"
            onClick={() => update((d) => void d.manifolds.push({ id: uid(), name: `Manifold ${d.manifolds.length + 1}`, location: '' }))}
          >
            + Manifold
          </button>
        }
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Manifold</th>
              <th>Location</th>
              <th className="r">Rooms</th>
              <th className="r">Ports (loops)</th>
              <th className="r">Output W</th>
              <th className="r">Total flow l/min</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {p.manifolds.map((m, mi) => {
              const rs = ufhRooms.filter(({ r }) => r.ufh.manifoldId === m.id).map(({ r }) => results.get(r.id)!);
              return (
                <tr key={m.id}>
                  <td>
                    <TextField value={m.name} onChange={(v) => update((d) => void (d.manifolds[mi].name = v))} />
                  </td>
                  <td>
                    <TextField value={m.location} placeholder="e.g. under stairs" onChange={(v) => update((d) => void (d.manifolds[mi].location = v))} />
                  </td>
                  <td className="r">{rs.length}</td>
                  <td className="r">{rs.reduce((a, x) => a + x.loops, 0)}</td>
                  <td className="r">{fmt(rs.reduce((a, x) => a + x.outputW, 0))}</td>
                  <td className="r">{fmt(rs.reduce((a, x) => a + x.totalFlowLpm, 0), 1)}</td>
                  <td>
                    {p.manifolds.length > 1 && (
                      <button className="link danger" onClick={() => update((d) => void d.manifolds.splice(mi, 1))}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Rooms with underfloor heating">
        <div className="chips">
          {p.rooms.map((r, i) => (
            <label key={r.id} className={`chip ${r.ufh.enabled ? 'on' : ''}`}>
              <input type="checkbox" checked={r.ufh.enabled} onChange={(e) => update((d) => void (d.rooms[i].ufh.enabled = e.target.checked))} />
              {r.name}
            </label>
          ))}
        </div>
      </Card>

      {ufhRooms.map(({ r, i }) => {
        const res = results.get(r.id)!;
        const need = res.coveragePct > 0 ? res.outputW / (res.coveragePct / 100) : 0;
        const u = r.ufh;
        const set = (fn: (x: typeof u) => void) => update((d) => fn(d.rooms[i].ufh));
        return (
          <Card
            key={r.id}
            title={r.name}
            actions={
              <>
                <Pill tone={res.coveragePct >= 100 || need === 0 ? 'ok' : res.coveragePct >= 85 ? 'warn' : 'bad'}>
                  {fmt(res.outputW)} W of {fmt(need)} W needed
                </Pill>
                <Pill tone={res.surfaceOk ? 'ok' : 'bad'}>
                  floor {fmt(res.surfaceTemp, 1)} °C {res.surfaceOk ? '' : `> ${res.maxSurfaceTemp} °C limit`}
                </Pill>
              </>
            }
          >
            <div className="grid4">
              <Select label="Manifold" value={u.manifoldId} onChange={(v) => set((x) => void (x.manifoldId = v))} options={p.manifolds.map((m) => ({ value: m.id, label: m.name }))} />
              <Select label="Pipe centres" value={String(u.spacing)} onChange={(v) => set((x) => void (x.spacing = Number(v)))} options={SPACINGS.map((v) => ({ value: String(v), label: `${v} mm` }))} />
              <Select label="Floor covering" value={u.covering} onChange={(v) => set((x) => void (x.covering = v))} options={FLOOR_COVERINGS.map((c) => ({ value: c.id, label: `${c.name} (R ${c.r})` }))} />
              <Select
                label="Pipe"
                value={u.pipeSizeId}
                onChange={(v) => set((x) => void (x.pipeSizeId = v))}
                options={PIPE_SIZES.filter((s) => s.material === 'pex' || s.material === 'mlcp').map((s) => ({ value: s.id, label: `${s.material.toUpperCase()} ${s.label}` }))}
              />
              <NumField label="Active area" unit="%" value={u.activeAreaPct} onChange={(v) => set((x) => void (x.activeAreaPct = v))} />
              <NumField label="Lead length (one way)" unit="m" value={u.leadLength} onChange={(v) => set((x) => void (x.leadLength = v))} />
              <NumField label="Screed over pipe" unit="mm" value={u.screedCover} onChange={(v) => set((x) => void (x.screedCover = v))} />
              <NumField label="Max loop length" unit="m" value={u.maxLoopLength} onChange={(v) => set((x) => void (x.maxLoopLength = v))} />
            </div>
            <div className="stats compact">
              <Stat label="Output" value={fmt(res.fluxWm2)} unit="W/m²" />
              <Stat label="Loops" value={String(res.loops)} />
              <Stat label="Each loop" value={fmt(res.loopLengthM)} unit="m" tone={res.loopLengthM > u.maxLoopLength ? 'bad' : undefined} />
              <Stat label="Flow meter setting" value={fmt(res.flowPerLoopLpm, 2)} unit="l/min per loop" />
              <Stat label="Pipe in room" value={fmt(res.pipeInRoomM)} unit="m" />
            </div>
          </Card>
        );
      })}
      {ufhRooms.length === 0 && <p className="muted">Tick a room above to design underfloor heating for it.</p>}
      <p className="muted small">
        Output per BS EN 1264-2 (wet screed, type A) at the project flow/return temperatures. Surface limits: 29 °C occupied areas, 33 °C bathrooms. Where a room also
        has radiators, the UFH only needs to cover what's left. Check against the UFH supplier's design before installation.
      </p>
    </div>
  );
}
