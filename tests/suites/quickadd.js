const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const LS="thirstyboys.brum26.v1";
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const errs=[];
  const mk = async (setup) => {
    const ctx=await b.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
    await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
    const page=await ctx.newPage();
    page.on("pageerror",e=>errs.push(e.message));
    await page.addInitScript(setup);
    await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(650);
    await page.evaluate(()=>{ const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); const a=document.getElementById("a2hs"); if(a)a.remove(); });
    return page;
  };

  // 1) Not claimed -> tapping the FAB prompts you to claim (opens the modal).
  let page = await mk(()=>{ localStorage.clear(); });
  await page.locator("#fab-beer").click(); await page.waitForTimeout(120);
  ok("unclaimed: FAB opens the who-are-you modal, not a drink menu", await page.evaluate(()=>!document.getElementById("whoami-modal").classList.contains("hidden")) && await page.locator(".fab-menu").count()===0);

  // 2) Claimed -> FAB fans out a drink menu.
  page = await mk(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","1"); });
  await page.locator("#fab-beer").click(); await page.waitForTimeout(120);
  ok("claimed: FAB opens the quick-add menu", await page.locator(".fab-menu").count()===1);
  ok("menu offers every drink", await page.locator(".fab-menu .fab-drink").count() === await page.evaluate(()=>document.querySelectorAll('#drink-bar .drink-pick').length));
  ok("menu names who it's for", /Big Ben/.test(await page.evaluate(()=>document.querySelector(".fab-menu-title").textContent)));

  // 3) Tapping a drink logs it for me and closes the menu — from anywhere.
  await page.locator('.fab-menu .fab-drink[data-drink="pint"]').click();
  await page.waitForTimeout(150);
  ok("tapping a drink logs it (pint tally = 1)", await page.evaluate((k)=>(JSON.parse(localStorage.getItem(k)).tallies[1]||{}).pint===1, LS));
  ok("it lands in the drink log", await page.evaluate(()=>document.querySelectorAll("#log li").length===1));
  ok("menu closes after adding", await page.locator(".fab-menu").count()===0);

  // 4) A second quick add stacks a different drink.
  await page.locator("#fab-beer").click(); await page.waitForTimeout(80);
  await page.locator('.fab-menu .fab-drink[data-drink="wine"]').click(); await page.waitForTimeout(120);
  ok("second quick-add logs a different drink", await page.evaluate((k)=>{ const t=JSON.parse(localStorage.getItem(k)).tallies[1]; return t.pint===1 && t.wine===1; }, LS));

  // 5) Tapping outside closes the menu without logging.
  await page.locator("#fab-beer").click(); await page.waitForTimeout(80);
  ok("menu is open", await page.locator(".fab-menu").count()===1);
  await page.mouse.click(20, 120); await page.waitForTimeout(100);
  ok("tapping outside closes the menu", await page.locator(".fab-menu").count()===0);
  ok("no page errors", errs.length===0, errs.join(" | "));

  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} quick-add checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
