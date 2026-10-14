# TRAVERSE — Marswalk Mission Planner 🚀

Plan an astronaut EVA walk across **Jezero Crater**, see it on the real Mars globe,
and export it as `route.json` that drives the **Perseverance rover physics sim** in
Blender. Built for the [NASA Space Apps Challenge](https://spaceappschallenge.nasa.gov).

**Live app:** _GitHub Pages URL is printed after `gh api` deploy below_

## What it does

1. **🌐 Globe** — full-planet Mars in 3D (CesiumJS + official **Cesium Mars** 3D Tiles:
   MOLA+HRSC blended terrain, Viking color mosaic, hi-res Jezero CTX inset), POI tour
   from Olympus Mons to Valles Marineris, touchdown sites for Perseverance and Curiosity,
   and the **actual Perseverance rover** (NASA/JPL GLB) placed at its live position
   (Sol-2006 snapshot) — hit **🤖 Fly to rover** to dive down to it.
2. **🗺️ Jezero Planner** — 2D map (OpenPlanetaryMap basemap + NASA Mars Trek MOLA
   hillshade) with **Perseverance's actual traverse** streamed live from
   `mars.nasa.gov` GIS (GeoJSON, Sol-tagged, with real MOLA elevations per segment).
   Click to plan your own route; live analytics: distance (haversine, R = 3,389.5 km),
   EVA time at 1–2 km/h suited-walk pace, science stops, slope flags (>15° caution,
   >25° hazard — vs. the sim's 40 cm step / 45° tip-over limits).
3. **⛰ Elevation** — route vertices are sampled against the 3D Mars globe
   (`sampleHeightMostDetailed`) and rendered as a profile chart.
4. **⬇ route.json** — a single file with waypoints (lat/lon/MOLA elevation/science
   flags) + EVA assumptions. `blender/marswalk_bridge.py` converts it to metre-space
   course coordinates and bakes the drive onto `Rover_Rig` (v1 pre-vis; v2 feeds the
   same waypoints into the live rocker-bogie physics driver as an autopilot).

## Run locally

```powershell
python -m http.server 8000        # then open http://localhost:8000
node server/server.js             # optional: PDS ODE REST proxy on :8001
```

Blender bridge:

```powershell
blender Untitled.blend --background --python blender\marswalk_bridge.py -- path\to\route.json --speed 1.5
```

## Data sources & attribution

- **Cesium Mars** 3D Tiles (ion asset 3644333) — imagery © NASA/JPL/USGS Viking + CTX;
  terrain MOLA (MGS) blended with HRSC (MEX), © NASA/USGS/ESA/DLR. CesiumJS is Apache-2.0.
- **Mars Trek** WMTS layers — NASA/JPL-Caltech.
- **Perseverance traverse** GeoJSON + **rover 3D model** — NASA/JPL-Caltech M20 GIS,
  public domain. Both are vendored in `assets/` because `mars.nasa.gov` sends no CORS
  headers (browser fetch would be blocked). To refresh the snapshot:

```powershell
Invoke-WebRequest 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json' -OutFile assets\M20_traverse.json
Invoke-WebRequest 'https://mars.nasa.gov/system/resources/gltf_files/25042_Perseverance.glb' -OutFile assets\Perseverance.glb
# then re-extract assets\rover_position.json (last feature's last coordinate) and commit
```
- **OpenPlanetaryMap** Mars basemap — OPM community.
- **PDS Orbital Data Explorer** REST — Washington University St. Louis / NASA PDS.

## Security note

`src/config.js` embeds a Cesium ion access token (required for the Mars asset).
It is intentionally public because the app is static-hosted — **restrict the token to
the deployed domain in the Cesium ion console** (Token → Allowed URLs) before
widely sharing the app.

## Project structure

```
index.html, src/{main,globe,planner,analytics,config}.js   static web app (no build step)
css/style.css
server/server.js          zero-dependency Node proxy for PDS ODE REST
blender/marswalk_bridge.py  route.json -> rover drive keyframes
DESIGN.md                 architecture + mission-visualisation design
```