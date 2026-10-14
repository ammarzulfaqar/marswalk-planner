// TRAVERSE backend proxy — zero-dependency Node HTTP server (Node 18+ global fetch).
// Purpose: serve PDS ODE REST data to the browser (ODE has no CORS for browsers) and
// host future endpoints (elevation caching, route storage). Static app runs from
// GitHub Pages; this server is optional and can be deployed free on Render/Fly.
//   Run:  node server/server.js     (port 8001, or PORT env var)
//   Try:  http://localhost:8001/api/health
//   ODE:  /api/ode?query=<url-encoded ODE query>  → proxies oderest.rsl.wustl.edu/live2
//         e.g. /api/ode?query=iipt%26target=mars%26json=1%26page=1%26page_size=5
const ODE = "https://oderest.rsl.wustl.edu/live2";
const PORT = process.env.PORT || 8001;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res, code, body) {
  res.writeHead(code, { ...cors, "Content-Type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

require("http").createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }

  if (url.pathname === "/api/health")
    return json(res, 200, { ok: true, service: "traverse-proxy", ts: new Date().toISOString() });

  if (url.pathname === "/api/ode") {
    const query = url.searchParams.get("query");
    if (!query) return json(res, 400, { error: "missing ?query=" });
    try {
      const r = await fetch(`${ODE}?${query}`, { headers: { Accept: "application/json" } });
      const text = await r.text();
      res.writeHead(r.status, { ...cors, "Content-Type": r.headers.get("content-type") || "application/json" });
      return res.end(text);
    } catch (e) {
      return json(res, 502, { error: `ODE unreachable: ${e.message}` });
    }
  }

  json(res, 404, { error: `unknown path ${url.pathname}` });
}).listen(PORT, () => console.log(`TRAVERSE proxy on :${PORT}`));