import { useState, type DragEvent } from 'react';
import { go } from '../App';
import { uid } from '../engine/factory';
import { projectHeatLoss } from '../engine/heatloss';
import type { Project } from '../engine/model';
import { analysePlant } from '../engine/plant';
import { analysePool, defaultPoolInputs } from '../engine/pool';
import { CATEGORIES, jobInfo, jobTypeOf } from '../jobs';
import { moduleOf, STAGES, stageOf, type StageId } from '../modules';
import { Explain } from '../ui/explain';
import { timeAgo } from '../ui/time';
import { loadExamples, startJob } from './Home';
import { downloadJson, store, useStore } from '../store';
import { ask } from '../ui/dialog';
import { fmt } from '../ui/fields';
import { Icon } from '../ui/icons';


function headline(p: Project): string {
  const m = moduleOf(p);
  if (m === 'plantroom' && p.plant) return `${fmt(analysePlant(p.plant, p.settings.fluid).connectedKw, 0)} kW plant`;
  if (m === 'pool') return `${fmt(analysePool({ ...defaultPoolInputs(), ...p.pool }).dutyKw, 1)} kW pool`;
  if (m === 'dhw') return p.dhw?.badge.capacityL ? `${p.dhw.badge.capacityL} L cylinder` : 'Hot water';
  if (m === 'materials') return `${p.pipes.length} pipe runs`;
  return p.rooms.length ? `${fmt(projectHeatLoss(p).totalW / 1000, 1)} kW · ${p.rooms.length} rooms` : 'No rooms yet';
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '–';

type View = 'board' | 'list' | StageId;

export function BoardPage({ jobType }: { jobType?: string }) {
  const { projects } = useStore();
  const [view, setView] = useState<View>('board');
  const [category, setCategory] = useState<string>('');
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const job = jobType ? jobInfo(jobType) : undefined;

  const visible = projects.filter(
    (p) =>
      (!job || jobTypeOf(p).id === job.id) &&
      (!category || jobTypeOf(p).category === category) &&
      (!query || `${p.name} ${p.customer.name} ${p.customer.postcode} ${p.reference}`.toLowerCase().includes(query.toLowerCase())),
  );
  const active = visible.filter((p) => stageOf(p) !== 'archived');
  const byStage = (s: StageId) => visible.filter((p) => stageOf(p) === s);

  const moveTo = (p: Project, stage: StageId) => store.upsertProject({ ...p, stage });

  const onDrop = (e: DragEvent, stage: StageId) => {
    e.preventDefault();
    setDragOver(null);
    const p = projects.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (p && stageOf(p) !== stage) moveTo(p, stage);
  };

  const tabs: { id: View; label: string; count: number; icon?: string }[] = [
    { id: 'board', label: 'Board', count: active.length, icon: 'board' },
    { id: 'list', label: 'List', count: active.length, icon: 'list' },
    ...STAGES.map((s) => ({ id: s.id as View, label: s.name, count: byStage(s.id).length })),
    { id: 'archived', label: 'Archived', count: byStage('archived').length },
  ];

  const listRows = view === 'list' ? active : view === 'board' ? [] : byStage(view as StageId);

  return (
    <div className="bd">
      <header className="bd-head">
        <h1>{job ? job.name : 'Jobs'}</h1>
        <div className="bd-actions">
          {job ? (
            <button className="btn-primary" onClick={() => startJob(job.id)}>
              <Icon name="plus" size={16} /> New {job.short.toLowerCase()} job
            </button>
          ) : (
            <a className="btn-primary" href="#/new">
              <Icon name="plus" size={16} /> New job
            </a>
          )}
          <details className="bd-more">
            <summary aria-label="More actions">
              <Icon name="dots" />
            </summary>
            <div className="sb-menu right" onClick={(e) => ((e.currentTarget.closest('details') as HTMLDetailsElement).open = false)}>
              <button onClick={() => loadExamples(job)}>
                <Icon name="plusCircle" />
                <span>
                  <b>Load examples</b>
                  <small>Example jobs to explore.</small>
                </span>
              </button>
              <button onClick={() => downloadJson(`ca2-designer-backup-${new Date().toISOString().slice(0, 10)}.json`, projects)}>
                <Icon name="download" />
                <span>
                  <b>Back up all projects</b>
                  <small>Save a file you can import on another device.</small>
                </span>
              </button>
            </div>
          </details>
        </div>
      </header>

      <Explain id="jobs">
        Every job by stage, from enquiry to handover. Drag a card to another column to move it on, or use its ⋯ menu. The tabs switch between the board,
        a list and each stage on its own.
      </Explain>

      <div className="bd-tabs" role="tablist">
        {tabs.map((t, i) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} className={`bd-tab ${view === t.id ? 'on' : ''} ${i === 1 ? 'sep' : ''}`} onClick={() => setView(t.id)}>
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="bd-filters">
        <input className="bd-search" type="search" placeholder="Search name, customer, postcode…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {!job && (
          <select className="bd-filter" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">+ Filter by category</option>
            {CATEGORIES.filter((c) => c.id !== 'business').map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 && (
        <div className="bd-empty">
          <h2>{projects.length ? 'Nothing matches' : 'No jobs yet'}</h2>
          <p>{projects.length ? 'Try clearing the search or filter.' : 'Start a new job, or load some examples to see how it works.'}</p>
          {!projects.length && (
            <div className="bd-actions">
              <a className="btn-primary" href="#/new">
                <Icon name="plus" size={16} /> New job
              </a>
              <button className="btn-line" onClick={() => loadExamples(job)}>
                Load examples
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'board' && visible.length > 0 && (
        <div className="bd-board">
          {STAGES.map((s) => {
            const items = byStage(s.id);
            return (
              <section
                key={s.id}
                className={`bd-col ${dragOver === s.id ? 'over' : ''}`}
                onDragOver={(e) => (e.preventDefault(), setDragOver(s.id))}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, s.id)}
              >
                <header>
                  <h3>
                    {s.name} <span>{items.length}</span>
                  </h3>
                </header>
                {items.map((p) => (
                  <Card key={p.id} p={p} onMove={moveTo} />
                ))}
                {items.length === 0 && <p className="bd-drop">Drop jobs here</p>}
              </section>
            );
          })}
        </div>
      )}

      {view !== 'board' && visible.length > 0 && (
        <div className="bd-list">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Postcode</th>
                <th>Engineer</th>
                <th>Summary</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listRows.map((p) => {
                const j = jobTypeOf(p);
                return (
                  <tr key={p.id} onClick={() => go(`p/${p.id}/overview`)}>
                    <td>
                      <b>{p.name}</b>
                      {p.customer.name && <small>{p.customer.name}</small>}
                    </td>
                    <td>
                      <span className={`tag t-${j.category}`}>
                        <Icon name={j.icon} size={13} />
                        {j.short}
                      </span>
                    </td>
                    <td>{STAGES.find((s) => s.id === stageOf(p))?.name ?? 'Archived'}</td>
                    <td>{p.customer.postcode || '–'}</td>
                    <td>{p.engineer || '–'}</td>
                    <td>{headline(p)}</td>
                    <td>{timeAgo(p.updatedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <CardMenu p={p} onMove={moveTo} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {listRows.length === 0 && <p className="bd-drop">No jobs here.</p>}
        </div>
      )}
    </div>
  );
}

function Card({ p, onMove }: { p: Project; onMove: (p: Project, s: StageId) => void }) {
  const j = jobTypeOf(p);
  return (
    <article className="bd-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)} onClick={() => go(`p/${p.id}/overview`)}>
      <header>
        <h4>{p.name}</h4>
        <span onClick={(e) => e.stopPropagation()}>
          <CardMenu p={p} onMove={onMove} />
        </span>
      </header>
      <p className="bd-meta">{timeAgo(p.updatedAt)}</p>
      {p.customer.postcode && <p className="bd-meta strong">{p.customer.postcode.toUpperCase()}</p>}
      <p className="bd-line">{headline(p)}</p>
      <div className="bd-foot">
        <span className={`tag t-${j.category}`}>
          <Icon name={j.icon} size={13} />
          {j.short}
        </span>
        {p.engineer && (
          <span className="who">
            <i>{initials(p.engineer)}</i>
            {p.engineer}
          </span>
        )}
      </div>
    </article>
  );
}

function CardMenu({ p, onMove }: { p: Project; onMove: (p: Project, s: StageId) => void }) {
  const stage = stageOf(p);
  return (
    <details className="bd-more small">
      <summary aria-label={`Actions for ${p.name}`}>
        <Icon name="dots" />
      </summary>
      <div className="sb-menu right compact" onClick={(e) => ((e.currentTarget.closest('details') as HTMLDetailsElement).open = false)}>
        <p>Move to</p>
        {STAGES.filter((s) => s.id !== stage).map((s) => (
          <button key={s.id} onClick={() => onMove(p, s.id)}>
            {s.name}
          </button>
        ))}
        {stage !== 'archived' ? (
          <button onClick={() => onMove(p, 'archived')}>
            <Icon name="archive" size={15} /> Archive
          </button>
        ) : (
          <button onClick={() => onMove(p, 'enquiry')}>Restore</button>
        )}
        <hr />
        <button
          onClick={() => {
            const c = structuredClone(p);
            c.id = uid();
            c.name = `${p.name} (copy)`;
            store.upsertProject(c);
          }}
        >
          Duplicate
        </button>
        <button onClick={() => downloadJson(`${p.name.replace(/\W+/g, '-')}.json`, p)}>Export file</button>
        <button className="danger" onClick={async () => (await ask.confirm(`Delete “${p.name}”? This cannot be undone.`, { danger: true })) && store.deleteProject(p.id)}>
          Delete
        </button>
      </div>
    </details>
  );
}
