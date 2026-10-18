import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { projectHeatLoss, type ProjectLoss } from '../engine/heatloss';
import type { ModuleId, Project } from '../engine/model';
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
import { MerchantTab } from './tabs/Merchant';
import { PricingTab } from './tabs/Pricing';
import { PlantDesignTab, PlantHeaderTab, PlantOverviewTab, PlantSheetTab, plantKwSummary } from './plant/PlantTabs';
import { moduleInfo, moduleOf } from '../modules';
import { PoolDesignTab, PoolOverviewTab, PoolSheetTab, poolSummary } from './tools/PoolTabs';
import { DhwDesignTab, DhwOverviewTab, DhwSheetTab, dhwSummary } from './tools/DhwTabs';
import { ReportTab } from './tabs/Handover';
import { ask } from '../ui/dialog';

interface Ctx {
  project: Project;
  loss: ProjectLoss;
  /** Apply a change to a copy of the project and save it. */
  update: (fn: (draft: Project) => void) => void;
}

const ProjectCtx = createContext<Ctx | null>(null);
export const useProject = () => useContext(ProjectCtx)!;

type Nav = { group: string; tabs: { id: string; label: string }[] }[];
type Finish = { id: string; label: string; sub: string };

const t = (id: string, label: string) => ({ id, label });

interface ModuleSetup {
  nav: Nav;
  finish: Finish;
  body: (tab: string) => ReactNode;
}

const PROPERTY_NAV: Nav = [
  { group: 'Survey', tabs: [t('overview', 'Overview'), t('plan', 'Floor plan'), t('rooms', 'Rooms & fabric')] },
  { group: 'Design', tabs: [t('heatloss', 'Heat loss'), t('emitters', 'Radiators'), t('ufh', 'Underfloor'), t('pipework', 'Pipework & Kv'), t('equipment', 'Equipment')] },
  { group: 'Pricing', tabs: [t('pricing', 'Materials & quote'), t('merchant', 'Merchant request')] },
];

function propertyBody(tab: string): ReactNode {
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
    case 'pricing':
      return <PricingTab />;
    case 'merchant':
      return <MerchantTab />;
    case 'handover':
      return <HandoverTab />;
    case 'report':
      return <ReportTab kinds={['cover', 'summary', 'plan', 'heatloss']} title="Heat loss report" />;
    case 'survey-report':
      return <ReportTab kinds={['cover', 'plan', 'heatloss', 'equipment']} title="Survey summary" />;
    default:
      return <OverviewTab />;
  }
}

const SETUPS: Record<ModuleId, ModuleSetup> = {
  heating: { nav: PROPERTY_NAV, finish: { id: 'handover', label: 'Handover pack', sub: 'End of job' }, body: propertyBody },
  heatloss: {
    nav: [{ group: 'Heat loss', tabs: [t('overview', 'Overview & conditions'), t('plan', 'Floor plan'), t('rooms', 'Rooms & fabric'), t('heatloss', 'Results')] }],
    finish: { id: 'report', label: 'Heat loss report', sub: 'Print for the customer' },
    body: propertyBody,
  },
  survey: {
    nav: [{ group: 'Site survey', tabs: [t('overview', 'Overview'), t('plan', 'Floor plan'), t('rooms', 'Rooms & fabric'), t('equipment', 'Existing equipment')] }],
    finish: { id: 'survey-report', label: 'Survey summary', sub: 'Print or send' },
    body: propertyBody,
  },
  materials: {
    nav: [{ group: 'Pipe runs & materials', tabs: [t('overview', 'Overview'), t('pipework', 'Pipe runs & Kv'), t('equipment', 'Equipment'), t('pricing', 'Materials & quote')] }],
    finish: { id: 'merchant', label: 'Merchant request', sub: 'Send for prices' },
    body: propertyBody,
  },
  plantroom: {
    nav: [{ group: 'Plant room', tabs: [t('overview', 'Overview'), t('plant', 'Sources & circuits'), t('header', 'Header & pumps')] }],
    finish: { id: 'sheet', label: 'Design sheet', sub: 'Print for the job' },
    body: (tab) => (tab === 'plant' ? <PlantDesignTab /> : tab === 'header' ? <PlantHeaderTab /> : tab === 'sheet' ? <PlantSheetTab /> : <PlantOverviewTab />),
  },
  pool: {
    nav: [{ group: 'Pool heating', tabs: [t('overview', 'Overview'), t('pool', 'Pool')] }],
    finish: { id: 'sheet', label: 'Design sheet', sub: 'Print for the job' },
    body: (tab) => (tab === 'pool' ? <PoolDesignTab /> : tab === 'sheet' ? <PoolSheetTab /> : <PoolOverviewTab />),
  },
  dhw: {
    nav: [{ group: 'Hot water', tabs: [t('overview', 'Overview'), t('dhw', 'Hot water')] }],
    finish: { id: 'sheet', label: 'Design sheet', sub: 'Print for the job' },
    body: (tab) => (tab === 'dhw' ? <DhwDesignTab /> : tab === 'sheet' ? <DhwSheetTab /> : <DhwOverviewTab />),
  },
};

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

  const module = moduleOf(project);
  const info = moduleInfo(module);
  const setup = SETUPS[module] ?? SETUPS.heating;
  const summary =
    module === 'plantroom'
      ? plantKwSummary(project)
      : module === 'pool'
        ? poolSummary(project)
        : module === 'dhw'
          ? { ...dhwSummary(project), value: undefined }
          : { label: 'Design heat loss', value: loss.totalW / 1000, sub: `${project.rooms.length} rooms · ${fmt(loss.area, 0)} m² · ${project.settings.externalTemp} °C outside` };

  const upgrade = async () => {
    if (!(await ask.confirm(`Open “${project.name}” as a whole property project? Everything entered so far is kept, and the full survey → design → pricing → handover menu appears.`))) return;
    ctx.update((d) => void (d.module = 'heating'));
  };

  return (
    <ProjectCtx.Provider value={ctx}>
      <div className="project">
        <aside className="sidebar no-print">
          <a href={`#/m/${module}`} className="back">
            ← {info?.name}
          </a>
          <h2>{project.name}</h2>
          <p className="muted small">{project.customer.name || 'No customer'}</p>
          <div className="side-total">
            <span>{summary.label}</span>
            <strong>{summary.value === undefined ? summary.sub.split(' · ')[0] : `${fmt(summary.value, 2)} kW`}</strong>
            <small>{summary.value === undefined ? summary.sub.split(' · ').slice(1).join(' · ') : summary.sub}</small>
          </div>
          <nav>
            {setup.nav.map((g) => (
              <div key={g.group} className="nav-group">
                <h5>{g.group}</h5>
                {g.tabs.map((x) => (
                  <a key={x.id} href={`#/p/${project.id}/${x.id}`} className={tab === x.id ? 'on' : ''}>
                    {x.label}
                  </a>
                ))}
              </div>
            ))}
            <a href={`#/p/${project.id}/${setup.finish.id}`} className={`finish ${tab === setup.finish.id ? 'on' : ''}`}>
              <span className="tick" aria-hidden="true">
                ✓
              </span>
              <span>
                {setup.finish.label}
                <small>{setup.finish.sub}</small>
              </span>
            </a>
            {info?.partOfProperty && (
              <button className="upgrade" onClick={upgrade}>
                Open as whole property project →
              </button>
            )}
          </nav>
        </aside>
        <div className="content">{setup.body(tab)}</div>
      </div>
    </ProjectCtx.Provider>
  );
}
