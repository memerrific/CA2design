import { useState } from 'react';
import { buildTakeoff, CATEGORY_ORDER } from '../engine/takeoff';
import { projectHeatLoss } from '../engine/heatloss';
import { store, useStore } from '../store';
import { NumField } from '../ui/fields';
import { Explain } from '../ui/explain';

/** The company price list: every item your designs have used, with your saved unit cost. */
export function PricesPage() {
  const { projects, prices } = useStore();
  const [query, setQuery] = useState('');

  const items = new Map<string, { category: string; description: string; unit: string; uses: number }>();
  for (const p of projects) {
    if (!p.rooms.length && !p.pipes.length) continue;
    let lines;
    try {
      lines = buildTakeoff(p, projectHeatLoss(p));
    } catch {
      continue;
    }
    for (const l of lines) {
      const it = items.get(l.key);
      if (it) it.uses++;
      else items.set(l.key, { category: l.category, description: l.description, unit: l.unit, uses: 1 });
    }
  }
  for (const key of Object.keys(prices)) if (!items.has(key)) items.set(key, { category: 'Other', description: key, unit: '', uses: 0 });

  const rows = [...items.entries()]
    .filter(([, it]) => !query || it.description.toLowerCase().includes(query.toLowerCase()))
    .sort(([, a], [, b]) => {
      const ca = CATEGORY_ORDER.indexOf(a.category), cb = CATEGORY_ORDER.indexOf(b.category);
      return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb) || a.description.localeCompare(b.description);
    });
  const priced = rows.filter(([k]) => prices[k] !== undefined).length;

  return (
    <div className="bd">
      <header className="bd-head">
        <h1>Price list</h1>
      </header>
      <Explain id="prices">
        Your unit costs, used to price the materials on every job. Items appear here once a design uses them; prices typed on a job’s Materials step are
        saved here too. {priced} of {rows.length} items priced.
      </Explain>
      <div className="bd-filters">
        <input className="bd-search" type="search" placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {rows.length === 0 ? (
        <div className="bd-empty">
          <h2>No items yet</h2>
          <p>Design a project with pipework, radiators or underfloor and its materials will be listed here to price.</p>
        </div>
      ) : (
        <div className="bd-list">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Used in</th>
                <th>Unit cost (£, ex VAT)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, it]) => (
                <tr key={key} className="static">
                  <td>
                    <b>{it.description}</b>
                  </td>
                  <td>{it.category}</td>
                  <td>{it.unit || '–'}</td>
                  <td>
                    {it.uses} project{it.uses === 1 ? '' : 's'}
                  </td>
                  <td>
                    <NumField value={prices[key] ?? 0} min={0} width={90} step={0.01} onChange={(v) => store.setPrice(key, v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
