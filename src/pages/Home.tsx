import { MODULES, moduleInfo, moduleOf } from '../modules';
import { useStore } from '../store';

export function HomePage() {
  const { projects, company } = useStore();
  const recent = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const live = MODULES.filter((m) => m.live);
  const planned = MODULES.filter((m) => !m.live);

  return (
    <div className="page home">
      <section className="home-hero">
        <p className="eyebrow">{company.name}</p>
        <h1>What are we designing today?</h1>
        <p className="muted">Pick the type of job. Each section keeps its own projects, and everything feeds the pricing and paperwork at the end.</p>
      </section>

      <div className="module-grid">
        {live.map((m) => (
          <a key={m.id} className="module live" href={`#/m/${m.id}`}>
            <h2>{m.name}</h2>
            <p>{m.blurb}</p>
            <ul>
              {m.covers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <span className="go">
              {(() => {
                const n = projects.filter((p) => moduleOf(p) === m.id).length;
                return `${n} project${n === 1 ? '' : 's'} · Open →`;
              })()}
            </span>
          </a>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="recent">
          <h3>Recent projects</h3>
          {recent.map((p) => (
            <a key={p.id} href={`#/p/${p.id}/overview`} className="recent-row">
              <span>{p.name}</span>
              <small className="muted">{moduleInfo(moduleOf(p))?.name}</small>
              <small className="muted">{new Date(p.updatedAt).toLocaleDateString('en-GB')}</small>
            </a>
          ))}
        </section>
      )}

      <section>
        <h3 className="planned-title">Planned sections</h3>
        <div className="module-grid planned">
          {planned.map((m) => (
            <div key={m.id} className="module">
              <span className="soon">Planned</span>
              <h2>{m.name}</h2>
              <p>{m.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
