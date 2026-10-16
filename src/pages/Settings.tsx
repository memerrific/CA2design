import { readFile, store, useStore } from '../store';
import { Card, TextField } from '../ui/fields';
import type { CompanyProfile } from '../engine/model';

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
      <p className="muted small">Saved automatically in this browser.</p>
    </div>
  );
}
