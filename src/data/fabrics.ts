// U-values (W/m²·K). Each entry records its source. Where possible these are
// the same defaults the MCS Heat Load Calculator uses:
//   RdSAP 10 Specification (BRE, June 2025) for external elements (England tables),
//   CIBSE Domestic Heating Design Guide 2026 values as listed in the MCS
//   calculator documentation for internal elements.
// Entries marked "typical" are general reference values, not from those tables.
// Use measured / calculated U-values when they are known.

export type FabricKind = 'wall' | 'window' | 'door' | 'floor' | 'roof' | 'ceiling' | 'rooflight';

export interface Fabric {
  id: string;
  kind: FabricKind;
  name: string;
  u: number;
  source?: string;
  custom?: boolean;
  /** U-value is calculated from the project's ground floor inputs. */
  calculated?: 'ground-floor';
}

const R6 = 'RdSAP 10 Table 6';
const R13 = 'RdSAP 10 Table 13 / §5.7';
const R12 = 'RdSAP 10 Table 12 / §5.6';
const R15 = 'RdSAP 10 Table 15';
const R16 = 'RdSAP 10 Table 16';
const R17 = 'RdSAP 10 Table 17';
const R18 = 'RdSAP 10 Table 18';
const R20 = 'RdSAP 10 Table 20';
const R24 = 'RdSAP 10 Table 24';
const R26 = 'RdSAP 10 Table 26';
const CIBSE = 'CIBSE DHDG 2026 (via MCS docs)';
const TYP = 'typical';

export const FABRICS: Fabric[] = [
  // External walls: solid brick (age bands A–E, by thickness)
  { id: 'w-solid-brick-thin', kind: 'wall', name: 'Solid brick < 200 mm, as built (A–E)', u: 2.5, source: R13 },
  { id: 'w-solid-brick-225', kind: 'wall', name: 'Solid brick 200–280 mm, as built (A–E)', u: 1.7, source: R13 },
  { id: 'w-solid-brick-thick', kind: 'wall', name: 'Solid brick 280–420 mm, as built (A–E)', u: 1.4, source: R13 },
  { id: 'w-solid-brick-vthick', kind: 'wall', name: 'Solid brick > 420 mm, as built (A–E)', u: 1.1, source: R13 },
  { id: 'w-solid-brick-iwi', kind: 'wall', name: 'Solid brick/stone + 50 mm insulation (A–E)', u: 0.55, source: R6 },
  { id: 'w-solid-brick-ewi', kind: 'wall', name: 'Solid brick/stone + 100 mm insulation (A–E)', u: 0.32, source: R6 },
  { id: 'w-solid-brick-150', kind: 'wall', name: 'Solid brick/stone + 150 mm insulation (A–E)', u: 0.23, source: R6 },
  // Stone (equations in RdSAP §5.6 evaluated at the thickness shown)
  { id: 'w-stone-sand-400', kind: 'wall', name: 'Sandstone/limestone 400 mm (A–E)', u: 1.9, source: R12 },
  { id: 'w-stone-500', kind: 'wall', name: 'Sandstone/limestone 500 mm (A–E)', u: 1.68, source: R12 },
  { id: 'w-stone-sand-600', kind: 'wall', name: 'Sandstone/limestone 600 mm (A–E)', u: 1.52, source: R12 },
  { id: 'w-stone-gran-400', kind: 'wall', name: 'Granite/whinstone 400 mm (A–E)', u: 2.1, source: R12 },
  { id: 'w-stone-gran-500', kind: 'wall', name: 'Granite/whinstone 500 mm (A–E)', u: 1.87, source: R12 },
  { id: 'w-stone-gran-600', kind: 'wall', name: 'Granite/whinstone 600 mm (A–E)', u: 1.7, source: R12 },
  { id: 'w-flint', kind: 'wall', name: 'Flint / cobble 400 mm', u: 1.9, source: TYP },
  // Cavity
  { id: 'w-cavity-unfilled', kind: 'wall', name: 'Cavity as built, unfilled (A–E, pre-1976)', u: 1.5, source: R6 },
  { id: 'w-cavity-f', kind: 'wall', name: 'Cavity as built (F, 1976–82)', u: 1.0, source: R6 },
  { id: 'w-cavity-1980s', kind: 'wall', name: 'Cavity as built (G–H, 1983–95)', u: 0.6, source: R6 },
  { id: 'w-cavity-i', kind: 'wall', name: 'Cavity as built (I, 1996–2002)', u: 0.45, source: R6 },
  { id: 'w-cavity-j', kind: 'wall', name: 'Cavity as built (J, 2003–06)', u: 0.35, source: R6 },
  { id: 'w-cavity-2006', kind: 'wall', name: 'Cavity as built (K, 2007–11)', u: 0.3, source: R6 },
  { id: 'w-cavity-l', kind: 'wall', name: 'Cavity as built (L, 2012–22)', u: 0.28, source: R6 },
  { id: 'w-cavity-m', kind: 'wall', name: 'Cavity as built (M, 2023+)', u: 0.26, source: R6 },
  { id: 'w-cavity-filled', kind: 'wall', name: 'Filled cavity (A–E, pre-1976)', u: 0.7, source: R6 },
  { id: 'w-cavity-filled-f', kind: 'wall', name: 'Filled cavity (F, 1976–82)', u: 0.4, source: R6 },
  { id: 'w-cavity-filled-gh', kind: 'wall', name: 'Filled cavity (G–H, 1983–95)', u: 0.35, source: R6 },
  // Timber frame / system build
  { id: 'w-timber-a', kind: 'wall', name: 'Timber frame as built (A, pre-1900)', u: 2.5, source: R6 },
  { id: 'w-timber-bc', kind: 'wall', name: 'Timber frame as built (B–C, 1900–49)', u: 1.9, source: R6 },
  { id: 'w-timber-frame', kind: 'wall', name: 'Timber frame as built (F–H, 1976–95)', u: 0.45, source: R6 },
  { id: 'w-system', kind: 'wall', name: 'System build as built (A–D, pre-1967)', u: 2.0, source: R6 },
  { id: 'w-new-build', kind: 'wall', name: 'New build to 2022 Part L (design value)', u: 0.18, source: TYP },
  // Internal walls
  { id: 'w-int-stud', kind: 'wall', name: 'Internal stud partition', u: 1.76, source: CIBSE },
  { id: 'w-int-brick', kind: 'wall', name: 'Internal solid brick', u: 2.05, source: CIBSE },
  { id: 'w-int-block', kind: 'wall', name: 'Internal breeze block', u: 2.76, source: CIBSE },
  { id: 'w-int-aerated', kind: 'wall', name: 'Internal aerated block', u: 0.82, source: CIBSE },
  // Party walls
  { id: 'w-party-solid', kind: 'wall', name: 'Party wall, solid masonry / timber / system', u: 0.0, source: R15 },
  { id: 'w-party-cavity', kind: 'wall', name: 'Party wall, cavity unfilled', u: 0.5, source: R15 },
  { id: 'w-party-filled', kind: 'wall', name: 'Party wall, cavity filled', u: 0.2, source: R15 },
  { id: 'w-party-unknown', kind: 'wall', name: 'Party wall, unknown (house)', u: 0.25, source: R15 },

  // Windows (whole window incl. frame)
  { id: 'g-single', kind: 'window', name: 'Single glazed, PVC/wood', u: 4.8, source: R24 },
  { id: 'g-single-metal', kind: 'window', name: 'Single glazed, metal', u: 5.7, source: R24 },
  { id: 'g-double-6', kind: 'window', name: 'Double pre-2002, 6 mm gap, PVC/wood', u: 3.1, source: R24 },
  { id: 'g-double-old', kind: 'window', name: 'Double pre-2002, 12 mm gap, PVC/wood', u: 2.8, source: R24 },
  { id: 'g-double-16', kind: 'window', name: 'Double pre-2002, 16 mm+ gap, PVC/wood', u: 2.7, source: R24 },
  { id: 'g-double-old-metal', kind: 'window', name: 'Double pre-2002, 12 mm gap, metal', u: 3.4, source: R24 },
  { id: 'g-double', kind: 'window', name: 'Double/triple 2002–2021, PVC/wood', u: 2.0, source: R24 },
  { id: 'g-double-metal', kind: 'window', name: 'Double/triple 2002–2021, metal', u: 2.2, source: R24 },
  { id: 'g-double-new', kind: 'window', name: 'Double/triple 2022 or later', u: 1.4, source: R24 },
  { id: 'g-triple', kind: 'window', name: 'Triple, high performance (known data)', u: 0.8, source: TYP },
  { id: 'g-secondary', kind: 'window', name: 'Single + secondary glazing, normal glass', u: 2.9, source: R24 },
  { id: 'g-secondary-lowe', kind: 'window', name: 'Single + secondary glazing, low-E', u: 2.2, source: R24 },
  { id: 'g-velux-old', kind: 'rooflight', name: 'Roof window, double pre-2002', u: 3.1, source: R24 },
  { id: 'g-velux', kind: 'rooflight', name: 'Roof window, 2002–2021', u: 2.3, source: R24 },
  { id: 'g-velux-new', kind: 'rooflight', name: 'Roof window, 2022 or later', u: 1.6, source: R24 },

  // Doors (glazed doors ≥ 60% glass should be entered as windows)
  { id: 'd-timber-solid', kind: 'door', name: 'External door (A–J, pre-2007)', u: 3.0, source: R26 },
  { id: 'd-door-k', kind: 'door', name: 'External door (K, 2007–11)', u: 2.0, source: R26 },
  { id: 'd-door-l', kind: 'door', name: 'External door (L, 2012–22)', u: 1.8, source: R26 },
  { id: 'd-composite', kind: 'door', name: 'External door (M, 2023+) / modern composite', u: 1.4, source: R26 },
  { id: 'd-door-corridor', kind: 'door', name: 'Door to unheated corridor/stairwell', u: 1.4, source: R26 },
  { id: 'd-glazed-old', kind: 'door', name: 'Solid wood, 25% single glazed', u: 3.5, source: CIBSE },
  { id: 'd-patio-double', kind: 'door', name: 'Patio / bi-fold, double 2002–21 (≥ 60% glass: window)', u: 2.0, source: R24 },
  { id: 'd-internal', kind: 'door', name: 'Internal door, solid wood', u: 3.0, source: CIBSE },

  // Ground and exposed floors
  { id: 'f-ground-calc', kind: 'floor', name: 'Ground floor – calculated from area & perimeter (ISO 13370)', u: 0, source: 'RdSAP 10 §5.12 / BS EN ISO 13370', calculated: 'ground-floor' },
  { id: 'f-solid-uninsulated', kind: 'floor', name: 'Ground floor, solid uninsulated (typical, use calculated)', u: 0.7, source: TYP },
  { id: 'f-suspended-timber', kind: 'floor', name: 'Ground floor, suspended uninsulated (typical, use calculated)', u: 0.8, source: TYP },
  { id: 'f-solid-insulated', kind: 'floor', name: 'Ground floor, 75 mm PIR (typical)', u: 0.25, source: TYP },
  { id: 'f-exposed-ag', kind: 'floor', name: 'Exposed/semi-exposed floor, as built (A–G)', u: 1.2, source: R20 },
  { id: 'f-exposed-hi', kind: 'floor', name: 'Exposed/semi-exposed floor, as built (H–I)', u: 0.51, source: R20 },
  { id: 'f-exposed-50', kind: 'floor', name: 'Exposed floor, 50 mm insulation (A–I)', u: 0.5, source: R20 },
  { id: 'f-exposed-100', kind: 'floor', name: 'Exposed floor, 100 mm insulation (A–I)', u: 0.3, source: R20 },
  { id: 'f-exposed-k', kind: 'floor', name: 'Exposed floor (K–L, 2007–22)', u: 0.22, source: R20 },
  { id: 'f-new-build', kind: 'floor', name: 'New build ground floor (design value)', u: 0.13, source: TYP },
  // Internal floors (floor of a room, heat flowing down)
  { id: 'f-intermediate', kind: 'floor', name: 'Intermediate floor, uninsulated (heat down)', u: 1.41, source: CIBSE },
  { id: 'f-intermediate-ins', kind: 'floor', name: 'Intermediate floor, 100 mm insulation (heat down)', u: 0.31, source: CIBSE },
  { id: 'f-intermediate-concrete', kind: 'floor', name: 'Party floor, concrete slab uninsulated (flats)', u: 1.82, source: CIBSE },
  { id: 'f-party-timber', kind: 'floor', name: 'Party floor, timber joists uninsulated (flats)', u: 1.75, source: CIBSE },

  // Ceilings to loft (insulation at joists)
  { id: 'r-loft-none', kind: 'ceiling', name: 'Ceiling to loft, no insulation', u: 2.3, source: R16 },
  { id: 'r-loft-50', kind: 'ceiling', name: 'Ceiling to loft, 50 mm', u: 0.68, source: R16 },
  { id: 'r-loft-100', kind: 'ceiling', name: 'Ceiling to loft, 100 mm', u: 0.4, source: R16 },
  { id: 'r-loft-150', kind: 'ceiling', name: 'Ceiling to loft, 150 mm', u: 0.3, source: R16 },
  { id: 'r-loft-200', kind: 'ceiling', name: 'Ceiling to loft, 200 mm', u: 0.21, source: R16 },
  { id: 'r-loft-270', kind: 'ceiling', name: 'Ceiling to loft, 270 mm', u: 0.16, source: R16 },
  { id: 'r-loft-300', kind: 'ceiling', name: 'Ceiling to loft, 300 mm', u: 0.14, source: R16 },
  { id: 'r-loft-400', kind: 'ceiling', name: 'Ceiling to loft, 400 mm+', u: 0.11, source: R16 },
  // Internal ceilings (heat flowing up)
  { id: 'r-intermediate', kind: 'ceiling', name: 'Intermediate ceiling, uninsulated (heat up)', u: 1.73, source: CIBSE },
  { id: 'r-intermediate-ins', kind: 'ceiling', name: 'Intermediate ceiling, 100 mm insulation (heat up)', u: 0.32, source: CIBSE },
  // Flat roofs / sloping ceilings
  { id: 'r-flat-old', kind: 'roof', name: 'Flat roof as built (A–D, pre-1967)', u: 2.3, source: R18 },
  { id: 'r-flat-e', kind: 'roof', name: 'Flat roof as built (E, 1967–75)', u: 1.5, source: R18 },
  { id: 'r-flat-f', kind: 'roof', name: 'Flat roof as built (F, 1976–82)', u: 0.68, source: R18 },
  { id: 'r-flat-g', kind: 'roof', name: 'Flat roof as built (G, 1983–90)', u: 0.4, source: R18 },
  { id: 'r-flat-hi', kind: 'roof', name: 'Flat roof as built (H–I, 1991–2002)', u: 0.35, source: R18 },
  { id: 'r-flat-jk', kind: 'roof', name: 'Flat roof as built (J–K, 2003–11)', u: 0.25, source: R18 },
  { id: 'r-flat-insulated', kind: 'roof', name: 'Flat roof as built (L, 2012–22)', u: 0.18, source: R18 },
  { id: 'r-pitched-rafter', kind: 'roof', name: 'Pitched, insulated at rafters (L, 2012–22)', u: 0.18, source: R18 },
  { id: 'r-sloping-old', kind: 'roof', name: 'Sloping ceiling, 50 mm mineral wool', u: 0.68, source: R17 },
  { id: 'r-sloping-100', kind: 'roof', name: 'Sloping ceiling, 100 mm mineral wool', u: 0.4, source: R17 },
  { id: 'r-sloping-100pir', kind: 'roof', name: 'Sloping ceiling, 100 mm PIR', u: 0.3, source: R17 },
  { id: 'r-rir-old', kind: 'roof', name: 'Room-in-roof elements as built (A–D)', u: 2.3, source: R18 },
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
