import { useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { BoardPage } from './pages/Board';
import { PricesPage } from './pages/Prices';
import { MethodsPage } from './pages/Methods';
import { moduleInfo } from './modules';
import type { ModuleId } from './engine/model';
import { ProjectView } from './pages/ProjectView';
import { SettingsPage } from './pages/Settings';
import { Dialogs } from './ui/dialog';
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
  const { projects } = useStore();

  let page;
  if (parts[0] === 'p' && parts[1]) {
    const project = projects.find((p) => p.id === parts[1]);
    page = project ? <ProjectView project={project} tab={parts[2] ?? 'overview'} /> : <p className="empty">Project not found.</p>;
  } else if (parts[0] === 'm' && moduleInfo(parts[1] ?? '')?.live) {
    page = <BoardPage key={parts[1]} module={parts[1] as ModuleId} />;
  } else if (parts[0] === 'settings') {
    page = <SettingsPage />;
  } else if (parts[0] === 'prices') {
    page = <PricesPage />;
  } else if (parts[0] === 'methods') {
    page = <MethodsPage />;
  } else {
    page = <BoardPage key="all" />;
  }

  return (
    <div className={`app ${parts[0] === 'p' ? 'in-project' : ''}`}>
      <AppSidebar route={parts} />
      <main className="app-main">{page}</main>
      <Dialogs />
    </div>
  );
}
