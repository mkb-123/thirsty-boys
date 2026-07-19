/* Runs every suite in tests/suites against a freshly-started local server.
   Usage:  node run.js            (all suites)
           node run.js e2e malta  (just those)
   Env:    CHROMIUM=/path/to/chrome   PORT=8735
   Exits non-zero if any suite fails. */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");

const SUITES_DIR = path.join(__dirname, "suites");
const only = process.argv.slice(2);
let suites = fs.readdirSync(SUITES_DIR).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, "")).sort();
if (only.length) suites = suites.filter((s) => only.includes(s));

// Server runs as its OWN process — spawnSync below blocks this event loop, so an
// in-process server couldn't answer the suites' requests.
const server = spawn(process.execPath, [path.join(__dirname, "server.js")], { stdio: "ignore" });
const done = (code) => { try { server.kill(); } catch (e) { /* ignore */ } process.exit(code); };
process.on("exit", () => { try { server.kill(); } catch (e) { /* ignore */ } });

setTimeout(() => {
  const results = [];
  for (const s of suites) {
    process.stdout.write(`\n=== ${s} ===\n`);
    const r = spawnSync(process.execPath, [path.join(SUITES_DIR, s + ".js")], { stdio: "inherit" });
    results.push({ s, ok: r.status === 0 });
  }
  const passed = results.filter((r) => r.ok).length;
  console.log("\n────────────────────────────────────────");
  results.forEach((r) => console.log(`${r.ok ? "PASS ✅" : "FAIL ❌"}  ${r.s}`));
  console.log(`\n${passed}/${results.length} suites passed`);
  done(passed === results.length ? 0 : 1);
}, 1000);
