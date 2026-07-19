const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:800},isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","1"); }); // I am Big Ben (1)
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); });
  const bannerText = ()=>page.evaluate(()=>{ const el=document.getElementById("big-banner"); return el?el.textContent:""; });
  const clearBanner = ()=>page.evaluate(()=>{ const el=document.getElementById("big-banner"); if(el) el.remove(); });

  // A remote drink from The Director (2) -> banner on my phone
  await clearBanner();
  await page.evaluate(()=>{ state.tallies[2]=(state.tallies[2]||{}); state.tallies[2].pint=(state.tallies[2].pint||0)+1; state.log.push({id:"remote1",who:2,drink:"pint",ts:Date.now()}); renderLog(); });
  await page.waitForTimeout(80);
  ok("a remote drink alerts me (banner)", /The Director/.test(await bannerText()) && /Pint/i.test(await bannerText()), await bannerText());

  // My OWN drink -> no banner
  await clearBanner();
  await page.evaluate(()=>{ state.tallies[1]=(state.tallies[1]||{}); state.tallies[1].pint=(state.tallies[1].pint||0)+1; state.log.push({id:"mine1",who:1,drink:"pint",ts:Date.now()}); renderLog(); });
  await page.waitForTimeout(80);
  ok("my own drink does NOT banner me", (await bannerText())==="");

  // Bulk arrival (2 at once) -> no banner (avoids spam on sync/load)
  await clearBanner();
  await page.evaluate(()=>{ state.log.push({id:"b1",who:0,drink:"pint",ts:Date.now()}); state.log.push({id:"b2",who:3,drink:"wine",ts:Date.now()}); renderLog(); });
  await page.waitForTimeout(80);
  ok("bulk arrival does NOT banner (no spam)", (await bannerText())==="");

  // Single soft drink from someone -> banners, without the booze count tail
  await clearBanner();
  await page.evaluate(()=>{ state.log.push({id:"c1",who:0,drink:"coffee",ts:Date.now()}); renderLog(); });
  await page.waitForTimeout(80);
  const t = await bannerText();
  ok("a remote coffee also alerts", /Coffee/i.test(t), t);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} drink-alert checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
