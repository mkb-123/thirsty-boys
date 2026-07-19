const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome") });
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true });
  await ctx.route("**/gstatic.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: "/*x*/" }));
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("thirstyboys.me","1");
    localStorage.setItem("thirstyboys.brum26.v1", JSON.stringify({
      names:["Mitul","Renamed","Director","Mr Science"], tallies:[{pint:2},{},{},{}], log:[{who:0,drink:"pint",ts:1}],
      bets:{tapout:{calls:{0:1},result:"",revealed:false}},
      quotes:[{text:"keep me?",who:0,ts:5}], present:{0:1,1:1}
    }));
  });
  await page.goto("http://localhost:8735/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById("whoami-modal")?.classList.add("hidden"));
  page.once("dialog", d => d.accept("brum26"));
  await page.locator("#reset-btn").click();
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("thirstyboys.brum26.v1")));
  const pass = JSON.stringify(s.names) === JSON.stringify(["Mr Finance","Big Ben","The Director","Mr Science"])
    && Object.keys(s.bets).length === 0 && s.quotes.length === 0 && s.log.length === 0;
  console.log("names reset:", JSON.stringify(s.names));
  console.log("bets/awards/quotes/log cleared:", Object.keys(s.bets).length, s.quotes.length, s.log.length);
  console.log("me still present:", !!s.present[1]);
  console.log(pass ? "FULL RESET PASS ✅" : "FAIL ❌");
  await b.close();
})();
