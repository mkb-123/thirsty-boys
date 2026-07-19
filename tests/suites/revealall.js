const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const LS="thirstyboys.brum26.v1";
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","0"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const a=document.getElementById("a2hs"); if(a)a.remove(); const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); document.getElementById("bets").style.display=""; });

  // No settled bets yet → no reveal-all button.
  await page.evaluate(()=>{ state.bets={}; save(); renderBets(); });
  ok("no reveal-all button when nothing is settled", await page.locator("#bets-reveal-all").count()===0);

  // Two bets with a logged outcome (unrevealed) + one settled+revealed + one with no result.
  await page.evaluate(()=>{
    state.bets={
      toca:{calls:{0:1,1:0}, result:1, revealed:false},   // settled, not revealed
      disc:{calls:{0:2,1:2}, result:2, revealed:false},   // settled, not revealed
      f1:{calls:{0:3},        result:3, revealed:true},    // already revealed
      balti:{calls:{0:0},     result:"", revealed:false},  // no outcome yet
    };
    save(); renderBets();
  });
  await page.waitForTimeout(150);

  ok("reveal-all button appears", await page.locator("#bets-reveal-all").count()===1);
  ok("reveal-all counts only settled+unrevealed (2)", /Reveal all 2 settled/.test(await page.evaluate(()=>document.getElementById("bets-reveal-all").textContent)));

  // Click it, enter the password → both settled bets reveal, others untouched.
  page.on("dialog", d=>d.accept("brum26"));
  await page.locator("#bets-reveal-all").click();
  await page.waitForTimeout(200);
  ok("toca revealed", await page.evaluate((k)=>JSON.parse(localStorage.getItem(k)).bets.toca.revealed===true, LS));
  ok("disc revealed", await page.evaluate((k)=>JSON.parse(localStorage.getItem(k)).bets.disc.revealed===true, LS));
  ok("balti (no outcome) stays hidden", await page.evaluate((k)=>JSON.parse(localStorage.getItem(k)).bets.balti.revealed!==true, LS));
  ok("reveal-all button disappears once nothing's left to reveal", await page.locator("#bets-reveal-all").count()===0);
  ok("no page errors", errs.length===0, errs.join(" | "));

  // Wrong password reveals nothing.
  await page.evaluate(()=>{ state.bets={ toca:{calls:{0:1}, result:1, revealed:false} }; save(); renderBets(); });
  await page.waitForTimeout(120);
  page.removeAllListeners("dialog");
  page.once("dialog", d=>d.accept("nope"));
  await page.locator("#bets-reveal-all").click();
  await page.waitForTimeout(150);
  ok("wrong password does not bulk-reveal", await page.evaluate((k)=>JSON.parse(localStorage.getItem(k)).bets.toca.revealed!==true, LS));

  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} reveal-all checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
