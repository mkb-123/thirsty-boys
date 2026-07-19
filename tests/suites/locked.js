const { chromium } = require("playwright-core");
const fs = require("fs");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const REPO = require("path").join(__dirname, "..", "..");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
(async()=>{
  // The real committed Birmingham file must be locked (finished trip).
  const t = JSON.parse(fs.readFileSync(REPO+"/assets/trip.json","utf8"));
  ok("repo trip.json has locked:true (Birmingham archived)", t.locked === true);
  // And the DB rules file exists with a locked-map guard.
  const rules = JSON.parse(fs.readFileSync(REPO+"/database.rules.json","utf8"));
  ok("database.rules.json blocks writes to locked houses", /locked/.test(JSON.stringify(rules.rules)) && rules.rules.houses.$code[".write"].includes("locked"));

  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1000},isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.setItem("thirstyboys.me","1"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(700);
  await page.evaluate(()=>{const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); ["tracker","bingo"].forEach(id=>{const e=document.getElementById(id); if(e)e.style.display="";});});

  // Server serves it unlocked; flip the lock on at runtime to test the read-only chrome + guards.
  await page.evaluate(()=>{ TRIP_LOCKED=true; applyLockedChrome(); render(); });
  await page.waitForTimeout(100);
  ok("read-only banner appears when locked", await page.evaluate(()=>{ const e=document.getElementById("readonly-banner"); return !!e && /archived/i.test(e.textContent); }));
  ok("quick-add FAB is hidden when locked", await page.evaluate(()=>{ const f=document.getElementById("fab-beer"); return f && f.style.display==="none"; }));

  const total = async ()=>page.evaluate(()=>{ const l=[...document.querySelectorAll(".lb-card")].map(c=>Number(c.querySelector(".lb-units").textContent)); return l.reduce((a,b)=>a+b,0); });
  const before = await total();
  await page.locator('.person-drink[data-i="1"][data-drink="pint"]').click();
  await page.waitForTimeout(120);
  ok("logging a drink is blocked when locked", await total() === before);
  ok("bingo claim is blocked when locked", await page.evaluate(()=>{
    const cell=document.querySelector(".bingo-cell"); if(!cell) return true;
    const id=cell.dataset.bingo; cell.click();
    return state.bingo[id] == null;
  }));

  // Flip the lock OFF → writes work again.
  await page.evaluate(()=>{ TRIP_LOCKED=false; applyLockedChrome(); render(); });
  await page.waitForTimeout(80);
  const b2 = await total();
  await page.locator('.person-drink[data-i="1"][data-drink="pint"]').click();
  await page.waitForTimeout(120);
  ok("unlocking restores writes", await total() === b2 + 1);
  ok("FAB returns when unlocked", await page.evaluate(()=>document.getElementById("fab-beer").style.display !== "none"));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} locked (read-only) checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
