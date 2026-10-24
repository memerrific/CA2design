import { go } from '../App';
import { demoFor } from '../data/demo';
import { projectHeatLoss } from '../engine/heatloss';
import type { ModuleId, Project } from '../engine/model';
import { CATEGORIES, categoryInfo, JOB_TYPES, jobTypeOf, STEPS, type CategoryId, type JobType } from '../jobs';
import { STAGES, stageOf } from '../modules';
import { applyJobType, newProjectFor } from '../newJob';
import { store, useStore } from '../store';
import { Explain } from '../ui/explain';
import { Icon } from '../ui/icons';
import { stepDone } from './SidePanels';
import { timeAgo } from '../ui/time';

export function startJob(jobId: string) {
  const p = newProjectFor(jobId);
  store.upsertProject(p);
  go(`p/${p.id}/overview`);
}

/** Example jobs: one of the given type, or a spread across the app. */
export function loadExamples(job?: JobType) {
  const mods: ModuleId[] = job ? [job.module] : ['heating', 'plantroom', 'pool', 'dhw'];
  const stages = ['survey', 'design', 'quote', 'enquiry'];
  mods.forEach((m, i) => {
    const p = demoFor(m);
    if (job) applyJobType(p, job.id);
    p.stage = stages[i % stages.length];
    store.upsertProject(p);
  });
}

/** The first step of a job that still needs doing. */
export function nextStep(p: Project): { id: string; label: string } {
  const job = jobTypeOf(p);
  const loss = projectHeatLoss(p);
  const id = job.steps.find((s) => !stepDone(s, p, loss)) ?? job.finish;
  return { id, label: STEPS[id]?.label ?? 'Overview' };
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export function HomePage() {
  const { projects, company } = useStore();
  const open = projects.filter((p) => stageOf(p) !== 'archived');
  const count = (ids: string[]) => open.filter((p) => ids.includes(stageOf(p))).length;
  const recent = [...open].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  return (
    <div className="pg">
      <header className="pg-head">
        <div>
          <p className="pg-crumb">{company.name}</p>
          <h1>{greeting()}</h1>
        </div>
        <div className="pg-actions">
          <a className="btn-primary" href="#/new">
            <Icon name="plus" size={16} /> New job
          </a>
        </div>
      </header>

      <Explain id="home">
        Pick a category to start a job, or carry on with one below. Each job type only shows the steps it needs, and every step works on the same
        building, so you can change a job’s type later without losing anything. Everything is saved on this device; use <b>Back up all projects</b> in the
        sidebar to move it to another one.
      </Explain>

      <div className="kpis">
        <div className="kpi">
          <span>Open jobs</span>
          <b>{open.length}</b>
        </div>
        <div className="kpi">
          <span>Enquiry & quote</span>
          <b>{count(['enquiry', 'quote'])}</b>
        </div>
        <div className="kpi">
          <span>Survey & design</span>
          <b>{count(['survey', 'design'])}</b>
        </div>
        <div className="kpi">
          <span>Install & handover</span>
          <b>{count(['proposal', 'install', 'handover'])}</b>
        </div>
      </div>

      <h2 className="pg-h2">Start something</h2>
      <div className="cats">
        {CATEGORIES.map((c) => {
          const jobs = JOB_TYPES.filter((j) => j.category === c.id);
          const live = jobs.filter((j) => j.live);
          const n = open.filter((p) => jobTypeOf(p).category === c.id).length;
          return (
            <a key={c.id} className="cat-tile" href={`#/c/${c.id}`}>
              <span className="cat-ic">
                <Icon name={c.icon} size={22} />
              </span>
              <span className="cat-name">
                {c.name}
                {n > 0 && <span className="pill">{n} open</span>}
                {c.id !== 'business' && live.length === 0 && <span className="pill soon">Coming soon</span>}
              </span>
              <span className="cat-blurb">{c.blurb}</span>
              {c.id !== 'business' && (
                <span className="cat-jobs">
                  {jobs.slice(0, 5).map((j) => (
                    <span key={j.id} className={j.live ? '' : 'soon'}>
                      {j.short}
                    </span>
                  ))}
                  {jobs.length > 5 && <span>+{jobs.length - 5} more</span>}
                </span>
              )}
            </a>
          );
        })}
      </div>

      <h2 className="pg-h2">Carry on</h2>
      {recent.length === 0 ? (
        <div className="empty-box">
          <b>No jobs yet</b>
          <p>Start one from a category above, or load some examples to see how it works.</p>
          <div className="pg-actions">
            <a className="btn-primary" href="#/new">
              <Icon name="plus" size={16} /> New job
            </a>
            <button className="btn-line" onClick={() => loadExamples()}>
              Load examples
            </button>
          </div>
        </div>
      ) : (
        <div className="rows">
          {recent.map((p) => (
            <JobRow key={p.id} p={p} />
          ))}
          <a className="rows-more" href="#/jobs">
            All jobs <Icon name="chevronRight" size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

function JobRow({ p }: { p: Project }) {
  const job = jobTypeOf(p);
  const next = nextStep(p);
  return (
    <a className="row" href={`#/p/${p.id}/${next.id}`}>
      <span className="row-ic">
        <Icon name={job.icon} />
      </span>
      <span className="row-main">
        <b>{p.name}</b>
        <small>{[p.customer.postcode?.toUpperCase(), job.name].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="pill stage">{STAGES.find((s) => s.id === stageOf(p))?.name ?? 'Archived'}</span>
      <span className="row-next">
        <small>Next</small>
        {next.label}
      </span>
      <span className="row-time">{timeAgo(p.updatedAt)}</span>
    </a>
  );
}

export function JobTypeCard({ job, compact }: { job: JobType; compact?: boolean }) {
  const steps = job.steps.length + 1;
  const body = (
    <>
      <span className="jt-ic">
        <Icon name={job.icon} size={20} />
      </span>
      <span className="jt-text">
        <b>{job.name}</b>
        {!compact && <span>{job.blurb}</span>}
        <small>{job.live ? `${steps} steps · ends with ${STEPS[job.finish]?.label}` : 'Coming soon'}</small>
      </span>
      {job.live ? (
        <span className="jt-go" aria-hidden="true">
          <Icon name="chevronRight" />
        </span>
      ) : (
        <span className="pill soon">Soon</span>
      )}
    </>
  );
  return job.live ? (
    <button className={`jt ${compact ? 'compact' : ''}`} onClick={() => startJob(job.id)} title={`Start a new ${job.name} job`}>
      {body}
    </button>
  ) : (
    <div className={`jt soon ${compact ? 'compact' : ''}`}>{body}</div>
  );
}

const BUSINESS_LINKS = [
  { href: '#/jobs', icon: 'board', name: 'Job board', blurb: 'Every job by stage, from enquiry to handover. Drag cards to move them on.' },
  { href: '#/prices', icon: 'coins', name: 'Price list', blurb: 'Your unit costs for every item your designs have used.' },
  { href: '#/settings', icon: 'gear', name: 'Settings & branding', blurb: 'Logo, company details and how printed packs look.' },
  { href: '#/methods', icon: 'book', name: 'Methods & sources', blurb: 'Where every number comes from: standards, data tables and their limits.' },
];
const BUSINESS_SOON = ['Service & maintenance reminders', 'MCS quality system', 'Tradify link', 'Email templates'];

export function CategoryPage({ id }: { id: CategoryId }) {
  const { projects } = useStore();
  const cat = categoryInfo(id)!;
  const jobs = JOB_TYPES.filter((j) => j.category === id);
  const mine = projects.filter((p) => stageOf(p) !== 'archived' && jobTypeOf(p).category === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="pg">
      <header className="pg-head">
        <div>
          <p className="pg-crumb">
            <a href="#/">Home</a> / {cat.name}
          </p>
          <h1>{cat.name}</h1>
        </div>
      </header>
      <Explain id={`cat-${id}`}>
        {id === 'business'
          ? 'The parts of the app that are about running jobs rather than designing them.'
          : `${cat.blurb} Choose the job type that fits; it switches on only the steps that job needs. You can change the type from inside the job later and nothing is lost.`}
      </Explain>

      {id === 'business' ? (
        <>
          <div className="jts">
            {BUSINESS_LINKS.map((l) => (
              <a key={l.href} className="jt" href={l.href}>
                <span className="jt-ic">
                  <Icon name={l.icon} size={20} />
                </span>
                <span className="jt-text">
                  <b>{l.name}</b>
                  <span>{l.blurb}</span>
                </span>
                <span className="jt-go" aria-hidden="true">
                  <Icon name="chevronRight" />
                </span>
              </a>
            ))}
          </div>
          <h2 className="pg-h2">Coming soon</h2>
          <div className="soon-list">
            {BUSINESS_SOON.map((s) => (
              <span key={s} className="pill soon">
                {s}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="jts">
            {jobs.map((j) => (
              <JobTypeCard key={j.id} job={j} />
            ))}
          </div>
          {mine.length > 0 && (
            <>
              <h2 className="pg-h2">Open {cat.name.toLowerCase()} jobs</h2>
              <div className="rows">
                {mine.map((p) => (
                  <JobRow key={p.id} p={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function NewJobPage() {
  return (
    <div className="pg">
      <header className="pg-head">
        <div>
          <p className="pg-crumb">
            <a href="#/">Home</a> / New job
          </p>
          <h1>What are you starting?</h1>
        </div>
      </header>
      <Explain id="new">Pick the job type that fits best. It decides which steps appear; you can change it from inside the job later and nothing is lost.</Explain>
      {CATEGORIES.filter((c) => c.id !== 'business').map((c) => (
        <section key={c.id} className="new-cat">
          <h2 className="pg-h2">
            <Icon name={c.icon} /> {c.name}
          </h2>
          <div className="jts">
            {JOB_TYPES.filter((j) => j.category === c.id).map((j) => (
              <JobTypeCard key={j.id} job={j} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
