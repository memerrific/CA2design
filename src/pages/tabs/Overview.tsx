import { FABRICS, KIND_NAMES, type FabricKind } from '../../data/fabrics';
import { DESIGN_LOCATIONS } from '../../data/rooms';
import { uid } from '../../engine/factory';
import { FLUIDS, type FluidId } from '../../engine/fluid';
import { Card, NumField, Select, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

export const SYSTEM_TYPES = [
  'Air source heat pump',
  'Ground source heat pump',
  'Oil boiler',
  'Multi-boiler plant room',
  'Pool heat pump',
  'Hybrid (heat pump + boiler)',
  'Solar PV / battery',
  'Air conditioning',
  'Other',
];

export function OverviewTab() {
  const { project: p, update } = useProject();
  const s = p.settings;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Project & design conditions</h1>
        </div>
      </div>
      <div className="grid2 top">
        <Card title="Project">
          <TextField label="Project name" value={p.name} onChange={(v) => update((d) => void (d.name = v))} />
          <div className="grid2">
            <TextField label="Reference" value={p.reference} onChange={(v) => update((d) => void (d.reference = v))} />
            <TextField label="Engineer" value={p.engineer} onChange={(v) => update((d) => void (d.engineer = v))} />
          </div>
          <Select
            label="System type"
            value={p.systemType}
            onChange={(v) => update((d) => void (d.systemType = v))}
            options={SYSTEM_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <TextField label="Notes" multiline value={p.notes} onChange={(v) => update((d) => void (d.notes = v))} />
        </Card>
        <Card title="Customer">
          <TextField label="Name" value={p.customer.name} onChange={(v) => update((d) => void (d.customer.name = v))} />
          <TextField label="Address" multiline value={p.customer.address} onChange={(v) => update((d) => void (d.customer.address = v))} />
          <div className="grid2">
            <TextField label="Postcode" value={p.customer.postcode} onChange={(v) => update((d) => void (d.customer.postcode = v))} />
            <TextField label="Phone" value={p.customer.phone} onChange={(v) => update((d) => void (d.customer.phone = v))} />
          </div>
          <TextField label="Email" value={p.customer.email} onChange={(v) => update((d) => void (d.customer.email = v))} />
        </Card>
      </div>

      <Card title="Design conditions">
        <div className="grid4">
          <Select
            label="Location"
            value={s.locationName}
            onChange={(v) =>
              update((d) => {
                d.settings.locationName = v;
                const loc = DESIGN_LOCATIONS.find((l) => l.name === v);
                if (loc && v !== 'Custom') d.settings.externalTemp = loc.temp;
              })
            }
            options={DESIGN_LOCATIONS.map((l) => ({ value: l.name, label: l.name }))}
          />
          <NumField label="External design temp" unit="°C" value={s.externalTemp} onChange={(v) => update((d) => void (d.settings.externalTemp = v))} />
          <NumField label="Annual mean external (ground)" unit="°C" value={s.meanExternalTemp} onChange={(v) => update((d) => void (d.settings.meanExternalTemp = v))} />
          <NumField label="Heated neighbour" unit="°C" value={s.neighbourTemp} onChange={(v) => update((d) => void (d.settings.neighbourTemp = v))} />
          <NumField label="Unheated spaces" unit="°C" value={s.unheatedTemp} onChange={(v) => update((d) => void (d.settings.unheatedTemp = v))} />
          <NumField label="Thermal bridging ΔU" unit="W/m²K" step={0.01} value={s.thermalBridgeU} onChange={(v) => update((d) => void (d.settings.thermalBridgeU = v))} />
          <NumField label="Design margin" unit="%" value={s.marginPct} onChange={(v) => update((d) => void (d.settings.marginPct = v))} />
        </div>
        <p className="muted small">
          Location temperatures are approximate starting points. Confirm the external design temperature for the postcode before relying on the result.
        </p>
      </Card>

      <Card title="Heating system">
        <div className="grid4">
          <NumField label="Design flow temperature" unit="°C" value={s.flowTemp} onChange={(v) => update((d) => void (d.settings.flowTemp = v))} />
          <NumField label="System ΔT (flow − return)" unit="K" value={s.deltaT} onChange={(v) => update((d) => void (d.settings.deltaT = v))} />
          <Select<FluidId> label="Fluid" value={s.fluid} onChange={(v) => update((d) => void (d.settings.fluid = v))} options={FLUIDS.map((f) => ({ value: f.id, label: f.name }))} />
          <NumField label="Radiator exponent n" step={0.01} value={s.radiatorExponent} onChange={(v) => update((d) => void (d.settings.radiatorExponent = v))} />
        </div>
        <p className="muted small">
          Return temperature {s.flowTemp - s.deltaT} °C · mean water {s.flowTemp - s.deltaT / 2} °C
        </p>
      </Card>

      <Card
        title="Custom fabrics for this project"
        actions={
          <button
            className="btn ghost sm"
            onClick={() => update((d) => void d.customFabrics.push({ id: 'c-' + uid(), kind: 'wall', name: 'Custom wall', u: 1, custom: true }))}
          >
            + Add fabric
          </button>
        }
      >
        {p.customFabrics.length === 0 ? (
          <p className="muted small">
            {FABRICS.length} built-in constructions are available. Add your own here when you have a calculated U-value (e.g. from a U-value calculator or
            manufacturer data).
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>U-value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {p.customFabrics.map((f, i) => (
                <tr key={f.id}>
                  <td>
                    <TextField value={f.name} onChange={(v) => update((d) => void (d.customFabrics[i].name = v))} />
                  </td>
                  <td>
                    <Select<FabricKind>
                      value={f.kind}
                      onChange={(v) => update((d) => void (d.customFabrics[i].kind = v))}
                      options={(Object.keys(KIND_NAMES) as FabricKind[]).map((k) => ({ value: k, label: KIND_NAMES[k] }))}
                    />
                  </td>
                  <td>
                    <NumField value={f.u} step={0.01} unit="W/m²K" onChange={(v) => update((d) => void (d.customFabrics[i].u = v))} />
                  </td>
                  <td>
                    <button className="link danger" onClick={() => update((d) => void d.customFabrics.splice(i, 1))}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
