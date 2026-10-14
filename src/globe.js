// 3D Mars globe — CesiumJS with the official "Cesium Mars" 3D Tiles asset (3644333):
// MGS MOLA + MEX HRSC blended DEM 200 m terrain, Viking color mosaic 232 m imagery,
// with high-res insets for Jezero (CTX 6 m imagery / TRN DTM 20 m terrain) and Gale.
// API ref: CesiumJS >= 1.133 ships Ellipsoid.MARS (PR #12828, Sept 2025).
// Rover: NASA/JPL-Caltech official Perseverance GLB (vendored in /assets, Sol-2006
// snapshot position from the M20 GIS traverse).
import { CESIUM_TOKEN, CESIUM_MARS_ASSET_ID } from "./config.js";

const POIS = [
  { name: "Perseverance — touchdown (Feb 18, 2021)", lat: 18.4447, lon: 77.4508, color: "#3ddc84" },
  { name: "Jezero crater — western delta",           lat: 18.3800, lon: 77.5800, color: "#ff7a1a" },
  { name: "Curiosity — Gale crater",                 lat: -4.5895, lon: 137.8443, color: "#ffd166" },
  { name: "Olympus Mons — 21.9 km high",             lat: 18.6500, lon: 226.2000, color: "#e15b64" },
  { name: "Valles Marineris — 4,000 km canyon",      lat: -14.0000, lon: 301.0000, color: "#e15b64" },
];

let viewer;

export async function initGlobe() {
  Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;
  Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;   // IAU_2015:49901 measurements

  viewer = new Cesium.Viewer("globe", {
    globe: false,            // global 3D Tiles tileset replaces the ellipsoid
    sceneModePicker: false, baseLayerPicker: false, geocoder: false,
    timeline: false, animation: false, navigationHelpButton: false,
    homeButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false,
  });
  viewer.cesiumWidget.creditContainer.style.fontSize = "10px";

  const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_MARS_ASSET_ID);
  viewer.scene.primitives.add(tileset);

  for (const p of POIS) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 40),
      point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(p.color),
               outlineColor: Cesium.Color.WHITE, outlineWidth: 1.5 },
      label: { text: p.name, font: "13px Segoe UI", fillColor: Cesium.Color.WHITE,
               showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("#14181fd9"),
               pixelOffset: new Cesium.Cartesian2(10, -12), scale: 0.85 },
    });
  }
  // Start on the whole planet, then swoop into Jezero — the mission story in one shot.
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(77.5, 12.0, 8_500_000),
  });
  await viewer.zoomTo(tileset);
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(77.45, 17.7, 160_000),
    orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35), roll: 0 },
    duration: 4.5,
  });
  loadRover();   // async, non-blocking: GLB is ~11.7 MB, loads in the background
}

let roverModel = null, roverPos = null;

// Place the real Perseverance GLB at its live position (end of the M20 traverse).
async function loadRover() {
  try {
    roverPos = await (await fetch("assets/rover_position.json")).json();
    const hpr = new Cesium.HeadingPitchRoll(0, 0, 0);
    let height = roverPos.elev_m;
    try {
      const s = await viewer.scene.sampleHeightMostDetailed(
        [Cesium.Cartographic.fromDegrees(roverPos.lon, roverPos.lat)]);
      if (s?.[0] && Number.isFinite(s[0].height)) height = s[0].height;
    } catch { /* keep traverse MOLA elevation as fallback */ }

    const position = Cesium.Cartesian3.fromDegrees(roverPos.lon, roverPos.lat, height);
    roverModel = await Cesium.Model.fromGltfAsync({
      url: "assets/Perseverance.glb",
      modelMatrix: Cesium.Transforms.headingPitchRollToFixedFrame(position, hpr),
      scale: 1.0,   // real size: 2.9 m mast to wheel — get close with 🤖 Fly to rover
    });
    viewer.scene.primitives.add(roverModel);

    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(roverPos.lon, roverPos.lat, 60),
      point: { pixelSize: 9, color: Cesium.Color.fromCssColorString("#3ddc84") },
      label: { text: `🤖 Perseverance — live position (Sol ${roverPos.sol})`,
               font: "13px Segoe UI", fillColor: Cesium.Color.WHITE, showBackground: true,
               backgroundColor: Cesium.Color.fromCssColorString("#14181fd9"),
               pixelOffset: new Cesium.Cartesian2(10, -12), scale: 0.85 },
    });
  } catch (e) {
    console.error("rover model load failed:", e);
  }
}

// Dive the camera down to the rover (button in the top bar).
export function flyToRover() {
  if (!roverPos) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(roverPos.lon - 0.0006, roverPos.lat - 0.0006, 55),
    orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(-22), roll: 0 },
    duration: 3.0,
  });
}

// Sample MOLA/HRSC terrain heights along a list of [lat, lon] points (degrees).
// Resolves [[lat, lon, elev_m] ...] or rejects if the scene can't sample (e.g. hidden
// until first render — user should switch to the Globe tab and retry).
export function sampleElevation(latlons) {
  return new Promise((resolve, reject) => {
    if (!viewer) return reject(new Error("globe not initialised"));
    const cartos = latlons.map(([lat, lon]) => Cesium.Cartographic.fromDegrees(lon, lat));
    const scene = viewer.scene;
    if (typeof scene.sampleHeightMostDetailed !== "function") {
      return reject(new Error("sampleHeightMostDetailed unavailable in this CesiumJS build"));
    }
    scene.sampleHeightMostDetailed(cartos).then((out) => {
      resolve(out.map((c) => [Cesium.Math.toDegrees(c.latitude), Cesium.Math.toDegrees(c.longitude), c.height]));
    }).catch(reject);
  });
}