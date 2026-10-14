// 2D Jezero planner — Leaflet over verified tile services:
//   · OpenPlanetaryMap Mars basemap (Leaflet-native XYZ, CDN verified 200)
//   · NASA Mars Trek WMTS "Mars_MGS_MOLA_ClrShade_merge_global_463m"
//     (tile template verified live: /1.0.0/default/default028mm/{z}/{y}/{x}.jpg)
//   · Perseverance's real traverse as GeoJSON from mars.nasa.gov (verified 200,
//     LineStrings carry MOLA elevations per segment)
import { haversineM, routeStats, profileSVG } from "./analytics.js";

const JEZERO = { center: [18.42, 77.53], zoom: 12 };
let map, ctx, verts = [], planMode = false, traverseLoaded = false, initialized = false;
let poly, markers = [];
const cb = {};   // callbacks from main: { status, sampleElevation }

const OPM = "https://cartocdn-gusc-c.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png";
const TREK_SHADE = "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg";
const CELESTIA_TMS = "https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{y}.png";

export function initPlanner(callbacks) {
  if (initialized) return;
  Object.assign(cb, callbacks);
  map = L.map("map", { center: JEZERO.center, zoom: JEZERO.zoom, maxZoom: 14,
                       maxBounds: [[-85, -360], [85, 360]] });
  const opm = L.tileLayer(OPM, { maxNativeZoom: 7, attribution: "© OpenPlanetaryMap, NASA/USGS" });
  const trek = L.tileLayer(TREK_SHADE, { maxNativeZoom: 7, attribution: "MOLA shade — NASA Mars Trek" });
  const cel = L.tileLayer(CELESTIA_TMS, { tms: true, maxNativeZoom: 5, attribution: "Celestia/Carto" });
  opm.addTo(map);
  L.control.layers({ "OPM Mars basemap": opm, "MOLA hillshade (Trek)": trek, "Shaded globe (TMS)": cel },
    {}, { position: "bottomright" }).addTo(map);
  map.on("click", onMapClick);
  initialized = true;
  wire();
}

function wire() {
  const $ = (id) => document.getElementById(id);
  $("b-plan").onclick = () => { planMode = !planMode; $("b-plan").classList.toggle("on", planMode);
    cb.status(planMode ? "Plan mode — click to add waypoints" : "Plan mode off"); };
  $("b-science").onclick = () => { if (verts.length) { last().science = !last().science; redraw(); } };
  $("b-undo").onclick = () => { verts.pop(); redraw(); };
  $("b-clear").onclick = () => { verts = []; redraw(); };
  $("b-elev").onclick = sampleElev;
  $("b-export").onclick = exportRoute;
  $("speed").onchange = update;
}

const last = () => verts[verts.length - 1];
const ll = (v) => [v.lat, v.lon];

function onMapClick(e) {
  if (!planMode) return;
  verts.push({ lat: e.latlng.lat, lon: e.latlng.lng, elev: null, science: false });
  redraw();
}

function redraw() {
  if (poly) poly.remove();
  markers.forEach((m) => m.remove());
  markers = [];
  if (verts.length >= 2) poly = L.polyline(verts.map(ll), { color: "#ff2d55", weight: 3.5, dashArray: "6 4" }).addTo(map);
  verts.forEach((v, i) => {
    markers.push(L.circleMarker(ll(v), {
      radius: v.science ? 7 : 4, color: v.science ? "#ffd166" : "#ff2d55", fillOpacity: 1,
    }).addTo(map).bindTooltip(`WP${i + 1}${v.science ? " ★" : ""}${v.elev != null ? ` · ${v.elev.toFixed(0)} m` : ""}`));
  });
  for (const id of ["b-science", "b-undo", "b-clear", "b-elev", "b-export"])
    document.getElementById(id).disabled = verts.length === 0;
  update();
}

function update() {
  const s = routeStats(verts, Number(document.getElementById("speed").value));
  document.getElementById("s-dist").textContent = (s.dist / 1000).toFixed(3);
  document.getElementById("s-time").textContent = Math.round(s.minutes);
  document.getElementById("s-stop").textContent = s.stops;
  document.getElementById("s-warn").textContent = s.warn;
  document.getElementById("s-haz").textContent = s.haz;
}

async function sampleElev() {
  const btn = document.getElementById("b-elev");
  btn.textContent = "⛰ Sampling…"; btn.disabled = true;
  try {
    const res = await cb.sampleElevation(verts.map(ll));   // uses the 3D globe (MOLA/HRSC)
    res.forEach(([lat, lon, elev], i) => { verts[i].elev = elev; });
    document.getElementById("profile").innerHTML =
      "<b style='font-size:11px;color:#9aa3b2'>Elevation profile (MOLA)</b>" +
      profileSVG(verts.filter((v) => v.elev != null));
    cb.status("Elevation sampled on the 3D Mars globe");
  } catch (e) {
    cb.status("Sampling failed — open the 🌐 Globe tab once, then retry. (" + e.message + ")", true);
  }
  btn.textContent = "⛰ Sample elevation (3D globe)"; btn.disabled = verts.length === 0;
  update();
}

async function loadTraverse() {
  if (traverseLoaded) return;
  traverseLoaded = true;
  cb.status("Loading Perseverance's traverse (Sol-2006 snapshot)…");
  try {
    // mars.nasa.gov sends no CORS header, so we serve the vendored snapshot from /assets.
    // Refresh it with: Invoke-WebRequest .../M20_traverse.json -OutFile assets\M20_traverse.json
    const gj = await (await fetch("assets/M20_traverse.json")).json();
    const landing = gj.features?.[0]?.geometry?.coordinates?.[0];
    L.geoJSON(gj, {
      style: { color: "#ff7a00", weight: 3, opacity: 0.9 },
      onEachFeature: (f, l) => l.bindPopup(`Sol ${f.properties.sol} · ${f.properties.length} m driven<br>RMC ${f.properties.fromRMC} → ${f.properties.toRMC}`),
    }).addTo(map);
    if (landing) L.marker([landing[1], landing[0]], { opacity: 0.9 })
      .addTo(map).bindPopup("Touchdown: Octavia E. Butler, Feb 18 2021");
    const end = gj.features[gj.features.length - 1].geometry.coordinates.slice(-1)[0];
    L.circleMarker([end[1], end[0]], { radius: 6, color: "#3ddc84", fillOpacity: 1 })
      .addTo(map).bindPopup("🤖 Rover's current position (Sol 2006 snapshot)");
    cb.status(`Traverse loaded — ${gj.features?.length ?? 0} sol segments (Sol-2006 snapshot)`);
  } catch (e) {
    traverseLoaded = false;
    cb.status("Traverse fetch failed (CORS?) — route planning still works", true);
  }
}

export function setMode(mode) {
  if (mode === "planner") loadTraverse();
}

function exportRoute() {
  const speedKmh = Number(document.getElementById("speed").value);
  const s = routeStats(verts, speedKmh);
  const route = verts.map((v, i) => ({
    wp: i + 1, lat: +v.lat.toFixed(6), lon: +v.lon.toFixed(6),
    elev_m: v.elev != null ? +v.elev.toFixed(1) : null,
    science_stop: !!v.science,
  }));
  const data = {
    planner: "TRAVERSE — Marswalk Mission Planner",
    version: 1,
    created_utc: new Date().toISOString(),
    datum: { body: "Mars", radius_km: 3.3895, reference: "IAU 2015 MOLA" },
    origin: route.length ? { lat: route[0].lat, lon: route[0].lon } : null,
    eva: { speed_kmh: speedKmh, assumptions: "1-2 km/h suited walk (DESIGN.md §4); slopes >15° caution, >25° hazard" },
    stats: {
      distance_km: +(s.dist / 1000).toFixed(3),
      duration_min: Math.round(s.minutes),
      science_stops: s.stops, slopes_gt15: s.warn, hazards_gt25: s.haz,
      steepest_deg: +s.steepest.toFixed(1),
    },
    route,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `marswalk_route_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  cb.status("route.json exported — feed it to blender/marswalk_bridge.py");
}