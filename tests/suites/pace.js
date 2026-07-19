const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>localStorage.clear());
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(400);
  const r = await page.evaluate(()=>{
    const now=Date.now(), H=3600000;
    const set=(arr)=>{ state.log=arr.map((m,i)=>({id:"p"+i,who:i%4,drink:"pint",ts:now-m*60000})); };
    // few drinks -> null (warming up)
    set([10,20]); const few=paceState(now);
    // steady: ~1 every 30 min over 3h (6 drinks), recent similar -> on pace
    set([170,140,110,80,50,20]); const steady=paceState(now);
    // hot: slow start then a burst in last 30 min
    set([175,150,25,20,15,10,5,2]); const hot=paceState(now);
    // easing: fast start, nothing recent
    set([180,170,160,150,140,130]); const easing=paceState(now);
    return { few, steady, hot, easing };
  });
  ok("too few drinks -> no badge", r.few===null, JSON.stringify(r.few));
  ok("steady drinking -> On pace", r.steady && r.steady.cls==="on", JSON.stringify(r.steady));
  ok("recent burst -> Running hot", r.hot && r.hot.cls==="hot", JSON.stringify(r.hot));
  ok("gone quiet -> Easing off", r.easing && r.easing.cls==="cool", JSON.stringify(r.easing));

  // live data
  const live=require("/tmp/live.json");
  const liveBadge = await page.evaluate((live)=>{ state.log=(Array.isArray(live.log)?live.log:Object.values(live.log||{})).filter(Boolean); state.names=live.names; return paceState(Date.now()); }, live);
  ok("live data yields a badge", !!liveBadge, JSON.stringify(liveBadge));
  ok("no errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} pace checks passed`);
  console.log("LIVE badge right now:", JSON.stringify(liveBadge));
  await b.close();
  process.exit(p===out.length?0:1);
})();
