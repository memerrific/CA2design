import { useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { currentAccount } from './account';
import { WelcomePage } from './pages/Welcome';
import { BoardPage } from './pages/Board';
import { CategoryPage, HomePage, NewJobPage } from './pages/Home';
import { categoryInfo, jobForModule, jobInfo, type CategoryId } from './jobs';
import { PricesPage } from './pages/Prices';
import { MethodsPage } from './pages/Methods';
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

  if (!currentAccount)
    return (
      <>
        <WelcomePage />
        <Dialogs />
      </>
    );

  let page;
  if (parts[0] === 'p' && parts[1]) {
    const project = projects.find((p) => p.id === parts[1]);
    page = project ? (
      <ProjectView project={project} tab={parts[2] ?? 'overview'} />
    ) : (
      <div className="pg">
        <div className="empty-box">
          <b>That job isn’t on this account</b>
          <p>It may have been deleted, or it was made on another device or account.</p>
          <a className="btn-primary" href="#/jobs">
            Go to your jobs
          </a>
        </div>
      </div>
    );
  } else if (parts[0] === 'jobs') {
    const job = jobInfo(parts[1] ?? '');
    page = <BoardPage key={parts[1] ?? 'all'} jobType={job?.id} />;
  } else if (parts[0] === 'm' && jobForModule(parts[1] ?? '')) {
    page = <BoardPage key={parts[1]} jobType={jobForModule(parts[1]!)} />;
  } else if (parts[0] === 'c' && categoryInfo(parts[1] ?? '')) {
    page = <CategoryPage key={parts[1]} id={parts[1] as CategoryId} />;
  } else if (parts[0] === 'new') {
    page = <NewJobPage />;
  } else if (parts[0] === 'settings') {
    page = <SettingsPage section={parts[1]} />;
  } else if (parts[0] === 'prices') {
    page = <PricesPage />;
  } else if (parts[0] === 'methods') {
    page = <MethodsPage />;
  } else {
    page = <HomePage />;
  }

  return (
    <div className={`app ${parts[0] === 'p' ? 'in-project' : ''}`}>
      <AppSidebar route={parts} />
      <main className="app-main">{page}</main>
      <Dialogs />
    </div>
  );
}
