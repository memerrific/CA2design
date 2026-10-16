import { useState } from 'react';
import { uid } from '../../engine/factory';
import { m3sToLpm } from '../../engine/fluid';
import type { PipeRun } from '../../engine/model';
import { analyseRun } from '../../engine/design';
import {
  analysePipe,
  autoSize,
  flowFromHeat,
  MATERIAL_NAMES,
  PIPE_SIZES,
  requiredKv,
  valveDropBar,
  type PipeMaterial,
} from '../../engine/pipes';
import { Card, fmt, NumField, Pill, Select, Stat, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

const MATERIALS = Object.keys(MATERIAL_NAMES) as PipeMaterial[];

export function PipeworkTab() {
  const { project: p, loss, update } = useProject();
  const s = p.settings;
  const mean = s.flowTemp - s.deltaT / 2;

  const runs = p.pipes.map((r) => ({ run: r, ...analyseRun(p, loss, r) }));
  const indexPa = runs.filter((x) => x.run.isIndex).reduce((a, x) => a + (x.res?.pressureDropPa ?? 0), 0);
  const valvePa = p.valves.reduce((a, v) => {
    const flow = valveFlow(v.flowM3h, v.pipeRunId);
    return a + (Number.isFinite(valveDropBar(flow, v.kv)) ? valveDropBar(flow, v.kv) * 1e5 : 0);
  }, 0);

  function valveFlow(manual: number, runId?: string) {
    if (manual > 0) return manual;
    const r = runs.find((x) => x.run.id === runId);
    return r ? r.q * 3600 : 0;
  }

  // Quick calculator
  const [kw, setKw] = useState(10);
  const [qdT, setQdT] = useState(s.deltaT);
  const qq = flowFromHeat(kw * 1000, qdT, s.fluid, mean);

  // Kv calculator
  const [kvFlow, setKvFlow] = useState(1);
  const [kvDp, setKvDp] = useState(10);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Pipework & Kv</p>
          <h1>Pipe sizing, flow rates and pressure drop</h1>
        </div>
      </div>

      <div className="grid2 top">
        <Card title="Quick flow-rate calculator">
          <div className="grid2">
            <NumField label="Heat" unit="kW" value={kw} onChange={setKw} />
            <NumField label="ΔT" unit="K" value={qdT} onChange={setQdT} />
          </div>
          <div className="stats compact">
            <Stat label="Flow" value={fmt(m3sToLpm(qq), 1)} unit="l/min" />
            <Stat label="" value={fmt(qq * 3600, 2)} unit="m³/h" />
            <Stat label="" value={fmt(qq * 1000, 3)} unit="l/s" />
          </div>
          <table className="tbl compact">
            <thead>
              <tr>
                <th>Material</th>
                <th>Smallest size within limits</th>
                <th className="r">Velocity</th>
                <th className="r">Pa/m</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((m) => {
                const sz = autoSize(m, qq, s.fluid, mean);
                const r = sz && analysePipe({ sizeId: sz.id, lengthM: 1, fittingsAllowancePct: 0, flowM3s: qq, fluid: s.fluid, meanTemp: mean });
                return (
                  <tr key={m}>
                    <td>{MATERIAL_NAMES[m]}</td>
                    <td>{sz?.label ?? 'over range'}</td>
                    <td className="r">{r ? `${fmt(r.velocity, 2)} m/s` : ''}</td>
                    <td className="r">{r ? fmt(r.paPerM) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Limits: 1.0 m/s and 200 Pa/m. A 2" pool heat pump connection at 10 m³/h is about 1.1 m/s in 2" ABS.</p>
        </Card>
        <Card title="Kv calculator">
          <div className="grid2">
            <NumField label="Flow" unit="m³/h" value={kvFlow} step={0.1} onChange={setKvFlow} />
            <NumField label="Allowed pressure drop" unit="kPa" value={kvDp} onChange={setKvDp} />
          </div>
          <div className="stats compact">
            <Stat label="Kv required" value={fmt(requiredKv(kvFlow, kvDp / 100), 2)} />
            <Stat label="Equivalent Cv" value={fmt(requiredKv(kvFlow, kvDp / 100) * 1.156, 2)} />
          </div>
          <p className="muted small">Δp (bar) = (Q / Kv)². Kv is the flow in m³/h at 1 bar drop. Pick the next valve Kv up, then check the actual drop below.</p>
        </Card>
      </div>

      <Card
        title="Pipe runs"
        actions={
          <button
            className="btn ghost sm"
            onClick={() =>
              update((d) =>
                void d.pipes.push({ id: uid(), name: `Run ${d.pipes.length + 1}`, material: 'copper', sizeId: '', lengthM: 10, fittingsPct: 30, loadW: 0, roomIds: [], isIndex: false }),
              )
            }
          >
            + Pipe run
          </button>
        }
      >
        <div className="stats compact">
          <Stat label="Index circuit, pipework" value={fmt(indexPa / 1000, 1)} unit="kPa" />
          <Stat label="Valves (listed below)" value={fmt(valvePa / 1000, 1)} unit="kPa" />
          <Stat label="Pump head needed (excl. heat source & emitters)" value={fmt((indexPa + valvePa) / (1000 * 9.81), 2)} unit="m" />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Run</th>
                <th>Material</th>
                <th>Size</th>
                <th>Length F+R</th>
                <th>Fittings</th>
                <th>Load</th>
                <th className="r">Flow l/min</th>
                <th className="r">m/s</th>
                <th className="r">Pa/m</th>
                <th className="r">kPa</th>
                <th>Index</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map(({ run, load, q, size, res }, i) => {
                const set = (fn: (r: PipeRun) => void) => update((d) => fn(d.pipes[i]));
                return (
                  <tr key={run.id}>
                    <td>
                      <TextField value={run.name} onChange={(v) => set((r) => void (r.name = v))} />
                    </td>
                    <td>
                      <Select<PipeMaterial>
                        value={run.material}
                        onChange={(v) =>
                          set((r) => {
                            r.material = v;
                            r.sizeId = '';
                          })
                        }
                        options={MATERIALS.map((m) => ({ value: m, label: MATERIAL_NAMES[m] }))}
                      />
                    </td>
                    <td>
                      <Select
                        value={run.sizeId}
                        onChange={(v) => set((r) => void (r.sizeId = v))}
                        options={[
                          { value: '', label: `Auto${!run.sizeId && size ? ` (${size.label})` : ''}` },
                          ...PIPE_SIZES.filter((x) => x.material === run.material).map((x) => ({ value: x.id, label: x.label })),
                        ]}
                      />
                    </td>
                    <td>
                      <NumField value={run.lengthM} unit="m" width={60} onChange={(v) => set((r) => void (r.lengthM = v))} />
                    </td>
                    <td>
                      <NumField value={run.fittingsPct} unit="%" width={50} onChange={(v) => set((r) => void (r.fittingsPct = v))} />
                    </td>
                    <td>
                      <details className="load">
                        <summary>{fmt(load)} W</summary>
                        <NumField value={run.loadW} unit="W fixed (0 = rooms)" width={80} onChange={(v) => set((r) => void (r.loadW = v))} />
                        <div className="chips small">
                          {p.rooms.map((rm) => (
                            <label key={rm.id} className={`chip ${run.roomIds.includes(rm.id) ? 'on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={run.roomIds.includes(rm.id)}
                                onChange={(e) =>
                                  set((r) => {
                                    r.roomIds = e.target.checked ? [...r.roomIds, rm.id] : r.roomIds.filter((x) => x !== rm.id);
                                  })
                                }
                              />
                              {rm.name}
                            </label>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td className="r">{fmt(m3sToLpm(q), 1)}</td>
                    <td className="r">
                      {res ? <span className={res.velocity > 1.0 ? 'warn-text' : ''}>{fmt(res.velocity, 2)}</span> : <Pill tone="bad">too small</Pill>}
                    </td>
                    <td className="r">{res ? fmt(res.paPerM) : ''}</td>
                    <td className="r">{res ? fmt(res.pressureDropPa / 1000, 2) : ''}</td>
                    <td>
                      <input type="checkbox" checked={run.isIndex} onChange={(e) => set((r) => void (r.isIndex = e.target.checked))} />
                    </td>
                    <td>
                      <button className="link danger" onClick={() => update((d) => void d.pipes.splice(i, 1))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Load is the heat carried by the run: tick the rooms it serves, or enter a fixed load. Flow uses the system ΔT ({s.deltaT} K). Tick “Index” for runs on
          the longest / highest-resistance path to estimate pump head.
        </p>
      </Card>

      <Card
        title="Valves & balancing"
        actions={
          <button className="btn ghost sm" onClick={() => update((d) => void d.valves.push({ id: uid(), name: 'Valve', kv: 4, flowM3h: 0, notes: '' }))}>
            + Valve
          </button>
        }
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Valve</th>
              <th>Kv</th>
              <th>On run</th>
              <th>Flow m³/h</th>
              <th className="r">Δp kPa</th>
              <th>Notes / setting</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {p.valves.map((v, i) => {
              const flow = valveFlow(v.flowM3h, v.pipeRunId);
              const dp = valveDropBar(flow, v.kv) * 100;
              return (
                <tr key={v.id}>
                  <td>
                    <TextField value={v.name} onChange={(x) => update((d) => void (d.valves[i].name = x))} />
                  </td>
                  <td>
                    <NumField value={v.kv} width={60} step={0.1} onChange={(x) => update((d) => void (d.valves[i].kv = x))} />
                  </td>
                  <td>
                    <Select
                      value={v.pipeRunId ?? ''}
                      onChange={(x) => update((d) => void (d.valves[i].pipeRunId = x || undefined))}
                      options={[{ value: '', label: '–' }, ...p.pipes.map((r) => ({ value: r.id, label: r.name }))]}
                    />
                  </td>
                  <td>
                    <NumField value={v.flowM3h || Number(flow.toFixed(3))} width={70} step={0.01} onChange={(x) => update((d) => void (d.valves[i].flowM3h = x))} />
                  </td>
                  <td className="r">{Number.isFinite(dp) ? fmt(dp, 2) : '–'}</td>
                  <td>
                    <TextField value={v.notes} onChange={(x) => update((d) => void (d.valves[i].notes = x))} />
                  </td>
                  <td>
                    <button className="link danger" onClick={() => update((d) => void d.valves.splice(i, 1))}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
