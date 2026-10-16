import { go } from '../App';
import { newProject, uid } from '../engine/factory';
import { projectHeatLoss } from '../engine/heatloss';
import type { Project } from '../engine/model';
import { downloadJson, readFile, store, useStore } from '../store';
import { fmt } from '../ui/fields';
import { demoProject } from '../data/demo';

export function ProjectsPage() {
  const { projects } = useStore();

  const create = () => {
    const p = newProject('New project');
    store.upsertProject(p);
    go(`p/${p.id}/overview`);
  };

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await readFile(file, 'text'));
      const list: Project[] = Array.isArray(data) ? data : [data];
      for (const p of list) {
        if (!p || !p.id || !Array.isArray(p.rooms)) throw new Error('Not a CA2 Designer project file');
        const clash = projects.some((x) => x.id === p.id);
        store.upsertProject(clash ? { ...p, id: uid(), name: `${p.name} (imported)` } : p);
      }
    } catch (e) {
      alert(`Could not import: ${(e as Error).message}`);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Projects</p>
          <h1>Heating designs & handover packs</h1>
        </div>
        <div className="actions">
          <label className="btn ghost">
            Import project file
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          {projects.length > 0 && (
            <button className="btn ghost" onClick={() => downloadJson(`ca2-designer-backup-${new Date().toISOString().slice(0, 10)}.json`, projects)}>
              Back up all
            </button>
          )}
          <button className="btn" onClick={create}>
            + New project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <h2>No projects yet</h2>
          <p>
            Start a project, add rooms by hand or import a Polycam floor plan (DXF), then work through heat loss, emitters,
            underfloor, pipework and the handover pack.
          </p>
          <div className="actions">
            <button className="btn" onClick={create}>
              + New project
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                const p = demoProject();
                store.upsertProject(p);
                go(`p/${p.id}/overview`);
              }}
            >
              Load an example house
            </button>
          </div>
          <p className="muted small">Projects are saved in this browser only. Use “Back up all” to keep a copy.</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => {
            const hl = projectHeatLoss(p);
            return (
              <article key={p.id} className="project-card" onClick={() => go(`p/${p.id}/overview`)}>
                <h3>{p.name}</h3>
                <p className="muted">{[p.customer.name, p.customer.postcode].filter(Boolean).join(' · ') || 'No customer yet'}</p>
                <div className="kv">
                  <span>{p.systemType}</span>
                  <span>{p.rooms.length} rooms</span>
                  <span>{fmt(hl.totalW / 1000, 2)} kW</span>
                </div>
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="link" onClick={() => downloadJson(`${p.name.replace(/\W+/g, '-')}.json`, p)}>
                    Export
                  </button>
                  <button
                    className="link"
                    onClick={() => {
                      const copy = structuredClone(p);
                      copy.id = uid();
                      copy.name = `${p.name} (copy)`;
                      store.upsertProject(copy);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="link danger"
                    onClick={() => confirm(`Delete “${p.name}”? This cannot be undone.`) && store.deleteProject(p.id)}
                  >
                    Delete
                  </button>
                </div>
                <small className="muted">Updated {new Date(p.updatedAt).toLocaleString('en-GB')}</small>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
