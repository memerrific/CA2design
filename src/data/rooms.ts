// Room design temperatures and minimum air change rates.
// Temperatures: CIBSE Domestic Heating Design Guide 2026 Table 2-2 as listed in
// the MCS Heat Load Calculator docs (age bands A–J vs K onwards).
// Minimum air changes: CIBSE DHDG 2026 Table 2-18 via MCS docs: 0.5 /h for
// rooms with an external envelope, 0 for fully internal rooms.

import { bandAtLeast, type AgeBand } from './climate';

export interface RoomType {
  id: string;
  name: string;
  tempOld: number; // °C, age bands A–J
  tempNew: number; // °C, age band K onwards
  ach: number; // minimum air changes per hour
  source: 'mcs' | 'typical';
}

export const ROOM_TYPES: RoomType[] = [
  { id: 'living', name: 'Living room / lounge', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'dining', name: 'Dining room', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'kitchen', name: 'Kitchen', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'kitchen-diner', name: 'Family / breakfast room (kitchen-diner)', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'bedroom', name: 'Bedroom', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'bedroom-ensuite', name: 'Bedroom with en-suite', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'bedroom-study', name: 'Bedroom / study', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'dressing', name: 'Dressing room', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'bathroom', name: 'Bathroom', tempOld: 22, tempNew: 22, ach: 0.5, source: 'mcs' },
  { id: 'ensuite', name: 'Shower room / en-suite', tempOld: 22, tempNew: 22, ach: 0.5, source: 'mcs' },
  { id: 'wc', name: 'Cloakroom / WC', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'hall', name: 'Hall', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'landing', name: 'Landing', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'internal', name: 'Internal room / corridor', tempOld: 18, tempNew: 21, ach: 0, source: 'mcs' },
  { id: 'study', name: 'Study', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'games', name: 'Games room', tempOld: 21, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'utility', name: 'Utility room', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'store', name: 'Store room', tempOld: 18, tempNew: 21, ach: 0.5, source: 'mcs' },
  { id: 'conservatory', name: 'Conservatory (not thermally separated)', tempOld: 21, tempNew: 21, ach: 0.5, source: 'typical' },
  { id: 'plant', name: 'Plant room', tempOld: 16, tempNew: 16, ach: 0.5, source: 'typical' },
  { id: 'pool', name: 'Pool hall', tempOld: 30, tempNew: 30, ach: 0.5, source: 'typical' },
  { id: 'other', name: 'Other', tempOld: 21, tempNew: 21, ach: 0.5, source: 'typical' },
];

export function roomType(id: string): RoomType {
  return ROOM_TYPES.find((r) => r.id === id) ?? ROOM_TYPES[ROOM_TYPES.length - 1];
}

/** Default design temperature for a room type in a house of the given age band. */
export function defaultRoomTemp(typeId: string, band: AgeBand): number {
  const t = roomType(typeId);
  return bandAtLeast(band, 'K') ? t.tempNew : t.tempOld;
}
