import { useState } from 'react';
import { uid } from './engine/factory';
import type { Project } from './engine/model';
import { CATEGORIES, jobTypeOf } from './jobs';
import { downloadJson, readFile, store, useStore } from './store';
import { ask } from './ui/dialog';
import { Icon } from './ui/icons';

/** Left navigation. Collapses to an icon rail (remembered per browser). */
export function AppSidebar({ route }: { route: string[] }) {
  const { projects, company } = useStore();
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
  const at = (path: string) => route.join('/') === path;
  const live = projects.filter((p) => p.stage !== 'archived');
  const open = live.length;
  const count = (id: string) => live.filter((p) => jobTypeOf(p).category === id).length;

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
          <Item href="#/" icon="home" label="Home" on={route.length === 0} />
          <Item href="#/jobs" icon="board" label="Jobs" on={route[0] === 'jobs'} badge={open} />
          <Item href="#/new" icon="plusCircle" label="New job" on={route[0] === 'new'} />
        </div>
        <div className="sb-group">
          <h6>Categories</h6>
          {CATEGORIES.map((c) => (
            <Item key={c.id} href={`#/c/${c.id}`} icon={c.icon} label={c.name} on={route[0] === 'c' && route[1] === c.id} badge={c.id === 'business' ? undefined : count(c.id)} />
          ))}
        </div>
        <div className="sb-group">
          <h6>More</h6>
          <Item href="#/prices" icon="coins" label="Price list" on={at('prices')} />
          <Item href="#/methods" icon="book" label="Methods & sources" on={at('methods')} />
          <Item href="#/settings" icon="gear" label="Settings & branding" on={route[0] === 'settings'} />
        </div>
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
