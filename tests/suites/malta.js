const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const boot=async(page,url)=>{ await page.goto(url,{waitUntil:"domcontentloaded"}); await page.waitForTimeout(700); await page.evaluate(()=>{const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden");}); };
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1000},isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));

  // --- Malta is a selectable, working trip via the real registry ---
  await boot(page,"http://localhost:8735/index.html");
  ok("Malta '27 appears in the switcher", await page.evaluate(()=>[...document.querySelectorAll("#trip-switch-sel option")].some(o=>o.value==="malta27" && /Malta/.test(o.textContent))));

  await boot(page,"http://localhost:8735/index.html?trip=malta27");
  ok("Malta loads as active trip", await page.evaluate(()=>window.__houseCode) === "malta27");
  ok("title/hero show Malta", /Malta/.test(await page.title()) && /MALTA/.test(await page.evaluate(()=>document.querySelector(".hero h1").textContent)));
  ok("bingo heading is 'Malta Bingo'", await page.evaluate(()=>document.getElementById("bingo-title").textContent) === "Malta Bingo");
  ok("reset password is malta27", await page.evaluate(()=>RESET_PASSWORD) === "malta27");
  ok("classics still present (round1) + Malta locals (bluelagoon)", await page.evaluate(()=>{ const has=id=>BETS.some(b=>b.id===id); return has("round1") && has("bluelagoon"); }));
  ok("Malta local bets tagged local, classics common", await page.evaluate(()=>{ const bl=BETS.find(b=>b.id==="bluelagoon"), r=BETS.find(b=>b.id==="round1"); return bl.scope==="local" && r.scope==="common"; }));
  ok("Malta bingo squares loaded (luzzu)", await page.evaluate(()=>BINGO.some(x=>x.id==="luzzu")));
  ok("NO Birmingham bets leaked (toca absent)", await page.evaluate(()=>!BETS.some(b=>b.id==="toca")));

  // --- Per-trip identity: claiming in Malta does NOT set you in Birmingham ---
  await page.evaluate(()=>{ setMe(2); });   // The Director in Malta
  await page.waitForTimeout(100);
  ok("Malta identity stored under the malta27 key", await page.evaluate(()=>localStorage.getItem("thirstyboys.malta27.me")) === "2");
  ok("Birmingham identity key untouched", await page.evaluate(()=>localStorage.getItem("thirstyboys.brum26.me")) === null);

  // Switch to Birmingham → should NOT inherit the Malta pick (fresh identity).
  await boot(page,"http://localhost:8735/index.html?trip=brum26");
  ok("Birmingham starts without Malta's identity (modal prompts)", await page.evaluate(()=>me == null || localStorage.getItem("thirstyboys.brum26.me")==null));

  // Now claim in Birmingham, go back to Malta → Malta remembers The Director.
  await page.evaluate(()=>{ setMe(0); });    // Mr Finance in Birmingham
  await boot(page,"http://localhost:8735/index.html?trip=malta27");
  ok("Malta still remembers its own identity (The Director)", await page.evaluate(()=>me) === 2);
  ok("Birmingham kept its own identity (Mr Finance)", await page.evaluate(()=>localStorage.getItem("thirstyboys.brum26.me")) === "0");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} malta + per-trip-identity checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
