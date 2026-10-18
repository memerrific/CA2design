# Sources checklist

What the calculations need, where it comes from, and whether we have it.
Tick items off as they are obtained and checked into the app.

Status: ✅ have it · 🔎 found, free, still to load into the app · 🛒 to buy / borrow · ⏳ later

## 1. Heat loss (highest indemnity risk)

| | Item | Cost | Status | Notes |
|---|---|---|---|---|
| [ ] | CIBSE Domestic Heating Design Guide 2026 (11th ed.) | £45 + VAT PDF (£39 members) | 🛒 | Room temperatures (Table 2-2), minimum air change rates (Table 2-18), internal U-values, thermal bridging (Table 2-9), intermittent heating (3.5.5). Source of most MCS defaults. |
| [ ] | BS EN 12831-1:2017 | ≈ €400, or read free at a library with British Standards Online (on-site), or via IET membership | 🛒 | Needed for the full ventilation/infiltration method (Annex B tables B.6–B.8), tall-room (> 4 m) corrections, Annex E ground contact. |
| [x] | MCS Heat Load Calculator documentation | Free | ✅ read | heatloadcalculator.mcscertified.com/docs. Lists design conditions, room temperatures, air change rates, thermal bridging, and which RdSAP/CIBSE table each default comes from. |
| [x] | RdSAP 10 Specification (BRE, June 2025) | Free | ✅ downloaded | Default U-values by age band (Tables 6–26), ground floor U-value method (BS EN ISO 13370 equations, §5.12), thermal bridging (Table 21), window/door U-values (Tables 24, 26), age bands (Table 1). |
| [ ] | MCS heat load calculator (the tool itself) | Free to MCS-registered installers | 🛒 access | Best cross-check for every heat loss we do. |
| [ ] | SAP 10.2 specification (BRE) | Free | 🔎 | Ventilation device rates (Table 2.1), shelter definitions (§2.5) used by MCS. |
| [ ] | Scottish Government "Tables of U-values", Part 6.C | Free | 🔎 (site blocked) | Ground floors and basements. RdSAP §5.12 already covers the equations. |
| [ ] | MCS MIS 3005-D and MGD 007 | Free | 🔎 | MIS 3005-D: what MCS requires. MGD 007 Table B1: annual mean temperatures. |

## 2. Emitters

| | Item | Cost | Status | Notes |
|---|---|---|---|---|
| [ ] | Stelrad specification brochure (Compact K1, P+, K2, K3 by height and length) | Free | 🔎 (site blocked) | Search figures at 600 high, per metre at ΔT50: K1 ≈ 980, P+ ≈ 1345, K2 ≈ 1732, K3 ≈ 2389 W. App currently overstates P+ and K2 by up to 7%. **Fix first.** |
| [ ] | Column radiator data (2, 3, 4 column steel; cast iron) | Free | 🔎 | Watts per section at ΔT50 for 300/500/600/750/1800 mm heights, plus exponent n. |
| [ ] | Radiator exponents (n) per range | Free | 🔎 | From manufacturers' EN 442 data. |
| [ ] | UFH supplier output tables (e.g. Timoleon, Uponor, Polypipe, the brand you fit) | Free | 🔎 | Use to check the BS EN 1264 model. Timoleon 150 mm centres, 40/30 °C: tile ≈ 69, wood ≈ 48, carpet ≈ 41 W/m². |
| [ ] | BS EN 1264-2 | Paid | ⏳ optional | Only if supplier tables disagree with the model. |

## 3. Plant rooms

| | Item | Cost | Status | Notes |
|---|---|---|---|---|
| [ ] | Low loss header manufacturer selection tables | Free | 🔎 | Replace the rules of thumb for header size. |
| [ ] | Boiler minimum flow / ΔT data for the boilers you fit | Free | 🔎 | |
| [ ] | CIBSE Guide C (pipe and fluid data) | Paid | ⏳ | Only if needed to confirm pressure drop tables. |

## 4. Before the app is ever sold or used by others

- [ ] Permission or licence for any tables derived from BSI / CIBSE documents.
- [ ] Check reuse terms for RdSAP / SAP data (published by BRE for government).
- [ ] Permission from manufacturers to include their radiator / UFH data.
- [ ] Independent validation write-up (vs MCS calculator and a paid designer).
- [ ] Professional indemnity and product liability cover for software.
- [ ] Terms of use and disclaimer; GDPR if customer data is stored online.
- [ ] Apple Developer account and App Store review, if an iPhone scanning app is built.

## 5. App changes waiting on these sources

- [ ] Replace external design temperatures with the 14 CIBSE Guide A stations used by MCS, plus the altitude correction (−0.6 °C per whole 100 m above the station).
- [ ] Annual mean temperatures and degree days by postcode area (from MCS docs).
- [ ] Room temperature defaults by age band (CIBSE DHDG 2026 Table 2-2, as listed in MCS docs).
- [ ] Minimum air change rates 0.5 / 0.0 (internal rooms) and BS EN 12831-1 infiltration method.
- [ ] Thermal bridging by age band (RdSAP Table 21 external; CIBSE Table 2-9 internal).
- [ ] U-value library rebuilt from RdSAP 10 by age band.
- [ ] Ground floor U-values from area and exposed perimeter (RdSAP §5.12 / BS EN ISO 13370).
- [ ] Add 0.25 m to wall heights for storeys above the lowest (MCS net internal convention).
- [ ] Radiator catalogue from Stelrad and column radiator data.
- [ ] Rooms over 4 m: emitter type and height correction (needs BS EN 12831-1).
