import { readFile, store, useStore } from '../store';
import { Card, TextField } from '../ui/fields';
import type { CompanyProfile } from '../engine/model';
import { Explain } from '../ui/explain';

export function SettingsPage() {
  const { company } = useStore();
  const set = (patch: Partial<CompanyProfile>) => store.setCompany({ ...company, ...patch });

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">Company & branding</p>
          <h1>How your handover packs look</h1>
        </div>
      </div>
      <Explain id="settings">Your logo and company details, used on every printed pack and report, plus how to put the app on your phone.</Explain>
      <Card title="Logo">
        <div className="logo-row">
          <img src={company.logoDataUrl || './logo.png'} alt="Logo preview" className="logo-preview" />
          <div className="actions">
            <label className="btn ghost">
              Upload logo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) set({ logoDataUrl: await readFile(f, 'dataUrl') });
                }}
              />
            </label>
            {company.logoDataUrl && (
              <button className="btn ghost" onClick={() => set({ logoDataUrl: undefined })}>
                Use CA2 logo
              </button>
            )}
          </div>
        </div>
      </Card>
      <Card title="Details printed on packs">
        <div className="grid2">
          <TextField label="Company name" value={company.name} onChange={(name) => set({ name })} />
          <TextField label="Tagline" value={company.tagline} onChange={(tagline) => set({ tagline })} />
          <TextField label="Phone" value={company.phone} onChange={(phone) => set({ phone })} />
          <TextField label="Email" value={company.email} onChange={(email) => set({ email })} />
          <TextField label="Website" value={company.website} onChange={(website) => set({ website })} />
          <TextField label="Accreditations line" value={company.accreditations} onChange={(accreditations) => set({ accreditations })} />
        </div>
        <TextField label="Address" value={company.address} onChange={(address) => set({ address })} multiline />
        <TextField label="Pack footer note" value={company.footer} onChange={(footer) => set({ footer })} multiline />
      </Card>
      <Card title="Use it on your phone or tablet">
        <p>CA2 Designer can be added to your home screen and then opens like an app, including on site with no signal once you have opened it online.</p>
        <ul className="plain-list">
          <li>
            <b>iPhone or iPad:</b> open the site in Safari, tap the Share button, then <b>Add to Home Screen</b>.
          </li>
          <li>
            <b>Android:</b> open the site in Chrome, tap the ⋮ menu, then <b>Install app</b> or <b>Add to Home screen</b>.
          </li>
          <li>
            <b>Computer:</b> in Chrome or Edge, click the install icon at the right of the address bar.
          </li>
        </ul>
        <p className="muted small">
          Jobs are saved on each device separately. To move them, use <b>Back up all projects</b> in the sidebar and <b>Import projects</b> on the other
          device.
        </p>
      </Card>
      <p className="muted small">Saved automatically in this browser.</p>
    </div>
  );
}
