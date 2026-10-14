// Route analytics — all constants citable (see DESIGN.md §4).
import { MARS_RADIUS_M } from "./config.js";

// Great-circle distance in metres (haversine, R = Mars mean radius 3,389.5 km).
export function haversineM(a, b) {
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.sqrt(s));
}

// Total distance + per-segment slope stats. Elevation values in metres (MOLA datum);
// slope = atan2(rise, run) in degrees; nulls skipped.
export function routeStats(vertices, speedKmh) {
  let dist = 0, warn = 0, haz = 0, steepest = 0;
  for (let i = 1; i < vertices.length; i++) {
    dist += haversineM(vertices[i - 1], vertices[i]);
    const e0 = vertices[i - 1].elev, e1 = vertices[i].elev;
    if (e0 != null && e1 != null) {
      const run = haversineM(vertices[i - 1], vertices[i]);
      if (run > 0) {
        const deg = Math.atan(Math.abs(e1 - e0) / run) * 180 / Math.PI;
        steepest = Math.max(steepest, deg);
        if (deg > 25) haz++; else if (deg > 15) warn++;
      }
    }
  }
  const stops = vertices.filter((v) => v.science).length;
  const minutes = dist / 1000 / speedKmh * 60;
  return { dist, minutes, stops, warn, haz, steepest };
}

// Inline SVG elevation profile (no chart lib). verts already sampled (elev != null).
export function profileSVG(verts) {
  const es = verts.map((v) => v.elev);
  const min = Math.min(...es), max = Math.max(...es), span = Math.max(max - min, 1);
  const W = 280, H = 74, n = verts.length;
  const pts = verts.map((v, i) =>
    `${(i / (n - 1)) * W},${H - ((v.elev - min) / span) * (H - 16) - 8}`).join(" ");
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${pts}" fill="none" stroke="#ff7a1a" stroke-width="1.6"/>
    <text x="4" y="10" fill="#9aa3b2" font-size="8">▲ ${max.toFixed(0)} m</text>
    <text x="4" y="${H - 3}" fill="#9aa3b2" font-size="8">▼ ${min.toFixed(0)} m</text>
  </svg>`;
}