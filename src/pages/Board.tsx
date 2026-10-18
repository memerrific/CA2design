import { useState, type DragEvent } from 'react';
import { go } from '../App';
import { demoFor } from '../data/demo';
import { defaultDhw } from '../data/dhwDefaults';
import { newProject, uid } from '../engine/factory';
import { projectHeatLoss } from '../engine/heatloss';
import type { ModuleId, Project } from '../engine/model';
import { analysePlant, defaultPlantRoom } from '../engine/plant';
import { analysePool, defaultPoolInputs } from '../engine/pool';
import { MODULES, moduleInfo, moduleOf, STAGES, stageOf, type StageId } from '../modules';
import { downloadJson, store, useStore } from '../store';
import { ask } from '../ui/dialog';
import { fmt } from '../ui/fields';
import { Icon } from '../ui/icons';

export function newProjectFor(module: ModuleId): Project {
  const p = newProject('New project');
  p.module = module;
  if (module === 'pool') p.pool = defaultPoolInputs();
  if (module === 'dhw') p.dhw = defaultDhw();
  if (module === 'plantroom') {
    p.plant = defaultPlantRoom();
    p.systemType = 'Multi-boiler plant room';
    p.settings.flowTemp = 80;
    p.settings.deltaT = 20;
  }
  return p;
}

export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

export function BoardPage({ module }: { module?: ModuleId }) {
  const { projects } = useStore();
  const [view, setView] = useState<View>('board');
  const [section, setSection] = useState<string>('');
  const [query, setQuery] = useState('');
  const [newMenu, setNewMenu] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const info = module ? moduleInfo(module) : undefined;
  const moduleFilter = module ?? section;

  const visible = projects.filter(
    (p) =>
      (!moduleFilter || moduleOf(p) === moduleFilter) &&
      (!query || `${p.name} ${p.customer.name} ${p.customer.postcode} ${p.reference}`.toLowerCase().includes(query.toLowerCase())),
  );
  const active = visible.filter((p) => stageOf(p) !== 'archived');
  const byStage = (s: StageId) => visible.filter((p) => stageOf(p) === s);

  const create = (m: ModuleId) => {
    setNewMenu(false);
    const p = newProjectFor(m);
    store.upsertProject(p);
    go(`p/${p.id}/overview`);
  };

  const loadExamples = () => {
    const mods: ModuleId[] = module ? [module] : ['heating', 'plantroom', 'pool', 'dhw'];
    const stages: StageId[] = ['survey', 'design', 'quote', 'enquiry'];
    mods.forEach((m, i) => {
      const p = demoFor(m);
      p.stage = stages[i % stages.length];
      store.upsertProject(p);
    });
  };

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
        <h1>{info ? info.name : 'All projects'}</h1>
        <div className="bd-actions">
          <div className="bd-new">
            <button className="btn-black" onClick={() => (module ? create(module) : setNewMenu(!newMenu))}>
              <Icon name="plus" size={16} /> New project
            </button>
            {newMenu && <div className="sb-backdrop" onClick={() => setNewMenu(false)} />}
            {newMenu && (
              <div className="sb-menu right" role="menu">
                <p>What are you starting?</p>
                {MODULES.filter((m) => m.live).map((m) => (
                  <button key={m.id} role="menuitem" onClick={() => create(m.id as ModuleId)}>
                    <Icon name={String(m.id)} />
                    <span>
                      <b>{m.name}</b>
                      <small>{m.blurb}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <details className="bd-more">
            <summary aria-label="More actions">
              <Icon name="dots" />
            </summary>
            <div className="sb-menu right" onClick={(e) => ((e.currentTarget.closest('details') as HTMLDetailsElement).open = false)}>
              <button onClick={loadExamples}>
                <Icon name="plusCircle" />
                <span>
                  <b>Load examples</b>
                  <small>Example projects to explore{info ? ` in ${info.name}` : ''}.</small>
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

      {info && <p className="bd-sub">{info.blurb}</p>}

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
        {!module && (
          <select className="bd-filter" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Filter by section">
            <option value="">+ Filter by section</option>
            {MODULES.filter((m) => m.live).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 && (
        <div className="bd-empty">
          <h2>{projects.length ? 'Nothing matches' : 'No projects yet'}</h2>
          <p>{projects.length ? 'Try clearing the search or filter.' : 'Start a new project, or load some examples to see how it works.'}</p>
          {!projects.length && (
            <div className="bd-actions">
              <button className="btn-black" onClick={() => (module ? create(module) : setNewMenu(true))}>
                <Icon name="plus" size={16} /> New project
              </button>
              <button className="btn-line" onClick={loadExamples}>
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
                {items.length === 0 && <p className="bd-drop">Drop projects here</p>}
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
                <th>Project</th>
                <th>Section</th>
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
                const m = moduleInfo(moduleOf(p));
                return (
                  <tr key={p.id} onClick={() => go(`p/${p.id}/overview`)}>
                    <td>
                      <b>{p.name}</b>
                      {p.customer.name && <small>{p.customer.name}</small>}
                    </td>
                    <td>
                      <span className={`tag t-${moduleOf(p)}`}>
                        <Icon name={moduleOf(p)} size={13} />
                        {m?.short}
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
          {listRows.length === 0 && <p className="bd-drop">No projects here.</p>}
        </div>
      )}
    </div>
  );
}

function Card({ p, onMove }: { p: Project; onMove: (p: Project, s: StageId) => void }) {
  const m = moduleOf(p);
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
        <span className={`tag t-${m}`}>
          <Icon name={m} size={13} />
          {moduleInfo(m)?.short}
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
