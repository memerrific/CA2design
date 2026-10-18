import { Card, Pill } from '../ui/fields';

type Status = 'exact' | 'method' | 'approx' | 'gap';

const STATUS: Record<Status, { tone: 'ok' | 'info' | 'warn' | 'bad'; label: string }> = {
  exact: { tone: 'ok', label: 'Exact formula' },
  method: { tone: 'info', label: 'Standard method, still to be validated' },
  approx: { tone: 'warn', label: 'Approximate: check before relying on it' },
  gap: { tone: 'bad', label: 'Not done yet' },
};

interface Item {
  topic: string;
  status: Status;
  what: string;
  source: string;
  check: string;
}

// Where every number in the app comes from, written for the engineer who signs
// the design off. Keep this in step with the engine code.
const ITEMS: { section: string; items: Item[] }[] = [
  {
    section: 'Heat loss',
    items: [
      {
        topic: 'Fabric heat loss',
        status: 'method',
        what: 'Each wall, window, door, floor and ceiling: U × area × temperature difference, room by room. Walls to warmer rooms count as gains.',
        source: 'Structure of BS EN 12831-1:2017. Written from general engineering knowledge of the standard, not from the standard text itself.',
        check: 'Unit-tested against hand calculations only. Not yet compared with the MCS heat load calculator or an independent designer.',
      },
      {
        topic: 'Ventilation heat loss',
        status: 'approx',
        what: '0.33 × air changes per hour × room volume × (inside − outside), with typical air change rates per room type.',
        source:
          'The older CIBSE Domestic Heating Design Guide approach. The current MCS calculator uses the full BS EN 12831-1 ventilation method, which can give roughly half the ventilation loss in older, naturally ventilated houses.',
        check: 'Expect this app to show more ventilation loss than the MCS calculator for older houses. Replacing it with the BS EN 12831-1 method is the top priority.',
      },
      {
        topic: 'Ground floors',
        status: 'approx',
        what: 'Floor U-value × 1.45 × (room temperature − annual mean outside temperature).',
        source: 'BS EN 12831-1 ground loss factors, groundwater factor taken as 1.',
        check: 'The floor U-value must be the equivalent U for the floor’s size and perimeter (BS EN ISO 13370). The app does not calculate that yet.',
      },
      {
        topic: 'Unheated spaces & neighbours',
        status: 'approx',
        what: 'Fixed temperatures you set on the Overview tab (default 7 °C unheated, 10 °C heated neighbour).',
        source: 'Common UK design convention. BS EN 12831-1 uses temperature factors for unheated spaces instead.',
        check: 'Confirm the values you want to use for each job.',
      },
      {
        topic: 'External design temperatures',
        status: 'approx',
        what: 'The town list on the Overview tab.',
        source: 'Typed in as rough starting values. Not taken from the official MCS / CIBSE tables.',
        check: 'Always enter the figure for the postcode from the MCS calculator or current CIBSE data. CIBSE has published new weather data in its 2026 guide.',
      },
      {
        topic: 'Room temperatures & air change rates',
        status: 'approx',
        what: 'Defaults per room type (e.g. living 21 °C, bedroom 18 °C, bathroom 22 °C).',
        source: 'Typical UK domestic design values.',
        check: 'Edit per room to suit the customer and the current guide.',
      },
      {
        topic: 'U-value library',
        status: 'approx',
        what: 'Typical U-values for common UK constructions, windows and doors.',
        source: 'Typical published values (RdSAP / CIBSE style), entered from general knowledge.',
        check: 'Use real constructions found on survey, and a proper U-value calculation where it matters. Add your own on the Overview tab.',
      },
      {
        topic: 'Tall rooms, churches, intermittent heating',
        status: 'gap',
        what: 'Not handled.',
        source: 'BS EN 12831-1 has corrections for rooms over 4 m high; intermittently heated buildings also need preheat (reheat) allowances.',
        check: 'Do not use the heat loss for churches or tall spaces until this is added. The app warns on rooms over 4 m.',
      },
    ],
  },
  {
    section: 'Emitters',
    items: [
      {
        topic: 'Radiator output at low temperatures',
        status: 'exact',
        what: 'Output = rated output at ΔT50 × (actual ΔT ÷ 50)^n, with n = 1.3.',
        source: 'The standard correction used with BS EN 442 test ratings.',
        check: 'Use the manufacturer’s own exponent n when known.',
      },
      {
        topic: 'Radiator sizes and outputs',
        status: 'approx',
        what: 'Generic outputs for Type 11, 21, 22 and 33 panels at each height and length.',
        source: 'Rough values typical of UK compact panels, not any one manufacturer.',
        check: 'Select final radiators from the chosen manufacturer’s tables.',
      },
      {
        topic: 'Underfloor heating output',
        status: 'approx',
        what: 'Heat output from pipe spacing, floor covering, screed depth and water temperatures, plus floor surface temperature.',
        source:
          'BS EN 1264-2 characteristic equation for wet screed systems. The coefficient tables were entered from memory of the standard; surface limits 29 °C occupied, 33 °C bathrooms.',
        check: 'Check results against the UFH supplier’s design or charts before installing.',
      },
    ],
  },
  {
    section: 'Pipework & plant',
    items: [
      {
        topic: 'Flow rate from heat load',
        status: 'exact',
        what: 'Flow = heat ÷ (density × specific heat × ΔT).',
        source: 'Basic physics, with standard water property formulas.',
        check: 'Glycol mixes use approximate property factors; check with the glycol supplier’s data.',
      },
      {
        topic: 'Pipe pressure drop',
        status: 'method',
        what: 'Darcy–Weisbach with the Swamee–Jain friction factor; fittings as a percentage allowance.',
        source: 'Standard fluid mechanics. Pipe bores are typical values for each product range.',
        check: 'Fittings allowance is an estimate. Sizing limits (1.0 m/s, 200 Pa/m) are rules of thumb.',
      },
      {
        topic: 'Valve Kv',
        status: 'exact',
        what: 'Pressure drop (bar) = (flow m³/h ÷ Kv)².',
        source: 'The definition of Kv. Valve authority target of 25–50% is a common rule of thumb.',
        check: 'Use the valve manufacturer’s Kv.',
      },
      {
        topic: 'Low loss header temperatures',
        status: 'method',
        what: 'Flow-weighted mixing when primary and secondary flows differ.',
        source: 'Energy balance at steady state, assuming the header mixes perfectly.',
        check: 'Real headers stratify a little; treat temperatures as a guide.',
      },
      {
        topic: 'Low loss header size',
        status: 'approx',
        what: 'Bore from a maximum velocity (default 0.2 m/s) and the “3 × largest connection” rule; the larger wins.',
        source: 'Rules of thumb. Published limits differ between manufacturers.',
        check: 'For a manufactured header, use its selection table for the design flow.',
      },
    ],
  },
  {
    section: 'Pricing',
    items: [
      {
        topic: 'Materials and totals',
        status: 'exact',
        what: 'Quantities from the design plus your waste %; prices from your own price list; sundries, markup and VAT as you set them.',
        source: 'Arithmetic only.',
        check: 'Fittings counts are a percentage allowance, not a fitting-by-fitting takeoff.',
      },
    ],
  },
];

export function MethodsPage() {
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">Methods & sources</p>
          <h1>Where every number comes from</h1>
        </div>
      </div>
      <Card>
        <p>
          This app is a design aid. A competent person must check the inputs and results before a design is issued. Each method below says where it comes
          from and how far it has been checked.
        </p>
        <div className="legend-pills">
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <Pill key={s} tone={STATUS[s].tone}>
              {STATUS[s].label}
            </Pill>
          ))}
        </div>
      </Card>
      {ITEMS.map((sec) => (
        <Card key={sec.section} title={sec.section}>
          <div className="methods">
            {sec.items.map((i) => (
              <article key={i.topic}>
                <header>
                  <h4>{i.topic}</h4>
                  <Pill tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Pill>
                </header>
                <dl>
                  <dt>What it does</dt>
                  <dd>{i.what}</dd>
                  <dt>Source</dt>
                  <dd>{i.source}</dd>
                  <dt>Check</dt>
                  <dd>{i.check}</dd>
                </dl>
              </article>
            ))}
          </div>
        </Card>
      ))}
      <Card title="How to validate it">
        <ol className="steps">
          <li>Run three or four past jobs through both this app and the MCS heat load calculator (or the tool you trust) and compare room by room.</li>
          <li>For a large job, pay an independent designer as planned and compare their figures with the app's.</li>
          <li>Note any differences and send them over, so each method can be corrected and its status upgraded here.</li>
        </ol>
      </Card>
    </div>
  );
}
