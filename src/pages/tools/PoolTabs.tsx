import { FLUIDS, type FluidId } from '../../engine/fluid';
import type { Project } from '../../engine/model';
import { analysePool, defaultPoolInputs, POOL_ACTIVITY, POOL_METHOD_NOTES, type PoolActivity, type PoolInputs, type PoolLosses, type PoolType } from '../../engine/pool';
import { useStore } from '../../store';
import { Card, fmt, NumField, Pill, Select, Stat } from '../../ui/fields';
import { useProject } from '../ProjectView';
import { SheetPage, SimpleOverviewTab } from './SimpleOverview';

export function usePool() {
  const { project: p, update } = useProject();
  const pool = { ...defaultPoolInputs(), ...p.pool };
  const result = analysePool(pool);
  const set = (fn: (x: PoolInputs) => void) =>
    update((d) => {
      const x = { ...defaultPoolInputs(), ...d.pool };
      fn(x);
      d.pool = x;
    });
  return { p, pool, result, set };
}

export const poolSummary = (p: Project) => {
  const r = analysePool({ ...defaultPoolInputs(), ...p.pool });
  return { label: 'Pool heating duty', value: r.dutyKw, sub: `${fmt(r.volume, 1)} m³ · ${r.governing === 'heatup' ? 'heat-up governs' : 'running losses govern'}` };
};

export function PoolOverviewTab() {
  return (
    <SimpleOverviewTab
      title="Pool heating project"
      howItWorks={
        <ol className="steps">
          <li>Enter the pool size, water temperature and the hall or outdoor air conditions on the Pool tab.</li>
          <li>Set how long the cover is on each day and how quickly the pool must reach temperature from cold.</li>
          <li>
            The duty is the larger of the heat-up load and the running losses. Use it to select a pool heat pump, or the plate heat exchanger and primary
            flow from a boiler plant room (it can be imported into a Plant room project as a circuit).
          </li>
        </ol>
      }
    />
  );
}

export function PoolDesignTab() {
  const { pool: x, result: r, set } = usePool();
  const lossRows: [string, keyof PoolLosses][] = [
    ['Evaporation', 'evaporationKw'],
    ['Convection', 'convectionKw'],
    ['Radiation', 'radiationKw'],
    ['Ground / shell', 'conductionKw'],
    ['Make-up water', 'makeupKw'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Pool</p>
          <h1>Pool heating duty</h1>
        </div>
      </div>
      <div className="stats">
        <Stat label="Heating duty" value={fmt(r.dutyKw, 1)} unit="kW" tone="ok" />
        <Stat label="Heat-up" value={fmt(r.heatUpKw, 1)} unit={`kW over ${x.heatUpHours} h`} />
        <Stat label="Running losses (with cover)" value={fmt(r.maintenanceWithCoverKw, 1)} unit="kW avg" />
        <Stat label="Energy per day" value={fmt(r.dailyKwh)} unit="kWh" />
        <Stat label="Evaporation" value={fmt(r.evaporationLitresPerDay)} unit="L/day" />
      </div>

      <div className="grid2 top">
        <Card title="Pool">
          <div className="grid2">
            <Select<PoolType>
              label="Type"
              value={x.type}
              onChange={(v) => set((p) => void (p.type = v))}
              options={[
                { value: 'indoor', label: 'Indoor' },
                { value: 'outdoor', label: 'Outdoor' },
              ]}
            />
            <Select<PoolActivity> label="Use" value={x.activity} onChange={(v) => set((p) => void (p.activity = v))} options={POOL_ACTIVITY.map((a) => ({ value: a.id, label: a.name }))} />
            <NumField label="Length" unit="m" value={x.length} onChange={(v) => set((p) => void (p.length = v))} />
            <NumField label="Width" unit="m" value={x.width} onChange={(v) => set((p) => void (p.width = v))} />
            <NumField label="Average depth" unit="m" step={0.05} value={x.avgDepth} onChange={(v) => set((p) => void (p.avgDepth = v))} />
            <NumField label="Volume override" unit="m³ (0 = auto)" value={x.volumeOverride} onChange={(v) => set((p) => void (p.volumeOverride = v))} />
            <NumField label="Water temperature" unit="°C" value={x.waterTemp} onChange={(v) => set((p) => void (p.waterTemp = v))} />
            <NumField label="Fill / mains water" unit="°C" value={x.fillTemp} onChange={(v) => set((p) => void (p.fillTemp = v))} />
            <NumField label="Heat-up time" unit="h" value={x.heatUpHours} onChange={(v) => set((p) => void (p.heatUpHours = v))} />
            <NumField label="Make-up water" unit="% / day" step={0.5} value={x.makeupFractionPerDay * 100} onChange={(v) => set((p) => void (p.makeupFractionPerDay = v / 100))} />
          </div>
        </Card>
        <Card title={x.type === 'indoor' ? 'Pool hall' : 'Outdoor conditions (heating season)'}>
          <div className="grid2">
            <NumField label="Air temperature" unit="°C" value={x.airTemp} onChange={(v) => set((p) => void (p.airTemp = v))} />
            <NumField label="Relative humidity" unit="%" value={x.rh} onChange={(v) => set((p) => void (p.rh = v))} />
            {x.type === 'outdoor' ? (
              <>
                <NumField label="Wind at water surface" unit="m/s" step={0.1} value={x.windSpeed} onChange={(v) => set((p) => void (p.windSpeed = v))} />
                <NumField label="Cloud cover" unit="0–1" step={0.1} value={x.cloudFraction} onChange={(v) => set((p) => void (p.cloudFraction = v))} />
              </>
            ) : (
              <NumField label="Air speed over water" unit="m/s" step={0.05} value={x.indoorAirSpeed} onChange={(v) => set((p) => void (p.indoorAirSpeed = v))} />
            )}
            <NumField label="Cover on" unit="h / day" value={x.coverHoursPerDay} onChange={(v) => set((p) => void (p.coverHoursPerDay = v))} />
            <NumField label="Cover cuts evaporation by" unit="%" value={x.coverEvapReduction * 100} onChange={(v) => set((p) => void (p.coverEvapReduction = v / 100))} />
            <NumField label="Ground temperature" unit="°C" value={x.groundTemp} onChange={(v) => set((p) => void (p.groundTemp = v))} />
            <NumField label="Shell U-value" unit="W/m²K" step={0.05} value={x.shellU} onChange={(v) => set((p) => void (p.shellU = v))} />
          </div>
        </Card>
      </div>

      <div className="grid2 top">
        <Card title="Losses at design conditions">
          <table className="tbl">
            <thead>
              <tr>
                <th>Loss</th>
                <th className="r">No cover kW</th>
                <th className="r">Covered kW</th>
              </tr>
            </thead>
            <tbody>
              {lossRows.map(([label, k]) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td className="r">{fmt(r.uncovered[k], 2)}</td>
                  <td className="r">{fmt(r.covered[k], 2)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="r">{fmt(r.uncovered.totalKw, 2)}</td>
                <td className="r">{fmt(r.covered.totalKw, 2)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            Negative values are gains (e.g. a hall warmer than the water). Daily average with {x.coverHoursPerDay} h of cover: {fmt(r.maintenanceWithCoverKw, 2)} kW;
            uncovered all day: {fmt(r.maintenanceUncoveredKw, 2)} kW.
          </p>
        </Card>
        <Card title="Heat source & heat exchanger">
          <div className="grid2">
            <Select<FluidId> label="Primary fluid" value={x.primaryFluid} onChange={(v) => set((p) => void (p.primaryFluid = v))} options={FLUIDS.map((f) => ({ value: f.id, label: f.name }))} />
            <NumField label="Primary flow temp" unit="°C" value={x.primaryFlowTemp} onChange={(v) => set((p) => void (p.primaryFlowTemp = v))} />
            <NumField label="Primary ΔT" unit="K" value={x.primaryDeltaT} onChange={(v) => set((p) => void (p.primaryDeltaT = v))} />
            <NumField label="Pool-side rise" unit="K" step={0.5} value={x.poolSideDeltaT} onChange={(v) => set((p) => void (p.poolSideDeltaT = v))} />
            <NumField label="Margin" unit="%" value={x.marginPct} onChange={(v) => set((p) => void (p.marginPct = v))} />
          </div>
          <table className="tbl summary wide">
            <tbody>
              <tr>
                <th>Duty ({r.governing === 'heatup' ? 'heat-up governs' : 'running losses govern'})</th>
                <td className="r">
                  <b>{fmt(r.dutyKw, 1)} kW</b>
                </td>
              </tr>
              <tr>
                <th>Primary flow to plate HEX</th>
                <td className="r">
                  {fmt(r.primaryFlowLpm, 1)} l/min · {fmt(r.primaryFlowM3h, 2)} m³/h
                </td>
              </tr>
              <tr>
                <th>Pool-side flow</th>
                <td className="r">
                  {fmt(r.poolSideFlowLpm)} l/min · {fmt(r.poolSideFlowM3h, 2)} m³/h
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            A longer heat-up time lowers the duty when heat-up governs. Check the selected heat pump's output at the air temperature it will see.
          </p>
        </Card>
      </div>

      <Card title="Methods & sources">
        <div className="methods">
          {POOL_METHOD_NOTES.map((n) => (
            <article key={n.topic}>
              <header>
                <h4>{n.topic}</h4>
                <Pill tone={n.confidence === 'exact' ? 'ok' : n.confidence === 'method' ? 'info' : 'warn'}>{n.confidence}</Pill>
              </header>
              <p className="small">{n.source}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function PoolSheetTab() {
  const { p, pool: x, result: r } = usePool();
  const { company } = useStore();
  return (
    <SheetPage eyebrow="Design sheet" title="Pool heating design">
      <section className="sheet">
        <div className="pack-head">
          <div>
            <p className="eyebrow">Pool heating design</p>
            <h2>{p.name}</h2>
          </div>
          <img src={company.logoDataUrl || './logo.png'} alt="" />
        </div>
        <div className="pack-stats">
          <div>
            <span>Pool</span>
            <b>
              {x.length} × {x.width} m, {fmt(r.volume, 1)} m³
            </b>
          </div>
          <div>
            <span>Water / air</span>
            <b>
              {x.waterTemp} / {x.airTemp} °C
            </b>
          </div>
          <div>
            <span>Duty</span>
            <b>{fmt(r.dutyKw, 1)} kW</b>
          </div>
          <div>
            <span>Heat-up</span>
            <b>
              {fmt(r.heatUpKwh)} kWh in {x.heatUpHours} h
            </b>
          </div>
          <div>
            <span>Running (with cover)</span>
            <b>{fmt(r.maintenanceWithCoverKw, 1)} kW</b>
          </div>
          <div>
            <span>Energy per day</span>
            <b>{fmt(r.dailyKwh)} kWh</b>
          </div>
        </div>
        <table className="tbl">
          <tbody>
            <tr>
              <th>Type / use</th>
              <td>
                {x.type}, {POOL_ACTIVITY.find((a) => a.id === x.activity)?.name}
              </td>
            </tr>
            <tr>
              <th>Cover</th>
              <td>{x.coverHoursPerDay} h/day</td>
            </tr>
            <tr>
              <th>Primary flow to HEX</th>
              <td>
                {fmt(r.primaryFlowLpm, 1)} l/min at {x.primaryFlowTemp} °C, ΔT {x.primaryDeltaT} K
              </td>
            </tr>
            <tr>
              <th>Pool-side flow</th>
              <td>{fmt(r.poolSideFlowLpm)} l/min</td>
            </tr>
          </tbody>
        </table>
        <p className="pack-foot">Evaporation by the ASHRAE natatorium method; losses are estimates. Confirm plant selection with the manufacturer.</p>
      </section>
    </SheetPage>
  );
}
