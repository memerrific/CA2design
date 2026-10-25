import { roomEmitterOutput } from '../engine/design';
import type { ProjectLoss } from '../engine/heatloss';
import type { Project } from '../engine/model';
import { plural, fmt } from '../ui/fields';
import { LAYERS, planUi, usePlanUi } from '../ui/planUi';
import { useProject } from './ProjectView';
import { LEVELS } from './tabs/Rooms';

/** Has this step of the project got what it needs? Drives the ticks in the sidebar. */
export function stepDone(tab: string, p: Project, loss: ProjectLoss): boolean {
  switch (tab) {
    case 'overview':
      return !!(p.customer.name && p.customer.postcode);
    case 'plan':
      return p.rooms.some((r) => r.polygon);
    case 'rooms':
      return p.rooms.length > 0 && p.rooms.every((r) => r.walls.length > 0);
    case 'heatloss':
      return p.rooms.length > 0 && loss.totalW > 0;
    case 'emitters':
      return p.rooms.length > 0 && p.rooms.every((r) => roomEmitterOutput(p, r).total >= (loss.byId.get(r.id)?.totalW ?? 0));
    case 'ufh':
      return p.rooms.some((r) => r.ufh.enabled);
    case 'pipework':
      return p.pipes.length > 0;
    case 'equipment':
      return p.equipment.length > 0;
    case 'pricing':
      return (p.pricing?.labour.length ?? 0) > 0 || (p.pricing?.extras.length ?? 0) > 0;
    case 'merchant':
      return !!p.pricing?.requiredBy;
    case 'plant':
      return (p.plant?.circuits.length ?? 0) > 0 && (p.plant?.sources.length ?? 0) > 0;
    case 'pool':
      return !!p.pool;
    case 'dhw':
      return !!p.dhw?.badge.capacityL;
    default:
      return false;
  }
}

/** Floors, drawing layers and notes, shown in the sidebar while on the floor plan. */
export function PlanSidePanels() {
  const { project: p, loss, update } = useProject();
  const ui = usePlanUi();
  const used = [...new Set([...Object.keys(p.plans), ...p.rooms.map((r) => r.level)])].sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));
  const floors = used.length ? used : ['Ground'];
  const current = ui.level;
  const spare = LEVELS.filter((l) => !floors.includes(l));

  return (
    <div className="side-panels">
      <section>
        <header>
          <h5>Floors</h5>
          {spare.length > 0 && (
            <select className="add-floor" value="" onChange={(e) => e.target.value && planUi.set({ level: e.target.value, selection: null })} aria-label="Add a floor">
              <option value="">+</option>
              {spare.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          )}
        </header>
        {[...new Set([...floors, ui.level])].map((l) => {
          const rooms = p.rooms.filter((r) => r.level === l);
          const kw = rooms.reduce((a, r) => a + (loss.byId.get(r.id)?.totalW ?? 0), 0) / 1000;
          return (
            <button key={l} className={`floor ${l === current ? 'on' : ''}`} onClick={() => planUi.set({ level: l, selection: null })}>
              <span>{l} floor</span>
              <small>{rooms.length ? `${plural(rooms.length, 'room')} · ${fmt(kw, 1)} kW` : 'empty'}</small>
            </button>
          );
        })}
      </section>
      <section>
        <header>
          <h5>Drawing layers</h5>
        </header>
        {LAYERS.map((l) => (
          <label key={l.id} className="layer">
            <input type="checkbox" checked={ui.layers[l.id]} onChange={() => planUi.toggleLayer(l.id)} />
            <span>{l.name}</span>
          </label>
        ))}
      </section>
      <section>
        <header>
          <h5>Project notes</h5>
        </header>
        <textarea className="side-notes" rows={4} value={p.notes} placeholder="e.g. Client prefers vertical radiators in living areas." onChange={(e) => update((d) => void (d.notes = e.target.value))} />
      </section>
    </div>
  );
}
