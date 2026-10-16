import { createContext, useContext, useMemo } from 'react';
import { projectHeatLoss, type ProjectLoss } from '../engine/heatloss';
import type { Project } from '../engine/model';
import { store } from '../store';
import { fmt } from '../ui/fields';
import { OverviewTab } from './tabs/Overview';
import { RoomsTab } from './tabs/Rooms';
import { PlanTab } from './tabs/Plan';
import { HeatLossTab } from './tabs/HeatLoss';
import { EmittersTab } from './tabs/Emitters';
import { UfhTab } from './tabs/Ufh';
import { PipeworkTab } from './tabs/Pipework';
import { EquipmentTab } from './tabs/Equipment';
import { HandoverTab } from './tabs/Handover';

interface Ctx {
  project: Project;
  loss: ProjectLoss;
  /** Apply a change to a copy of the project and save it. */
  update: (fn: (draft: Project) => void) => void;
}

const ProjectCtx = createContext<Ctx | null>(null);
export const useProject = () => useContext(ProjectCtx)!;

const TABS: { id: string; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Floor plan' },
  { id: 'rooms', label: 'Rooms & fabric' },
  { id: 'heatloss', label: 'Heat loss' },
  { id: 'emitters', label: 'Radiators' },
  { id: 'ufh', label: 'Underfloor' },
  { id: 'pipework', label: 'Pipework & Kv' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'handover', label: 'Handover pack' },
];

export function ProjectView({ project, tab }: { project: Project; tab: string }) {
  const loss = useMemo(() => projectHeatLoss(project), [project]);
  const ctx: Ctx = {
    project,
    loss,
    update: (fn) => {
      const draft = structuredClone(project);
      fn(draft);
      store.upsertProject(draft);
    },
  };

  const body = (() => {
    switch (tab) {
      case 'plan':
        return <PlanTab />;
      case 'rooms':
        return <RoomsTab />;
      case 'heatloss':
        return <HeatLossTab />;
      case 'emitters':
        return <EmittersTab />;
      case 'ufh':
        return <UfhTab />;
      case 'pipework':
        return <PipeworkTab />;
      case 'equipment':
        return <EquipmentTab />;
      case 'handover':
        return <HandoverTab />;
      default:
        return <OverviewTab />;
    }
  })();

  return (
    <ProjectCtx.Provider value={ctx}>
      <div className="project">
        <aside className="sidebar no-print">
          <a href="#/" className="back">
            ← All projects
          </a>
          <h2>{project.name}</h2>
          <p className="muted small">{project.customer.name || 'No customer'}</p>
          <div className="side-total">
            <span>Design heat loss</span>
            <strong>{fmt(loss.totalW / 1000, 2)} kW</strong>
            <small>
              {project.rooms.length} rooms · {fmt(loss.area, 0)} m² · {project.settings.externalTemp} °C outside
            </small>
          </div>
          <nav>
            {TABS.map((t) => (
              <a key={t.id} href={`#/p/${project.id}/${t.id}`} className={tab === t.id ? 'on' : ''}>
                {t.label}
              </a>
            ))}
          </nav>
        </aside>
        <div className="content">{body}</div>
      </div>
    </ProjectCtx.Provider>
  );
}
