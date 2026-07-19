const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1000},isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.setItem("thirstyboys.me","1"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(700);
  await page.evaluate(()=>{const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden");});

  ok("common.json loaded", await page.evaluate(()=>!!(window.__common && Array.isArray(window.__common.bets) && window.__common.bets.length)));
  ok("34 classic bets from common.json", await page.evaluate(()=>window.__common.bets.length) === 34);
  ok("BETS = classics + local (42 total)", await page.evaluate(()=>BETS.length) === 42);
  ok("classics are tagged scope=common", await page.evaluate(()=>BETS.filter(b=>b.scope==="common").length) === 34);
  ok("local bets tagged scope=local", await page.evaluate(()=>BETS.filter(b=>b.scope==="local").length) === 8);
  ok("a known classic (round1) is present & common", await page.evaluate(()=>{ const b=BETS.find(x=>x.id==="round1"); return b && b.scope==="common"; }));
  ok("a known local (toca) is present & local", await page.evaluate(()=>{ const b=BETS.find(x=>x.id==="toca"); return b && b.scope==="local"; }));
  ok("classics come before locals in order", await page.evaluate(()=>{ const i=id=>BETS.findIndex(b=>b.id===id); return i("round1") < i("toca") && i("units") < i("disc"); }));
  ok("local override replaces a classic in place", await page.evaluate(()=>{
    const merged = mergeCatalog([{id:"round1",q:"orig",type:"person"},{id:"x",q:"x",type:"person"}],[{id:"round1",q:"OVERRIDDEN",type:"person"}]);
    const r=merged.find(b=>b.id==="round1");
    return merged.length===2 && r.q==="OVERRIDDEN" && r.scope==="local" && merged[0].id==="round1"; // stays in place
  }));
  // Bingo is split the same way (common.json + trip locals).
  ok("8 classic bingo squares from common.json", await page.evaluate(()=>(window.__common.bingo||[]).length) === 8);
  ok("BINGO = classics + Birmingham locals", await page.evaluate(()=>BINGO.length) === 19);
  ok("common bingo (footy) + local bingo (canal) both present", await page.evaluate(()=>BINGO.some(x=>x.id==="footy" && x.scope==="common") && BINGO.some(x=>x.id==="canal" && x.scope==="local")));
  ok("trip.json holds only local bets (no classics)", await page.evaluate(async()=>{
    const t=await (await fetch("assets/trip.json")).json();
    return t.bets.length===8 && t.bets.every(b=>["toca","balti","disc","f1","gameschamp","dance","sing","canal"].includes(b.id)) && !("awards" in t);
  }));
  ok("no page errors", errs.length===0, errs.join(" | "));

  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} bet-split checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
