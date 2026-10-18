import { useState } from 'react';
import { emitterDt50, emitterOutput, RAD_TYPES } from '../../engine/emitters';
import { uid } from '../../engine/factory';
import { m3sToLpm } from '../../engine/fluid';
import type { HandoverSection } from '../../engine/model';
import { MATERIAL_NAMES } from '../../engine/pipes';
import { covering, designUfhRoom } from '../../engine/ufh';
import { useStore } from '../../store';
import { fmt, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';
import { analyseRun, requiredFlowTemp, roomEmitterOutput, ufhInputs } from '../../engine/design';
import { IS_PREVIEW } from '../../ui/dialog';
import { lossColour } from './Plan';

export function HandoverTab() {
  const { project: p, update } = useProject();
  const [editing, setEditing] = useState(true);

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.handover.length) return;
      [d.handover[i], d.handover[j]] = [d.handover[j], d.handover[i]];
    });

  return (
    <div className="page handover-page">
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">Handover pack</p>
          <h1>Design your pack, then print or save as PDF</h1>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setEditing(!editing)}>
            {editing ? 'Hide editor' : 'Show editor'}
          </button>
          {IS_PREVIEW ? (
            <span className="muted small">Print / save PDF is available in the installed app.</span>
          ) : (
            <button className="btn" onClick={() => window.print()}>
              Print / save PDF
            </button>
          )}
        </div>
      </div>
      <div className={`handover-layout ${editing ? '' : 'full'}`}>
        {editing && (
          <aside className="handover-editor no-print">
            <h4>Sections</h4>
            {p.handover.map((s, i) => (
              <div key={s.id} className={`sec-row ${s.enabled ? '' : 'off'}`}>
                <input type="checkbox" checked={s.enabled} onChange={(e) => update((d) => void (d.handover[i].enabled = e.target.checked))} />
                <input className="sec-title" value={s.title} onChange={(e) => update((d) => void (d.handover[i].title = e.target.value))} />
                <button className="link" onClick={() => move(i, -1)} title="Move up">
                  ↑
                </button>
                <button className="link" onClick={() => move(i, 1)} title="Move down">
                  ↓
                </button>
                {s.kind === 'text' && (
                  <button className="link danger" onClick={() => update((d) => void d.handover.splice(i, 1))} title="Remove">
                    ✕
                  </button>
                )}
                {s.kind === 'text' && (
                  <TextField multiline value={s.body ?? ''} onChange={(v) => update((d) => void (d.handover[i].body = v))} />
                )}
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => update((d) => void d.handover.push({ id: uid(), title: 'New section', kind: 'text', enabled: true, body: '' }))}>
              + Text section
            </button>

            <h4>Commissioning record</h4>
            {p.commissioning.map((c, i) => (
              <div key={c.id} className="comm-row">
                <input value={c.label} onChange={(e) => update((d) => void (d.commissioning[i].label = e.target.value))} />
                <input value={c.value} placeholder="value" onChange={(e) => update((d) => void (d.commissioning[i].value = e.target.value))} />
                <button className="link danger" onClick={() => update((d) => void d.commissioning.splice(i, 1))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => update((d) => void d.commissioning.push({ id: uid(), label: 'New item', value: '' }))}>
              + Commissioning item
            </button>
          </aside>
        )}
        <div className="pack">
          {p.handover.filter((s) => s.enabled).map((s) => (
            <PackSection key={s.id} s={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A fixed-content report built from the same sheets as the handover pack. */
export function ReportTab({ kinds, title }: { kinds: HandoverSection['kind'][]; title: string }) {
  const { project: p } = useProject();
  const titles: Record<string, string> = { cover: 'Cover', summary: 'Summary', plan: 'Floor plans', heatloss: 'Room-by-room heat loss', equipment: 'Equipment on site' };
  return (
    <div className="page handover-page">
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">{title}</p>
          <h1>{p.name}</h1>
        </div>
        <div className="actions">
          {IS_PREVIEW ? (
            <span className="muted small">Print / save PDF is available in the installed app.</span>
          ) : (
            <button className="btn" onClick={() => window.print()}>
              Print / save PDF
            </button>
          )}
        </div>
      </div>
      <div className="pack">
        {kinds.map((k) => (
          <PackSection key={k} s={{ id: k, kind: k, title: k === 'cover' ? title : titles[k] ?? k, enabled: true }} />
        ))}
      </div>
    </div>
  );
}

function PackSection({ s }: { s: HandoverSection }) {
  const { project: p, loss } = useProject();
  const { company } = useStore();
  const st = p.settings;

  const head = (
    <div className="pack-head">
      <h2>{s.title}</h2>
      <img src={company.logoDataUrl || './logo.png'} alt="" />
    </div>
  );

  switch (s.kind) {
    case 'cover':
      return (
        <section className="sheet cover">
          <img className="cover-logo" src={company.logoDataUrl || './logo.png'} alt={company.name} />
          <p className="eyebrow">{company.tagline}</p>
          <h1>{s.title === 'Cover' ? 'Heating System Handover Pack' : s.title}</h1>
          <h3>{p.systemType}</h3>
          <div className="cover-meta">
            <div>
              <span>Property</span>
              <b>{p.customer.name}</b>
              <p style={{ whiteSpace: 'pre-line' }}>
                {p.customer.address}
                {p.customer.postcode ? `\n${p.customer.postcode}` : ''}
              </p>
            </div>
            <div>
              <span>Installed by</span>
              <b>{company.name}</b>
              <p style={{ whiteSpace: 'pre-line' }}>{[company.address, company.phone, company.email, company.website].filter(Boolean).join('\n')}</p>
            </div>
            <div>
              <span>Reference</span>
              <b>{p.reference || '–'}</b>
              <p>
                Engineer: {p.engineer || '–'}
                <br />
                Date: {new Date().toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
          <p className="cover-foot">{company.accreditations}</p>
        </section>
      );

    case 'summary': {
      const worst = Math.max(0, ...p.rooms.map((r) => requiredFlowTemp(p, r, loss.byId.get(r.id)!.totalW) ?? 0).filter(Number.isFinite));
      const sources = p.equipment.filter((e) => /pump|boiler/i.test(e.category));
      return (
        <section className="sheet">
          {head}
          <div className="pack-stats">
            <div>
              <span>Design heat loss</span>
              <b>{fmt(loss.totalW / 1000, 2)} kW</b>
            </div>
            <div>
              <span>External design temp</span>
              <b>{st.externalTemp} °C</b>
            </div>
            <div>
              <span>Design flow / return</span>
              <b>
                {st.flowTemp} / {st.flowTemp - st.deltaT} °C
              </b>
            </div>
            <div>
              <span>Heated area</span>
              <b>{fmt(loss.area, 1)} m²</b>
            </div>
            <div>
              <span>Rooms</span>
              <b>{p.rooms.length}</b>
            </div>
            <div>
              <span>Emitters need</span>
              <b>{worst ? `${fmt(worst, 1)} °C flow` : '–'}</b>
            </div>
          </div>
          <table className="tbl">
            <tbody>
              <tr>
                <th>System</th>
                <td>{p.systemType}</td>
              </tr>
              {sources.map((e) => (
                <tr key={e.id}>
                  <th>{e.category}</th>
                  <td>
                    {e.make} {e.model} {e.outputKw ? `· ${e.outputKw} kW` : ''} {e.location ? `· ${e.location}` : ''}
                  </td>
                </tr>
              ))}
              <tr>
                <th>Heat transfer fluid</th>
                <td>{st.fluid === 'water' ? 'Water with inhibitor' : st.fluid}</td>
              </tr>
            </tbody>
          </table>
          {p.notes && <p style={{ whiteSpace: 'pre-line' }}>{p.notes}</p>}
        </section>
      );
    }

    case 'plan': {
      const levels = [...new Set(p.rooms.filter((r) => r.polygon).map((r) => r.level))];
      if (!levels.length) return null;
      return (
        <section className="sheet">
          {head}
          {levels.map((lv) => {
            const rooms = p.rooms.filter((r) => r.level === lv && r.polygon);
            const pts = rooms.flatMap((r) => r.polygon!);
            const minX = Math.min(...pts.map((q) => q[0])) - 0.5;
            const minY = Math.min(...pts.map((q) => q[1])) - 0.5;
            const w = Math.max(...pts.map((q) => q[0])) - minX + 0.5;
            const h = Math.max(...pts.map((q) => q[1])) - minY + 0.5;
            const fs = Math.max(w, h) / 40;
            return (
              <figure key={lv} className="pack-plan">
                <figcaption>{lv} floor</figcaption>
                <svg viewBox={`${minX} ${minY} ${w} ${h}`}>
                  {rooms.map((r) => {
                    const cx = r.polygon!.reduce((a, q) => a + q[0], 0) / r.polygon!.length;
                    const cy = r.polygon!.reduce((a, q) => a + q[1], 0) / r.polygon!.length;
                    const rl = loss.byId.get(r.id)!;
                    return (
                      <g key={r.id}>
                        <polygon points={r.polygon!.map((q) => q.join(',')).join(' ')} fill={lossColour(rl.wPerM2)} stroke="#0c1920" strokeWidth={fs / 8} />
                        <text x={cx} y={cy} fontSize={fs} textAnchor="middle" fontWeight={700}>
                          {r.name}
                        </text>
                        <text x={cx} y={cy + fs * 1.2} fontSize={fs * 0.8} textAnchor="middle">
                          {fmt(rl.totalW)} W · {r.designTemp} °C
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </figure>
            );
          })}
        </section>
      );
    }

    case 'heatloss':
      return (
        <section className="sheet">
          {head}
          <p className="small">
            Calculated to BS EN 12831-1 at {st.externalTemp} °C external design temperature. Ventilation at the air change rates shown.
          </p>
          <table className="tbl">
            <thead>
              <tr>
                <th>Room</th>
                <th className="r">°C</th>
                <th className="r">m²</th>
                <th className="r">ach</th>
                <th className="r">Fabric W</th>
                <th className="r">Vent. W</th>
                <th className="r">Total W</th>
                <th className="r">W/m²</th>
              </tr>
            </thead>
            <tbody>
              {p.rooms.map((r) => {
                const l = loss.byId.get(r.id)!;
                return (
                  <tr key={r.id}>
                    <td>
                      {r.name} <small className="muted">{r.level}</small>
                    </td>
                    <td className="r">{r.designTemp}</td>
                    <td className="r">{fmt(r.area, 1)}</td>
                    <td className="r">{r.ach}</td>
                    <td className="r">{fmt(l.fabricW)}</td>
                    <td className="r">{fmt(l.ventilationW)}</td>
                    <td className="r">
                      <b>{fmt(l.totalW)}</b>
                    </td>
                    <td className="r">{fmt(l.wPerM2)}</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>Total</td>
                <td />
                <td className="r">{fmt(loss.area, 1)}</td>
                <td />
                <td className="r">{fmt(loss.fabricW)}</td>
                <td className="r">{fmt(loss.ventilationW)}</td>
                <td className="r">{fmt(loss.totalW)}</td>
                <td className="r">{fmt(loss.area ? loss.totalW / loss.area : 0)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      );

    case 'emitters': {
      const rows = p.rooms.flatMap((r) => {
        const out = roomEmitterOutput(p, r);
        return r.emitters
          .filter((e) => e.status !== 'replace')
          .map((e) => ({ r, e, out: emitterOutput(e, out.dT, st.radiatorExponent) }));
      });
      if (!rows.length) return null;
      return (
        <section className="sheet">
          {head}
          <table className="tbl">
            <thead>
              <tr>
                <th>Room</th>
                <th>Emitter</th>
                <th>Size</th>
                <th>Status</th>
                <th className="r">ΔT50 W</th>
                <th className="r">At {st.flowTemp} °C W</th>
                <th className="r">Room loss W</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, e, out }) => (
                <tr key={e.id}>
                  <td>{r.name}</td>
                  <td>{e.name}</td>
                  <td>
                    {e.kind === 'radiator'
                      ? `${e.quantity > 1 ? `${e.quantity} × ` : ''}${RAD_TYPES.find((t) => t.id === e.type)?.name ?? ''} ${e.height}×${e.length}`
                      : `${e.quantity} ×`}
                  </td>
                  <td>{e.status === 'new' ? 'New' : 'Existing'}</td>
                  <td className="r">{fmt(emitterDt50(e))}</td>
                  <td className="r">{fmt(out)}</td>
                  <td className="r">{fmt(loss.byId.get(r.id)!.totalW)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    }

    case 'ufh': {
      const rooms = p.rooms.filter((r) => r.ufh.enabled);
      if (!rooms.length) return null;
      return (
        <section className="sheet">
          {head}
          <table className="tbl">
            <thead>
              <tr>
                <th>Room</th>
                <th>Manifold</th>
                <th>Centres</th>
                <th>Covering</th>
                <th className="r">W/m²</th>
                <th className="r">Output W</th>
                <th className="r">Loops</th>
                <th className="r">Loop m</th>
                <th className="r">l/min per loop</th>
                <th className="r">Floor °C</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const res = designUfhRoom(ufhInputs(p, r));
                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{p.manifolds.find((m) => m.id === r.ufh.manifoldId)?.name}</td>
                    <td>{r.ufh.spacing} mm</td>
                    <td>{covering(r.ufh.covering).name}</td>
                    <td className="r">{fmt(res.fluxWm2)}</td>
                    <td className="r">{fmt(res.outputW)}</td>
                    <td className="r">{res.loops}</td>
                    <td className="r">{fmt(res.loopLengthM)}</td>
                    <td className="r">
                      <b>{fmt(res.flowPerLoopLpm, 2)}</b>
                    </td>
                    <td className="r">{fmt(res.surfaceTemp, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small">Flow meters on the manifold have been set to the l/min per loop shown. Please do not adjust them.</p>
        </section>
      );
    }

    case 'pipework': {
      if (!p.pipes.length) return null;
      return (
        <section className="sheet">
          {head}
          <table className="tbl">
            <thead>
              <tr>
                <th>Run</th>
                <th>Pipe</th>
                <th className="r">Length m</th>
                <th className="r">Load W</th>
                <th className="r">Flow l/min</th>
                <th className="r">Velocity m/s</th>
                <th className="r">Pa/m</th>
              </tr>
            </thead>
            <tbody>
              {p.pipes.map((run) => {
                const a = analyseRun(p, loss, run);
                return (
                  <tr key={run.id}>
                    <td>{run.name}</td>
                    <td>
                      {MATERIAL_NAMES[run.material]} {a.size?.label}
                    </td>
                    <td className="r">{fmt(run.lengthM)}</td>
                    <td className="r">{fmt(a.load)}</td>
                    <td className="r">{fmt(m3sToLpm(a.q), 1)}</td>
                    <td className="r">{a.res ? fmt(a.res.velocity, 2) : '–'}</td>
                    <td className="r">{a.res ? fmt(a.res.paPerM) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      );
    }

    case 'valves':
      if (!p.valves.length) return null;
      return (
        <section className="sheet">
          {head}
          <table className="tbl">
            <thead>
              <tr>
                <th>Valve</th>
                <th className="r">Kv</th>
                <th className="r">Flow m³/h</th>
                <th>Setting / notes</th>
              </tr>
            </thead>
            <tbody>
              {p.valves.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td className="r">{v.kv}</td>
                  <td className="r">{v.flowM3h ? fmt(v.flowM3h, 2) : 'from run'}</td>
                  <td>{v.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );

    case 'equipment':
      if (!p.equipment.length) return null;
      return (
        <section className="sheet">
          {head}
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Make / model</th>
                <th>Serial</th>
                <th>Location</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {p.equipment.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.category}
                    {e.outputKw ? ` (${e.outputKw} kW)` : ''}
                  </td>
                  <td>
                    {e.make} {e.model}
                  </td>
                  <td>{e.serial}</td>
                  <td>{e.location}</td>
                  <td style={{ whiteSpace: 'pre-line' }}>{e.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );

    case 'commissioning':
      return (
        <section className="sheet">
          {head}
          <table className="tbl comm">
            <tbody>
              {p.commissioning.map((c) => (
                <tr key={c.id}>
                  <th>{c.label}</th>
                  <td>{c.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="signoff">
            <div>
              <span>Engineer signature</span>
            </div>
            <div>
              <span>Customer signature</span>
            </div>
            <div>
              <span>Date</span>
            </div>
          </div>
        </section>
      );

    case 'text':
      return (
        <section className="sheet">
          {head}
          <div className="prose">
            {(s.body ?? '').split(/\n{2,}/).map((para, i) => (
              <p key={i} style={{ whiteSpace: 'pre-line' }}>
                {para}
              </p>
            ))}
          </div>
          <p className="pack-foot">{company.footer}</p>
        </section>
      );
  }
}
