const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const LS="thirstyboys.brum26.v1";
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1200},isMobile:true,hasTouch:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","1"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); const a=document.getElementById("a2hs"); if(a)a.remove(); ["tracker","stats"].forEach(id=>{const e=document.getElementById(id); if(e)e.style.display="";}); });

  const lbUnits = (name)=>page.evaluate((n)=>{ const c=[...document.querySelectorAll(".lb-card")].find(x=>x.querySelector(".lb-name").textContent.startsWith(n)); return c?Number(c.querySelector(".lb-units").textContent):null; }, name);

  ok("coffee is a drink option (☕ button per person)", await page.locator('.person-drink[data-i="1"][data-drink="coffee"]').count() === 1);
  ok("coffee is in the quick-add picker", await page.evaluate(()=>[...document.querySelectorAll("#drink-bar .drink-pick")].some(b=>/Coffee/i.test(b.textContent))));

  // Log a pint (booze) then a coffee + a soft (non-booze) for Big Ben.
  await page.locator('.person-drink[data-i="1"][data-drink="pint"]').click(); await page.waitForTimeout(80);
  ok("pint counts: leaderboard = 1", await lbUnits("Big Ben") === 1);
  await page.locator('.person-drink[data-i="1"][data-drink="coffee"]').click(); await page.waitForTimeout(80);
  ok("coffee does NOT bump the drinking count (still 1)", await lbUnits("Big Ben") === 1);
  await page.locator('.person-drink[data-i="1"][data-drink="soft"]').click(); await page.waitForTimeout(80);
  ok("soft does NOT bump the drinking count (still 1)", await lbUnits("Big Ben") === 1);
  ok("G&T is a drink option", await page.locator('.person-drink[data-i="1"][data-drink="gandt"]').count() === 1);
  await page.locator('.person-drink[data-i="1"][data-drink="gandt"]').click(); await page.waitForTimeout(80);
  ok("G&T DOES count as booze (now 2)", await lbUnits("Big Ben") === 2);

  ok("tallies still record coffee + soft", await page.evaluate((k)=>{ const t=JSON.parse(localStorage.getItem(k)).tallies[1]; return t.coffee===1 && t.soft===1 && t.pint===1 && t.gandt===1; }, LS));
  ok("all four show in the drink log", await page.evaluate(()=>document.querySelectorAll("#log li").length === 4));

  // Stats: total tile is booze-only (pint + G&T = 2); soft tracker is separate.
  await page.evaluate(()=>render());
  await page.waitForTimeout(80);
  ok("stats 'Total drinks' tile = 2 (booze only: pint + G&T)", await page.evaluate(()=>{ const t=[...document.querySelectorAll("#stats .stat-tile")].find(x=>/total drinks/i.test(x.textContent)); return t && t.querySelector(".st-v").textContent.trim()==="2"; }));
  ok("separate Soft & coffee tracker is shown", await page.locator("#stats .soft-track").count() === 1);
  ok("soft tracker lists Coffee and Soft", await page.evaluate(()=>{ const s=document.querySelector("#stats .soft-track").textContent; return /Coffee/i.test(s) && /Soft/i.test(s); }));
  ok("soft tracker shows the per-drink counts", await page.evaluate(()=>[...document.querySelectorAll("#stats .soft-tile .st-v")].map(e=>e.textContent).every(v=>v==="1")));
  ok("main per-drink breakdown excludes soft/coffee", await page.evaluate(()=>{ const b=document.querySelector("#stats .stat-break"); return b && !/☕|🧃/.test(b.textContent); }));
  ok("no page errors", errs.length===0, errs.join(" | "));

  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} soft-drink checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
