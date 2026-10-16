// Default internal design temperatures and air change rates per room type.
// Temperatures follow the commonly used UK domestic design values; air change
// rates are typical CIBSE-style figures for older dwellings. Edit per room to
// suit the survey (e.g. newer, tighter houses need fewer air changes).

export interface RoomType {
  id: string;
  name: string;
  temp: number; // °C
  ach: number; // air changes per hour
}

export const ROOM_TYPES: RoomType[] = [
  { id: 'living', name: 'Living room', temp: 21, ach: 1.5 },
  { id: 'dining', name: 'Dining room', temp: 21, ach: 1.5 },
  { id: 'kitchen', name: 'Kitchen', temp: 18, ach: 2.0 },
  { id: 'kitchen-diner', name: 'Kitchen / diner', temp: 21, ach: 2.0 },
  { id: 'bedroom', name: 'Bedroom', temp: 18, ach: 1.0 },
  { id: 'bedroom-ensuite', name: 'Bedroom with en-suite', temp: 21, ach: 2.0 },
  { id: 'bathroom', name: 'Bathroom', temp: 22, ach: 3.0 },
  { id: 'ensuite', name: 'En-suite / shower room', temp: 22, ach: 3.0 },
  { id: 'wc', name: 'WC / cloakroom', temp: 18, ach: 2.0 },
  { id: 'hall', name: 'Hall / landing', temp: 18, ach: 2.0 },
  { id: 'study', name: 'Study', temp: 21, ach: 1.5 },
  { id: 'utility', name: 'Utility', temp: 18, ach: 3.0 },
  { id: 'conservatory', name: 'Conservatory', temp: 21, ach: 1.5 },
  { id: 'store', name: 'Store / airing', temp: 16, ach: 0.5 },
  { id: 'plant', name: 'Plant room', temp: 16, ach: 1.0 },
  { id: 'pool', name: 'Pool hall', temp: 30, ach: 4.0 },
  { id: 'other', name: 'Other', temp: 20, ach: 1.5 },
];

export function roomType(id: string): RoomType {
  return ROOM_TYPES.find((r) => r.id === id) ?? ROOM_TYPES[ROOM_TYPES.length - 1];
}

// Approximate external design temperatures (°C). Use the MCS postcode tool or
// CIBSE data for the exact site; these are only to get a project started.
export const DESIGN_LOCATIONS: { name: string; temp: number }[] = [
  { name: 'Worthing / Shoreham (approx.)', temp: -1.6 },
  { name: 'Brighton & Hove (approx.)', temp: -1.6 },
  { name: 'Chichester / Bognor (approx.)', temp: -1.8 },
  { name: 'Horsham / Crawley (approx.)', temp: -3.2 },
  { name: 'Eastbourne (approx.)', temp: -1.5 },
  { name: 'London (approx.)', temp: -1.8 },
  { name: 'Birmingham (approx.)', temp: -3.4 },
  { name: 'Manchester (approx.)', temp: -2.2 },
  { name: 'Edinburgh (approx.)', temp: -3.4 },
  { name: 'Custom', temp: -3 },
];
