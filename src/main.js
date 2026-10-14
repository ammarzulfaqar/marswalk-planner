import { initGlobe, sampleElevation, flyToRover } from "./globe.js";
import { initPlanner, setMode as plannerMode } from "./planner.js";

const $ = (id) => document.getElementById(id);
export function status(msg, warn = false) {
  const el = $("status");
  el.textContent = msg;
  el.style.color = warn ? "#ffb86b" : "var(--dim)";
}

let current = "globe";
function show(view) {
  current = view;
  $("globe").classList.toggle("hidden", view !== "globe");
  $("planner").classList.toggle("hidden", view !== "planner");
  $("btn-globe").classList.toggle("active", view === "globe");
  $("btn-planner").classList.toggle("active", view === "planner");
  if (view === "planner") plannerMode("idle");
}

$("btn-globe").onclick = () => show("globe");
$("btn-planner").onclick = () => show("planner");
$("btn-rover").onclick = () => { show("globe"); flyToRover(); };

(async function boot() {
  try {
    await initGlobe();
    status("Mars online — Cesium Mars terrain loaded");
  } catch (e) {
    console.error(e);
    status("Globe failed: " + e.message, true);
  }
  initPlanner({
    status,
    sampleElevation,          // async ([lat,lon][]) => [[lat,lon,elev_m]|null]
  });
})();