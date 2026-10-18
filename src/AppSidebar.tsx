import { useEffect, useState } from 'react';
import { go } from './App';
import { uid } from './engine/factory';
import type { Project } from './engine/model';
import { MODULES, moduleOf } from './modules';
import { newProjectFor } from './pages/Board';
import { downloadJson, readFile, store, useStore } from './store';
import { ask } from './ui/dialog';
import { Icon } from './ui/icons';

/** Left navigation. Collapses to an icon rail (remembered per browser). */
export function AppSidebar({ route }: { route: string[] }) {
  const { projects, company } = useStore();
  const [menu, setMenu] = useState<number | null>(null);
  const [rail, setRailState] = useState(() => {
    try {
      return localStorage.getItem('ca2d.rail') === '1';
    } catch {
      return false;
    }
  });
  const setRail = (v: boolean) => {
    setRailState(v);
    try {
      localStorage.setItem('ca2d.rail', v ? '1' : '0');
    } catch {
      /* not saved */
    }
  };
  const path = route.join('/');
  useEffect(() => setMenu(null), [path]);
  const live = MODULES.filter((m) => m.live);
  const planned = MODULES.filter((m) => !m.live);
  const at = (path: string) => route.join('/') === path;
  const count = (id: string) => projects.filter((p) => moduleOf(p) === id && p.stage !== 'archived').length;

  const create = (module: string) => {
    setMenu(null);
    const p = newProjectFor(module as Project['module'] & string);
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
      void ask.alert(`Imported ${list.length} project${list.length === 1 ? '' : 's'}.`);
    } catch (e) {
      void ask.alert(`Could not import: ${(e as Error).message}`);
    }
  };

  const Item = ({ href, icon, label, on, badge }: { href: string; icon: string; label: string; on: boolean; badge?: number }) => (
    <a href={href} className={`sb-item ${on ? 'on' : ''}`} title={rail ? label : undefined}>
      <Icon name={icon} />
      <span className="sb-label">{label}</span>
      {badge !== undefined && badge > 0 && <span className="sb-badge">{badge}</span>}
    </a>
  );

  return (
    <aside className={`app-sb no-print ${rail ? 'rail' : ''}`}>
      <a className="sb-company" href="#/" title={company.name}>
        <span className="sb-logo">
          <img src={company.logoDataUrl || './logo.png'} alt="" />
        </span>
        <span className="sb-label">
          <b>{company.name}</b>
          <small>Designer</small>
        </span>
      </a>
      <button className="sb-collapse" onClick={() => setRail(!rail)} aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'} title={rail ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Icon name="sidebar" />
      </button>

      <nav className="sb-nav">
        <div className="sb-group">
          <h6>Projects</h6>
          <Item href="#/" icon="board" label="All projects" on={route.length === 0 || at('list')} badge={projects.filter((p) => p.stage !== 'archived').length} />
          <div className="sb-new">
            <button className={`sb-item ${menu !== null ? 'on' : ''}`} onClick={(e) => setMenu(menu === null ? e.currentTarget.getBoundingClientRect().top : null)} title={rail ? 'New project' : undefined}>
              <Icon name="plusCircle" />
              <span className="sb-label">New project</span>
            </button>
            {menu !== null && <div className="sb-backdrop" onClick={() => setMenu(null)} />}
            {menu !== null && (
              <div className="sb-menu side" role="menu" style={{ top: menu }}>
                <p>What are you starting?</p>
                {live.map((m) => (
                  <button key={m.id} role="menuitem" onClick={() => create(String(m.id))}>
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
        </div>

        <div className="sb-group">
          <h6>Sections</h6>
          {live.map((m) => (
            <Item key={m.id} href={`#/m/${m.id}`} icon={String(m.id)} label={m.short === 'Property' ? 'Whole property' : m.name} on={route[0] === 'm' && route[1] === m.id} badge={count(String(m.id))} />
          ))}
        </div>

        <div className="sb-group">
          <h6>More</h6>
          <Item href="#/prices" icon="coins" label="Price list" on={at('prices')} />
          <Item href="#/methods" icon="book" label="Methods & sources" on={at('methods')} />
          <Item href="#/settings" icon="gear" label="Settings & branding" on={at('settings')} />
        </div>
        {!rail && (
          <details className="sb-group sb-soon">
            <summary className="sb-item">
              <Icon name="clock" />
              <span className="sb-label">Coming soon</span>
              <span className="sb-badge">{planned.length}</span>
            </summary>
            {planned.map((m) => (
              <span key={m.id} className="sb-item soon">
                <Icon name={String(m.id)} />
                <span className="sb-label">{m.name}</span>
              </span>
            ))}
          </details>
        )}
      </nav>

      <div className="sb-foot">
        <label className="sb-item" title={rail ? 'Import projects' : undefined}>
          <Icon name="upload" />
          <span className="sb-label">Import projects</span>
          <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
        <button
          className="sb-item"
          title={rail ? 'Back up all projects' : undefined}
          onClick={() => downloadJson(`ca2-designer-backup-${new Date().toISOString().slice(0, 10)}.json`, projects)}
        >
          <Icon name="download" />
          <span className="sb-label">Back up all projects</span>
        </button>
      </div>
    </aside>
  );
}
