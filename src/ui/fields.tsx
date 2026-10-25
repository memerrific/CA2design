import { useEffect, useState, type ReactNode } from 'react';

/** Quantities with a unit can't be negative, except temperatures; a ΔT in kelvin must be above zero. */
const floorFor = (unit?: string) => (unit === 'K' ? 0.1 : unit && unit !== '°C' && unit !== '×' ? 0 : undefined);

export function NumField({
  label,
  value,
  onChange,
  step,
  unit,
  min,
  max,
  width,
  title,
}: {
  label?: string;
  value: number | undefined;
  onChange: (v: number) => void;
  step?: number;
  unit?: string;
  /** Lowest value accepted. Defaults to 0 for anything with a unit except °C, and just above 0 for ΔT (K). */
  min?: number;
  max?: number;
  width?: number;
  title?: string;
}) {
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? '' : String(value));
  const [error, setError] = useState('');
  useEffect(() => {
    const parsed = parseFloat(text);
    if (value !== undefined && parsed !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const floor = min ?? floorFor(unit);
  const input = (
    <span className={`num ${error ? 'invalid' : ''}`}>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        step={step ?? 'any'}
        min={floor}
        max={max}
        title={error || title}
        aria-invalid={error ? true : undefined}
        style={width ? { width } : undefined}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isNaN(v)) return setError(e.target.value.trim() ? 'Enter a number' : '');
          if (floor !== undefined && v < floor) return setError(floor === 0 ? 'Can’t be negative' : `Must be at least ${floor}`);
          if (max !== undefined && v > max) return setError(`Must be ${max} or less`);
          setError('');
          onChange(v);
        }}
        onBlur={() => {
          // Leaving a box with a rejected value puts back the last good one.
          if (error && value !== undefined) {
            setText(String(value));
            setError('');
          }
        }}
      />
      {unit && <em>{unit}</em>}
    </span>
  );
  if (!label)
    return (
      <>
        {input}
        {error && <small className="num-error">{error}</small>}
      </>
    );
  return (
    <label className="field">
      <span>{label}</span>
      {input}
      {error && <small className="num-error">{error}</small>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const input = multiline ? (
    <textarea value={value} placeholder={placeholder} rows={4} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
  if (!label) return input;
  return (
    <label className="field">
      <span>{label}</span>
      {input}
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; group?: string }[];
}) {
  const groups = [...new Set(options.map((o) => o.group ?? ''))];
  const sel = (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {groups.length > 1
        ? groups.map((g) => (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => (o.group ?? '') === g)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ))
        : options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
    </select>
  );
  if (!label) return sel;
  return (
    <label className="field">
      <span>{label}</span>
      {sel}
    </label>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <header>
          {title && <h3>{title}</h3>}
          {actions && <div className="actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>
        {value}
        {unit && <small> {unit}</small>}
      </strong>
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export const fmt = (v: number, dp = 0) =>
  Number.isFinite(v) ? v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '–';

/** "1 room", "3 rooms". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
