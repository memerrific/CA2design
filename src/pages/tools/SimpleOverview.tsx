import type { ReactNode } from 'react';
import { Card, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

/** Project + site card shared by the single-purpose tools. */
export function SimpleOverviewTab({ title, howItWorks }: { title: string; howItWorks: ReactNode }) {
  const { project: p, update } = useProject();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="grid2 top">
        <Card title="Project">
          <TextField label="Project name" value={p.name} onChange={(v) => update((d) => void (d.name = v))} />
          <div className="grid2">
            <TextField label="Reference" value={p.reference} onChange={(v) => update((d) => void (d.reference = v))} />
            <TextField label="Engineer" value={p.engineer} onChange={(v) => update((d) => void (d.engineer = v))} />
          </div>
          <TextField label="Notes" multiline value={p.notes} onChange={(v) => update((d) => void (d.notes = v))} />
        </Card>
        <Card title="Site / customer">
          <TextField label="Name" value={p.customer.name} onChange={(v) => update((d) => void (d.customer.name = v))} />
          <TextField label="Address" multiline value={p.customer.address} onChange={(v) => update((d) => void (d.customer.address = v))} />
          <div className="grid2">
            <TextField label="Postcode" value={p.customer.postcode} onChange={(v) => update((d) => void (d.customer.postcode = v))} />
            <TextField label="Phone" value={p.customer.phone} onChange={(v) => update((d) => void (d.customer.phone = v))} />
          </div>
        </Card>
      </div>
      <Card title="How this works">{howItWorks}</Card>
    </div>
  );
}

/** Branded A4 sheet wrapper with a print button. */
export function SheetPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => window.print()}>
            Print / save PDF
          </button>
        </div>
      </div>
      <div className="pack">{children}</div>
    </div>
  );
}
