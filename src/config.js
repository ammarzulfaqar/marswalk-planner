// TRAVERSE configuration. NOTE: this token is public in a static app — restrict it to
// your deployed domain in the Cesium ion console (Assets → token → Allowed URLs).
export const CESIUM_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkZCQU5mTFpaTGxzdjBMZ0kiLCJqdGkiOiI1OTQwNmI0NC1lZjg4LTQ0MGUtYWQ2YS00OTIxOWFkMzBmODYiLCJpZCI6NTI1MTU1LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3OTIwMTE3OTh9.9wH4DESg9O5YO5kCWiwo0bSKsVsS0bjTLJXQRYCYTC0";

export const CESIUM_MARS_ASSET_ID = 3644333;   // Cesium Mars 3D Tiles (MOLA+HRSC terrain, Viking imagery)
export const MARS_RADIUS_M = 3389500;          // IAU Mars volumetric mean radius
export const M20_TRAVERSE_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json";
export const ODE_REST = "https://oderest.rsl.wustl.edu/live2"; // PDS Orbital Data Explorer REST