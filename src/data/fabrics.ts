// Typical U-values (W/m²·K) for UK construction. These are starting points
// from common reference values (CIBSE Guide A, SAP RdSAP tables, typical
// manufacturer data). Always check against the actual construction found on
// survey, and add your own in Settings > Fabric library.

export type FabricKind = 'wall' | 'window' | 'door' | 'floor' | 'roof' | 'ceiling' | 'rooflight';

export interface Fabric {
  id: string;
  kind: FabricKind;
  name: string;
  u: number;
  custom?: boolean;
}

export const FABRICS: Fabric[] = [
  // External walls
  { id: 'w-solid-brick-225', kind: 'wall', name: 'Solid brick 225 mm, plastered', u: 2.1 },
  { id: 'w-solid-brick-ewi', kind: 'wall', name: 'Solid brick + 100 mm EWI', u: 0.3 },
  { id: 'w-solid-brick-iwi', kind: 'wall', name: 'Solid brick + 60 mm IWI board', u: 0.45 },
  { id: 'w-cavity-unfilled', kind: 'wall', name: 'Cavity wall, unfilled', u: 1.6 },
  { id: 'w-cavity-filled', kind: 'wall', name: 'Cavity wall, retro-filled', u: 0.55 },
  { id: 'w-cavity-1980s', kind: 'wall', name: 'Cavity, partial fill (1980s–90s)', u: 0.45 },
  { id: 'w-cavity-2006', kind: 'wall', name: 'Cavity, full fill (2006+ regs)', u: 0.3 },
  { id: 'w-new-build', kind: 'wall', name: 'New build (2022 Part L)', u: 0.18 },
  { id: 'w-stone-500', kind: 'wall', name: 'Stone 500 mm', u: 1.7 },
  { id: 'w-timber-frame', kind: 'wall', name: 'Timber frame, 90 mm insulation', u: 0.35 },
  { id: 'w-flint', kind: 'wall', name: 'Flint / cobble 400 mm', u: 1.9 },
  // Internal / party
  { id: 'w-int-stud', kind: 'wall', name: 'Internal stud, plasterboard', u: 1.7 },
  { id: 'w-int-block', kind: 'wall', name: 'Internal block 100 mm, plastered', u: 2.0 },
  { id: 'w-int-brick', kind: 'wall', name: 'Internal brick 112 mm, plastered', u: 1.9 },
  { id: 'w-party-solid', kind: 'wall', name: 'Party wall, solid', u: 0.5 },
  // Windows
  { id: 'g-single', kind: 'window', name: 'Single glazed, timber', u: 4.8 },
  { id: 'g-secondary', kind: 'window', name: 'Single + secondary glazing', u: 2.4 },
  { id: 'g-double-old', kind: 'window', name: 'Double glazed, pre-2002', u: 2.8 },
  { id: 'g-double', kind: 'window', name: 'Double glazed, 2002–2021', u: 2.0 },
  { id: 'g-double-new', kind: 'window', name: 'Double glazed, A-rated', u: 1.4 },
  { id: 'g-triple', kind: 'window', name: 'Triple glazed', u: 0.8 },
  { id: 'g-velux', kind: 'rooflight', name: 'Roof window (double)', u: 1.5 },
  // Doors
  { id: 'd-timber-solid', kind: 'door', name: 'Solid timber door', u: 3.0 },
  { id: 'd-glazed-old', kind: 'door', name: 'Half-glazed door, old', u: 3.5 },
  { id: 'd-composite', kind: 'door', name: 'Composite door', u: 1.4 },
  { id: 'd-patio-double', kind: 'door', name: 'Patio / bi-fold, double glazed', u: 2.0 },
  { id: 'd-internal', kind: 'door', name: 'Internal door', u: 2.5 },
  // Floors
  { id: 'f-solid-uninsulated', kind: 'floor', name: 'Solid concrete, uninsulated', u: 0.7 },
  { id: 'f-suspended-timber', kind: 'floor', name: 'Suspended timber, uninsulated', u: 0.8 },
  { id: 'f-suspended-insulated', kind: 'floor', name: 'Suspended timber, 100 mm insulation', u: 0.3 },
  { id: 'f-solid-insulated', kind: 'floor', name: 'Solid, 75 mm PIR', u: 0.25 },
  { id: 'f-new-build', kind: 'floor', name: 'New build ground floor', u: 0.13 },
  { id: 'f-intermediate', kind: 'floor', name: 'Intermediate timber floor', u: 1.7 },
  { id: 'f-intermediate-concrete', kind: 'floor', name: 'Intermediate concrete floor', u: 1.4 },
  // Roofs & ceilings
  { id: 'r-loft-none', kind: 'ceiling', name: 'Ceiling to loft, no insulation', u: 2.3 },
  { id: 'r-loft-100', kind: 'ceiling', name: 'Ceiling to loft, 100 mm wool', u: 0.4 },
  { id: 'r-loft-200', kind: 'ceiling', name: 'Ceiling to loft, 200 mm wool', u: 0.2 },
  { id: 'r-loft-270', kind: 'ceiling', name: 'Ceiling to loft, 270 mm wool', u: 0.16 },
  { id: 'r-intermediate', kind: 'ceiling', name: 'Intermediate ceiling (room above)', u: 1.7 },
  { id: 'r-flat-old', kind: 'roof', name: 'Flat roof, uninsulated', u: 1.5 },
  { id: 'r-flat-insulated', kind: 'roof', name: 'Flat roof, 120 mm PIR', u: 0.18 },
  { id: 'r-pitched-rafter', kind: 'roof', name: 'Pitched, insulated at rafters', u: 0.18 },
  { id: 'r-sloping-old', kind: 'roof', name: 'Sloping ceiling, 50 mm insulation', u: 0.65 },
];

export const KIND_NAMES: Record<FabricKind, string> = {
  wall: 'Walls',
  window: 'Windows',
  door: 'Doors',
  floor: 'Floors',
  roof: 'Roofs',
  ceiling: 'Ceilings',
  rooflight: 'Roof windows',
};
