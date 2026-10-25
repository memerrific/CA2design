import { useState, type FormEvent } from 'react';
import { createAccount, emailTaken, initials, isValidEmail, legacyJobCount, listAccounts, signIn, type LegacyChoice } from '../account';
import { Icon } from '../ui/icons';

/** Shown when nobody is signed in: pick an account on this device or create one. */
export function WelcomePage() {
  const accounts = listAccounts();
  const [creating, setCreating] = useState(accounts.length === 0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('CA2 Mechanical & Electrical');
  const legacy = legacyJobCount();
  const [legacyChoice, setLegacyChoice] = useState<LegacyChoice>('delete');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name.');
    if (!isValidEmail(email)) return setError('Enter a valid email address, like name@example.com.');
    if (emailTaken(email)) return setError('There is already an account with that email on this device. Choose it from the list instead.');
    const acc = createAccount({ name, email, company, legacy: legacy ? legacyChoice : undefined });
    signIn(acc.id);
  };

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-brand">
          <span className="sb-logo">
            <img src="./logo.png" alt="" />
          </span>
          <div>
            <b>CA2 Designer</b>
            <small>Heating, hot water and plant design</small>
          </div>
        </div>

        {!creating && accounts.length > 0 && (
          <>
            <h1>Who’s using CA2 Designer?</h1>
            <p className="muted">Accounts saved on this device.</p>
            <div className="acc-list">
              {accounts.map((a) => (
                <button key={a.id} className="acc" onClick={() => signIn(a.id)}>
                  <i>{initials(a.name)}</i>
                  <span>
                    <b>{a.name}</b>
                    <small>{a.email}</small>
                  </span>
                  <Icon name="chevronRight" />
                </button>
              ))}
            </div>
            <button className="btn-line wide" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> Create a new account
            </button>
          </>
        )}

        {creating && (
          <form onSubmit={submit} noValidate>
            <h1>Create your account</h1>
            <p className="muted">Your jobs, prices and settings are kept separately for each account.</p>
            <label className="field">
              <span>Your name</span>
              <input id="acc-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input id="acc-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Company name</span>
              <input id="acc-company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>

            {legacy > 0 && (
              <fieldset className="legacy">
                <legend>
                  This device has {legacy} job{legacy === 1 ? '' : 's'} saved from before accounts
                </legend>
                <label>
                  <input type="radio" name="legacy" checked={legacyChoice === 'delete'} onChange={() => setLegacyChoice('delete')} />
                  Start empty and delete them
                </label>
                <label>
                  <input type="radio" name="legacy" checked={legacyChoice === 'move'} onChange={() => setLegacyChoice('move')} />
                  Bring them into this account
                </label>
              </fieldset>
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary wide">
              Create account
            </button>
            {accounts.length > 0 && (
              <button type="button" className="btn-line wide" onClick={() => (setCreating(false), setError(''))}>
                Back to accounts
              </button>
            )}
          </form>
        )}

        <p className="welcome-note">
          <Icon name="info" size={15} />
          <span>
            Accounts are saved in this browser on this device only and have no password, so anyone using this device can open them. Nothing is sent
            anywhere and no emails are sent.
          </span>
        </p>
      </div>
    </div>
  );
}
