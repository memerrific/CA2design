import { uid } from '../../engine/factory';
import type { Pricing, Project } from '../../engine/model';
import { CATEGORY_ORDER, pricingOf, priceProject, type PricedLine } from '../../engine/takeoff';
import { store, useStore } from '../../store';
import { Card, fmt, NumField, Select, Stat, TextField } from '../../ui/fields';
import { useProject } from '../ProjectView';

export const money = (v: number) => `£${fmt(v, 2)}`;

export function usePricing() {
  const { project: p, loss, update } = useProject();
  const { prices } = useStore();
  const pr = pricingOf(p);
  const result = priceProject(p, loss, prices);
  const setPricing = (fn: (x: Pricing, d: Project) => void) =>
    update((d) => {
      const x = pricingOf(d);
      fn(x, d);
      d.pricing = x;
    });
  return { p, pr, result, setPricing };
}

export function groupByCategory(lines: PricedLine[]) {
  const cats = [...new Set(lines.map((l) => l.category))].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return cats.map((c) => ({ category: c, lines: lines.filter((l) => l.category === c) }));
}

export function PricingTab() {
  const { p, pr, result, setPricing } = usePricing();
  const groups = groupByCategory(result.lines);
  const unpriced = result.lines.filter((l) => !l.excluded && l.unitCost === 0 && l.qty > 0).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1>Materials & quote, from the design</h1>
        </div>
        <div className="actions">
          <a className="btn ghost" href={`#/p/${p.id}/merchant`}>
            Merchant request →
          </a>
        </div>
      </div>

      <div className="stats">
        <Stat label="Materials" value={money(result.materials + result.sundries)} />
        <Stat label="Markup" value={money(result.markup)} />
        <Stat label="Labour" value={money(result.labour)} />
        <Stat label="Total ex VAT" value={money(result.net)} />
        <Stat label={`Total inc VAT (${pr.vatPct}%)`} value={money(result.total)} tone="ok" />
      </div>
      {unpriced > 0 && (
        <p className="notice">
          {unpriced} item{unpriced > 1 ? 's have' : ' has'} no price yet. Enter a unit cost once and it's saved to your price list for every future job.
        </p>
      )}

      <Card title="Allowances">
        <div className="grid4">
          <NumField label="Waste on pipe" unit="%" value={pr.wastePct} onChange={(v) => setPricing((x) => void (x.wastePct = v))} />
          <NumField label="Fittings & sundries" unit="% of materials" value={pr.sundriesPct} onChange={(v) => setPricing((x) => void (x.sundriesPct = v))} />
          <NumField label="Markup on materials" unit="%" value={pr.markupPct} onChange={(v) => setPricing((x) => void (x.markupPct = v))} />
          <Select
            label="VAT"
            value={String(pr.vatPct)}
            onChange={(v) => setPricing((x) => void (x.vatPct = Number(v)))}
            options={[
              { value: '20', label: '20% standard' },
              { value: '5', label: '5% reduced' },
              { value: '0', label: '0% (qualifying energy-saving materials)' },
            ]}
          />
          <label className="field check">
            <span>Pipe insulation</span>
            <span className="inline">
              <input type="checkbox" checked={pr.includeInsulation} onChange={(e) => setPricing((x) => void (x.includeInsulation = e.target.checked))} /> Include on all pipe runs
            </span>
          </label>
        </div>
        <p className="muted small">Check the VAT rate that applies to the job; heat pump and insulation installs can qualify for a reduced rate.</p>
      </Card>

      {groups.map((g) => (
        <Card key={g.category} title={g.category} actions={<b>{money(g.lines.reduce((a, l) => a + l.total, 0))}</b>}>
          <div className="scroll-x">
            <table className="tbl price">
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>Item</th>
                  <th className="r" style={{ width: 130 }}>
                    Qty
                  </th>
                  <th style={{ width: 60 }}>Unit</th>
                  <th className="r" style={{ width: 120 }}>
                    Unit cost £
                  </th>
                  <th className="r" style={{ width: 110 }}>
                    Total
                  </th>
                  <th style={{ width: 8 }} />
                </tr>
              </thead>
              <tbody>{g.lines.map((l) => <LineRow key={l.key} l={l} />)}</tbody>
            </table>
          </div>
        </Card>
      ))}
      {result.lines.length === 0 && <p className="muted">Nothing to price yet. Add pipe runs, new radiators, UFH rooms or equipment and the list fills in.</p>}

      <Card
        title="Extras"
        actions={
          <button
            className="btn ghost sm"
            onClick={() => setPricing((x) => void x.extras.push({ id: uid(), category: 'Extras', description: 'Item', qty: 1, unit: 'each', unitCost: 0, notes: '' }))}
          >
            + Add item
          </button>
        }
      >
        {pr.extras.length === 0 ? (
          <p className="muted small">Anything the design doesn't cover: flue kit, condensate pump, scaffold, skip, electrical sundries, building work…</p>
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit cost £</th>
                  <th className="r">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pr.extras.map((x, i) => (
                  <tr key={x.id}>
                    <td>
                      <TextField value={x.category} onChange={(v) => setPricing((y) => void (y.extras[i].category = v))} />
                    </td>
                    <td>
                      <TextField value={x.description} onChange={(v) => setPricing((y) => void (y.extras[i].description = v))} />
                    </td>
                    <td>
                      <NumField value={x.qty} width={60} onChange={(v) => setPricing((y) => void (y.extras[i].qty = v))} />
                    </td>
                    <td>
                      <TextField value={x.unit} onChange={(v) => setPricing((y) => void (y.extras[i].unit = v))} />
                    </td>
                    <td>
                      <NumField value={x.unitCost} width={80} step={0.01} onChange={(v) => setPricing((y) => void (y.extras[i].unitCost = v))} />
                    </td>
                    <td className="r">{money(x.qty * x.unitCost)}</td>
                    <td>
                      <button className="link danger" onClick={() => setPricing((y) => void y.extras.splice(i, 1))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Labour"
        actions={
          <button className="btn ghost sm" onClick={() => setPricing((x) => void x.labour.push({ id: uid(), description: 'Engineer', days: 1, dayRate: 0 }))}>
            + Add labour
          </button>
        }
      >
        {pr.labour.length === 0 ? (
          <p className="muted small">Add engineers, electricians, commissioning days…</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Description</th>
                <th>Days</th>
                <th>Day rate £</th>
                <th className="r">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pr.labour.map((l, i) => (
                <tr key={l.id}>
                  <td>
                    <TextField value={l.description} onChange={(v) => setPricing((y) => void (y.labour[i].description = v))} />
                  </td>
                  <td>
                    <NumField value={l.days} width={60} step={0.5} onChange={(v) => setPricing((y) => void (y.labour[i].days = v))} />
                  </td>
                  <td>
                    <NumField value={l.dayRate} width={80} onChange={(v) => setPricing((y) => void (y.labour[i].dayRate = v))} />
                  </td>
                  <td className="r">{money(l.days * l.dayRate)}</td>
                  <td>
                    <button className="link danger" onClick={() => setPricing((y) => void y.labour.splice(i, 1))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Summary">
        <table className="tbl summary">
          <tbody>
            <tr>
              <th>Materials</th>
              <td className="r">{money(result.materials)}</td>
            </tr>
            <tr>
              <th>Fittings & sundries ({pr.sundriesPct}%)</th>
              <td className="r">{money(result.sundries)}</td>
            </tr>
            <tr>
              <th>Markup ({pr.markupPct}%)</th>
              <td className="r">{money(result.markup)}</td>
            </tr>
            <tr>
              <th>Labour</th>
              <td className="r">{money(result.labour)}</td>
            </tr>
            <tr className="total">
              <th>Total ex VAT</th>
              <td className="r">{money(result.net)}</td>
            </tr>
            <tr>
              <th>VAT ({pr.vatPct}%)</th>
              <td className="r">{money(result.vat)}</td>
            </tr>
            <tr className="total">
              <th>Total inc VAT</th>
              <td className="r">{money(result.total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function LineRow({ l }: { l: PricedLine }) {
  const { setPricing } = usePricing();
  if (!l.auto) {
    return (
      <tr>
        <td />
        <td>
          {l.description}
          <small className="src">Extra, edit below</small>
        </td>
        <td className="r">{fmt(l.qty, 2)}</td>
        <td>{l.unit}</td>
        <td className="r">{fmt(l.unitCost, 2)}</td>
        <td className="r">{money(l.total)}</td>
        <td />
      </tr>
    );
  }
  const setOverride = (patch: { qty?: number | undefined; exclude?: boolean }) =>
    setPricing((x) => {
      const o = { ...(x.overrides[l.key] ?? {}), ...patch };
      if (o.qty === undefined) delete o.qty;
      if (!o.exclude) delete o.exclude;
      if (Object.keys(o).length) x.overrides[l.key] = o;
      else delete x.overrides[l.key];
    });
  return (
    <tr className={l.excluded ? 'struck' : ''}>
      <td>
        <input type="checkbox" title="Include" checked={!l.excluded} onChange={(e) => setOverride({ exclude: !e.target.checked })} />
      </td>
      <td>
        {l.description}
        <small className="src">{l.source}</small>
      </td>
      <td className="r">
        <NumField value={l.qty} width={70} onChange={(v) => setOverride({ qty: v })} />
        {l.edited && (
          <button className="link small" onClick={() => setOverride({ qty: undefined })} title="Go back to the quantity from the design">
            reset
          </button>
        )}
      </td>
      <td>{l.unit}</td>
      <td className="r">
        <NumField value={l.unitCost} width={80} step={0.01} onChange={(v) => store.setPrice(l.key, v)} title="Saved to your price list" />
      </td>
      <td className="r">{money(l.total)}</td>
      <td />
    </tr>
  );
}
