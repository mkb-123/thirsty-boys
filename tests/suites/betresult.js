const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const LS="thirstyboys.brum26.v1";
const cardText = (page)=>page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); return c?c.textContent:""; });
const q = (page,sel)=>page.evaluate((s)=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); return !!(c && c.querySelector(s)); }, sel);
const click = (page,sel)=>page.evaluate((s)=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); c.querySelector(s).click(); }, sel);
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","0"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const a=document.getElementById("a2hs"); if(a)a.remove(); const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); document.getElementById("bets").style.display=""; render(); });

  // Seed everyone's secret calls on 'disc' (person bet), NOT revealed. me=0 has called.
  await page.evaluate(()=>{ state.bets={ disc:{calls:{0:1,1:1,2:2,3:0}, result:"", revealed:false} }; save(); renderBets(); });
  await page.waitForTimeout(150);

  // Once you've bet, the picker is hidden behind a "your call" summary + Edit.
  ok("after betting, the call picker is hidden", !(await q(page,'[data-bet-call="disc"]')));
  ok("shows a locked-in summary (pick value hidden)", /locked in/i.test(await cardText(page)) && !/Your call: /i.test(await cardText(page)));
  ok("has an Edit call button", await q(page,".bet-editcall"));
  ok("outcome is NOT shown yet (button instead)", !(await q(page,'[data-bet-result="disc"]')) && await q(page,".bet-enteroutcome"));
  ok("nobody's calls are shown (still secret)", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); return c.querySelectorAll(".bet-call-row").length===0; }));

  // Edit call re-opens the picker; you must Submit to lock it back in.
  await click(page,".bet-editcall"); await page.waitForTimeout(80);
  ok("Edit call re-opens the picker", await q(page,'[data-bet-call="disc"]'));
  ok("editing shows a Submit/Update button", await q(page,".bet-submit"));
  await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); const s=c.querySelector('[data-bet-call="disc"]'); s.value="1"; s.dispatchEvent(new Event("change",{bubbles:true})); });
  ok("changing alone does NOT collapse (needs Submit)", await q(page,'[data-bet-call="disc"]'));
  await click(page,".bet-submit"); await page.waitForTimeout(100);
  ok("submitting collapses the picker again", !(await q(page,'[data-bet-call="disc"]')));

  // Enter outcome → result control appears; log it WITHOUT revealing.
  await click(page,".bet-enteroutcome"); await page.waitForTimeout(80);
  ok("'Enter outcome' reveals the result control", await q(page,'[data-bet-result="disc"]'));
  await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); const s=c.querySelector('[data-bet-result="disc"]'); s.value="1"; s.dispatchEvent(new Event("change",{bubbles:true})); });
  await page.waitForTimeout(120);
  ok("result saved to shared state", await page.evaluate((k)=>String(JSON.parse(localStorage.getItem(k)).bets.disc.result)==="1", LS));
  ok("bet stays UN-revealed after logging outcome", await page.evaluate((k)=>JSON.parse(localStorage.getItem(k)).bets.disc.revealed!==true, LS));
  ok("still no calls revealed", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); return c.querySelectorAll(".bet-call-row").length===0; }));
  ok("shows a 'result logged' lock note", /result logged/i.test(await cardText(page)));
  ok("Beef&Bragging does NOT count it yet (no leak)", await page.evaluate(()=>!/Sharpest caller/.test(document.getElementById("bragging").textContent)));

  // Reveal → pre-set result drives the hits.
  page.on("dialog", d=>d.accept("brum26"));
  await click(page,".bet-reveal"); await page.waitForTimeout(200);
  ok("after reveal: all calls shown", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); return c.querySelectorAll(".bet-call-row").length===4; }));
  ok("pre-set result drives the hits (idx0 & idx1 correct)", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); return c.querySelectorAll(".bet-call-row.hit").length===2; }));
  ok("now Beef&Bragging counts it", await page.evaluate(()=>/Sharpest caller/.test(document.getElementById("bragging").textContent)));
  ok("no page errors", errs.length===0, errs.join(" | "));

  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} bet-result checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
