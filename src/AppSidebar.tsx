import { currentAccount, initials, scopedKey } from './account';
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
      return localStorage.getItem(scopedKey('rail')) === '1';
    } catch {
      return false;
    }
  });
  const setRail = (v: boolean) => {
    setRailState(v);
    try {
      localStorage.setItem(scopedKey('rail'), v ? '1' : '0');
    } catch {
      /* not saved */
    }
  };
  const at = (path: string) => route.join('/') === path;
  const live = projects.filter((p) => p.stage !== 'archived');
  const open = live.length;
  const count = (id: string) => live.filter((p) => jobTypeOf(p).category === id).length;

  const importFile = async (file: File) => {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(file, 'text'));
    } catch {
      void ask.alert(`“${file.name}” isn’t a CA2 Designer backup or job file. Choose a .json file saved from Back up all projects or a job’s Export file.`);
      return;
    }
    const list = (Array.isArray(data) ? data : [data]) as Project[];
    const valid = list.filter((p) => p && typeof p === 'object' && typeof p.id === 'string' && Array.isArray(p.rooms));
    if (!valid.length) {
      void ask.alert(list.length ? 'No CA2 Designer jobs were found in that file.' : 'That file has no jobs in it.');
      return;
    }
    for (const p of valid) {
      const clash = store.get().projects.some((x) => x.id === p.id);
      store.upsertProject(clash ? { ...p, id: uid(), name: `${p.name} (imported)` } : p);
    }
    const skipped = list.length - valid.length;
    void ask.alert(`Imported ${valid.length} job${valid.length === 1 ? '' : 's'}.${skipped ? ` ${skipped} item${skipped === 1 ? ' was' : 's were'} skipped because ${skipped === 1 ? 'it isn’t a' : 'they aren’t'} CA2 Designer job${skipped === 1 ? '' : 's'}.` : ''}`);
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
          <Item href="#/settings" icon="gear" label="Settings" on={route[0] === 'settings' && route[1] !== 'account'} />
        </div>
      </nav>

      <div className="sb-foot">
        {currentAccount && (
          <a href="#/settings/account" className={`sb-item sb-me ${route[0] === 'settings' && route[1] === 'account' ? 'on' : ''}`} title={rail ? `${currentAccount.name} · ${currentAccount.email}` : undefined}>
            <i>{initials(currentAccount.name)}</i>
            <span className="sb-label">
              <b>{currentAccount.name}</b>
              <small>{currentAccount.email}</small>
            </span>
          </a>
        )}
        <label className="sb-item" title={rail ? 'Import projects' : undefined}>
          <Icon name="upload" />
          <span className="sb-label">Import projects</span>
          <input type="file" accept=".json,application/json" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importFile(f);
            }} />
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
