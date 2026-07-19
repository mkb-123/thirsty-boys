const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1200},isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(()=>{ localStorage.clear(); localStorage.setItem("thirstyboys.me","1"); });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(700);
  await page.evaluate(()=>{ const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden"); });

  // Everything below should derive from trip.json (city=Birmingham, houseCode=brum26).
  ok("title comes from trip.json", /Birmingham/.test(await page.title()));
  ok("bingo heading is patched to '<City> Bingo'", await page.evaluate(()=>document.getElementById("bingo-title").textContent) === "Birmingham Bingo");
  ok("meta description patched from crew + dates", await page.evaluate(()=>{ const m=document.querySelector('meta[name=description]').content; return /Mr Finance/.test(m) && /Big Ben/.test(m); }));
  ok("HQ address filled from trip.json (not the old hardcode)", await page.evaluate(()=>document.querySelector(".hq-addr").textContent).then(t=>/Sloane Street/.test(t)));
  ok("walk-home link built from trip.json mapsQuery", await page.evaluate(()=>document.querySelector(".hq-walk").getAttribute("href")).then(h=>h!=="#" && /Sloane/.test(decodeURIComponent(h))));
  ok("weather BBC link from trip.json", await page.evaluate(()=>document.querySelector(".weather-cta").getAttribute("href")) === "https://www.bbc.co.uk/weather/2655603");
  ok("reveal/reset password equals the house code", await page.evaluate(()=>RESET_PASSWORD) === "brum26");
  ok("no LEGACY_RENAMES / applyLegacyRenames left", await page.evaluate(()=>typeof applyLegacyRenames==="undefined" && typeof LEGACY_RENAMES==="undefined"));
  ok("all-pins map link uses TRIP.city", await page.evaluate(()=>{ const u=googleAllPinsUrl([{name:"The Wellington",lat:1,lon:1}]); return /Birmingham/.test(decodeURIComponent(u)); }));

  // Simulate a different trip purely via config to prove nothing else is hardcoded.
  const rebrand = await page.evaluate(()=>{
    TRIP.city="Leeds"; TRIP.year="27"; TRIP.houseCode="leeds27";
    TRIP.crew=[{name:"Gaffer"},{name:"Sparky"}]; TRIP.datesLabel="Fri 3 → Sun 5 Sept";
    applyTrip(TRIP); applyTripToDOM();
    return {
      title: document.title,
      bingo: document.getElementById("bingo-title").textContent,
      desc: document.querySelector('meta[name=description]').content,
      pw: RESET_PASSWORD,
      pins: decodeURIComponent(googleAllPinsUrl([{name:"Whitelock's"}])),
    };
  });
  ok("rebrand → title", /Leeds/.test(rebrand.title));
  ok("rebrand → bingo heading", rebrand.bingo === "Leeds Bingo");
  ok("rebrand → description uses new crew", /Gaffer/.test(rebrand.desc) && /Sparky/.test(rebrand.desc));
  ok("rebrand → password follows new house code", rebrand.pw === "leeds27");
  ok("rebrand → map link uses new city", /Leeds/.test(rebrand.pins));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} reskin checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
