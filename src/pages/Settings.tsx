import { useEffect, useState, type ReactNode } from 'react';
import { AGE_BANDS, DESIGN_STATIONS, type AgeBand } from '../data/climate';
import { FLUIDS, type FluidId } from '../engine/fluid';
import type { CompanyProfile, Project } from '../engine/model';
import { STAGES } from '../modules';
import { DEFAULT_PREFS, prefsStore, usePrefs, type Theme } from '../prefs';
import { downloadJson, store, useStore } from '../store';
import { ask } from '../ui/dialog';
import { Explain, hiddenExplanationCount, showAllExplanations } from '../ui/explain';
import { Card, NumField, Select, TextField } from '../ui/fields';
import { Icon } from '../ui/icons';
import { downscaleImage } from '../ui/image';
import { currentAccount, deleteAccount, emailTaken, initials, isValidEmail, listAccounts, signOut, updateAccount } from '../account';
import { loadExamples } from './Home';

const SECTIONS = [
  { id: 'account', icon: 'user', name: 'Account', blurb: 'Your name, email and sign out' },
  { id: 'general', icon: 'gear', name: 'General', blurb: 'Appearance and explanations' },
  { id: 'company', icon: 'heating', name: 'Company & branding', blurb: 'Logo and details on printed packs' },
  { id: 'defaults', icon: 'radiator', name: 'Job defaults', blurb: 'What every new job starts with' },
  { id: 'data', icon: 'archive', name: 'Data & backup', blurb: 'Back up, move or clear your jobs' },
  { id: 'device', icon: 'download', name: 'Phone & offline', blurb: 'Install the app and work without signal' },
  { id: 'about', icon: 'info', name: 'About', blurb: 'Version and where the numbers come from' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsPage({ section }: { section?: string }) {
  const current: SectionId = SECTIONS.some((s) => s.id === section) ? (section as SectionId) : 'general';
  const info = SECTIONS.find((s) => s.id === current)!;

  return (
    <div className="pg">
      <header className="pg-head">
        <div>
          <p className="pg-crumb">
            <a href="#/">Home</a> / Settings
          </p>
          <h1>Settings</h1>
        </div>
      </header>
      <div className="set">
        <nav className="set-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#/settings/${s.id}`} className={`set-link ${s.id === current ? 'on' : ''}`} aria-current={s.id === current ? 'page' : undefined}>
              <Icon name={s.icon} />
              <span>
                <b>{s.name}</b>
                <small>{s.blurb}</small>
              </span>
            </a>
          ))}
        </nav>
        <div className="set-body">
          <h2 className="set-title">{info.name}</h2>
          {current === 'account' && <AccountSection />}
          {current === 'general' && <General />}
          {current === 'company' && <Company />}
          {current === 'defaults' && <Defaults />}
          {current === 'data' && <Data />}
          {current === 'device' && <Device />}
          {current === 'about' && <About />}
        </div>
      </div>
    </div>
  );
}

/** One setting: label and help on the left, the control on the right. */
function Row({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row">
      <div>
        <b>{label}</b>
        {help && <p>{help}</p>}
      </div>
      <div className="set-ctl">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

const THEMES: { id: Theme; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
  { id: 'system', name: 'Match this device' },
];

function AccountSection() {
  const acc = currentAccount!;
  const [name, setName] = useState(acc.name);
  const [email, setEmail] = useState(acc.email);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const others = listAccounts().filter((a) => a.id !== acc.id);
  const changed = name.trim() !== acc.name || email.trim() !== acc.email;

  const save = () => {
    if (!name.trim()) return setMsg({ ok: false, text: 'Enter your name.' });
    if (!isValidEmail(email)) return setMsg({ ok: false, text: 'Enter a valid email address, like name@example.com.' });
    if (emailTaken(email, acc.id)) return setMsg({ ok: false, text: 'Another account on this device already uses that email.' });
    updateAccount(acc.id, { name: name.trim(), email: email.trim() });
    window.location.reload();
  };

  const remove = async () => {
    const typed = await ask.prompt(`Delete the account ${acc.email} and all its jobs, prices and settings on this device? This cannot be undone. Type the email address to confirm.`);
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== acc.email.toLowerCase()) {
      await ask.alert('The email did not match, so nothing was deleted.');
      return;
    }
    deleteAccount(acc.id);
  };

  return (
    <>
      <Explain id="settings-account">
        Your account keeps its own jobs, prices, company details and settings. Accounts are saved on this device only and have no password.
      </Explain>
      <Card>
        <div className="me-head">
          <i>{initials(acc.name)}</i>
          <div>
            <b>{acc.name}</b>
            <small>
              {acc.email} · created {new Date(acc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </small>
          </div>
        </div>
      </Card>
      <Card title="Your details">
        <div className="grid2">
          <label className="field">
            <span>Name</span>
            <input id="me-name" value={name} onChange={(e) => (setName(e.target.value), setMsg(null))} />
          </label>
          <label className="field">
            <span>Email</span>
            <input id="me-email" type="email" value={email} onChange={(e) => (setEmail(e.target.value), setMsg(null))} />
          </label>
        </div>
        {msg && <p className={msg.ok ? 'muted small' : 'form-error'}>{msg.text}</p>}
        <div className="actions">
          <button className="btn-primary" disabled={!changed} onClick={save}>
            Save changes
          </button>
        </div>
      </Card>
      <Card title="Sign out">
        <Row label="Switch account" help={others.length ? `${others.length} other account${others.length === 1 ? '' : 's'} on this device.` : 'Sign out to create another account on this device.'}>
          <button className="btn-line" onClick={signOut}>
            Switch account
          </button>
        </Row>
        <Row label="Sign out" help="Your jobs stay saved in this account for next time.">
          <button className="btn-line" onClick={signOut}>
            Sign out
          </button>
        </Row>
      </Card>
      <Card title="Delete account" className="danger-card">
        <Row label="Delete this account" help="Removes the account and everything saved in it on this device: jobs, prices, company details and settings. Back up first if you want a copy.">
          <button className="btn-line danger" onClick={remove}>
            Delete account
          </button>
        </Row>
      </Card>
      <p className="muted small">
        Signing in from any device with an emailed link (no password) needs an online sign-in service. It can be added later without changing how this
        looks.
      </p>
    </>
  );
}

function General() {
  const p = usePrefs();
  const [hidden, setHidden] = useState(hiddenExplanationCount);
  return (
    <>
      <Explain id="settings-general">How the app looks on this device, and the “What this page does” boxes.</Explain>
      <Card title="Appearance">
        <div className="theme-pick" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={p.theme === t.id} className={`theme-opt ${p.theme === t.id ? 'on' : ''}`} onClick={() => prefsStore.set({ theme: t.id })}>
              <span className={`theme-swatch ${t.id}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {t.name}
            </button>
          ))}
        </div>
        <p className="muted small">Printed packs and the floor plan drawing always stay light, so they print and read the same either way.</p>
        <Row label="Larger text" help="Makes everything about 15% bigger. Handy on a tablet on site.">
          <Toggle label="Larger text" on={p.largeText} onChange={(v) => prefsStore.set({ largeText: v })} />
        </Row>
        <Row label="Compact layout" help="Tighter spacing so more fits on the screen.">
          <Toggle label="Compact layout" on={p.compact} onChange={(v) => prefsStore.set({ compact: v })} />
        </Row>
        <Row label="Reduce motion" help="Turns off hover and transition animations.">
          <Toggle label="Reduce motion" on={p.reduceMotion} onChange={(v) => prefsStore.set({ reduceMotion: v })} />
        </Row>
      </Card>
      <Card title="Explanations">
        <Row label="Show “What this page does” boxes" help="The short explanation at the top of every page and step.">
          <Toggle label="Show explanations" on={p.explanations} onChange={(v) => prefsStore.set({ explanations: v })} />
        </Row>
        <Row label="Boxes you have hidden" help={hidden ? `${hidden} hidden with “Got it”.` : 'None hidden.'}>
          <button
            className="btn-line"
            disabled={!hidden}
            onClick={() => {
              showAllExplanations();
              setHidden(0);
            }}
          >
            Show them all again
          </button>
        </Row>
      </Card>
      <Card title="Reset">
        <Row label="Reset settings" help="Puts appearance, explanations and job defaults back as they started. Your jobs and company details are not touched.">
          <button
            className="btn-line"
            onClick={async () => {
              if (await ask.confirm('Reset all settings on this device? Jobs and company details are kept.')) prefsStore.set(DEFAULT_PREFS);
            }}
          >
            Reset settings
          </button>
        </Row>
      </Card>
    </>
  );
}

function Company() {
  const { company } = useStore();
  const set = (patch: Partial<CompanyProfile>) => store.setCompany({ ...company, ...patch });
  return (
    <>
      <Explain id="settings">Your logo and company details, printed on every handover pack, report and merchant request. Packs always use the CA2 website colours.</Explain>
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
                  e.target.value = '';
                  if (f) set({ logoDataUrl: await downscaleImage(f, 800, 'image/png') });
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
    </>
  );
}

function Defaults() {
  const { defaults: d } = usePrefs();
  const set = prefsStore.setDefaults;
  return (
    <>
      <Explain id="settings-defaults">
        What every new job starts with, so you are not typing the same things each time. Changing these does not alter jobs you have already started; each job
        can still be changed on its own Overview. Plant room jobs start at 80/60 °C whatever is set here.
      </Explain>
      <Card title="You">
        <div className="grid2">
          <TextField label="Engineer name on new jobs" value={d.engineer} onChange={(engineer) => set({ engineer })} />
          <Select label="Stage new jobs start in" value={d.stage} onChange={(stage) => set({ stage })} options={STAGES.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
      </Card>
      <Card title="Design conditions">
        <div className="grid2">
          <Select
            label="Weather station (CIBSE Guide A)"
            value={d.stationId}
            onChange={(stationId) => set({ stationId })}
            options={DESIGN_STATIONS.map((s) => ({ value: s.id, label: `${s.location} (${s.station}) ${s.t996} °C` }))}
          />
          <Select<'99.6' | '99'>
            label="Design percentile"
            value={d.percentile}
            onChange={(percentile) => set({ percentile })}
            options={[
              { value: '99.6', label: '99.6% (MCS default)' },
              { value: '99', label: '99%' },
            ]}
          />
          <Select<AgeBand> label="Typical house age band" value={d.ageBand} onChange={(ageBand) => set({ ageBand })} options={AGE_BANDS.map((b) => ({ value: b.id, label: `${b.id}: ${b.years}` }))} />
          <NumField label="Design margin" unit="%" value={d.marginPct} onChange={(marginPct) => set({ marginPct })} />
        </div>
        <p className="muted small">The weather station still updates per job when you use “Find station from postcode” on its Overview.</p>
      </Card>
      <Card title="Heating system">
        <div className="grid2">
          <NumField label="Design flow temperature" unit="°C" value={d.flowTemp} onChange={(flowTemp) => set({ flowTemp })} />
          <NumField label="System ΔT (flow – return)" unit="K" value={d.deltaT} onChange={(deltaT) => set({ deltaT })} />
          <Select<FluidId> label="Fluid" value={d.fluid} onChange={(fluid) => set({ fluid })} options={FLUIDS.map((f) => ({ value: f.id, label: f.name }))} />
        </div>
        <p className="muted small">
          Return temperature {d.flowTemp - d.deltaT} °C, mean water {d.flowTemp - d.deltaT / 2} °C.
        </p>
      </Card>
    </>
  );
}

function storageBytes(): number {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k.startsWith('ca2d')) n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  } catch {
    /* unknown */
  }
  return n;
}

const isExample = (p: Project) => p.name.startsWith('Example') || p.reference.startsWith('DEMO');

function Data() {
  const { projects } = useStore();
  const [bytes, setBytes] = useState(storageBytes);
  useEffect(() => setBytes(storageBytes()), [projects]);
  const examples = projects.filter(isExample);
  const mb = bytes / 1024 / 1024;

  return (
    <>
      <Explain id="settings-data">
        Jobs are saved in this browser on this device only. Back them up to a file to keep a copy or move them to another phone, tablet or computer.
      </Explain>
      <Card>
        <div className="kpis in-card">
          <div className="kpi">
            <span>Jobs</span>
            <b>{projects.length}</b>
          </div>
          <div className="kpi">
            <span>Examples</span>
            <b>{examples.length}</b>
          </div>
          <div className="kpi">
            <span>Space used</span>
            <b>{mb < 0.1 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${mb.toFixed(1)} MB`}</b>
          </div>
        </div>
        <p className="muted small">Browsers allow around 5 MB here. Property photos take the most room, so back up and clear old jobs if this gets near the limit.</p>
      </Card>
      <Card title="Back up and move">
        <Row label="Back up all jobs" help="Saves every job to one file. Keep it somewhere safe, or open it on another device.">
          <button className="btn-primary" onClick={() => downloadJson(`ca2-designer-backup-${new Date().toISOString().slice(0, 10)}.json`, projects)}>
            <Icon name="download" size={16} /> Back up
          </button>
        </Row>
        <Row label="Import jobs" help="Adds jobs from a backup or an exported job file. Nothing you already have is replaced.">
          <span className="muted small">Use Import projects at the bottom of the sidebar.</span>
        </Row>
      </Card>
      <Card title="Examples">
        <Row label="Load example jobs" help="A heat pump house, a plant room, a pool and a cylinder to explore.">
          <button className="btn-line" onClick={() => loadExamples()}>
            Load examples
          </button>
        </Row>
        <Row label="Remove example jobs" help={examples.length ? `${examples.length} example job${examples.length === 1 ? '' : 's'} on this device.` : 'No examples loaded.'}>
          <button
            className="btn-line"
            disabled={!examples.length}
            onClick={async () => {
              if (await ask.confirm(`Remove ${examples.length} example job${examples.length === 1 ? '' : 's'}? Your own jobs are kept.`)) examples.forEach((p) => store.deleteProject(p.id));
            }}
          >
            Remove examples
          </button>
        </Row>
      </Card>
      <Card title="Danger zone" className="danger-card">
        <Row label="Delete every job" help="Removes all jobs from this device. This cannot be undone, so back up first.">
          <button
            className="btn-line danger"
            disabled={!projects.length}
            onClick={async () => {
              if (!(await ask.confirm(`Delete all ${projects.length} jobs from this device? This cannot be undone.`, { danger: true }))) return;
              projects.forEach((p) => store.deleteProject(p.id));
            }}
          >
            Delete all jobs
          </button>
        </Row>
      </Card>
    </>
  );
}

function Device() {
  const [state, setState] = useState<'checking' | 'on' | 'off'>('checking');
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return setState('off');
    navigator.serviceWorker.getRegistration().then((r) => setState(r ? 'on' : 'off'), () => setState('off'));
  }, []);
  const installed = window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <>
      <Explain id="settings-device">Put CA2 Designer on your home screen so it opens like an app, and keep working on site with no signal.</Explain>
      <Card title="This device">
        <Row label="Opened as an app" help={installed ? 'Yes, running from the home screen.' : 'No, running in the browser. Follow the steps below to install it.'}>
          <span className={`pill ${installed ? 'ok' : ''}`}>{installed ? 'Installed' : 'In browser'}</span>
        </Row>
        <Row
          label="Works offline"
          help={
            state === 'on'
              ? 'Ready. Pages you have opened online also open with no signal.'
              : state === 'off'
                ? 'Not available in this browser or in preview mode.'
                : 'Checking…'
          }
        >
          <span className={`pill ${state === 'on' ? 'ok' : ''}`}>{state === 'on' ? 'Ready' : state === 'off' ? 'Off' : '…'}</span>
        </Row>
      </Card>
      <Card title="Install on your phone or tablet">
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
        <p className="muted small">Each device keeps its own jobs. To move them, back up on one and import on the other (Data & backup).</p>
      </Card>
    </>
  );
}

function About() {
  const [update, setUpdate] = useState<'idle' | 'checking' | 'none'>('idle');
  const built = new Date(__BUILD_TIME__);
  const check = async () => {
    setUpdate('checking');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      const res = await fetch('./index.html', { cache: 'no-store' });
      const html = await res.text();
      const live = [...document.scripts].map((s) => s.src.split('/').pop()).find((n) => n && n.startsWith('index-'));
      if (live && !html.includes(live)) window.location.reload();
      else setUpdate('none');
    } catch {
      setUpdate('none');
    }
  };
  return (
    <>
      <Card title="CA2 Designer">
        <Row label="Version" help={`Updated ${built.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${built.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}>
          <code className="build">{__COMMIT__}</code>
        </Row>
        <Row label="Check for updates" help={update === 'none' ? 'You have the latest version.' : 'The app updates itself when you are online; this checks straight away.'}>
          <button className="btn-line" onClick={check} disabled={update === 'checking'}>
            {update === 'checking' ? 'Checking…' : 'Check now'}
          </button>
        </Row>
        <Row label="Methods & sources" help="Every calculation, the standard or data table it follows, and how far it has been checked.">
          <a className="btn-line" href="#/methods">
            Open
          </a>
        </Row>
      </Card>
      <p className="muted small">
        A design aid for CA2 Mechanical & Electrical. A competent person must check the inputs and results before a design is issued.
      </p>
    </>
  );
}
