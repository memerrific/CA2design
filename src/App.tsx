import { useEffect, useState } from 'react';
import { ProjectsPage } from './pages/Projects';
import { ProjectView } from './pages/ProjectView';
import { SettingsPage } from './pages/Settings';
import { useStore } from './store';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export const go = (path: string) => {
  window.location.hash = '/' + path;
};

export default function App() {
  const parts = useHash();
  const { projects, company } = useStore();

  let page;
  if (parts[0] === 'p' && parts[1]) {
    const project = projects.find((p) => p.id === parts[1]);
    page = project ? <ProjectView project={project} tab={parts[2] ?? 'overview'} /> : <p className="empty">Project not found.</p>;
  } else if (parts[0] === 'settings') {
    page = <SettingsPage />;
  } else {
    page = <ProjectsPage />;
  }

  return (
    <div className="shell">
      <header className="topbar no-print">
        <a className="brand" href="#/">
          <img src={company.logoDataUrl || './logo.png'} alt="" />
          <span>
            Designer
          </span>
        </a>
        <nav>
          <a href="#/" className={!parts[0] || parts[0] === 'p' ? 'on' : ''}>
            Projects
          </a>
          <a href="#/settings" className={parts[0] === 'settings' ? 'on' : ''}>
            Branding
          </a>
        </nav>
      </header>
      <main>{page}</main>
    </div>
  );
}
