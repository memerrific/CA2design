import { uid } from '../../engine/factory';
import { FLUIDS, type FluidId } from '../../engine/fluid';
import type { Project } from '../../engine/model';
import { MATERIAL_NAMES, PIPE_SIZES, type PipeMaterial } from '../../engine/pipes';
import { analysePlant, CIRCUIT_TYPES, defaultPlantRoom, type CircuitType, type HeatSource, type PlantCircuit, type PlantRoom } from '../../engine/plant';
import { useStore } from '../../store';
import { moduleOf } from '../../modules';
import { jobTypeOf } from '../../jobs';
import { analysePool, defaultPoolInputs } from '../../engine/pool';
import { defaultDhw } from '../../data/dhwDefaults';
import { analyseDhw } from '../tools/DhwTabs';
import { projectHeatLoss } from '../../engine/heatloss';
import { IS_PREVIEW } from '../../ui/dialog';
import { Card, fmt, NumField, Pill, Select, Stat, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

const MATERIALS = Object.keys(MATERIAL_NAMES) as PipeMaterial[];

export function usePlant() {
  const { project: p, update } = useProject();
  const plant = p.plant ?? defaultPlantRoom();
  const result = analysePlant(plant, p.settings.fluid);
  const setPlant = (fn: (x: PlantRoom, d: Project) => void) =>
    update((d) => {
      const x = d.plant ?? defaultPlantRoom();
      fn(x, d);
      d.plant = x;
    });
  return { p, plant, result, setPlant, update };
}

export function plantKwSummary(p: Project) {
  const r = analysePlant(p.plant ?? defaultPlantRoom(), p.settings.fluid);
  return { label: 'Plant load (diversified)', value: r.diversifiedKw, sub: `${fmt(r.installedKw, 0)} kW installed · ${p.plant?.circuits.length ?? 0} circuits` };
}

export function PlantOverviewTab() {
  const { p, update } = usePlant();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Plant room project</h1>
        </div>
      </div>
      <div className="grid2 top">
        <Card title="Project">
          <TextField label="Project name" value={p.name} onChange={(v) => update((d) => void (d.name = v))} />
          <div className="grid2">
            <TextField label="Reference" value={p.reference} onChange={(v) => update((d) => void (d.reference = v))} />
            <TextField label="Engineer" value={p.engineer} onChange={(v) => update((d) => void (d.engineer = v))} />
          </div>
          <TextField label="System description" value={p.systemType} onChange={(v) => update((d) => void (d.systemType = v))} />
          <Select<FluidId> label="Fluid" value={p.settings.fluid} onChange={(v) => update((d) => void (d.settings.fluid = v))} options={FLUIDS.map((f) => ({ value: f.id, label: f.name }))} />
          <TextField label="Notes" multiline value={p.notes} onChange={(v) => update((d) => void (d.notes = v))} />
        </Card>
        <Card title="Site / customer">
          <TextField label="Name" value={p.customer.name} onChange={(v) => update((d) => void (d.customer.name = v))} />
          <TextField label="Address" multiline value={p.customer.address} onChange={(v) => update((d) => void (d.customer.address = v))} />
          <div className="grid2">
            <TextField label="Postcode" value={p.customer.postcode} onChange={(v) => update((d) => void (d.customer.postcode = v))} />
            <TextField label="Phone" value={p.customer.phone} onChange={(v) => update((d) => void (d.customer.phone = v))} />
          </div>
        </Card>
      </div>
      <Card title="How this section works">
        <ol className="steps">
          <li>
            On <b>Sources & circuits</b>, list what is leaving the plant room: each heating zone, cylinder coil, pool heat exchanger or coil, with its kW and
            design temperatures. Use the designer's figures where someone else designed the downstream system.
          </li>
          <li>Add the heat sources feeding the header: number of boilers or heat pumps, output each, flow temperature and ΔT.</li>
          <li>
            <b>Header & pumps</b> then shows the flow each circuit needs, pipe sizes, pump duties, the header size, and the temperature the circuits will
            actually get when primary and secondary flows don't match.
          </li>
        </ol>
      </Card>
    </div>
  );
}

export function PlantDesignTab() {
  const { plant, result, setPlant } = usePlant();

  const addCircuit = (type: CircuitType) => {
    const t = CIRCUIT_TYPES.find((c) => c.id === type)!;
    setPlant((x) =>
      void x.circuits.push({
        id: uid(),
        name: `${t.name} ${x.circuits.filter((c) => c.type === type).length + 1}`,
        type,
        loadKw: 10,
        flowTemp: t.flow,
        deltaT: t.dT,
        diversityPct: 100,
        material: 'copper',
        sizeId: '',
        lengthM: 10,
        fittingsPct: 40,
        terminalDropKpa: 10,
        valveKv: 0,
        notes: '',
      }),
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Sources & circuits</p>
          <h1>What goes in, what comes out</h1>
        </div>
      </div>
      <div className="stats">
        <Stat label="Connected load" value={fmt(result.connectedKw, 1)} unit="kW" />
        <Stat label="Diversified load" value={fmt(result.diversifiedKw, 1)} unit="kW" />
        <Stat label="Installed output" value={fmt(result.installedKw, 1)} unit="kW" tone={result.installedKw >= result.diversifiedKw ? 'ok' : 'bad'} />
        <Stat
          label="Margin"
          value={result.diversifiedKw ? `${fmt(result.capacityMarginPct)}%` : '–'}
          tone={result.capacityMarginPct < 0 ? 'bad' : result.capacityMarginPct > 50 ? 'warn' : 'ok'}
        />
      </div>

      <Card
        title="Circuits leaving the plant room"
        actions={
          <div className="actions">
            <ImportCircuit />
            {CIRCUIT_TYPES.slice(0, 5).map((t) => (
              <button key={t.id} className="btn ghost sm" onClick={() => addCircuit(t.id)}>
                + {t.name}
              </button>
            ))}
            <button className="btn ghost sm" onClick={() => addCircuit('other')}>
              + Other
            </button>
          </div>
        }
      >
        {plant.circuits.length === 0 && <p className="muted">Add each circuit the header feeds.</p>}
        <div className="walls">
          {plant.circuits.map((c, i) => (
            <CircuitEditor key={c.id} c={c} i={i} />
          ))}
        </div>
        <p className="muted small">
          Diversity is the share of a circuit counted towards the boiler size (e.g. not every cylinder reheats at once). Pipes and pumps are always sized for
          the circuit's full load.
        </p>
      </Card>

      <Card
        title="Heat sources"
        actions={
          <button
            className="btn ghost sm"
            onClick={() => setPlant((x) => void x.sources.push({ id: uid(), name: 'Boiler', kind: 'boiler', count: 1, outputKw: 30, flowTemp: 80, deltaT: 20, minFlowLpm: 0, notes: '' }))}
          >
            + Heat source
          </button>
        }
      >
        {plant.sources.length === 0 && <p className="muted">Add the boilers or heat pumps feeding the header.</p>}
        <div className="scroll-x">
          <table className="tbl">
            {plant.sources.length > 0 && (
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Output each</th>
                  <th>Flow °C</th>
                  <th>ΔT</th>
                  <th>Min flow each</th>
                  <th className="r">Total</th>
                  <th />
                </tr>
              </thead>
            )}
            <tbody>
              {plant.sources.map((s, i) => {
                const set = (fn: (x: HeatSource) => void) => setPlant((x) => fn(x.sources[i]));
                return (
                  <tr key={s.id}>
                    <td>
                      <TextField value={s.name} onChange={(v) => set((x) => void (x.name = v))} />
                    </td>
                    <td>
                      <Select
                        value={s.kind}
                        onChange={(v) => set((x) => void (x.kind = v))}
                        options={[
                          { value: 'boiler', label: 'Boiler' },
                          { value: 'heatpump', label: 'Heat pump' },
                          { value: 'other', label: 'Other' },
                        ]}
                      />
                    </td>
                    <td>
                      <NumField value={s.count} width={50} step={1} min={1} onChange={(v) => set((x) => void (x.count = v))} />
                    </td>
                    <td>
                      <NumField value={s.outputKw} unit="kW" width={70} onChange={(v) => set((x) => void (x.outputKw = v))} />
                    </td>
                    <td>
                      <NumField value={s.flowTemp} width={60} onChange={(v) => set((x) => void (x.flowTemp = v))} />
                    </td>
                    <td>
                      <NumField value={s.deltaT} unit="K" width={50} onChange={(v) => set((x) => void (x.deltaT = v))} />
                    </td>
                    <td>
                      <NumField value={s.minFlowLpm} unit="l/min" width={60} onChange={(v) => set((x) => void (x.minFlowLpm = v))} />
                    </td>
                    <td className="r">{fmt(s.count * s.outputKw, 1)} kW</td>
                    <td>
                      <button className="link danger" onClick={() => setPlant((x) => void x.sources.splice(i, 1))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Bring a load in from another project in the app as a new circuit. */
function ImportCircuit() {
  const { p, setPlant } = usePlant();
  const { projects } = useStore();
  const sources = projects.filter((x) => x.id !== p.id && ['heating', 'heatloss', 'pool', 'dhw'].includes(moduleOf(x)));
  if (!sources.length) return null;
  const add = (id: string) => {
    const src = projects.find((x) => x.id === id);
    if (!src) return;
    const m = moduleOf(src);
    let c: Pick<PlantCircuit, 'name' | 'type' | 'loadKw' | 'flowTemp' | 'deltaT'>;
    if (m === 'pool') {
      const pi = { ...defaultPoolInputs(), ...src.pool };
      c = { name: `Pool: ${src.name}`, type: 'pool', loadKw: analysePool(pi).dutyKw, flowTemp: pi.primaryFlowTemp, deltaT: pi.primaryDeltaT };
    } else if (m === 'dhw') {
      const dh = { ...defaultDhw(), ...src.dhw };
      c = { name: `Hot water: ${src.name}`, type: 'dhw', loadKw: analyseDhw(dh).priority.minSourceKw, flowTemp: 80, deltaT: 20 };
    } else {
      c = { name: `Heating: ${src.name}`, type: 'heating', loadKw: projectHeatLoss(src).totalW / 1000, flowTemp: src.settings.flowTemp, deltaT: src.settings.deltaT };
    }
    setPlant((x) =>
      void x.circuits.push({ id: uid(), ...c, loadKw: Math.round(c.loadKw * 10) / 10, diversityPct: 100, material: 'copper', sizeId: '', lengthM: 10, fittingsPct: 40, terminalDropKpa: 10, valveKv: 0, notes: `Imported from ${src.name}` }),
    );
  };
  return (
    <select className="import-select" value="" onChange={(e) => add(e.target.value)} aria-label="Import a circuit from another project">
      <option value="">Import from a project…</option>
      {sources.map((x) => (
        <option key={x.id} value={x.id}>
          {jobTypeOf(x).short}: {x.name}
        </option>
      ))}
    </select>
  );
}

function CircuitEditor({ c, i }: { c: PlantCircuit; i: number }) {
  const { result, setPlant } = usePlant();
  const r = result.circuits[i];
  const set = (fn: (x: PlantCircuit) => void) => setPlant((x) => fn(x.circuits[i]));
  return (
    <div className="wall">
      <div className="wall-row">
        <TextField label="Circuit" value={c.name} onChange={(v) => set((x) => void (x.name = v))} />
        <Select<CircuitType> label="Type" value={c.type} onChange={(v) => set((x) => void (x.type = v))} options={CIRCUIT_TYPES.map((t) => ({ value: t.id, label: t.name }))} />
        <NumField label="Load" unit="kW" value={c.loadKw} onChange={(v) => set((x) => void (x.loadKw = v))} />
        <NumField label="Flow" unit="°C" value={c.flowTemp} onChange={(v) => set((x) => void (x.flowTemp = v))} />
        <NumField label="ΔT" unit="K" value={c.deltaT} onChange={(v) => set((x) => void (x.deltaT = v))} />
        <NumField label="Diversity" unit="%" value={c.diversityPct} onChange={(v) => set((x) => void (x.diversityPct = v))} />
        <button className="link danger" onClick={() => setPlant((x) => void x.circuits.splice(i, 1))} title="Remove circuit">
          ✕
        </button>
      </div>
      <div className="wall-row sub">
        <Select<PipeMaterial>
          label="Pipe"
          value={c.material}
          onChange={(v) =>
            set((x) => {
              x.material = v;
              x.sizeId = '';
            })
          }
          options={MATERIALS.map((m) => ({ value: m, label: MATERIAL_NAMES[m] }))}
        />
        <Select
          label="Size"
          value={c.sizeId}
          onChange={(v) => set((x) => void (x.sizeId = v))}
          options={[
            { value: '', label: `Auto${!c.sizeId && r?.sizeLabel ? ` (${r.sizeLabel})` : ''}` },
            ...PIPE_SIZES.filter((s) => s.material === c.material).map((s) => ({ value: s.id, label: s.label })),
          ]}
        />
        <NumField label="Length F+R" unit="m" value={c.lengthM} onChange={(v) => set((x) => void (x.lengthM = v))} />
        <NumField label="Fittings" unit="%" value={c.fittingsPct} onChange={(v) => set((x) => void (x.fittingsPct = v))} />
        <NumField label="Coil / HEX drop" unit="kPa" value={c.terminalDropKpa} onChange={(v) => set((x) => void (x.terminalDropKpa = v))} />
        <NumField label="Valve Kv" value={c.valveKv} step={0.1} onChange={(v) => set((x) => void (x.valveKv = v))} title="0 = no control valve" />
      </div>
      {r && (
        <div className="circuit-result">
          <span>
            <b>{fmt(r.flowLpm, 1)}</b> l/min · {fmt(r.flowM3h, 2)} m³/h
          </span>
          <span>{r.sizeLabel ? `${r.sizeLabel} at ${fmt(r.velocity ?? 0, 2)} m/s, ${fmt(r.paPerM ?? 0)} Pa/m` : 'No size fits'}</span>
          <span>
            Pump duty <b>{fmt(r.flowM3h, 2)} m³/h @ {fmt(r.totalKpa, 1)} kPa</b> ({fmt(r.headM, 2)} m)
          </span>
          {r.valveAuthority !== null && <Pill tone={r.valveAuthority >= 0.25 ? 'ok' : 'warn'}>authority {fmt(r.valveAuthority * 100)}%</Pill>}
        </div>
      )}
    </div>
  );
}

export function PlantHeaderTab() {
  const { p, plant, result: r, setPlant } = usePlant();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Header & pumps</p>
          <h1>Low loss header and flows</h1>
        </div>
      </div>
      <div className="stats">
        <Stat label="Primary flow" value={fmt(r.primaryM3s * 3600, 2)} unit="m³/h" />
        <Stat label="Secondary flow (all circuits)" value={fmt(r.secondaryM3s * 3600, 2)} unit="m³/h" />
        <Stat
          label="Primary ÷ secondary"
          value={r.secondaryM3s ? fmt(r.primaryRatio, 2) : '–'}
          tone={!r.secondaryM3s ? undefined : r.primaryRatio < 1 ? 'bad' : r.primaryRatio > 1.4 ? 'warn' : 'ok'}
        />
        <Stat label="Header body" value={r.headerSuggestion ?? '–'} />
      </div>

      {r.warnings.length > 0 && (
        <Card title="Check these">
          <ul className="warnings">
            {r.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid2 top">
        <Card title="Temperatures at the header">
          <table className="tbl summary wide">
            <tbody>
              <tr>
                <th>Primary flow temperature (from sources)</th>
                <td className="r">{fmt(r.primaryFlowTemp, 1)} °C</td>
              </tr>
              <tr>
                <th>Flow temperature reaching circuits</th>
                <td className="r">
                  <b>{fmt(r.secondaryFlowTempAtHeader, 1)} °C</b>
                </td>
              </tr>
              <tr>
                <th>Mixed secondary return</th>
                <td className="r">{fmt(r.secondaryReturnTemp, 1)} °C</td>
              </tr>
              <tr>
                <th>Return temperature back to sources</th>
                <td className="r">
                  <b>{fmt(r.returnTempToSources, 1)} °C</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            Primary flow should be slightly above secondary (about {plant.primaryMarginPct}% is a common target). Below it, the circuits get cooler water;
            well above it, hot water short-circuits back to the boilers and stops them condensing.
          </p>
        </Card>
        <Card title="Header sizing">
          <div className="grid2">
            <NumField label="Max velocity in header" unit="m/s" step={0.05} value={plant.headerMaxVelocity} onChange={(v) => setPlant((x) => void (x.headerMaxVelocity = v))} />
            <NumField label="Target primary margin" unit="%" value={plant.primaryMarginPct} onChange={(v) => setPlant((x) => void (x.primaryMarginPct = v))} />
          </div>
          <table className="tbl summary wide">
            <tbody>
              <tr>
                <th>Design flow through header</th>
                <td className="r">{fmt(r.headerFlowM3s * 3600, 2)} m³/h</td>
              </tr>
              <tr>
                <th>Bore for {plant.headerMaxVelocity} m/s</th>
                <td className="r">{fmt(r.headerIdForVelocityMm)} mm</td>
              </tr>
              <tr>
                <th>3 × largest connection ({fmt(r.largestConnectionIdMm, 1)} mm bore)</th>
                <td className="r">{fmt(r.headerIdFor3dMm)} mm</td>
              </tr>
              <tr className="total">
                <th>Minimum header bore</th>
                <td className="r">{fmt(r.headerIdRequiredMm)} mm</td>
              </tr>
              <tr>
                <th>Nearest standard size</th>
                <td className="r">
                  <b>{r.headerSuggestion ?? '–'}</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            Both are rules of thumb and published limits vary between manufacturers. For a manufactured header, check its own selection table for this flow.
          </p>
        </Card>
      </div>

      <Card title="Primary pipework (sources to header)">
        <div className="grid4">
          <Select<PipeMaterial> label="Material" value={plant.primaryMaterial} onChange={(v) => setPlant((x) => void (x.primaryMaterial = v))} options={MATERIALS.map((m) => ({ value: m, label: MATERIAL_NAMES[m] }))} />
          <NumField label="Length F+R (index)" unit="m" value={plant.primaryLengthM} onChange={(v) => setPlant((x) => void (x.primaryLengthM = v))} />
          <NumField label="Fittings" unit="%" value={plant.primaryFittingsPct} onChange={(v) => setPlant((x) => void (x.primaryFittingsPct = v))} />
          <div className="field">
            <span>Common primary</span>
            <strong>
              {r.primaryPipe.sizeLabel ?? '–'} {r.primaryPipe.velocity !== null && `· ${fmt(r.primaryPipe.velocity, 2)} m/s · ${fmt(r.primaryPipe.kpa, 1)} kPa`}
            </strong>
          </div>
        </div>
        <p className="muted small">Size each boiler's own pump from its manufacturer's data; this is the common pipe carrying the full primary flow.</p>
      </Card>

      <Card title="Circuit pumps">
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Circuit</th>
                <th className="r">kW</th>
                <th className="r">Flow l/min</th>
                <th className="r">m³/h</th>
                <th>Pipe</th>
                <th className="r">m/s</th>
                <th className="r">Pipe kPa</th>
                <th className="r">Valve kPa</th>
                <th className="r">Coil kPa</th>
                <th className="r">Pump duty</th>
              </tr>
            </thead>
            <tbody>
              {plant.circuits.map((c, i) => {
                const x = r.circuits[i];
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="r">{fmt(c.loadKw, 1)}</td>
                    <td className="r">{fmt(x.flowLpm, 1)}</td>
                    <td className="r">{fmt(x.flowM3h, 2)}</td>
                    <td>{x.sizeLabel ? `${MATERIAL_NAMES[c.material].split(' ')[0]} ${x.sizeLabel}` : '–'}</td>
                    <td className="r">{x.velocity !== null ? fmt(x.velocity, 2) : '–'}</td>
                    <td className="r">{fmt(x.pipeKpa, 1)}</td>
                    <td className="r">{fmt(x.valveKpa, 1)}</td>
                    <td className="r">{fmt(c.terminalDropKpa, 1)}</td>
                    <td className="r">
                      <b>
                        {fmt(x.flowM3h, 2)} m³/h @ {fmt(x.headM, 2)} m
                      </b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Fluid: {FLUIDS.find((f) => f.id === p.settings.fluid)?.name}. Pump duty is the circuit's own resistance from the header and back; pick a pump whose
          curve passes through it.
        </p>
      </Card>
    </div>
  );
}

export function PlantSheetTab() {
  const { p, plant, result: r } = usePlant();
  const { company } = useStore();
  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">Design sheet</p>
          <h1>Plant room design summary</h1>
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
        <section className="sheet">
          <div className="pack-head">
            <div>
              <p className="eyebrow">Plant room design</p>
              <h2>{p.name}</h2>
            </div>
            <img src={company.logoDataUrl || './logo.png'} alt="" />
          </div>
          <div className="rfq-meta">
            <div>
              <span>Site</span>
              <b>{p.customer.name || '–'}</b>
              <p style={{ whiteSpace: 'pre-line' }}>{[p.customer.address, p.customer.postcode].filter(Boolean).join('\n')}</p>
            </div>
            <div>
              <span>Designed by</span>
              <b>{company.name}</b>
              <p>{p.engineer}</p>
            </div>
            <div>
              <span>Reference</span>
              <b>{p.reference || '–'}</b>
              <p>{new Date().toLocaleDateString('en-GB')}</p>
            </div>
          </div>
          <div className="pack-stats">
            <div>
              <span>Connected / diversified</span>
              <b>
                {fmt(r.connectedKw, 1)} / {fmt(r.diversifiedKw, 1)} kW
              </b>
            </div>
            <div>
              <span>Installed output</span>
              <b>{fmt(r.installedKw, 1)} kW</b>
            </div>
            <div>
              <span>Header</span>
              <b>{r.headerSuggestion ?? '–'}</b>
            </div>
            <div>
              <span>Primary flow</span>
              <b>{fmt(r.primaryM3s * 3600, 2)} m³/h</b>
            </div>
            <div>
              <span>Secondary flow</span>
              <b>{fmt(r.secondaryM3s * 3600, 2)} m³/h</b>
            </div>
            <div>
              <span>Flow / return at header</span>
              <b>
                {fmt(r.secondaryFlowTempAtHeader, 1)} / {fmt(r.returnTempToSources, 1)} °C
              </b>
            </div>
          </div>
          <h3 className="sheet-h">Heat sources</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Source</th>
                <th className="r">Qty</th>
                <th className="r">kW each</th>
                <th className="r">Flow / ΔT</th>
              </tr>
            </thead>
            <tbody>
              {plant.sources.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="r">{s.count}</td>
                  <td className="r">{fmt(s.outputKw, 1)}</td>
                  <td className="r">
                    {s.flowTemp} °C / {s.deltaT} K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="sheet-h">Circuits</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Circuit</th>
                <th className="r">kW</th>
                <th className="r">°C / K</th>
                <th className="r">l/min</th>
                <th>Pipe</th>
                <th className="r">Pump duty</th>
                <th className="r">Kv</th>
              </tr>
            </thead>
            <tbody>
              {plant.circuits.map((c, i) => {
                const x = r.circuits[i];
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="r">{fmt(c.loadKw, 1)}</td>
                    <td className="r">
                      {c.flowTemp} / {c.deltaT}
                    </td>
                    <td className="r">{fmt(x.flowLpm, 1)}</td>
                    <td>{x.sizeLabel ? `${MATERIAL_NAMES[c.material].split(' ')[0]} ${x.sizeLabel}` : '–'}</td>
                    <td className="r">
                      {fmt(x.flowM3h, 2)} m³/h @ {fmt(x.totalKpa, 1)} kPa
                    </td>
                    <td className="r">{c.valveKv || '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {r.warnings.length > 0 && (
            <>
              <h3 className="sheet-h">Notes</h3>
              <ul className="warnings">
                {r.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          )}
          <p className="pack-foot">Pipe pressure drops by Darcy–Weisbach; header bore from velocity and 3 × connection rules. Verify against manufacturers' data before ordering.</p>
        </section>
      </div>
    </div>
  );
}
