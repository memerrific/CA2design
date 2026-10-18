// Design climate data, as used by the MCS Heat Load Calculator
// (heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions).
// External design temperatures: CIBSE Guide A (2015) Table 2.5, 14 UK sites.
// Annual mean temperatures: Met Office 1981–2010, MCS MGD 007 Table B1.
// Degree days: Met Office, base 15.5 °C, by postcode area.

export interface DesignStation {
  id: string;
  location: string;
  station: string;
  altitude: number; // m
  t996: number; // °C, 99.6% hourly dry bulb (MCS default)
  t99: number; // °C, 99%
  lat: number;
  lon: number;
}

// Coordinates are approximate station positions, used only to suggest the
// nearest station from a postcode.
export const DESIGN_STATIONS: DesignStation[] = [
  { id: 'belfast', location: 'Belfast', station: 'Aldergrove', altitude: 63, t996: -3.2, t99: -1.5, lat: 54.66, lon: -6.22 },
  { id: 'birmingham', location: 'Birmingham', station: 'Coleshill', altitude: 96, t996: -5.1, t99: -3.2, lat: 52.48, lon: -1.69 },
  { id: 'cardiff', location: 'Cardiff', station: 'St Athan', altitude: 49, t996: -3.1, t99: -1.5, lat: 51.4, lon: -3.44 },
  { id: 'edinburgh', location: 'Edinburgh', station: 'Gogarbank', altitude: 57, t996: -5.4, t99: -3.2, lat: 55.93, lon: -3.34 },
  { id: 'glasgow', location: 'Glasgow', station: 'Bishopton', altitude: 59, t996: -5.6, t99: -3.5, lat: 55.91, lon: -4.53 },
  { id: 'leeds', location: 'Leeds', station: 'Church Fenton', altitude: 8, t996: -3.3, t99: -1.9, lat: 53.83, lon: -1.2 },
  { id: 'london', location: 'London', station: 'Heathrow', altitude: 25, t996: -3.0, t99: -1.7, lat: 51.48, lon: -0.45 },
  { id: 'manchester', location: 'Manchester', station: 'Woodford', altitude: 88, t996: -4.5, t99: -2.7, lat: 53.34, lon: -2.15 },
  { id: 'newcastle', location: 'Newcastle', station: 'Albemarle', altitude: 142, t996: -3.7, t99: -2.0, lat: 55.02, lon: -1.88 },
  { id: 'norwich', location: 'Norwich', station: 'Marham', altitude: 21, t996: -4.6, t99: -3.1, lat: 52.65, lon: 0.57 },
  { id: 'nottingham', location: 'Nottingham', station: 'Watnall', altitude: 117, t996: -3.9, t99: -2.4, lat: 53.01, lon: -1.25 },
  { id: 'plymouth', location: 'Plymouth', station: 'Mountbatten', altitude: 50, t996: -1.5, t99: -0.2, lat: 50.36, lon: -4.12 },
  { id: 'southampton', location: 'Southampton', station: 'Hurn', altitude: 10, t996: -4.8, t99: -3.4, lat: 50.78, lon: -1.84 },
  { id: 'swindon', location: 'Swindon', station: 'Brize Norton', altitude: 82, t996: -4.6, t99: -2.9, lat: 51.76, lon: -1.58 },
  { id: 'jersey', location: 'Jersey / Guernsey', station: 'Maison St Louis', altitude: 53, t996: 0.1, t99: 2.0, lat: 49.19, lon: -2.1 },
];

export function station(id: string): DesignStation | undefined {
  return DESIGN_STATIONS.find((s) => s.id === id);
}

/**
 * External design temperature with the MCS altitude rule: 0.6 °C colder for
 * every whole 100 m the property sits above the station.
 */
export function designTemperature(st: DesignStation, propertyAltitude: number, percentile: '99.6' | '99' = '99.6'): number {
  const base = percentile === '99' ? st.t99 : st.t996;
  if (st.id === 'jersey') return base;
  const above = Math.max(0, propertyAltitude - st.altitude);
  return Math.round((base - 0.6 * Math.floor(above / 100)) * 10) / 10;
}

export function nearestStation(lat: number, lon: number): DesignStation {
  const d = (s: DesignStation) => {
    const x = (s.lon - lon) * Math.cos(((s.lat + lat) / 2) * (Math.PI / 180));
    const y = s.lat - lat;
    return x * x + y * y;
  };
  return [...DESIGN_STATIONS].sort((a, b) => d(a) - d(b))[0];
}

export const MEAN_ANNUAL_TEMPS: { region: string; station: string; temp: number }[] = [
  { region: 'Borders', station: 'Boulmer', temp: 9.0 },
  { region: 'East Pennines', station: 'Finningley', temp: 10.0 },
  { region: 'East Scotland', station: 'Leuchars', temp: 8.8 },
  { region: 'East Anglia', station: 'Honington', temp: 10.1 },
  { region: 'Midlands', station: 'Elmdon', temp: 9.8 },
  { region: 'North East England', station: 'Leeming', temp: 9.4 },
  { region: 'North East Scotland', station: 'Dyce', temp: 8.5 },
  { region: 'North West England', station: 'Carlisle', temp: 9.4 },
  { region: 'North West Scotland', station: 'Stornoway', temp: 8.6 },
  { region: 'Northern Ireland', station: 'Aldergrove', temp: 9.4 },
  { region: 'Severn Valley', station: 'Filton', temp: 10.6 },
  { region: 'South East England', station: 'Gatwick', temp: 10.2 },
  { region: 'South West England', station: 'Plymouth', temp: 11.0 },
  { region: 'Southern England', station: 'Hurn', temp: 10.4 },
  { region: 'Thames Valley', station: 'Heathrow', temp: 11.3 },
  { region: 'Wales', station: 'Aberporth', temp: 9.9 },
  { region: 'West Pennines', station: 'Ringway', temp: 10.0 },
  { region: 'West Scotland', station: 'Abbotsinch', temp: 9.1 },
  { region: 'Channel Islands', station: 'Maison St Louis', temp: 12.4 },
];

/** Heating degree days (base 15.5 °C) by postcode area. */
export const DEGREE_DAYS: Record<string, number> = {
  AB: 2668, AL: 2033, B: 2425, BA: 1835, BB: 2228, BD: 2307, BH: 2224, BL: 2228, BN: 2224, BR: 2255, BS: 1835, BT: 2360,
  CA: 2388, CB: 2033, CF: 1835, CH: 2228, CM: 2033, CO: 2254, CR: 2224, CT: 2255, CV: 2425, CW: 2228, DA: 2255, DD: 2577,
  DE: 2228, DG: 2483, DH: 2370, DL: 2388, DN: 2307, DT: 2224, DY: 2425, E: 2033, EC: 2033, EH: 2577, EN: 2255, EX: 1858,
  FK: 2577, FY: 2388, G: 2494, GL: 2425, GU: 2033, GY: 1800, HA: 2033, HD: 2307, HG: 2307, HP: 2033, HR: 2425, HS: 1800,
  HU: 2307, HX: 2228, IG: 2033, IM: 2228, IP: 2254, IV: 2668, JE: 1800, KA: 2494, KT: 2033, KW: 2668, KY: 2577, L: 2228,
  LA: 2388, LD: 2161, LE: 2425, LL: 2228, LN: 2307, LS: 2307, LU: 2033, M: 2228, ME: 2033, MK: 2425, ML: 2494, N: 2033,
  NE: 2370, NG: 2254, NN: 2425, NP: 2425, NR: 2254, NW: 2033, OL: 2228, OX: 2425, PA: 2494, PE: 2254, PH: 2668, PL: 1858,
  PO: 2224, PR: 2388, RG: 2033, RH: 2033, RM: 2033, S: 2228, SA: 2161, SE: 2033, SG: 2033, SK: 2228, SL: 2033, SM: 2033,
  SN: 2425, SO: 2224, SP: 2224, SR: 2370, SS: 2033, ST: 2228, SW: 2033, SY: 2161, TA: 1835, TD: 2483, TF: 2425, TN: 2255,
  TQ: 1858, TR: 1858, TS: 2370, TW: 2203, UB: 2203, W: 2203, WA: 2228, WC: 2203, WD: 2203, WF: 2307, WN: 2228, WR: 2425,
  WS: 2425, WV: 2425, YO: 2307, ZE: 2668,
};

export function postcodeArea(postcode: string): string {
  return (postcode.trim().toUpperCase().match(/^[A-Z]{1,2}/) ?? [''])[0];
}

export function degreeDays(postcode: string): number | undefined {
  const a = postcodeArea(postcode);
  return DEGREE_DAYS[a] ?? DEGREE_DAYS[a.slice(0, 1)];
}

// ---- Age bands (RdSAP 10 Table 1, England & Wales) ----

export type AgeBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';

export const AGE_BANDS: { id: AgeBand; years: string }[] = [
  { id: 'A', years: 'before 1900' },
  { id: 'B', years: '1900–1929' },
  { id: 'C', years: '1930–1949' },
  { id: 'D', years: '1950–1966' },
  { id: 'E', years: '1967–1975' },
  { id: 'F', years: '1976–1982' },
  { id: 'G', years: '1983–1990' },
  { id: 'H', years: '1991–1995' },
  { id: 'I', years: '1996–2002' },
  { id: 'J', years: '2003–2006' },
  { id: 'K', years: '2007–2011' },
  { id: 'L', years: '2012–2022' },
  { id: 'M', years: '2023 onwards' },
];

const bandIndex = (b: AgeBand) => AGE_BANDS.findIndex((x) => x.id === b);
export const bandAtLeast = (b: AgeBand, min: AgeBand) => bandIndex(b) >= bandIndex(min);

/** Thermal bridging allowance on external elements, RdSAP 10 Table 21. */
export function thermalBridgingExternal(b: AgeBand): number {
  if (bandAtLeast(b, 'K')) return 0.08;
  if (b === 'J') return 0.11;
  return 0.15;
}

/** Thermal bridging allowance on internal elements, CIBSE DHDG 2026 Table 2-9 (as listed by MCS). */
export function thermalBridgingInternal(b: AgeBand): number {
  return bandAtLeast(b, 'L') ? 0.05 : 0.1;
}

/** Default wall thickness (mm) when not measured, RdSAP 10 Table 3 (England & Wales). */
export function defaultWallThickness(kind: 'stone' | 'solid-brick' | 'cavity' | 'timber' | 'system', b: AgeBand): number {
  const cols: AgeBand[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const i = Math.min(cols.indexOf(b) < 0 ? 9 : cols.indexOf(b), 9);
  const t: Record<string, number[]> = {
    stone: [500, 500, 500, 500, 450, 420, 420, 420, 450, 450],
    'solid-brick': [220, 220, 220, 220, 240, 250, 270, 270, 300, 300],
    cavity: [250, 250, 250, 250, 250, 260, 270, 270, 300, 300],
    timber: [150, 150, 150, 250, 270, 270, 270, 270, 300, 300],
    system: [250, 250, 250, 250, 250, 300, 300, 300, 300, 300],
  };
  return t[kind][i];
}
