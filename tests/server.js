/* Tiny static server for the test suite. Serves the repo root so the suites
   run against the real committed app (no staging copy). Two test-only tweaks:
   - version.json always reports the build the page was stamped with
     ("__BUILD__"), so the in-app update checker never triggers a reload loop.
   - trip files are served UNLOCKED so suites can exercise the live trip; the
     lock behaviour itself is covered by locked.js against the real file. */
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8735;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  if (p.endsWith("version.json")) {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end('{ "build": "__BUILD__" }');
    return;
  }
  const f = path.join(ROOT, p === "/" ? "index.html" : p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("nope"); return; }
    const isTrip = /(^|\/)trip\.json$/.test(p) || /\/assets\/trips\/.*\.json$/.test(p);
    if (isTrip) {
      try { const t = JSON.parse(data.toString()); if (t.locked) { t.locked = false; data = Buffer.from(JSON.stringify(t)); } } catch (e) { /* serve as-is */ }
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});
server.listen(PORT, () => console.log("test server on " + PORT));
module.exports = server;
