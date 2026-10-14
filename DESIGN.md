# MARSWALK PLANNER — Design & Pitch Document
**NASA Space Apps Challenge — layered, integrated view of a location/route on Mars for human explorers**

> One-line pitch: *"Google-Maps-meets-mission-control for the first Marswalk — pick a route on Mars, and instantly see terrain, hazards, weather context, and every NASA science dataset collected along the way."*

---

## 1. Challenge Understanding

The challenge asks for a **layered, integrated view of a location or route** on the Martian surface that:
- Pulls together data from **multiple NASA science missions** (Viking, MGS, Odyssey, MRO, MAVEN, MER, Perseverance…)
- Helps a human explorer **plan and carry out a successful Marswalk** (EVA)
- Supports **route details, destination info, current conditions, and new science along the way**

Key differentiator: don't just show a map — build a **decision-support tool**: the map must *compute* something (EVA time, hazard risk, science value) from NASA data.

### How this will be judged (Space Apps criteria)
| Criterion | How we win it |
|---|---|
| **Impact** | Directly supports astronaut safety + science ROI on future crewed missions (Artemis→Mars roadmap relevance) |
| **Creativity** | Route-centric (not map-centric) UX: draw a walk, get a mission brief |
| **Validity** | All data from real NASA sources (Mars Trek WMTS, PDS ODE REST) with citations on-screen |
| **Relevance** | Uses genuine NASA mission datasets spanning 4 decades & 6+ missions |
| **Presentation** | Live interactive demo + 1 killer "story route" (e.g., Curiosity's traverse or a Valles Marineris rim walk) |

---

## 2. Concept: "TRAVERSE — Marswalk Mission Planner"

**Core user story:**
> An astronaut at basecamp wants to visit a supposed clay exposure 1.2 km away. She draws the route on the map. In <5 seconds the app returns: distance, elevation gain/loss, cumulative slope, estimated EVA duration & consumables, steep-slope and dust-trap hazard flags, the best route legs, plus a science dossier of every HiRISE/CRISM/THEMIS observation that ever covered her path — each clickable with browse imagery.

**MVP features (build order):**
1. **Layered map** — Leaflet/MapLibre map with toggleable NASA Mars Trek WMTS layers (see §4):
   - Viking MDIM color basemap (context)
   - MOLA elevation hillshade + color elevation (terrain)
   - CTX / HiRISE footprints (high-res detail)
   - THEMIS day/night IR (thermal properties, dust, rock abundance)
   - Geologic map + nomenclature (named craters/valleys along route)
2. **Route drawing** — click points to draw a polyline; app splits it into legs.
3. **Terrain analytics** — elevation profile chart (from MOLA data), distance, grade per segment, min/max elevation; **EVA time estimate** with Mars-appropriate walking speed (~1–2 km/h with suited overheads) and consumables (O2, water, battery) bars.
4. **Hazard flags** — segments where slope > threshold (e.g., >15°); night-IR "dust trap" hints (low thermal inertia = fine dust, footing risk); crater-rim/steep-wall proximity flags.
5. **Science waypoints** — for the route's bounding box, query **PDS ODE REST** for HiRISE RDRs, CRISM mineral obs, THEMIS IR; render as map markers with thumbnails; click → data card (acquisition date, resolution, PDS product link, mini science note).
6. **Mission brief export** — one-click "Mission Brief" (printable HTML/summary): route stats, hazards, science targets, timeline. Great for the demo/pitch.

**Stretch goals (if time allows):**
- Slope-based **routing cost** (A* on MOLA grid): "safest path" vs. "fastest path" toggle
- **What-if weather context**: sun azimuth/elevation at mission sol (lighting for photography/navigation)
- **2.5D/3D view** (CesiumJS with Mars WMTS drapes) — very impressive on stage
- Comparison mode: overlay Curiosity/Perseverance actual traverses ("how the robots did it")

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────┐
│                 FRONTEND (single page)                  │
│  Leaflet (2D) or Cesium (3D stretch) + vanilla JS      │
│  • WMTS tile layers (Mars Trek) — direct, no key       │
│  • Route drawing (leaflet-draw / polyline clicks)      │
│  • Elevation profile chart (Chart.js / canvas)         │
└──────────────┬─────────────────────────────────────────┘
               │ JSON
┌──────────────┴─────────────────────────────────────────┐
│         BACKEND (small API: Flask/FastAPI or           │
│         serverless functions) — avoids CORS issues     │
│  /api/elevation   → sample MOLA DEM along route        │
│  /api/ode-scan    → PDS ODE REST queries (bbox)        │
│  /api/brief       → assemble mission brief JSON        │
└──────────────┬─────────────────────────────────────────┘
               │ HTTP (no auth, no API keys needed!)
┌──────────────┴─────────────────────────────────────────┐
│                 NASA DATA SERVICES                      │
│  • trek.nasa.gov WMTS tiles (imagery/elevation)        │
│  • oderest.rsl.wustl.edu/live2 (PDS product metadata)  │
│  • Optional: GDS MOLA PEDR granular query              │
└────────────────────────────────────────────────────────┘
```

**Why this stack:** zero API keys, zero cost, tiles come pre-rendered by NASA (no GIS processing needed), ODE gives science metadata + thumbnails. A 2-person team can ship this in <8 hours. If you prefer Python: Streamlit + `folium`/`ipyleaflet` works too.

**MOLA elevation along a route — two options:**
- **Option A (easiest):** query ODE/GDS **MOLA PEDR** point elevations inside the route bbox (GDS REST: `https://oderest.rsl.wustl.edu/livegds`) and interpolate.
- **Option B:** download the global MOLA DEM GeoTIFF once (~2 GB, or a regional subset), serve samples from your backend via `rasterio`. More control, better profile charts.

---

## 4. Data Sources (verified working during research)

### 4.1 NASA Mars Trek — WMTS tile layers (basemaps) [CONFIRMED]
- Doc: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- Template: `https://{endpoint}/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png|.jpg`
- Each layer has a `GetCapabilities` XML listing the exact `{Style}` and `{TileMatrixSet}` identifiers — parse it during build (capability URLs vary per layer; get the layer list from the Trek API page above and follow its per-product links).
- Layers to include: Viking MDIM color mosaic, MOLA elevation (color + hillshade), THEMIS day & night IR, CTX mosaic, HiRISE footprints, geologic map, TES dust, nomenclature labels.
- **Build-time task:** verify each layer's exact identifier by parsing GetCapabilities (curl + grep, ~15 min). Fallbacks: USGS Astrogeology tiled services (astrotiles.wr.usgs.gov) and OpenPlanetaryMap community tiles.

### 4.2 PDS Orbital Data Explorer (ODE) REST [LIVE-VERIFIED]
- Endpoint: `https://oderest.rsl.wustl.edu/live2?query=...` (XML; add `&json=1`)
- **Valid IIPT query (verified live):** `?query=iipt&target=mars&json=1` → lists every instrument/product-type combo (~507 KB). Key verified combos for our app:
  - `IHID=MRO, IID=CRISM, PT=DDR` — derived data records (1,022,029 products!) → mineralogy context
  - `IHID=MRO, IID=CRISM, PT=CDR / ANCILL`
  - `IHID=MRO, IID=HiRISE` with `PT=RDR / EDR / DTM` (DTM = digital terrain models → slope maps!)
  - THEMIS global thermal inertia: `PT=GLOBAL_TI_DAY_2007` / `GLOBAL_TI_NIGHT_2007` (only 4 products, global rasters!)
  - MOLA (`MGS`) PEDR via GDS granular query
- **Product metadata query pattern (responds, verified):** `?query=product&ihid=mro&iid=crism&pt=ddr&json=1` → returns `Count` (e.g., 1,022,029).
  **Build-time task (~30 min):** confirm exact bounding-box parameter names against the ODE REST V2.1.6 User's Manual PDF (linked on https://oderest.rsl.wustl.edu/ — candidates: `olat1/olon1/olat2/olon2` + intersection flag `fpI=I`, or `min_lat/min_lon/max_lat/max_lon`). The live IIPT response also documents which combos accept footprint queries. Working Python reference: https://github.com/samiriff/mars-ode-data-access
- Results include product ID, footprint, observation time, and **browse/thumbnail URLs** → perfect for clickable science waypoints.

### 4.3 Other curated sources ("current conditions" & richness)
- **MEDA weather (Perseverance):** daily air temp/pressure/dust → "conditions at Jezero" card (PDS Atmospheres node / mars.nasa.gov).
- **MAVEN** and **ExoMars TGO ACS** (verified in ODE IIPT list: `EM16TGO/ACS`, data through 2026) → atmospheric context.
- **USGS Gazetteer of Planetary Nomenclature** → named features along route ("you'll pass Paddington crater").
- Demo sites with dense data: **Jezero Crater (Perseverance)**, **Gale Crater (Curiosity)**, **Valles Marineris** rim.

---

## 5. Route Analytics — the math (make it defensible)

- **Distance:** haversine over Mars radius **R = 3,389.5 km**, per polyline leg.
- **Elevation profile:** sample MOLA every ~50–100 m along route → chart with gain/loss.
- **Grade:** `atan2(dh, horizontal_dist)` per segment → hazard flag if >15° (steep) / >25° (very steep).
- **EVA time:** suited walking speed 1–2 km/h (cite NASA HRP suited-locomotion studies) + fixed overheads (don/doff, setup at waypoints).
- **Consumables:** linear from EVA time (O2 rate, water, CO2 scrubber) as gauges with margin.
- **Hazard score per segment:** weighted sum: slope grade + thermal-inertia dust risk (low TI = loose fines) + shadow/lighting → color route polyline green/yellow/red.
- **Science value score:** count of HiRISE DTMs + CRISM mineral detections within corridor → "science-rich corridor" badges.
- Be transparent on-slide: these are **engineering estimates with cited assumptions**, not official NASA EVA rules — judges reward honest, well-sourced modeling.

---

## 6. Demo Story (for judges) — 3–4 minutes

1. **Hook (20 s):** "In 2039, an astronaut wakes at basecamp on Mars. Where is it safe to walk, and what's worth walking to? NASA already has the data. We bring it together."
2. **Layered map (30 s):** toggle MOLA elevation → THEMIS night IR → CTX. "Four decades of missions, one view."
3. **Draw a route** in Jezero or Gale (60 s): profile chart, EVA time, hazard coloring, consumable bars appear live.
4. **Science waypoints (45 s):** click a CRISM waypoint → thumbnail + "Fe/Mg phyllosilicates detected here — this is your 300-m side trip."
5. **Mission Brief export (25 s):** print-ready sheet. "The astronaut prints it, pockets it, walks."
6. **Close:** "Built entirely on open NASA data — Mars Trek tiles, PDS Orbital Data Explorer, MOLA, THEMIS, HiRISE, CRISM. Ready for the first bootprints."

---

## 7. Hackathon-Day Build Checklist (realistic 8–12 h)

| Time | Task |
|---|---|
| 0:00–0:45 | Verify Trek layer identifiers (parse GetCapabilities with curl); verify ODE bbox params vs REST manual PDF |
| 0:45–1:30 | Map scaffold: Leaflet + 3 layers + basemap switcher |
| 1:30–2:30 | Route drawing + haversine distance + polyline rendering |
| 2:30–4:30 | Elevation source (MOLA PEDR via GDS or regional DEM) + profile chart |
| 4:30–6:00 | ODE scan endpoint + science waypoint markers + data cards |
| 6:00–7:00 | Hazard coloring + EVA/consumables gauges |
| 7:00–8:00 | Mission Brief page + styling pass |
| 8:00–9:00 | Rehearse demo route, screenshots for slides, credit NASA sources on-screen |

**Team split:** 1 frontend/map, 1 backend/ODE. (Solo: frontend first, mock ODE JSON with 5–10 cached products, then go live.)

---

## 8. Pitch Slide Outline (8 slides)

1. Title + team + challenge name
2. Problem: astronauts need mission-grade maps, not web maps
3. Solution: TRAVERSE — route-first, data-everywhere (screenshot)
4. Architecture: NASA Trek WMTS + PDS ODE (diagram from §3)
5. The science: which missions and why (MOLA, THEMIS, HiRISE, CRISM, MEDA)
6. Live demo (or 3 screenshots if offline risk)
7. What it computes: EVA time, hazards, science value — assumptions cited
8. Roadmap: 3D Cesium view, A* safest routing, MAVEN weather; credits & data links

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Trek layer identifiers hard to find | Parse GetCapabilities early; fallback to USGS Astrogeology / OpenPlanetaryMap tiles |
| ODE bbox params misbehaving | Cache 5–10 products per demo region as JSON fallback; live query as enhancement |
| Elevation data too heavy | Use PEDR point interpolation or a regional DEM subset, not the full global 3D DEM |
| Slow tiles during demo | Pre-load/zoom to demo region beforehand; keep screenshot backups |

---

*Document generated during research session on 2026-10-15. All live-verified endpoints noted with [CONFIRMED] / [LIVE-VERIFIED].*
