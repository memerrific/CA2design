# CA2 Designer

Heating design and handover pack software for CA2 Mechanical & Electrical.

**Live app:** https://memerrific.github.io/CA2design/
Runs entirely in the browser: project data is stored on the device (localStorage)
and can be exported/imported as JSON. Nothing is sent to a server.

## What it does

| Area | Details |
| --- | --- |
| Floor plans | Import Polycam floor plans (DXF) or a plan image, trace rooms with snapping, set scale with a known dimension. Shared walls are detected and linked automatically. |
| Heat loss | Room-by-room to the structure of BS EN 12831-1: fabric U·A·ΔT (walls, windows, doors, floors, ceilings/roofs), ground floors via annual mean temperature, adjacent rooms/neighbours/unheated spaces, ventilation 0.33·n·V·ΔT, thermal bridging and margin. Built-in UK U-value library plus custom fabrics. |
| Radiators | Existing radiator check at the design flow temperature (ΔT50 correction, n = 1.3), flow temperature each room needs, index room, new/replacement radiator suggestions. |
| Underfloor | BS EN 1264-2 wet screed output by pipe centres, floor covering, screed depth; floor surface temperature limits; loop count/length; flow-meter setting per loop; manifold totals. |
| Pipework & Kv | Flow from load and ΔT, Darcy–Weisbach pressure drop (copper, PE-X, MLCP, steel, ABS/PVC pool pipe), auto-sizing to velocity/Pa/m limits, index circuit pump head, Kv calculator and valve pressure drops. Water or glycol mixes. |
| Equipment | Plant list with make/model/serial/location (heat pumps, oil boilers, cascades, pool heat pumps, cylinders, PV, AC, MVHR…). |
| Plant room | Low loss header design from the loads leaving the plant room: circuit flows, pipe sizes, pump duties, Kv and valve authority, primary/secondary flow balance and resulting temperatures, header bore. Printable design sheet. |
| Pricing | Materials takeoff from the design, company price list, sundries, markup, labour, VAT; merchant request for quotation (PDF/CSV/JSON). |
| Handover pack | Branded A4 pack: cover, summary, coloured floor plans, heat loss, radiator, UFH, pipework, valves, equipment, commissioning record with sign-off, and your own text sections. Reorder, rename, toggle, then Print / save PDF. |

Where every method comes from, and how far it has been checked, is listed in the app under **Methods & sources** (`src/pages/Methods.tsx`).

All calculations are design aids; a competent person should check inputs before sign-off.
Radiator outputs use generic panel data. Use the manufacturer's tables for the final selection.

## Website

Every push to `main` runs the tests, builds the app and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). In the repo's Settings → Pages, Source must be set to
**GitHub Actions**.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # engine unit tests
npm run build    # production build in designer/dist
```

Calculation code is in `src/engine/` (no UI dependencies, unit-tested in
`src/engine/engine.test.ts`). Reference data (U-values, room defaults, design
temperatures) is in `src/data/`.
