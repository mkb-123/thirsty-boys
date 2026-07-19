const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const BASE = "http://localhost:8735";
const out = [];
const ok = (n, c, x = "") => out.push(`${c ? "PASS ✅" : "FAIL ❌"}  ${n}${x ? "  — " + x : ""}`);

// Freeze the clock to a chosen moment. new Date() / Date.now() return it;
// parsing (new Date(isoString)) still works so the itinerary maths hold.
function clockScript(iso) {
  return `(function(){
    var FAKE = new (window.Date)("${iso}").getTime();
    var _D = window.Date;
    function MockDate(){ if(arguments.length===0){ return new _D(FAKE); } return new _D(...arguments); }
    MockDate.now = function(){ return FAKE; };
    MockDate.parse = _D.parse; MockDate.UTC = _D.UTC; MockDate.prototype = _D.prototype;
    window.Date = MockDate;
  })();`;
}

async function run(label, iso, checks) {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true });
  await ctx.route("**/gstatic.com/**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "/* stub */" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => out.push("PAGEERROR(" + label + "): " + e.message));
  await page.addInitScript(clockScript(iso));
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("thirstyboys.me", "1"); });
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById("whoami-modal") && document.getElementById("whoami-modal").classList.add("hidden"));
  await checks(page);
  await b.close();
}

(async () => {
  // DURING the trip — Friday 18:00.
  await run("during", "2026-07-17T18:00:00", async (page) => {
    ok("during: body has trip-live class", await page.evaluate(() => document.body.classList.contains("trip-live")));
    ok("during: kicker reads LIVE", (await page.locator(".hero .kicker").textContent()).includes("LIVE"));
    ok("during: LIVE hero panel visible", await page.evaluate(() => !document.getElementById("hero-live").classList.contains("hidden")));
    ok("during: Now/Next is in the bottom bar, NOT duplicated in the hero", await page.evaluate(() => { const nn = document.getElementById("nownext"); const hero = document.getElementById("hero-live"); return !nn.classList.contains("hidden") && /NOW/.test(nn.textContent) && /NEXT/.test(nn.textContent) && !/NEXT/.test(hero.textContent); }));
    ok("during: hero shows a live drink stat", await page.evaluate(() => /🍺/.test(document.getElementById("hero-live").textContent)));
    ok("during: no green live caption on the hero", await page.evaluate(() => document.getElementById("cd-caption").textContent.trim() === "" && !document.getElementById("cd-caption").classList.contains("live")));
    // The countdown becomes a live drink scoreboard, styled with a leader card.
    ok("during: countdown switches to live scoreboard styling", await page.evaluate(() => document.getElementById("countdown").classList.contains("live")));
    ok("during: scoreboard shows crew names (normal case, not day labels)", await page.evaluate(() => [...document.querySelectorAll("#countdown .cd-lab")].some((l) => /[a-z]/.test(l.textContent)) && ![...document.querySelectorAll("#countdown .cd-lab")].some((l) => /days|hrs/.test(l.textContent))));
    ok("during: default tab is Drinks (live landing)", await page.evaluate(() => document.getElementById("tracker").style.display !== "none" && document.getElementById("itinerary").style.display === "none" && document.getElementById("recap").style.display === "none"));
    // log a couple of drinks, then the stats chart should draw a projection line
    await page.evaluate(() => { document.getElementById("stats").style.display = ""; });
    await page.evaluate(() => { document.querySelector('.person-drink[data-i="1"][data-drink="pint"]').click(); document.querySelector('.person-drink[data-i="1"][data-drink="pint"]').click(); });
    await page.waitForTimeout(200);
    ok("during: stats chart shows a projection line", await page.evaluate(() => !!document.querySelector('#stats .stat-chart path[stroke-dasharray]')));
    ok("during: a 'Projected by Sun' tile is shown", await page.evaluate(() => [...document.querySelectorAll('#stats .stat-tile')].some((x) => /projected/i.test(x.textContent))));
  });

  // AFTER the trip — Monday.
  await run("after", "2026-07-20T10:00:00", async (page) => {
    ok("after: body has trip-done class", await page.evaluate(() => document.body.classList.contains("trip-done")));
    ok("after: kicker reads 'wrap'", (await page.locator(".hero .kicker").textContent()).toLowerCase().includes("wrap"));
    ok("after: default tab is recap", await page.evaluate(() => document.getElementById("recap").style.display !== "none" && document.getElementById("itinerary").style.display === "none"));
  });

  console.log(out.join("\n"));
  const passed = out.filter((x) => x.startsWith("PASS")).length;
  console.log(`\n${passed}/${out.length} trip-mode checks passed`);
  process.exit(passed === out.length ? 0 : 1);
})();
