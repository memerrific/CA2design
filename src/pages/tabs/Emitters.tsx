import { useState } from 'react';
import { emitterDt50, emitterOutput, RAD_HEIGHTS, RAD_LENGTHS, RAD_TYPES, suggestRadiator } from '../../engine/emitters';
import { requiredFlowTemp, roomEmitterOutput } from '../../engine/design';
import { uid } from '../../engine/factory';
import type { Emitter, RadiatorType, Room } from '../../engine/model';
import { Card, fmt, NumField, Pill, Select, Stat, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

export function EmittersTab() {
  const { project: p, loss, update } = useProject();
  const [height, setHeight] = useState(600);
  const s = p.settings;

  const flows = p.rooms.map((r) => ({ r, f: requiredFlowTemp(p, r, loss.byId.get(r.id)!.totalW) }));
  const worst = flows.reduce<{ r?: Room; f: number }>((a, x) => (x.f !== null && x.f > a.f ? { r: x.r, f: x.f } : a), { f: 0 });
  const short = flows.filter((x) => x.f !== null && x.f > s.flowTemp + 0.01).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Radiators</p>
          <h1>Emitter sizing at {s.flowTemp} °C flow</h1>
        </div>
        <div className="actions">
          <Select
            label="Preferred height"
            value={String(height)}
            onChange={(v) => setHeight(Number(v))}
            options={RAD_HEIGHTS.map((h) => ({ value: String(h.mm), label: `${h.mm} mm` }))}
          />
        </div>
      </div>
      <div className="stats">
        <Stat label="Design flow / return" value={`${s.flowTemp} / ${s.flowTemp - s.deltaT}`} unit="°C" />
        <Stat
          label="Flow temp the current emitters need"
          value={worst.f === Infinity ? 'n/a' : fmt(worst.f, 1)}
          unit={worst.f === Infinity ? '' : '°C'}
          tone={worst.f > s.flowTemp ? 'bad' : 'ok'}
        />
        <Stat label="Index room" value={worst.r?.name ?? '–'} />
        <Stat label="Rooms short" value={String(short)} tone={short ? 'warn' : 'ok'} />
      </div>
      <p className="muted small">
        Outputs use generic panel radiator data at ΔT50 with Φ = Φ50·(ΔT/50)^{s.radiatorExponent}. Use the chosen manufacturer's tables for the final order. Mark
        radiators being removed as “Replace” so they don't count.
      </p>

      {p.rooms.map((r, ri) => {
        const need = loss.byId.get(r.id)!.totalW;
        const out = roomEmitterOutput(p, r);
        const pct = need > 0 ? (out.total / need) * 100 : 100;
        const shortfall = Math.max(0, need - out.total);
        const sug = shortfall > 0 ? suggestRadiator(shortfall, out.dT, height, s.radiatorExponent) : null;
        // Alternative: swap the existing radiators for one sized for the whole room (less UFH share).
        const swap = shortfall > 0 && r.emitters.some((e) => e.status === 'existing') ? suggestRadiator(need - out.ufh, out.dT, height, s.radiatorExponent) : null;
        const f = flows[ri].f;
        const set = (fn: (e: Emitter[]) => void) => update((d) => fn(d.rooms[ri].emitters));
        return (
          <Card
            key={r.id}
            title={
              <>
                {r.name} <small className="muted">{r.level}</small>
              </>
            }
            actions={
              <>
                <Pill tone={pct >= 100 ? 'ok' : pct >= 85 ? 'warn' : 'bad'}>{fmt(pct)}% of {fmt(need)} W</Pill>
                {f !== null && <Pill tone="info">needs {f === Infinity ? 'emitters' : `${fmt(f, 1)} °C flow`}</Pill>}
              </>
            }
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Emitter</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Height</th>
                  <th>Length</th>
                  <th>Qty</th>
                  <th className="r">ΔT50 W</th>
                  <th className="r">At design W</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.emitters.map((e, ei) => (
                  <tr key={e.id} className={e.status === 'replace' ? 'struck' : ''}>
                    <td>
                      <TextField value={e.name} onChange={(v) => set((x) => void (x[ei].name = v))} />
                    </td>
                    <td>
                      <Select
                        value={e.status}
                        onChange={(v) => set((x) => void (x[ei].status = v))}
                        options={[
                          { value: 'existing', label: 'Existing' },
                          { value: 'new', label: 'New' },
                          { value: 'replace', label: 'Replace' },
                        ]}
                      />
                    </td>
                    {e.kind === 'radiator' ? (
                      <>
                        <td>
                          <Select<RadiatorType> value={e.type ?? '11'} onChange={(v) => set((x) => void (x[ei].type = v))} options={RAD_TYPES.map((t) => ({ value: t.id, label: t.name }))} />
                        </td>
                        <td>
                          <NumField value={e.height} unit="mm" width={70} step={50} onChange={(v) => set((x) => void (x[ei].height = v))} />
                        </td>
                        <td>
                          <NumField value={e.length} unit="mm" width={70} step={100} onChange={(v) => set((x) => void (x[ei].length = v))} />
                        </td>
                      </>
                    ) : (
                      <td colSpan={3}>
                        <NumField value={e.ratedDt50} unit="W @ ΔT50" width={80} onChange={(v) => set((x) => void (x[ei].ratedDt50 = v))} />
                      </td>
                    )}
                    <td>
                      <NumField value={e.quantity} width={45} step={1} min={1} onChange={(v) => set((x) => void (x[ei].quantity = v))} />
                    </td>
                    <td className="r">{fmt(emitterDt50(e))}</td>
                    <td className="r">{e.status === 'replace' ? '–' : fmt(emitterOutput(e, out.dT, s.radiatorExponent))}</td>
                    <td>
                      <button className="link danger" onClick={() => set((x) => void x.splice(ei, 1))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {out.ufh > 0 && (
                  <tr>
                    <td colSpan={7}>Underfloor heating</td>
                    <td className="r">{fmt(out.ufh)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            <div className="row-actions">
              <button
                className="link"
                onClick={() => set((x) => void x.push({ id: uid(), kind: 'radiator', name: 'Radiator', status: 'existing', type: '11', height: 600, length: 1000, quantity: 1 }))}
              >
                + Existing radiator
              </button>
              <button
                className="link"
                onClick={() => set((x) => void x.push({ id: uid(), kind: 'custom', name: 'Towel rail / fan coil', status: 'new', ratedDt50: 500, quantity: 1 }))}
              >
                + Other emitter (rated output)
              </button>
              {sug && (
                <span className="suggest">
                  Short by {fmt(shortfall)} W. Suggest{' '}
                  <b>
                    {sug.quantity > 1 ? `${sug.quantity} × ` : ''}Type {sug.type} {sug.height}×{sug.length}
                  </b>{' '}
                  ({fmt(sug.output)} W at design)
                  <button
                    className="btn sm"
                    onClick={() =>
                      set((x) =>
                        void x.push({ id: uid(), kind: 'radiator', name: 'New radiator', status: 'new', type: sug.type, height: sug.height, length: sug.length, quantity: sug.quantity }),
                      )
                    }
                  >
                    Add
                  </button>
                </span>
              )}
              {swap && (
                <span className="suggest">
                  Or replace existing with{' '}
                  <b>
                    {swap.quantity > 1 ? `${swap.quantity} × ` : ''}Type {swap.type} {swap.height}×{swap.length}
                  </b>{' '}
                  ({fmt(swap.output)} W)
                  <button
                    className="btn sm"
                    onClick={() =>
                      set((x) => {
                        x.forEach((e) => {
                          if (e.status === 'existing') e.status = 'replace';
                        });
                        x.push({ id: uid(), kind: 'radiator', name: 'New radiator', status: 'new', type: swap.type, height: swap.height, length: swap.length, quantity: swap.quantity });
                      })
                    }
                  >
                    Replace
                  </button>
                </span>
              )}
              {shortfall > 0 && !sug && <span className="suggest">Short by {fmt(shortfall)} W: too much for panel radiators at this height; try a taller size or UFH.</span>}
            </div>
          </Card>
        );
      })}
      <p className="muted small">Available lengths: {RAD_LENGTHS.join(', ')} mm.</p>
    </div>
  );
}
