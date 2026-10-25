import { useState } from 'react';
import {
  AGE_BANDS,
  DESIGN_STATIONS,
  MEAN_ANNUAL_TEMPS,
  degreeDays,
  defaultWallThickness,
  designTemperature,
  nearestStation,
  station,
  type AgeBand,
} from '../../data/climate';
import { defaultRoomTemp, roomType } from '../../data/rooms';
import { ageBandDefaults, settingsOf } from '../../engine/heatloss';
import type { GroundFloorKind } from '../../engine/groundfloor';
import { ask } from '../../ui/dialog';
import { plural, Card, fmt, NumField, Select } from '../../ui/fields';
import { useProject } from '../ProjectView';

// Rough mapping from postcodes.io regions to the MCS annual-mean regions.
const REGION_MAP: Record<string, string> = {
  'South East': 'South East England',
  London: 'Thames Valley',
  'South West': 'South West England',
  'East of England': 'East Anglia',
  'West Midlands': 'Midlands',
  'East Midlands': 'Midlands',
  'North West': 'North West England',
  'North East': 'North East England',
  'Yorkshire and The Humber': 'East Pennines',
};

// postcodes.io gives Scottish postcodes no region, so use the nearest Scottish mean-temperature station.
const SCOTLAND: { region: string; lat: number; lon: number }[] = [
  { region: 'Borders', lat: 55.42, lon: -1.6 },
  { region: 'East Scotland', lat: 56.38, lon: -2.86 },
  { region: 'North East Scotland', lat: 57.2, lon: -2.2 },
  { region: 'North West Scotland', lat: 58.21, lon: -6.32 },
  { region: 'West Scotland', lat: 55.87, lon: -4.43 },
];
function scottishRegion(lat: number, lon: number): string {
  const d = (r: { lat: number; lon: number }) => (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
  return [...SCOTLAND].sort((a, b) => d(a) - d(b))[0].region;
}

export function DesignConditionsCard() {
  const { project: p, update, loss } = useProject();
  const s = settingsOf(p);
  const st = station(s.stationId);
  const [lookup, setLookup] = useState('');
  const dd = degreeDays(p.customer.postcode);

  const setStation = (id: string, altitude = s.altitude, pct = s.percentile) =>
    update((d) => {
      const x = station(id);
      d.settings.stationId = id;
      d.settings.altitude = altitude;
      d.settings.percentile = pct;
      if (x) {
        d.settings.externalTemp = designTemperature(x, altitude, pct);
        d.settings.locationName = `${x.location} (${x.station})`;
      }
    });

  const lookupPostcode = async () => {
    const pc = p.customer.postcode.trim();
    if (!pc) {
      setLookup('Enter the postcode on the Customer card first.');
      return;
    }
    setLookup('Looking up…');
    try {
      const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      const j = await r.json();
      if (j.status !== 200) throw new Error(j.error || 'not found');
      const near = nearestStation(j.result.latitude, j.result.longitude);
      setStation(near.id);
      const c = j.result.country;
      const region =
        c === 'Wales' ? 'Wales' : c === 'Northern Ireland' ? 'Northern Ireland' : c === 'Scotland' ? scottishRegion(j.result.latitude, j.result.longitude) : REGION_MAP[j.result.region];
      const mean = MEAN_ANNUAL_TEMPS.find((m) => m.region === region);
      if (mean)
        update((d) => {
          d.settings.meanExternalTemp = mean.temp;
          d.settings.meanRegion = mean.region;
        });
      setLookup(`Nearest design station: ${near.location} (${near.station}). ${mean ? `Annual mean: ${mean.region} ${mean.temp} °C. ` : ''}Enter the property altitude if over 100 m.`);
    } catch (e) {
      setLookup(`Couldn't look that postcode up (${(e as Error).message}). Pick the station by hand.`);
    }
  };

  const setBand = async (band: AgeBand) => {
    update((d) => {
      d.settings.ageBand = band;
      Object.assign(d.settings, ageBandDefaults(band));
    });
    if (p.rooms.length && (await ask.confirm(`Apply the room temperatures for age band ${band} to all ${plural(p.rooms.length, 'room')}? Rooms you have changed by hand will be reset.`))) {
      update((d) => {
        for (const r of d.rooms) {
          r.designTemp = defaultRoomTemp(r.typeId, band);
          r.ach = roomType(r.typeId).ach;
        }
      });
    }
  };

  const gf = s.groundFloor;
  const setGf = (patch: Partial<typeof gf>) => update((d) => void (d.settings.groundFloor = { ...settingsOf(d).groundFloor, ...patch }));

  return (
    <>
      <Card title="Design conditions">
        <div className="grid4">
          <Select
            label="Design weather station (CIBSE Guide A)"
            value={s.stationId}
            onChange={(v) => setStation(v)}
            options={[{ value: '', label: 'Custom temperature' }, ...DESIGN_STATIONS.map((x) => ({ value: x.id, label: `${x.location} (${x.station}) ${x.t996} °C` }))]}
          />
          <NumField label="Property altitude" unit="m" min={-50} value={s.altitude} onChange={(v) => (s.stationId ? setStation(s.stationId, v) : update((d) => void (d.settings.altitude = v)))} />
          <Select
            label="Design percentile"
            value={s.percentile}
            onChange={(v) => (s.stationId ? setStation(s.stationId, s.altitude, v) : update((d) => void (d.settings.percentile = v)))}
            options={[
              { value: '99.6', label: '99.6% (MCS default)' },
              { value: '99', label: '99%' },
            ]}
          />
          <NumField
            label="External design temp"
            unit="°C"
            value={s.externalTemp}
            onChange={(v) =>
              update((d) => {
                d.settings.externalTemp = v;
                d.settings.stationId = '';
              })
            }
          />
          <Select
            label="Annual mean temp (ground)"
            value={
              MEAN_ANNUAL_TEMPS.find((m) => m.region === s.meanRegion && m.temp === s.meanExternalTemp)?.region ??
              MEAN_ANNUAL_TEMPS.find((m) => m.temp === s.meanExternalTemp)?.region ??
              'custom'
            }
            onChange={(v) =>
              update((d) => {
                const m = MEAN_ANNUAL_TEMPS.find((x) => x.region === v);
                if (!m) return;
                d.settings.meanExternalTemp = m.temp;
                d.settings.meanRegion = m.region;
              })
            }
            options={[
              ...MEAN_ANNUAL_TEMPS.map((m) => ({ value: m.region, label: `${m.region} (${m.station}) ${m.temp} °C` })),
              ...(MEAN_ANNUAL_TEMPS.some((m) => m.temp === s.meanExternalTemp) ? [] : [{ value: 'custom', label: `${s.meanExternalTemp} °C (custom)` }]),
            ]}
          />
          <NumField label="Heated neighbour" unit="°C" value={s.neighbourTemp} onChange={(v) => update((d) => void (d.settings.neighbourTemp = v))} />
          <NumField label="Unheated spaces" unit="°C" value={s.unheatedTemp} onChange={(v) => update((d) => void (d.settings.unheatedTemp = v))} />
          <NumField label="Design margin" unit="%" value={s.marginPct} onChange={(v) => update((d) => void (d.settings.marginPct = v))} />
        </div>
        <div className="row-actions">
          <button className="btn ghost sm" onClick={lookupPostcode}>
            Find station from postcode
          </button>
          <span className="muted small">{lookup || (st ? `${st.location}: ${designTemperature(st, s.altitude, s.percentile)} °C at ${s.altitude} m (−0.6 °C per whole 100 m above the station's ${st.altitude} m).` : '')}</span>
        </div>
        {dd && <p className="muted small">Degree days for {p.customer.postcode.toUpperCase().match(/^[A-Z]{1,2}/)?.[0]}: {dd} (base 15.5 °C).</p>}
        <p className="muted small">The postcode lookup sends only the postcode to postcodes.io. Stations and temperatures are the CIBSE Guide A values used by the MCS calculator.</p>
      </Card>

      <Card title="Building">
        <div className="grid4">
          <Select<AgeBand> label="Age band (original house)" value={s.ageBand} onChange={(v) => void setBand(v)} options={AGE_BANDS.map((b) => ({ value: b.id, label: `${b.id}: ${b.years}` }))} />
          <NumField label="Thermal bridging, external" unit="W/m²K" step={0.01} value={s.thermalBridgeU} onChange={(v) => update((d) => void (d.settings.thermalBridgeU = v))} />
          <NumField label="Thermal bridging, internal" unit="W/m²K" step={0.01} value={s.thermalBridgeInternalU} onChange={(v) => update((d) => void (d.settings.thermalBridgeInternalU = v))} />
          <NumField label="Floor void added to walls" unit="m" step={0.05} value={s.floorVoidAddM} onChange={(v) => update((d) => void (d.settings.floorVoidAddM = v))} />
        </div>
        <p className="muted small">
          Thermal bridging defaults follow the age band (RdSAP 10 Table 21 external, CIBSE DHDG Table 2-9 internal). The floor void (0.25 m) is added to external
          wall heights on storeys below the top, as MCS does for net internal measurements.
        </p>
      </Card>

      <div className="grid2 top">
        <Card title="Ground floor (BS EN ISO 13370)">
          <div className="grid2">
            <Select<GroundFloorKind>
              label="Construction"
              value={gf.kind}
              onChange={(v) => setGf({ kind: v })}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
            <NumField label="All-over insulation" unit="mm" value={gf.insulationMm} onChange={(v) => setGf({ insulationMm: v })} />
            <NumField label="External wall thickness" unit="mm" value={gf.wallThicknessMm} onChange={(v) => setGf({ wallThicknessMm: v })} />
            <div className="field">
              <span>Calculated U-value</span>
              <strong className="big">{fmt(loss.ground.u, 2)}</strong>
            </div>
            <NumField label="Floor area" unit="m²" value={gf.areaOverride || Number(loss.ground.autoArea.toFixed(1))} onChange={(v) => setGf({ areaOverride: v === Number(loss.ground.autoArea.toFixed(1)) ? undefined : v })} />
            <NumField
              label="Exposed perimeter"
              unit="m"
              value={gf.perimeterOverride || Number(loss.ground.autoPerimeter.toFixed(1))}
              onChange={(v) => setGf({ perimeterOverride: v === Number(loss.ground.autoPerimeter.toFixed(1)) ? undefined : v })}
            />
          </div>
          <p className="muted small">
            Applies to floors set to “Ground floor – calculated”. Area and perimeter come from the ground-floor rooms unless overridden. Uses the RdSAP 10 §5.12
            parameters (clay soil). Typical wall thickness for this age band: cavity {defaultWallThickness('cavity', s.ageBand)} mm, solid brick{' '}
            {defaultWallThickness('solid-brick', s.ageBand)} mm.
          </p>
        </Card>
        <Card title="Ventilation">
          <div className="grid2">
            <NumField label="Air permeability q50" unit="m³/h·m²" value={s.airPermeability} onChange={(v) => update((d) => void (d.settings.airPermeability = v))} />
            <NumField label="q50 → infiltration ratio" step={0.01} value={s.infiltrationFactor} onChange={(v) => update((d) => void (d.settings.infiltrationFactor = v))} />
          </div>
          <table className="tbl summary wide">
            <tbody>
              <tr>
                <th>External envelope area</th>
                <td className="r">{fmt(loss.envelopeArea, 1)} m²</td>
              </tr>
              <tr>
                <th>Building infiltration</th>
                <td className="r">{fmt(loss.infiltrationM3h)} m³/h</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            Each room uses the larger of its minimum air change rate (0.5/h, MCS default) and its share of building infiltration by external envelope area. 12
            m³/h·m² is the BS EN 12831-1 Table B.6 default MCS uses. The ratio converting it to natural infiltration (0.05, i.e. q50 ÷ 20) is a rule of thumb
            until the full BS EN 12831-1 method is added.
          </p>
        </Card>
      </div>
    </>
  );
}
