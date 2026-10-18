import { go } from '../App';
import { newProject } from '../engine/factory';
import { projectHeatLoss } from '../engine/heatloss';
import type { ModuleId } from '../engine/model';
import { analysePlant } from '../engine/plant';
import { MODULES, moduleInfo, moduleOf } from '../modules';
import { store, useStore } from '../store';
import { fmt } from '../ui/fields';

// Simple line icons per section (24 × 24, stroke = currentColor).
const ICONS: Record<string, string> = {
  heating: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  heatloss: 'M12 3v10M8 9a4 4 0 1 0 8 0M12 21a4 4 0 0 0 4-4H8a4 4 0 0 0 4 4z',
  survey: 'M4 4h16v16H4zM4 10h16M10 4v16',
  materials: 'M3 8h18M3 16h18M7 4v8M17 12v8',
  plantroom: 'M4 20V8l4-4h8l4 4v12M9 20v-6h6v6M8 9h8',
  pool: 'M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5S16 18 18 18s2-1.5 4-1.5M2 13c2 0 2-1.5 4-1.5S8 13 10 13s2-1.5 4-1.5S16 13 18 13M8 11V5a2 2 0 0 1 4 0',
  dhw: 'M7 3h10v18H7zM7 8h10M12 12v5M10 14l2-2 2 2',
  aircon: 'M3 6h18v6H3zM6 15c0 2 1 3 1 5M12 15v5M18 15c0 2-1 3-1 5',
  solar: 'M3 20l3-10h12l3 10zM9 10l-1 10M15 10l1 10M4 15h16M12 2v4',
  oil: 'M6 8h12v12H6zM9 8V5h6v3M9 14h6',
  service: 'M14 6l4 4-8 8H6v-4zM12 8l4 4',
};

function Icon({ id }: { id: string }) {
  return (
    <span className="mod-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={ICONS[id] ?? ICONS.heating} />
      </svg>
    </span>
  );
}

export function HomePage() {
  const { projects, company } = useStore();
  const recent = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const property = MODULES.find((m) => m.id === 'heating')!;
  const tools = MODULES.filter((m) => m.group === 'tool');
  const planned = MODULES.filter((m) => m.group === 'planned');

  const kwDesigned = projects.reduce((a, p) => {
    const m = moduleOf(p);
    if (m === 'plantroom' && p.plant) return a + analysePlant(p.plant, p.settings.fluid).connectedKw;
    if (m === 'heating' || m === 'heatloss') return a + projectHeatLoss(p).totalW / 1000;
    return a;
  }, 0);

  const start = (module: ModuleId) => {
    const p = newProject('New project');
    p.module = module;
    store.upsertProject(p);
    go(`p/${p.id}/overview`);
  };

  return (
    <div className="hub">
      <section className="hub-hero">
        <div className="hub-wrap hub-hero-grid">
          <div>
            <p className="eyebrow">{company.name} · Designer</p>
            <h1>
              Design it right.
              <br />
              <em>Prove it</em> on paper.
            </h1>
            <p className="hub-lede">Survey, heat loss, emitters, plant rooms and pricing in one place, ending in a handover pack with your name on it.</p>
          </div>
          <div className="hub-stats">
            <div>
              <span>Projects</span>
              <b>{projects.length}</b>
            </div>
            <div>
              <span>kW designed</span>
              <b>{fmt(kwDesigned)}</b>
            </div>
            <div>
              <span>Sections live</span>
              <b>{MODULES.filter((m) => m.live).length}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="hub-wrap hub-main">
        <div className="hub-start">
          <p className="eyebrow">Start here</p>
          <h2>{property.name}</h2>
          <p>{property.blurb}</p>
          <div className="hub-steps">
            <span>Survey</span>
            <span>Heat loss</span>
            <span>Design</span>
            <span>Pricing</span>
            <span>Handover ✓</span>
          </div>
          <div className="hub-actions">
            <button className="hub-btn" onClick={() => start('heating')}>
              New property project →
            </button>
            <a href="#/m/heating" className="hub-link">
              Open property projects
            </a>
          </div>
        </div>
        <div className="hub-recent">
          <h3>Pick up where you left off</h3>
          {recent.length === 0 && <p className="muted">Your recent projects will show here. Try an example from any section.</p>}
          {recent.map((p) => {
            const m = moduleOf(p);
            return (
              <a key={p.id} href={`#/p/${p.id}/overview`} className="hub-r">
                <Icon id={m} />
                <span>
                  <b>{p.name}</b>
                  <small>{moduleInfo(m)?.short}</small>
                </span>
                <small>{new Date(p.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small>
              </a>
            );
          })}
        </div>
      </section>

      <section className="hub-wrap hub-tools">
        <h3>Tools · use on their own or inside a project</h3>
        <div className="hub-grid">
          {tools.map((m) => (
            <a key={m.id} href={`#/m/${m.id}`} className="hub-t">
              <Icon id={m.id} />
              <h4>{m.name}</h4>
              <p>{m.blurb}</p>
              <small>
                {(() => {
                  const n = projects.filter((p) => moduleOf(p) === m.id).length;
                  return `${n} project${n === 1 ? '' : 's'}${m.partOfProperty ? ' · part of a property project' : ''}`;
                })()}
              </small>
            </a>
          ))}
          {planned.map((m) => (
            <div key={m.id} className="hub-t soon">
              <span className="hub-tag">Planned</span>
              <h4>{m.name}</h4>
              <p>{m.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
