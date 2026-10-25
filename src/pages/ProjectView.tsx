import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { projectHeatLoss, type ProjectLoss } from '../engine/heatloss';
import type { ModuleId, Project } from '../engine/model';
import { store } from '../store';
import { plural, fmt } from '../ui/fields';
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
import { STAGES, stageOf } from '../modules';
import { CATEGORIES, categoryInfo, JOB_TYPES, jobInfo, jobName, jobTypeOf, STEPS, type JobType } from '../jobs';
import { applyJobType } from '../newJob';
import { Explain } from '../ui/explain';
import { Icon } from '../ui/icons';
import { PoolDesignTab, PoolOverviewTab, PoolSheetTab, poolSummary } from './tools/PoolTabs';
import { DhwDesignTab, DhwOverviewTab, DhwSheetTab, dhwSummary } from './tools/DhwTabs';
import { ReportTab } from './tabs/Handover';
import { ask } from '../ui/dialog';
import { downscaleImage } from '../ui/image';
import { PlanSidePanels, stepDone } from './SidePanels';

interface Ctx {
  project: Project;
  loss: ProjectLoss;
  /** Apply a change to a copy of the project and save it. */
  update: (fn: (draft: Project) => void) => void;
}

const ProjectCtx = createContext<Ctx | null>(null);
export const useProject = () => useContext(ProjectCtx)!;

/** What each step shows. Overview and the printed sheets depend on the job's family. */
function stepBody(step: string, module: ModuleId): ReactNode {
  switch (step) {
    case 'overview':
      return module === 'plantroom' ? <PlantOverviewTab /> : module === 'pool' ? <PoolOverviewTab /> : module === 'dhw' ? <DhwOverviewTab /> : <OverviewTab />;
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
    case 'dhw':
      return <DhwDesignTab />;
    case 'equipment':
      return <EquipmentTab />;
    case 'plant':
      return <PlantDesignTab />;
    case 'header':
      return <PlantHeaderTab />;
    case 'pool':
      return <PoolDesignTab />;
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
    case 'plant-sheet':
      return <PlantSheetTab />;
    case 'pool-sheet':
      return <PoolSheetTab />;
    case 'dhw-sheet':
      return <DhwSheetTab />;
    default:
      return <OverviewTab />;
  }
}

/** The job's steps as a tick list, shown on the overview. */
function StepChecklist({ job, project, loss }: { job: JobType; project: Project; loss: ProjectLoss }) {
  const all = [...job.steps.filter((s) => s !== 'overview'), job.finish];
  return (
    <div className="page checklist-wrap">
      <ol className="checklist">
        {all.map((id) => {
          const done = id !== job.finish && stepDone(id, project, loss);
          return (
            <li key={id} className={done ? 'done' : ''}>
              <a href={`#/p/${project.id}/${id}`}>
                <span className="ck">{done && <Icon name="check" size={13} />}</span>
                <span>{STEPS[id]?.label}</span>
                <Icon name="chevronRight" size={15} />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ProjectView({ project, tab }: { project: Project; tab: string }) {
  const loss = useMemo(() => projectHeatLoss(project), [project]);
  const ctx: Ctx = {
    project,
    loss,
    update: (fn) => {
      // Start from the latest saved copy, not the one this page was drawn with:
      // after a confirm box or a lookup, an earlier save may already have landed.
      const latest = store.get().projects.find((x) => x.id === project.id) ?? project;
      const draft = structuredClone(latest);
      fn(draft);
      store.upsertProject(draft);
    },
  };

  const job = jobTypeOf(project);
  const module = job.module;
  const cat = categoryInfo(job.category);
  // Old links used 'sheet' for every tool's printout. A step this job type doesn't have
  // (after changing type, or an old link) opens the overview instead.
  const asked = tab === 'sheet' ? job.finish : tab;
  const step = asked === 'overview' || job.steps.includes(asked) || asked === job.finish ? asked : 'overview';
  useEffect(() => {
    if (step !== tab) window.location.replace(`#/p/${project.id}/${step}`);
  }, [step, tab, project.id]);
  const def = STEPS[step];
  const summary =
    module === 'plantroom'
      ? plantKwSummary(project)
      : module === 'pool'
        ? poolSummary(project)
        : module === 'dhw'
          ? { ...dhwSummary(project), value: undefined }
          : { label: 'Design heat loss', value: loss.totalW / 1000, sub: `${plural(project.rooms.length, 'room')} · ${fmt(loss.area, 0)} m² · ${project.settings.externalTemp} °C outside` };

  const changeType = async (id: string) => {
    const next = jobInfo(id);
    if (!next || next.id === job.id) return;
    if (!(await ask.confirm(`Change “${project.name}” to ${next.name}? Everything entered so far is kept; the steps change to suit the new job type.`))) return;
    ctx.update((d) => applyJobType(d, next.id));
  };

  const address = [project.customer.address.split('\n')[0], project.customer.postcode].filter(Boolean).join(', ');
  const total = summary.value === undefined ? summary.sub.split(' · ')[0] : `${fmt(summary.value, 2)} kW`;

  return (
    <ProjectCtx.Provider value={ctx}>
      <div className="project">
        <header className="pj-head no-print">
          <a href={`#/c/${job.category}`} className="pj-back" aria-label={`Back to ${cat?.name}`} title={`Back to ${cat?.name}`}>
            <Icon name="back" />
          </a>
          <label className={`pj-photo ${project.photo ? '' : 'empty'}`} title={project.photo ? 'Change property photo' : 'Add property photo'}>
            {project.photo ? <img src={project.photo} alt="" /> : <Icon name={job.icon} />}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  const url = await downscaleImage(f, 900);
                  ctx.update((d) => void (d.photo = url));
                }
              }}
            />
          </label>
          <div className="pj-title">
            <p className="pg-crumb">
              <a href={`#/c/${job.category}`}>{cat?.name}</a> / {job.name}
            </p>
            <h1>{jobName(project)}</h1>
            <p>{address || project.customer.name || 'No address yet'}</p>
          </div>
          <div className="pj-total" title={summary.sub}>
            <small>{summary.label}</small>
            <b>{total}</b>
          </div>
          <div className="pj-actions">
            <select className="pj-stage" value={stageOf(project)} onChange={(e) => ctx.update((d) => void (d.stage = e.target.value))} aria-label="Job stage">
              {STAGES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
              <option value="archived">Archived</option>
            </select>
            <select className="pj-stage" value={job.id} onChange={(e) => changeType(e.target.value)} aria-label="Job type" title="Change job type">
              {CATEGORIES.filter((c) => c.id !== 'business').map((c) => {
                const live = JOB_TYPES.filter((j) => j.category === c.id && j.live);
                return live.length ? (
                  <optgroup key={c.id} label={c.name}>
                    {live.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
            <a href={`#/p/${project.id}/${job.finish}`} className={`btn-primary ${step === job.finish ? 'on' : ''}`}>
              <Icon name="download" size={16} /> {STEPS[job.finish]?.label}
            </a>
          </div>
        </header>
        <nav className="pj-tabs no-print" aria-label="Job steps">
          {job.steps.map((id, i) => {
            const done = stepDone(id, project, loss);
            return (
              <a key={id} href={`#/p/${project.id}/${id}`} className={`pj-tab ${step === id ? 'on' : ''} ${done ? 'done' : ''}`} aria-current={step === id ? 'page' : undefined}>
                <span className="pj-n">{done ? <Icon name="check" size={12} /> : i + 1}</span>
                {STEPS[id]?.label}
              </a>
            );
          })}
        </nav>
        {def && (
          <div className="pj-explain">
            <Explain id={`step-${step}`}>{def.explain}</Explain>
            {step === 'overview' && job.note && <p className="pj-note">{job.note}</p>}
          </div>
        )}
        {step === 'overview' && <StepChecklist job={job} project={project} loss={loss} />}
        {step === 'plan' ? (
          <div className="pj-plan">
            <aside className="pj-plan-side no-print">
              <PlanSidePanels />
            </aside>
            <div className="content">{stepBody(step, module)}</div>
          </div>
        ) : (
          <div className="content">{stepBody(step, module)}</div>
        )}
      </div>
    </ProjectCtx.Provider>
  );
}
