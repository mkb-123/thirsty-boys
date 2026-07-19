const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const out=[]; const ok=(n,c,x="")=>out.push(`${c?"PASS ✅":"FAIL ❌"}  ${n}${x?"  — "+x:""}`);
const clock=(iso)=>`(function(){var F=new (window.Date)("${iso}").getTime();var D=window.Date;function M(){if(arguments.length===0)return new D(F);return new D(...arguments);}M.now=()=>F;M.parse=D.parse;M.UTC=D.UTC;M.prototype=D.prototype;window.Date=M;})();`;
(async()=>{
  const b=await chromium.launch({executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:1400},isMobile:true});
  await ctx.route("**/gstatic.com/**",r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.addInitScript(clock("2026-07-20T10:00:00")); // after the trip → recap is default/visible
  await page.addInitScript(()=>{
    localStorage.clear(); localStorage.setItem("thirstyboys.me","1");
    // Stub html2canvas so the export path runs without a network fetch.
    window.__h2cCalls=0; window.__h2cFail=false;
    window.html2canvas=(el,opts)=>{ window.__h2cCalls++; window.__h2cOpts=opts; window.__h2cEl=(el&&el.id)||""; if(window.__h2cFail) return Promise.reject(new Error("boom")); return Promise.resolve({ toBlob:(cb,type)=>cb(new Blob(["PNGDATA"],{type:type||"image/png"})) }); };
    // Capture share() / canShare() and anchor downloads.
    window.__shared=null; window.__downloads=[];
    Object.defineProperty(navigator,"canShare",{configurable:true,value:(d)=>!!(d&&d.files&&d.files.length)});
    Object.defineProperty(navigator,"share",{configurable:true,value:(d)=>{ window.__shared={title:d.title,text:d.text,hasFiles:!!(d.files&&d.files.length),url:d.url,fileType:d.files&&d.files[0]&&d.files[0].type,fileName:d.files&&d.files[0]&&d.files[0].name}; return Promise.resolve(); }});
    const realClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){ if(this.download) window.__downloads.push(this.download); else realClick.call(this); };
  });
  await page.goto("http://localhost:8735/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{
    const m=document.getElementById("whoami-modal"); if(m)m.classList.add("hidden");
    state.tallies=[{pint:9},{pint:5},{pint:7},{pint:3}]; state.log=[]; save(); render();
  });
  await page.waitForTimeout(200);

  ok("recap card is visible", await page.evaluate(()=>document.getElementById("recap-card").offsetWidth>0));
  ok("share button present", await page.locator("#recap-share").count()===1);

  // ---- Case 1: file-sharing supported → share a PNG file (not a link) ----
  await page.evaluate(()=>{ window.__shared=null; window.__downloads=[]; window.__h2cCalls=0; });
  await page.locator("#recap-share").click();
  await page.waitForTimeout(400);
  ok("html2canvas was invoked on #recap-card", await page.evaluate(()=>window.__h2cCalls===1 && window.__h2cEl==="recap-card"));
  ok("navigator.share was called", await page.evaluate(()=>!!window.__shared));
  ok("shared payload includes a file (image, not a link)", await page.evaluate(()=>window.__shared && window.__shared.hasFiles===true && !window.__shared.url));
  ok("shared file is image/png", await page.evaluate(()=>window.__shared && window.__shared.fileType==="image/png"));
  ok("shared file name ends in .png", await page.evaluate(()=>/\.png$/.test((window.__shared||{}).fileName||"")));
  ok("no download when share succeeds", await page.evaluate(()=>window.__downloads.length===0));

  // ---- Case 2: no file-share support → download the PNG ----
  await page.evaluate(()=>{
    window.__shared=null; window.__downloads=[]; window.__h2cCalls=0;
    Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>false});
  });
  await page.locator("#recap-share").click();
  await page.waitForTimeout(400);
  ok("a PNG download was triggered", await page.evaluate(()=>window.__downloads.length===1 && /\.png$/.test(window.__downloads[0])));
  ok("did not fall back to link-share", await page.evaluate(()=>window.__shared===null));

  // ---- Case 3: image build fails → graceful text/link fallback ----
  await page.evaluate(()=>{
    window.__shared=null; window.__downloads=[]; window.__h2cFail=true;
    Object.defineProperty(navigator,"canShare",{configurable:true,value:(d)=>!!(d&&d.files&&d.files.length)});
  });
  await page.locator("#recap-share").click();
  await page.waitForTimeout(400);
  ok("falls back to link share when image fails", await page.evaluate(()=>!!window.__shared && !window.__shared.hasFiles && !!window.__shared.url));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(out.join("\n"));
  const p=out.filter(x=>x.startsWith("PASS")).length;
  console.log(`\n${p}/${out.length} recap-image checks passed`);
  await b.close();
  process.exit(p===out.length?0:1);
})();
