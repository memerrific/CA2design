import {
  DHW_METHOD_NOTES,
  SHOWER_PRESETS,
  deriveFromBadge,
  dhwPriority,
  legionellaCycle,
  sizeCylinder,
  type CylinderBadge,
  type DhwHeatSource,
  type ShowerType,
  type UsagePattern,
} from '../../engine/dhw';
import type { DhwProject, Project } from '../../engine/model';
import { useStore } from '../../store';
import { downscaleImage } from '../../ui/image';
import { defaultDhw } from '../../data/dhwDefaults';
import { Card, fmt, NumField, Pill, Select, Stat, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';
import { SheetPage, SimpleOverviewTab } from './SimpleOverview';

export { defaultDhw };

export function analyseDhw(x: DhwProject) {
  const demand = sizeCylinder(x.demand);
  const cold = x.demand.coldFeedC ?? 10;
  const badge = deriveFromBadge(x.badge, {
    storageTempC: x.demand.storageTempC,
    coldFeedC: cold,
    primaryFlowC: x.primaryFlowC,
    primaryFlowLpm: x.primaryFlowLpm,
    sourceMaxKw: x.sourceKw,
  });
  const volume = x.badge.capacityL || demand.recommendedSizeL;
  const ua = badge.coilUAWK ?? badge.coilUAFromReheatWK;
  const priority = dhwPriority({
    volumeL: volume,
    fromC: cold,
    toC: x.demand.storageTempC,
    targetReheatMinutes: x.targetReheatMinutes,
    standingLossW: badge.standingLossAtStorageW,
    sourceKw: x.sourceKw,
    coil: ua ? { uaWK: ua, primaryFlowC: x.primaryFlowC, primaryFlowLpm: x.primaryFlowLpm } : undefined,
    spaceHeatingLoadKw: x.spaceHeatingLoadKw,
  });
  const legionella = legionellaCycle({ volumeL: volume, storageTempC: x.demand.storageTempC, heaterKw: x.badge.immersionKw ?? 3, standingLossRatedW: badge.standingLossRatedW });
  return { demand, badge, priority, legionella, volume };
}

export function useDhw() {
  const { project: p, update } = useProject();
  const dhw = { ...defaultDhw(), ...p.dhw };
  const result = analyseDhw(dhw);
  const set = (fn: (x: DhwProject) => void) =>
    update((d) => {
      const x = { ...defaultDhw(), ...d.dhw };
      fn(x);
      d.dhw = x;
    });
  return { p, dhw, result, set };
}

export const dhwSummary = (p: Project) => {
  const r = analyseDhw({ ...defaultDhw(), ...p.dhw });
  return { label: 'Recommended cylinder', value: r.demand.recommendedSizeL / 1000, sub: `${r.demand.recommendedSizeL} L · min ${fmt(r.priority.minSourceKw, 1)} kW for target reheat`, unit: 'm³' };
};

export function DhwOverviewTab() {
  return (
    <SimpleOverviewTab
      title="Hot water project"
      howItWorks={
        <ol className="steps">
          <li>On the Hot water tab, enter the household, showers and baths to get the cylinder size.</li>
          <li>Photograph the cylinder's data badge and type in its figures: capacity, coil rating, reheat time, heat loss.</li>
          <li>Set the heat source and primary temperature to see real reheat times on a heat pump, the kW needed, and the legionella cycle energy.</li>
        </ol>
      }
    />
  );
}

const BADGE_FIELDS: [keyof CylinderBadge, string, string][] = [
  ['capacityL', 'Capacity', 'L'],
  ['coilAreaM2', 'Coil area', 'm²'],
  ['coilRatingKw', 'Coil rating', 'kW'],
  ['coilRatedPrimaryFlowC', 'Rated at primary', '°C'],
  ['coilRatedPrimaryFlowLpm', 'Rated primary flow', 'l/min'],
  ['reheatMinutes', 'Reheat time', 'min'],
  ['heatLossKwhPer24h', 'Heat loss', 'kWh/24h'],
  ['immersionKw', 'Immersion', 'kW'],
  ['maxWorkingPressureBar', 'Operating pressure', 'bar'],
  ['expansionVesselL', 'Expansion vessel', 'L'],
];

export function DhwDesignTab() {
  const { dhw: x, result: r, set } = useDhw();
  const d = x.demand;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Hot water</p>
          <h1>Cylinder size, coil and reheat</h1>
        </div>
      </div>
      <div className="stats">
        <Stat label="Recommended cylinder" value={String(r.demand.recommendedSizeL)} unit="L" tone="ok" />
        <Stat label="Peak demand from store" value={fmt(r.demand.peakHotL)} unit={`L at ${d.storageTempC} °C`} />
        <Stat label={`kW to reheat in ${x.targetReheatMinutes} min`} value={fmt(r.priority.minSourceKw, 1)} unit="kW" />
        <Stat
          label="Actual reheat"
          value={r.priority.actualReheatMinutes ? fmt(r.priority.actualReheatMinutes) : '–'}
          unit="min"
          tone={r.priority.actualReheatMinutes && r.priority.actualReheatMinutes > x.targetReheatMinutes ? 'warn' : undefined}
        />
      </div>

      <div className="grid2 top">
        <Card title="Household">
          <div className="grid2">
            <NumField label="Occupants" value={d.occupants} step={1} onChange={(v) => set((p) => void (p.demand.occupants = v))} />
            <NumField label="Bedrooms" value={d.bedrooms} step={1} onChange={(v) => set((p) => void (p.demand.bedrooms = v))} />
            <NumField label="Bathrooms" value={d.bathrooms} step={1} onChange={(v) => set((p) => void (p.demand.bathrooms = v))} />
            <Select<UsagePattern>
              label="Usage"
              value={d.usagePattern}
              onChange={(v) => set((p) => void (p.demand.usagePattern = v))}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
              ]}
            />
            <Select<DhwHeatSource>
              label="Heat source"
              value={d.heatSource}
              onChange={(v) => set((p) => void (p.demand.heatSource = v))}
              options={[
                { value: 'heatPump', label: 'Heat pump' },
                { value: 'boiler', label: 'Boiler' },
                { value: 'immersion', label: 'Immersion only' },
              ]}
            />
            <NumField label="Storage temperature" unit="°C" value={d.storageTempC} onChange={(v) => set((p) => void (p.demand.storageTempC = v))} />
            <NumField label="Cold feed" unit="°C" value={d.coldFeedC ?? 10} onChange={(v) => set((p) => void (p.demand.coldFeedC = v))} />
            <NumField label="Shower length" unit="min" value={d.showerMinutes ?? 8} onChange={(v) => set((p) => void (p.demand.showerMinutes = v))} />
          </div>
          <h4 className="sub-h">Showers</h4>
          {d.showers.map((s, i) => (
            <div key={i} className="shower-row">
              <Select<ShowerType>
                value={s.type}
                onChange={(v) => set((p) => void (p.demand.showers[i] = { type: v }))}
                options={(Object.keys(SHOWER_PRESETS) as ShowerType[]).map((t) => ({ value: t, label: SHOWER_PRESETS[t].name }))}
              />
              <NumField value={s.flowLpm ?? SHOWER_PRESETS[s.type].flowLpm} unit="l/min" width={60} onChange={(v) => set((p) => void (p.demand.showers[i].flowLpm = v))} />
              <button className="link danger" onClick={() => set((p) => void p.demand.showers.splice(i, 1))}>
                ✕
              </button>
            </div>
          ))}
          <h4 className="sub-h">Baths</h4>
          {d.baths.map((b, i) => (
            <div key={i} className="shower-row">
              <span>Bath {i + 1}</span>
              <NumField value={b.litres} unit="L at 40 °C" width={60} onChange={(v) => set((p) => void (p.demand.baths[i].litres = v))} />
              <button className="link danger" onClick={() => set((p) => void p.demand.baths.splice(i, 1))}>
                ✕
              </button>
            </div>
          ))}
          <div className="row-actions">
            <button className="link" onClick={() => set((p) => void p.demand.showers.push({ type: 'mixer' }))}>
              + Shower
            </button>
            <button className="link" onClick={() => set((p) => void p.demand.baths.push({ litres: 100 }))}>
              + Bath
            </button>
          </div>
        </Card>

        <Card title="Sizing">
          <table className="tbl">
            <thead>
              <tr>
                <th>Peak draw</th>
                <th className="r">L at 40 °C</th>
                <th className="r">L from store</th>
              </tr>
            </thead>
            <tbody>
              {r.demand.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.label}</td>
                  <td className="r">{fmt(l.mixedL)}</td>
                  <td className="r">{fmt(l.hotL)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="tbl summary wide">
            <tbody>
              <tr>
                <th>Peak-period method</th>
                <td className="r">{fmt(r.demand.peakMethodL)} L</td>
              </tr>
              <tr>
                <th>Litres per person rule</th>
                <td className="r">{fmt(r.demand.perPersonMethodL)} L</td>
              </tr>
              {r.demand.bathroomGuideL !== null && (
                <tr>
                  <th>Bathroom guide</th>
                  <td className="r">{fmt(r.demand.bathroomGuideL)} L</td>
                </tr>
              )}
              <tr className="total">
                <th>Recommended (next standard size)</th>
                <td className="r">{r.demand.recommendedSizeL} L</td>
              </tr>
            </tbody>
          </table>
          {r.demand.warnings.length > 0 && (
            <ul className="warnings small">
              {r.demand.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Cylinder data badge">
        <div className="badge-row">
          <div className="badge-photos">
            {x.photos.map((src, i) => (
              <figure key={i}>
                <img src={src} alt={`Badge photo ${i + 1}`} />
                <button className="link danger" onClick={() => set((p) => void p.photos.splice(i, 1))}>
                  Remove
                </button>
              </figure>
            ))}
            <label className="btn ghost sm">
              {x.photos.length ? 'Add another photo' : 'Add badge photo'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const url = await downscaleImage(f);
                    set((p) => void p.photos.push(url));
                  }
                }}
              />
            </label>
          </div>
          <div className="grid4 badge-fields">
            <TextField label="Make" value={x.badge.manufacturer ?? ''} onChange={(v) => set((p) => void (p.badge.manufacturer = v))} />
            <TextField label="Model" value={x.badge.model ?? ''} onChange={(v) => set((p) => void (p.badge.model = v))} />
            <TextField label="Serial" value={x.badge.serial ?? ''} onChange={(v) => set((p) => void (p.badge.serial = v))} />
            {BADGE_FIELDS.map(([k, label, unit]) => (
              <NumField
                key={k}
                label={label}
                unit={unit}
                value={(x.badge[k] as number | undefined) ?? undefined}
                onChange={(v) => set((p) => void ((p.badge as Record<string, unknown>)[k] = v || undefined))}
              />
            ))}
          </div>
        </div>
        <p className="muted small">Type the figures from the photo. The photo is stored with the project (reduced in size).</p>
      </Card>

      <div className="grid2 top">
        <Card title="Heat source & reheat">
          <div className="grid2">
            <NumField label="Primary flow temp" unit="°C" value={x.primaryFlowC} onChange={(v) => set((p) => void (p.primaryFlowC = v))} />
            <NumField label="Primary flow" unit="l/min" value={x.primaryFlowLpm} onChange={(v) => set((p) => void (p.primaryFlowLpm = v))} />
            <NumField label="Heat source output" unit="kW" value={x.sourceKw} onChange={(v) => set((p) => void (p.sourceKw = v))} />
            <NumField label="Target reheat" unit="min" value={x.targetReheatMinutes} onChange={(v) => set((p) => void (p.targetReheatMinutes = v))} />
            <NumField label="Space heating load" unit="kW" value={x.spaceHeatingLoadKw} onChange={(v) => set((p) => void (p.spaceHeatingLoadKw = v))} />
          </div>
          <table className="tbl summary wide">
            <tbody>
              {r.badge.energyContentKWh !== undefined && (
                <tr>
                  <th>Energy in a full cylinder</th>
                  <td className="r">{fmt(r.badge.energyContentKWh, 1)} kWh</td>
                </tr>
              )}
              {r.badge.mixed40L !== undefined && (
                <tr>
                  <th>Usable hot water at 40 °C</th>
                  <td className="r">{fmt(r.badge.mixed40L)} L</td>
                </tr>
              )}
              {r.badge.coilKwAtSystem !== undefined && (
                <tr>
                  <th>Coil output at {x.primaryFlowC} °C primary</th>
                  <td className="r">{fmt(r.badge.coilKwAtSystem, 1)} kW</td>
                </tr>
              )}
              <tr>
                <th>Reheat time with this heat source</th>
                <td className="r">
                  <b>{r.priority.actualReheatMinutes ? `${fmt(r.priority.actualReheatMinutes)} min` : '–'}</b>
                </td>
              </tr>
              {r.priority.minutesAwayPerDay !== null && (
                <tr>
                  <th>Time away from space heating</th>
                  <td className="r">{fmt(r.priority.minutesAwayPerDay)} min/day</td>
                </tr>
              )}
              {r.badge.standingLossAtStorageW !== undefined && (
                <tr>
                  <th>Standing loss at {x.demand.storageTempC} °C</th>
                  <td className="r">{fmt(r.badge.standingLossAtStorageW)} W</td>
                </tr>
              )}
            </tbody>
          </table>
          {[...r.badge.warnings, ...r.priority.warnings].length > 0 && (
            <ul className="warnings small">
              {[...r.badge.warnings, ...r.priority.warnings].map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Legionella cycle">
          <table className="tbl summary wide">
            <tbody>
              <tr>
                <th>
                  Energy per cycle ({x.demand.storageTempC} → 60 °C)
                </th>
                <td className="r">{fmt(r.legionella.cycleKWh, 2)} kWh</td>
              </tr>
              <tr>
                <th>Heat-up on {x.badge.immersionKw ?? 3} kW immersion</th>
                <td className="r">{r.legionella.heatUpMinutes === null ? "–" : `${fmt(r.legionella.heatUpMinutes)} min`}</td>
              </tr>
              <tr>
                <th>Per year (weekly cycle)</th>
                <td className="r">{fmt(r.legionella.annualKWh)} kWh</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">Stored hot water at 60 °C or above, and outlets reaching 50 °C within a minute, follow HSE guidance (HSG274 Part 2).</p>
        </Card>
      </div>

      <Card title="Methods & sources">
        <div className="methods">
          {DHW_METHOD_NOTES.map((n) => (
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

export function DhwSheetTab() {
  const { p, dhw: x, result: r } = useDhw();
  const { company } = useStore();
  return (
    <SheetPage eyebrow="Design sheet" title="Hot water design">
      <section className="sheet">
        <div className="pack-head">
          <div>
            <p className="eyebrow">Hot water design</p>
            <h2>{p.name}</h2>
          </div>
          <img src={company.logoDataUrl || './logo.png'} alt="" />
        </div>
        <div className="pack-stats">
          <div>
            <span>Household</span>
            <b>
              {x.demand.occupants} people, {x.demand.bathrooms ?? '–'} bathrooms
            </b>
          </div>
          <div>
            <span>Recommended cylinder</span>
            <b>{r.demand.recommendedSizeL} L</b>
          </div>
          <div>
            <span>Storage</span>
            <b>{x.demand.storageTempC} °C</b>
          </div>
          <div>
            <span>Installed</span>
            <b>{x.badge.capacityL ? `${x.badge.capacityL} L ${x.badge.manufacturer ?? ''} ${x.badge.model ?? ''}` : '–'}</b>
          </div>
          <div>
            <span>Reheat</span>
            <b>{r.priority.actualReheatMinutes ? `${fmt(r.priority.actualReheatMinutes)} min` : '–'}</b>
          </div>
          <div>
            <span>Legionella cycle</span>
            <b>{fmt(r.legionella.cycleKWh, 1)} kWh</b>
          </div>
        </div>
        {x.photos[0] && <img className="sheet-photo" src={x.photos[0]} alt="Cylinder data badge" />}
        <p className="pack-foot">Sizing by peak-period and litres-per-person methods; coil output from the badge rating. Confirm with the cylinder manufacturer.</p>
      </section>
    </SheetPage>
  );
}
