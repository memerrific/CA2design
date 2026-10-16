import { useState } from 'react';
import { merchantCsv } from '../../engine/takeoff';
import { downloadFile, useStore } from '../../store';
import { IS_PREVIEW } from '../../ui/dialog';
import { Card, fmt, TextField } from '../../ui/fields';
import { groupByCategory, usePricing } from './Pricing';

export function MerchantTab() {
  const { p, pr, result, setPricing } = usePricing();
  const { company } = useStore();
  const [copied, setCopied] = useState('');
  const lines = result.lines.filter((l) => !l.excluded && l.qty > 0);
  const groups = groupByCategory(lines);
  const slug = (p.reference || p.name).replace(/\W+/g, '-');

  const json = () => ({
    type: 'request-for-quotation',
    from: { company: company.name, phone: company.phone, email: company.email, address: company.address },
    project: { name: p.name, reference: p.reference },
    deliverTo: pr.deliveryAddress,
    requiredBy: pr.requiredBy,
    notes: pr.merchantNotes,
    items: lines.map((l) => ({ category: l.category, description: l.description, quantity: l.qty, unit: l.unit, notes: l.notes })),
  });

  const plainText = () =>
    [
      `Request for quotation: ${p.name}${p.reference ? ` (${p.reference})` : ''}`,
      pr.requiredBy ? `Required by: ${pr.requiredBy}` : '',
      `Deliver to: ${pr.deliveryAddress.replace(/\n/g, ', ')}`,
      '',
      ...groups.flatMap((g) => [g.category.toUpperCase(), ...g.lines.map((l) => `  ${l.qty} ${l.unit}  ${l.description}`), '']),
      pr.merchantNotes,
    ]
      .filter((x, i, a) => x !== '' || a[i - 1] !== '')
      .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText());
      setCopied('Copied. Paste it into an email or the merchant’s portal.');
    } catch {
      setCopied('Copy was blocked here. Select the list below and copy it by hand.');
    }
  };

  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">Merchant request</p>
          <h1>Request for quotation</h1>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={copy}>
            Copy list
          </button>
          {!IS_PREVIEW && (
            <>
              <button className="btn ghost" onClick={() => downloadFile(`RFQ-${slug}.csv`, merchantCsv(lines), 'text/csv')}>
                Download CSV
              </button>
              <button className="btn ghost" onClick={() => downloadFile(`RFQ-${slug}.json`, JSON.stringify(json(), null, 2), 'application/json')}>
                Download JSON
              </button>
              <button className="btn" onClick={() => window.print()}>
                Print / save PDF
              </button>
            </>
          )}
        </div>
      </div>
      {copied && <p className="notice no-print">{copied}</p>}
      {IS_PREVIEW && <p className="muted small no-print">CSV, JSON and PDF downloads are available in the installed app. Copy list works here.</p>}

      <Card title="Request details" className="no-print">
        <div className="grid2">
          <TextField label="Deliver to" multiline value={pr.deliveryAddress} onChange={(v) => setPricing((x) => void (x.deliveryAddress = v))} />
          <div>
            <TextField label="Required by" value={pr.requiredBy} placeholder="e.g. Mon 3 Nov, AM delivery" onChange={(v) => setPricing((x) => void (x.requiredBy = v))} />
            <TextField label="Notes to merchant" multiline value={pr.merchantNotes} onChange={(v) => setPricing((x) => void (x.merchantNotes = v))} />
          </div>
        </div>
        <p className="muted small">Quantities come from the Pricing tab, including waste. Prices are never included in the merchant request.</p>
      </Card>

      <div className="pack">
        <section className="sheet rfq">
          <div className="pack-head">
            <div>
              <p className="eyebrow">Request for quotation</p>
              <h2>{p.name}</h2>
            </div>
            <img src={company.logoDataUrl || './logo.png'} alt="" />
          </div>
          <div className="rfq-meta">
            <div>
              <span>From</span>
              <b>{company.name}</b>
              <p>{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
            </div>
            <div>
              <span>Deliver to</span>
              <p style={{ whiteSpace: 'pre-line' }}>{pr.deliveryAddress || '–'}</p>
            </div>
            <div>
              <span>Reference</span>
              <b>{p.reference || '–'}</b>
              <p>
                Date {new Date().toLocaleDateString('en-GB')}
                {pr.requiredBy && (
                  <>
                    <br />
                    Required by {pr.requiredBy}
                  </>
                )}
              </p>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Description</th>
                <th className="r">Qty</th>
                <th>Unit</th>
                <th>Your price</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => [
                <tr key={g.category} className="cat">
                  <td colSpan={5}>{g.category}</td>
                </tr>,
                ...g.lines.map((l) => (
                  <tr key={l.key}>
                    <td className="muted">{lines.indexOf(l) + 1}</td>
                    <td>{l.description}</td>
                    <td className="r">{fmt(l.qty, l.qty % 1 ? 1 : 0)}</td>
                    <td>{l.unit}</td>
                    <td className="blank" />
                  </tr>
                )),
              ])}
            </tbody>
          </table>
          {pr.merchantNotes && <p style={{ whiteSpace: 'pre-line' }}>{pr.merchantNotes}</p>}
          <p className="pack-foot">Please quote your best net price and lead time for each line, and note any substitutions. Quote valid for 30 days.</p>
        </section>
      </div>
      <pre className="copy-src no-print" aria-label="Plain text list">
        {plainText()}
      </pre>
    </div>
  );
}
