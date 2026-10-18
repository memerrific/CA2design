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
        what: 'Each wall, window, door, floor and ceiling: (U + thermal bridging) × area × temperature difference, room by room. Walls to warmer rooms count as gains.',
        source: 'Structure of BS EN 12831-1:2017 as implemented by the MCS Heat Load Calculator (public documentation).',
        check: 'Unit-tested against hand calculations. Not yet compared job-for-job with the MCS calculator.',
      },
      {
        topic: 'External design temperature',
        status: 'exact',
        what: 'Nearest of the 14 CIBSE Guide A stations (99.6% by default), 0.6 °C colder for every whole 100 m the property is above the station. Postcode lookup suggests the station.',
        source: 'CIBSE Guide A (2015) Table 2.5 values and altitude rule, as published in the MCS Heat Load Calculator documentation.',
        check: 'Station suggestion uses straight-line distance from the postcode, as MCS does; confirm the altitude.',
      },
      {
        topic: 'Annual mean temperature & degree days',
        status: 'exact',
        what: 'Annual mean by region (used for ground losses); degree days by postcode area.',
        source: 'Met Office data via MCS MGD 007 Table B1 and the MCS documentation.',
        check: 'Region is suggested from the postcode; check it is the nearest station.',
      },
      {
        topic: 'Room temperatures',
        status: 'exact',
        what: 'By room type and age band (bands A–J vs K onwards).',
        source: 'CIBSE Domestic Heating Design Guide 2026 Table 2-2, as listed in the MCS documentation.',
        check: 'MCS does not allow lower temperatures than these defaults.',
      },
      {
        topic: 'U-values',
        status: 'method',
        what: 'Library of walls, windows, doors, roofs and floors with the source shown on each entry.',
        source: 'RdSAP 10 Specification (BRE, June 2025) England tables for external elements; CIBSE DHDG 2026 (via MCS docs) for internal elements.',
        check: 'Use measured or calculated U-values when known. Scotland, Wales, NI tables differ slightly and are not loaded yet.',
      },
      {
        topic: 'Thermal bridging',
        status: 'exact',
        what: 'Added to every element: external 0.15 / 0.11 / 0.08 W/m²K by age band; internal 0.10 / 0.05.',
        source: 'RdSAP 10 Table 21 (external) and CIBSE DHDG 2026 Table 2-9 (internal), as used by MCS.',
        check: 'Editable on the Overview tab.',
      },
      {
        topic: 'Ground floors',
        status: 'method',
        what: 'U-value from floor area and exposed perimeter (solid or suspended, with insulation), then × 1.45 × (room − annual mean temperature).',
        source: 'BS EN ISO 13370 equations and parameters as written out in RdSAP 10 §5.12; ground factor 1.45 from BS EN 12831.',
        check: 'How MCS treats suspended floors against the annual mean temperature still needs confirming from BS EN 12831-1.',
      },
      {
        topic: 'Ventilation',
        status: 'approx',
        what: 'Each room: the larger of its minimum air change rate (0.5/h, 0 for internal rooms) and its share of building infiltration by external envelope area.',
        source:
          'Minimum rates: CIBSE DHDG 2026 Table 2-18 via MCS. Air permeability default 12 m³/h·m²: BS EN 12831-1 Table B.6 via MCS. Converting that to natural infiltration uses q50 ÷ 20, a rule of thumb.',
        check: 'The full BS EN 12831-1 infiltration equations (shielding, height, facades) are not in yet. Needs the standard.',
      },
      {
        topic: 'Floor void',
        status: 'exact',
        what: '0.25 m added to external wall heights on storeys below the top floor.',
        source: 'MCS documentation, net internal dimensions.',
        check: 'Applies to walls without a height override.',
      },
      {
        topic: 'Unheated spaces & neighbours',
        status: 'approx',
        what: 'Fixed temperatures you set (default 7 °C unheated, 10 °C heated neighbour).',
        source: 'Common UK convention. BS EN 12831-1 uses temperature factors by type of unheated space.',
        check: 'Lofts default to outside air, which is close to what MCS assumes.',
      },
      {
        topic: 'Tall rooms, intermittent heating',
        status: 'gap',
        what: 'Not handled.',
        source: 'BS EN 12831-1 corrections for rooms over 4 m; CIBSE DHDG 2026 §3.5.5 for intermittent heating.',
        check: 'The app warns on rooms over 4 m. MIS 3005-D needs no intermittent uplift when the 99.6% temperature is used.',
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
        status: 'method',
        what: 'Type 11, 21, 22 and 33 panels by height and length; heights between published ones interpolated.',
        source: 'Stelrad Compact published specification sheets (ΔT50), read from search results; direct check of the PDFs pending.',
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
