const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out = []; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 1400 }, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route("**/gstatic.com/**", r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page = await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","0"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const a=document.getElementById("a2hs"); if(a)a.remove(); const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); });

  // Empty state first
  ok("empty state renders before any data", await page.evaluate(()=>{ location.hash="#stats"; render(); const e=document.getElementById("bragging"); return /gossip unlocks/i.test(e.textContent) || /Beef/.test(e.textContent); }));

  // Seed settled bets only (awards removed). Names: 0 Mr Finance,1 Big Ben,2 The Director,3 Mr Science
  await page.evaluate(()=>{
    state.bets = {
      disc: { calls:{0:1,1:1,2:2,3:1}, result:1, revealed:true },   // 0,1,3 right (result Big Ben)
      toca: { calls:{0:0,1:2,2:2}, result:0, revealed:true },       // 0 right (result Mr Finance)
      f1:   { calls:{0:3,1:3,2:0,3:3}, result:3, revealed:true },   // 0,1,3 right (result Mr Science)
    };
    save(); render();
  });
  await page.waitForTimeout(200);
  const txt = await page.evaluate(()=>document.getElementById("bragging").textContent);
  ok("shows Sharpest caller", /Sharpest caller/.test(txt), txt.slice(0,60));
  ok("shows a correct-calls ranking (how many each got right)", await page.locator("#bragging .brag-mini span").count() === 4);
  ok("Mr Finance is sharpest (3 right)", /Sharpest caller:\s*Mr Finance\s*—\s*3 right/.test(txt.replace(/\s+/g,' ')), txt.replace(/\s+/g,' ').match(/Sharpest[^]*?right/)?.[0]);
  ok("shows Worst tipster (fewest right, >=3 settled)", /Worst tipster/.test(txt));
  ok("no vote-based gossip remains (Vote magnet gone)", !/Vote magnet/.test(txt) && !/Wallflower/.test(txt) && !/Big ego/.test(txt));
  ok("no page errors", errs.length===0, errs.join(" | "));

  await page.locator("#bragging .brag-card").screenshot({ path: "bragging.png" });
  console.log(out.join("\n"));
  const passed=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${passed}/${out.length} bragging checks passed`);
  await b.close();
  process.exit(passed===out.length?0:1);
})();
