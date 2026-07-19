const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const LS="thirstyboys.brum26.v1";
const card=(page)=>page.evaluateHandle(()=>[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)));
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","1"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); const a=document.getElementById("a2hs"); if(a)a.remove(); document.getElementById("bets").style.display=""; render(); });

  // The call picker offers "Won't happen"
  ok("call picker has a 'Won't happen' option", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); const sel=c.querySelector('[data-bet-call="disc"]'); return !!sel && [...sel.options].some(o=>o.value==="none"); }));

  // Seed: Mr Finance(0) called Big Ben(1); Big Ben(1) called "won't happen"; result = none, revealed
  await page.evaluate(()=>{ state.bets={ disc:{calls:{0:1,1:"none"}, result:"none", revealed:true} }; save(); renderBets(); });
  await page.waitForTimeout(120);

  ok("revealed card shows a \"Won't happen\" call", /Won't happen/.test(await page.evaluate(()=>[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)).textContent)));
  const rowByCaller = (caller)=>page.evaluate((caller)=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); const r=[...c.querySelectorAll(".bet-call-row")].find(x=>x.querySelector(".bet-caller").textContent.trim()===caller); return r?r.classList.contains("hit"):null; }, caller);
  ok("the 'won't happen' caller gets the hit", await rowByCaller("Big Ben") === true);
  ok("the wrong caller does NOT hit", await rowByCaller("Mr Finance") === false);
  ok("scoreboard credits the 'won't happen' caller", /Big Ben/.test(await page.evaluate(()=>document.querySelector("#bets .bet-scoreboard")?.textContent||"")));

  // result dropdown has the option too
  ok("result picker has 'Didn't happen' option", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/Disc golf/.test(x.textContent)); const sel=c.querySelector('[data-bet-result="disc"]'); return !!sel && [...sel.options].some(o=>o.value==="none"); }));

  // A normal person-result still works (regression)
  await page.evaluate(()=>{ state.bets={ toca:{calls:{0:2,1:2}, result:2, revealed:true} }; save(); renderBets(); });
  await page.waitForTimeout(100);
  ok("normal person result still scores correctly", await page.evaluate(()=>{ const c=[...document.querySelectorAll(".bet-card")].find(x=>/TOCA/.test(x.textContent)); return [...c.querySelectorAll(".bet-call-row.hit")].length===2; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} didn't-happen checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
