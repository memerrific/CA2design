import { uid } from '../../engine/factory';
import { Card, NumField, Select, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

export const EQUIPMENT_CATEGORIES = [
  'Heat pump',
  'Oil boiler',
  'Boiler (cascade)',
  'Pool heat pump',
  'Hot water cylinder',
  'Buffer / volumiser',
  'Low loss header / plate HEX',
  'Circulating pump',
  'Expansion vessel',
  'Controls / thermostat',
  'UFH manifold',
  'Mixing valve / blending',
  'Zone / diverter valve',
  'Filter / dirt separator',
  'Solar PV inverter',
  'PV panels',
  'Battery storage',
  'Air conditioning unit',
  'MVHR unit',
  'Oil tank',
  'Other',
];

export function EquipmentTab() {
  const { project: p, update } = useProject();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Equipment</p>
          <h1>Installed equipment & plant</h1>
        </div>
        <div className="actions">
          <button
            className="btn"
            onClick={() => update((d) => void d.equipment.push({ id: uid(), category: 'Heat pump', make: '', model: '', serial: '', location: '', notes: '' }))}
          >
            + Add item
          </button>
        </div>
      </div>
      {p.equipment.length === 0 && <p className="muted">List each piece of plant with make, model and serial; it all goes into the handover pack.</p>}
      <div className="equip-grid">
        {p.equipment.map((e, i) => {
          const set = (fn: (x: typeof e) => void) => update((d) => fn(d.equipment[i]));
          return (
            <Card
              key={e.id}
              title={e.make || e.model ? `${e.make} ${e.model}` : e.category}
              actions={
                <button className="link danger" onClick={() => update((d) => void d.equipment.splice(i, 1))}>
                  Remove
                </button>
              }
            >
              <div className="grid2">
                <Select label="Category" value={e.category} onChange={(v) => set((x) => void (x.category = v))} options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
                <NumField label="Output / size" unit="kW" value={e.outputKw} onChange={(v) => set((x) => void (x.outputKw = v))} />
                <TextField label="Make" value={e.make} onChange={(v) => set((x) => void (x.make = v))} />
                <TextField label="Model" value={e.model} onChange={(v) => set((x) => void (x.model = v))} />
                <TextField label="Serial number" value={e.serial} onChange={(v) => set((x) => void (x.serial = v))} />
                <TextField label="Location" value={e.location} onChange={(v) => set((x) => void (x.location = v))} />
              </div>
              <TextField label="Notes (settings, warranty, commissioning ref.)" multiline value={e.notes} onChange={(v) => set((x) => void (x.notes = v))} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
