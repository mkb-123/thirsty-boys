/* Guards the two sync bugs:
   1. The Firebase room must follow the ACTIVE TRIP's houseCode, not config.js's
      global one (else Malta would show Birmingham's data).
   2. Applying a remote snapshot must not throw (no calls to removed functions). */
const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);

// A minimal fake `firebase` so initSync runs its real code path against a stub
// that records which room path it opened and lets us push a snapshot.
const fakeFirebase = () => {
  window.__roomPath = null; window.__valueCb = null;
  const makeRef = (path) => ({
    _path: path,
    child(p) { return makeRef(path + "/" + p); },
    on(evt, cb) {
      if (path.indexOf("houses/") === 0 && evt === "value") { window.__roomPath = path; window.__valueCb = cb; cb({ val: () => null }); }
      if (path === ".info/connected" && evt === "value") { cb({ val: () => true }); }
    },
    set() {}, remove() {}, transaction() {},
  });
  window.firebase = {
    apps: [],
    initializeApp() { this.apps = [{}]; },
    database() { return { ref: (p) => makeRef(p) }; },
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, isMobile: true });
  await ctx.route("**/gstatic.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.addInitScript(fakeFirebase);
  await page.addInitScript(() => { localStorage.setItem("thirstyboys.me", "1"); });

  // Load Malta while config.js's global houseCode is still "brum26".
  await page.goto("http://localhost:8735/index.html?trip=malta27", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  ok("config global houseCode is still brum26 (the trap)", await page.evaluate(() => window.THIRSTY_CONFIG.houseCode) === "brum26");
  ok("active trip houseCode is malta27", await page.evaluate(() => window.__houseCode) === "malta27");
  ok("Firebase room follows the TRIP, not config (houses/malta27)", await page.evaluate(() => window.__roomPath) === "houses/malta27");
  ok("room is NOT Birmingham's", await page.evaluate(() => window.__roomPath) !== "houses/brum26");

  // Push a remote snapshot → must apply cleanly (catches the removed-fn ReferenceError).
  await page.evaluate(() => {
    window.__valueCb({ val: () => ({ names: ["A","B","C","D"], tallies: [{ pint: 3 }, {}, {}, {}], bets: {}, bingo: {} }) });
  });
  await page.waitForTimeout(200);
  ok("applying a remote snapshot doesn't throw", errs.length === 0, errs.join(" | "));
  ok("remote data is adopted (names updated from snapshot)", await page.evaluate(() => state.names[0]) === "A");

  // Birmingham opens its OWN room.
  await page.goto("http://localhost:8735/index.html?trip=brum26", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  ok("Birmingham opens houses/brum26", await page.evaluate(() => window.__roomPath) === "houses/brum26");

  console.log(out.join("\n"));
  const p = out.filter(x => x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} room-path checks passed`);
  await b.close();
  process.exit(p === out.length ? 0 : 1);
})();
