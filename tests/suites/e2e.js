const { chromium } = require("playwright-core");
const EXE = (process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const BASE = "http://localhost:8735";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS ✅" : "FAIL ❌"}  ${name}${extra ? "  — " + extra : ""}`);

// Freeze the clock to a fixed PRE-TRIP moment so the pre-trip UI (countdown,
// visible connection pill, non-live hero) is tested deterministically —
// independent of the real calendar or trip.json's start date. Trip-live and
// post-trip states have their own coverage in tripmode.js.
const clockScript = (iso) => `(function(){ var FAKE = new (window.Date)("${iso}").getTime(); var _D = window.Date; function MockDate(){ if(arguments.length===0){ return new _D(FAKE); } return new _D(...arguments); } MockDate.now=function(){ return FAKE; }; MockDate.parse=_D.parse; MockDate.UTC=_D.UTC; MockDate.prototype=_D.prototype; window.Date=MockDate; })();`;

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
  // Firebase stub: never touches network, so we test pure local + UI.
  await ctx.route("**/gstatic.com/**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "/* firebase stubbed */" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(clockScript("2026-07-10T18:00"));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // ---- 0. Tabbed view: one section at a time (no giant scroll) ----
  const visSections = async () => page.evaluate(() =>
    ["itinerary", "pubs", "tracker", "bets", "bingo", "stats", "recap", "crew"]
      .filter((id) => { const el = document.getElementById(id); return el && el.style.display !== "none"; }));
  let vis = await visSections();
  ok("only itinerary visible on load", vis.length === 1 && vis[0] === "itinerary", vis.join(","));
  ok("itinerary tab is active", await page.locator('.tab.active[href="#itinerary"]').count() === 1);

  // ---- 1. First-load identity modal ----
  ok("modal shows on first load", await page.locator("#whoami-modal:not(.hidden)").count() === 1);
  ok("modal offers 4 crew", await page.locator("#modal-pick .whoami-btn").count() === 4);
  ok("crew renamed: Mr Finance & The Director in, old names gone", await page.evaluate(() => { const t = document.getElementById("modal-pick").textContent; return t.includes("Mr Finance") && t.includes("The Director") && !t.includes("Mitul"); }));
  // claim Big Ben (index 1)
  await page.locator('#modal-pick .whoami-btn[data-me="1"]').click();
  await page.waitForTimeout(200);
  ok("claiming closes modal", await page.locator("#whoami-modal.hidden").count() === 1);
  ok("claimed banner shows name", (await page.locator(".whoami-claimed .me-name").textContent()).includes("Big Ben"));
  ok("roster shows me as in", (await page.locator("#whoami .roster").textContent()).includes("Big Ben"));

  // modal now closed — test tab switching
  await page.locator('.tab[href="#bets"]').click();
  await page.waitForTimeout(150);
  vis = await visSections();
  ok("clicking Bets tab shows only bets", vis.length === 1 && vis[0] === "bets", vis.join(","));
  ok("bets tab is active after click", await page.locator('.tab.active[href="#bets"]').count() === 1);
  await page.locator('.tab[href="#tracker"]').click();
  await page.waitForTimeout(150);
  // From here on, force every section visible so the remaining interaction checks
  // (which reach into any section) don't fail just because a tab is hidden.
  await page.evaluate(() => ["itinerary", "pubs", "tracker", "bets", "bingo", "stats", "recap", "crew"]
    .forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = ""; }));

  // ---- 2. Drink tracker: +1 per tap, leaderboard counts drinks ----
  const lbBig = async (name) => page.evaluate((n) => {
    const c = [...document.querySelectorAll(".lb-card")].find((x) => x.querySelector(".lb-name").textContent.startsWith(n));
    return { big: c.querySelector(".lb-units").textContent, lab: c.querySelector(".lb-units-lab").textContent };
  }, name);
  // tap Big Ben's own pint button (per-person drink logging)
  await page.locator('.person-drink[data-i="1"][data-drink="pint"]').click();
  await page.waitForTimeout(120);
  let l = await lbBig("Big Ben");
  ok("1 pint -> leaderboard shows 1 drink (not 2)", l.big === "1", `big=${l.big} ${l.lab}`);
  // quick-add for me
  await page.locator("#me-quickadd").click();
  await page.waitForTimeout(120);
  l = await lbBig("Big Ben");
  ok("quick-add +1 -> 2 drinks", l.big === "2", `big=${l.big}`);
  // per-person: logging a wine for Director (person 2) records a wine for THEM
  await page.locator('.person-drink[data-i="2"][data-drink="wine"]').click();
  await page.waitForTimeout(100);
  ok("per-person button logs that drink for that person", await page.evaluate(() => (JSON.parse(localStorage.getItem("thirstyboys.brum26.v1")).tallies[2] || {}).wine === 1));
  ok("Director's log entry names the wine", await page.evaluate(() => [...document.querySelectorAll("#log li .log-who")].some((x) => /Director/.test(x.textContent) && /Wine/i.test(x.textContent))));
  ok("Big Ben is Thirstiest (crown)", (await page.evaluate(() => [...document.querySelectorAll(".lb-card")][0].textContent)).includes("Thirstiest"));

  // ---- 3. Undo removes MY last drink only ----
  await page.locator("#undo-btn").click();
  await page.waitForTimeout(120);
  l = await lbBig("Big Ben");
  ok("undo my last -> back to 1", l.big === "1", `big=${l.big}`);

  // ---- 3b. Drink log = audit of who / what / when ----
  ok("log title is 'Drink log'", await page.evaluate(() => document.querySelector(".log-title").textContent.includes("Drink log")));
  ok("drink log entry shows who + drink", await page.evaluate(() => [...document.querySelectorAll("#log li .log-who")].some((x) => /Big Ben/.test(x.textContent) && /Pint/i.test(x.textContent))));
  ok("drink log entry shows a day + time", await page.evaluate(() => { const w = document.querySelector("#log li .log-when"); return !!w && /\d{1,2}:\d{2}/.test(w.textContent); }));
  ok("drink log shows a count", await page.evaluate(() => /\(\d+\)/.test(document.getElementById("log-count").textContent)));

  // ---- 4. Per-device drink picker (not synced state) ----
  await page.locator('.drink-pick[data-drink="shot"]').click();
  await page.waitForTimeout(80);
  ok("picker changes my quick-add button label", (await page.locator("#me-quickadd").textContent()).includes("Shot"));
  ok("selectedDrink stored per-device (localStorage)", await page.evaluate(() => localStorage.getItem("thirstyboys.drink") === "shot"));
  ok("selectedDrink NOT in synced state", await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("thirstyboys.brum26.v1") || "{}"); return s.selectedDrink === undefined; }));
  ok("whiskey drink option present", await page.locator('.drink-pick[data-drink="whiskey"]').count() === 1);
  ok("no \"units\" text anywhere", !(await page.evaluate(() => /\bunits\b/.test(document.body.innerText))));
  await page.locator('.drink-pick[data-drink="pint"]').click();

  // ---- 4b. Admin drink editor (password-gated; edit anyone) ----
  const p0pint = () => page.evaluate(() => (JSON.parse(localStorage.getItem("thirstyboys.brum26.v1")).tallies[0] || {}).pint || 0);
  // wrong password → editor stays hidden
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => d.accept("nope"));
  await page.locator("#admin-btn").click();
  await page.waitForTimeout(140);           // prompt + the wrong-pw alert (auto-dismissed)
  ok("admin editor hidden on wrong password", await page.evaluate(() => document.getElementById("admin-editor").classList.contains("hidden")));
  // correct password → editor opens with a row per crew member
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => d.accept("brum26"));
  await page.locator("#admin-btn").click();
  await page.waitForTimeout(120);
  ok("admin editor opens with the password", await page.evaluate(() => !document.getElementById("admin-editor").classList.contains("hidden") && document.querySelectorAll("#admin-editor .admin-person").length === 4));
  // add a pint to Mr Finance (person 0 — not me)
  const b0 = await p0pint();
  await page.evaluate(() => [...document.querySelectorAll("#admin-editor .admin-person")][0].querySelector('.admin-step[data-drink="pint"][data-delta="1"]').click());
  await page.waitForTimeout(80);
  ok("admin adds a drink to another person", (await p0pint()) === b0 + 1, `pint ${b0}->${await p0pint()}`);
  // remove it again
  await page.evaluate(() => [...document.querySelectorAll("#admin-editor .admin-person")][0].querySelector('.admin-step[data-drink="pint"][data-delta="-1"]').click());
  await page.waitForTimeout(80);
  ok("admin removes another person's drink", (await p0pint()) === b0);
  // toggling off needs no password
  await page.locator("#admin-btn").click();
  await page.waitForTimeout(60);
  ok("admin editor toggles closed without a prompt", await page.evaluate(() => document.getElementById("admin-editor").classList.contains("hidden")));
  page.removeAllListeners("dialog");

  // ---- 5. Reset requires password ----
  page.once("dialog", (d) => d.accept("wrongpw"));
  await page.locator("#reset-btn").click();
  await page.waitForTimeout(150);
  // handle the "wrong password" alert
  page.once("dialog", (d) => d.accept());
  await page.waitForTimeout(150);
  l = await lbBig("Big Ben");
  ok("wrong password does NOT reset", l.big === "1", `big=${l.big}`);

  // ---- 6. Bets: cast, reveal, settle, score ----
  const betCards = await page.locator(".bet-card").count();
  ok("42 bets present", betCards === 42, `${betCards} cards`);
  ok("'First to mention AI' bet present", await page.evaluate(() => document.getElementById("bets-deck").textContent.includes("First to mention AI")));
  // Swipe deck: bets live in a horizontal snap-scroller, not a long vertical list
  ok("bets render inside a swipe deck", await page.locator("#bets-deck.deck").count() === 1);
  ok("deck cards are children of the decks (42 across both)", await page.evaluate(() => document.querySelectorAll(".deck > .bet-card").length) === 42);
  ok("deck is horizontally scrollable", await page.evaluate(() => { const d = document.getElementById("bets-deck"); return d.scrollWidth > d.clientWidth + 10; }));
  ok("deck counter shows position / total", /\/\s*\d+/.test(await page.evaluate(() => document.getElementById("bets-deck-count").textContent)));
  // Next arrow advances the deck
  const beforeScroll = await page.evaluate(() => document.getElementById("bets-deck").scrollLeft);
  await page.locator('.deck-arrow[data-deck="bets-deck"][data-dir="1"]').click();
  await page.waitForTimeout(450);
  ok("‹ › arrow advances the deck", await page.evaluate(() => document.getElementById("bets-deck").scrollLeft) > beforeScroll);
  // Done/to-do progress: before calling anything, 0 done and every card flagged to-do
  ok("bets progress bar shows 0 called", /You've called\s*0\s*\/\s*42/.test(await page.evaluate(() => document.querySelector("#bets .mine-progress .mp-text").textContent)));
  ok("uncalled bet shows 'Your call needed'", await page.evaluate(() => { const c = [...document.querySelectorAll("#bets-deck .bet-card")].find((x) => x.textContent.includes("tap out")); return c.classList.contains("mine-todo") && /your call needed/i.test(c.textContent); }));
  // person bet 'tapout' dropdown -> pick Director(2), then Submit to lock it in
  ok("uncalled bet shows a Submit button", await page.evaluate(() => { const c = [...document.querySelectorAll(".bet-card")].find((x) => x.textContent.includes("tap out")); return !!c.querySelector(".bet-submit"); }));
  await page.evaluate(() => { const s = document.querySelector('[data-bet-call="tapout"]'); s.value = "2"; s.dispatchEvent(new Event("change")); s.closest(".bet-card").querySelector(".bet-submit").click(); });
  await page.waitForTimeout(100);
  ok("my bet call locks (🔒)", (await page.evaluate(() => [...document.querySelectorAll(".bet-card")].find((c) => c.textContent.includes("tap out")).textContent)).includes("🔒"));
  ok("called bet flips to 'Called' + done state", await page.evaluate(() => { const c = [...document.querySelectorAll("#bets-deck .bet-card")].find((x) => x.textContent.includes("tap out")); return c.classList.contains("mine-done") && /called/i.test(c.textContent); }));
  ok("bets progress bar advances to 1 called", /You've called\s*1\s*\/\s*42/.test(await page.evaluate(() => document.querySelector("#bets .mine-progress .mp-text").textContent)));
  // Bets are grouped: shared "classics" first, then this trip's LOCAL bets.
  ok("bets split into a 'This trip' deck and a 'Classics' deck", await page.evaluate(() => !!document.getElementById("bets-deck-local") && !!document.getElementById("bets-deck")));
  ok("local bets live in the 'This trip' deck, in order (TOCA before disc golf)", await page.evaluate(() => { const cards = [...document.querySelectorAll("#bets-deck-local > .bet-card")]; const idx = (q) => cards.findIndex((c) => c.textContent.includes(q)); return idx("TOCA Social") > -1 && idx("Disc golf") > idx("TOCA Social"); }));
  ok("classics deck holds classic bets (Total pints) and excludes local ones (no TOCA)", await page.evaluate(() => { const t = document.getElementById("bets-deck").textContent; return t.includes("Total pints") && !t.includes("TOCA Social"); }));
  // After calling, the picker collapses to a "your call" line with Edit + Enter-outcome buttons
  ok("called bet hides the picker + the pick itself, shows Edit call", await page.evaluate(() => { const c = [...document.querySelectorAll("#bets-deck .bet-card")].find((x) => x.textContent.includes("tap out")); return !c.querySelector('[data-bet-call="tapout"]') && !!c.querySelector(".bet-editcall") && /locked in/i.test(c.textContent) && !/The Director/.test(c.textContent); }));
  ok("outcome hidden until 'Enter outcome' is tapped", await page.evaluate(() => { const c = [...document.querySelectorAll("#bets-deck .bet-card")].find((x) => x.textContent.includes("tap out")); return !c.querySelector('[data-bet-result="tapout"]') && !!c.querySelector(".bet-enteroutcome"); }));
  // Edit call re-opens the picker
  await page.evaluate(() => [...document.querySelectorAll("#bets-deck .bet-card")].find((x) => x.textContent.includes("tap out")).querySelector(".bet-editcall").click());
  await page.waitForTimeout(80);
  ok("Edit call re-opens the picker", await page.evaluate(() => { const c = [...document.querySelectorAll("#bets-deck .bet-card")].find((x) => x.textContent.includes("tap out")); return !!c.querySelector('[data-bet-call="tapout"]'); }));
  // reveal requires the password — wrong password first (ensuing alert auto-dismisses)
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => d.accept("wrongpw"));
  await page.evaluate(() => [...document.querySelectorAll(".bet-card")].find((c) => c.textContent.includes("tap out")).querySelector(".bet-reveal").click());
  await page.waitForTimeout(120);
  ok("wrong password does NOT reveal calls", await page.evaluate(() => { const b = JSON.parse(localStorage.getItem("thirstyboys.brum26.v1")).bets.tapout; return b && b.revealed !== true; }));
  // now reveal with the correct password
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => d.accept("brum26"));
  await page.evaluate(() => [...document.querySelectorAll(".bet-card")].find((c) => c.textContent.includes("tap out")).querySelector(".bet-reveal").click());
  await page.waitForTimeout(100);
  ok("correct password reveals calls", await page.evaluate(() => JSON.parse(localStorage.getItem("thirstyboys.brum26.v1")).bets.tapout.revealed === true));
  // settle result = Director(2)
  await page.evaluate(() => { const s = document.querySelector('[data-bet-result="tapout"]'); s.value = "2"; s.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(120);
  ok("correct call gets ✅ hit row", await page.locator(".bet-call-row.hit").count() >= 1);
  ok("scoreboard tallies my correct call", (await page.evaluate(() => document.querySelector(".bet-scoreboard")?.textContent || "")).includes("Big Ben"));
  ok("bet standings show ranked rows with accuracy", await page.evaluate(() => { const sb = document.querySelector(".bet-scoreboard.bet-stats"); return !!sb && sb.querySelectorAll(".bet-stat-row").length === 4 && /settled/.test(sb.textContent) && /%/.test(sb.textContent); }));
  // text bet 'totalpints' (free-text guess)
  await page.evaluate(() => { const el = document.querySelector('[data-bet-call="totalpints"]'); el.value = "42"; el.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(80);
  ok("text bet stores free-text guess", await page.evaluate(() => JSON.parse(localStorage.getItem("thirstyboys.brum26.v1")).bets.totalpints.calls["1"] === "42"));
  ok("removed bets gone (villa/phone casualty/playoff winner)", await page.evaluate(() => !document.body.textContent.includes("Villa/Blues") && !document.body.textContent.includes("phone casualty") && !document.body.textContent.includes("wins the 3rd-place playoff")));

  // ---- 7. Awards feature removed entirely ----
  ok("awards tab & section gone", await page.evaluate(() =>
    !document.getElementById("awards") &&
    !document.getElementById("awards-list") &&
    !document.querySelector('.tab[href="#awards"]')));
  ok("no award-vote leftovers in state schema", await page.evaluate(() => !("awards" in (state || {}))));

  // ---- 8. Quote wall removed entirely ----
  ok("quote wall tab & section gone", await page.evaluate(() =>
    !document.getElementById("quotes") &&
    !document.getElementById("quote-add") &&
    ![...document.querySelectorAll(".tab")].some((t) => t.textContent.includes("Quotes"))));

  // ---- 9. Crew rename propagates ----
  await page.evaluate(() => { const inp = document.querySelector('.crew-name-input[data-i="1"]'); inp.value = "Big Benjamin"; inp.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(150);
  ok("rename in crew updates tracker", (await page.evaluate(() => [...document.querySelectorAll(".person-name-static")].some((e) => e.textContent.includes("Big Benjamin")))));
  // revert
  await page.evaluate(() => { const inp = document.querySelector('.crew-name-input[data-i="1"]'); inp.value = "Big Ben"; inp.dispatchEvent(new Event("change")); });

  // ---- 10. Itinerary + HQ + countdown ----
  ok("HQ card address present", (await page.locator(".hq-addr").textContent()).includes("9 Sloane Street"));
  ok("walk-home link is walking directions", (await page.getAttribute(".hq-walk", "href")).includes("Sloane") && (await page.getAttribute(".hq-walk", "href")).includes("walking"));
  ok("HQ has an Uber-home deep link with coords", await page.evaluate(() => { const h = document.getElementById("hq-uber").getAttribute("href"); return h.includes("m.uber.com") && h.includes("dropoff") && /latitude/.test(h); }));
  await page.click("#hq-copy");
  await page.waitForTimeout(120);
  ok("copy address works", await page.evaluate(() => navigator.clipboard.readText()) === "9 Sloane Street, Birmingham, B1 3DZ");
  ok("countdown caption is the motto", (await page.locator("#cd-caption").textContent()).includes("big gay"));
  ok("TOCA booking ref shown", (await page.evaluate(() => document.getElementById("days").textContent)).includes("4K2WGY43LF43"));
  ok("per-day Route link present", (await page.locator(".day-map").count()) >= 3);
  ok("off-licence tab & section removed", await page.evaluate(() => !document.getElementById("shop") && ![...document.querySelectorAll(".tab")].some((t) => t.textContent.includes("Off-Licence"))));
  // Removed the standalone 19:15 "Uber to Balti" stop (it's implied by the balti stop)
  ok("19:15 Uber-to-Balti stop removed", await page.evaluate(() => !document.getElementById("days").textContent.includes("Uber to Balti")));
  // Every real venue now has a proper Uber deep link — Arch 13 was the gap
  ok("Arch 13 has a real Uber deep link", await page.evaluate(() => { const arch = [...document.querySelectorAll("#days .stop")].find((s) => s.textContent.includes("Arch 13")); return !!arch && !!arch.querySelector('a[href*="m.uber.com"]'); }));
  ok("no venue falls back to 'Get there' (all have Uber)", await page.evaluate(() => !document.getElementById("days").textContent.includes("Get there")));
  // Find food + find beer, both biased to top-rated & open now
  ok("Find food link targets top-rated & open now", await page.evaluate(() => { const h = document.getElementById("food-now").getAttribute("href"); return /maps/.test(h) && /rated/.test(h) && /open/.test(h) && /restaurant/i.test(h); }));
  ok("Find beer link present, top-rated & open now", await page.evaluate(() => { const el = document.getElementById("beer-now"); if (!el) return false; const h = el.getAttribute("href"); return /maps/.test(h) && /rated/.test(h) && /open/.test(h) && /pub|bar|beer/i.test(h); }));
  // Pubs slotted into the itinerary
  ok("Albert Schloss slotted into Saturday", await page.evaluate(() => { const s = [...document.querySelectorAll("#days .stop")].find((x) => x.textContent.includes("Albert Schloss")); return !!s && !!s.querySelector('a[href*="m.uber.com"]'); }));
  ok("Jewellers Arms slotted as Friday nightcap", await page.evaluate(() => { const s = [...document.querySelectorAll("#days .stop")].find((x) => x.textContent.includes("Jewellers Arms")); return !!s && !!s.querySelector('a[href*="m.uber.com"]'); }));

  // ---- 10c. Pubs on the bench ----
  ok("Pubs tab present", await page.evaluate(() => [...document.querySelectorAll(".tab")].some((t) => t.textContent.trim() === "Pubs")));
  ok("pubs grouped by area", await page.evaluate(() => document.querySelectorAll("#pubs .pub-area").length >= 3));
  ok("The Woodman listed with map + Uber", await page.evaluate(() => { const p = [...document.querySelectorAll("#pubs .pub")].find((x) => x.textContent.includes("The Woodman")); return !!p && !!p.querySelector('a[href*="maps"]') && !!p.querySelector('a[href*="m.uber.com"]'); }));
  ok("bench pub Uber has geocoded coords", await page.evaluate(() => { const p = [...document.querySelectorAll("#pubs .pub")].find((x) => x.textContent.includes("Tiger Bites Pig")); return !!p && /latitude/.test(p.querySelector('a[href*="m.uber.com"]').getAttribute("href")); }));
  // Slotted pubs moved into the itinerary (not duplicated on the bench)
  ok("The Wellington slotted into Friday", await page.evaluate(() => { const s = [...document.querySelectorAll("#days .stop")].find((x) => x.textContent.includes("The Wellington")); return !!s && !!s.querySelector('a[href*="m.uber.com"]'); }));
  ok("Kilder slotted into Saturday", await page.evaluate(() => { const s = [...document.querySelectorAll("#days .stop")].find((x) => x.textContent.includes("Kilder")); return !!s && !!s.querySelector('a[href*="m.uber.com"]'); }));
  ok("slotted pubs not duplicated on the bench", await page.evaluate(() => ![...document.querySelectorAll("#pubs .pub")].some((x) => /The Wellington|Kilder/.test(x.textContent))));

  // ---- 10c-0. Outdoor / beer-garden section ----
  ok("Outdoor beer-garden section present", await page.evaluate(() => [...document.querySelectorAll("#pubs .pub-area-h")].some((h) => /outdoor/i.test(h.textContent))));
  ok("Lord Clifden listed under Outdoor with map + Uber", await page.evaluate(() => { const p = [...document.querySelectorAll("#pubs .pub")].find((x) => x.textContent.includes("Lord Clifden")); return !!p && !!p.querySelector('a[href*="maps"]') && !!p.querySelector('a[href*="m.uber.com"]'); }));
  ok("Old Crown geocoded (Uber has coords)", await page.evaluate(() => { const p = [...document.querySelectorAll("#pubs .pub")].find((x) => x.textContent.includes("Old Crown")); return !!p && /latitude/.test(p.querySelector('a[href*="m.uber.com"]').getAttribute("href")); }));

  // ---- 10c-i. Instagram links (itinerary + bench pubs) ----
  ok("itinerary stops carry Instagram links", await page.locator("#days .stop-tags .link-insta").count() >= 10);
  ok("Albert Schloss stop links its Instagram", await page.evaluate(() => { const s = [...document.querySelectorAll("#days .stop")].find((x) => x.textContent.includes("Albert Schloss")); const a = s && s.querySelector(".link-insta"); return !!a && /instagram\.com\/albertsschloss/.test(a.getAttribute("href")); }));
  ok("bench pubs carry Instagram links", await page.locator("#pubs .pub-links .link-insta").count() >= 5);
  ok("The Woodman bench pub links its Instagram", await page.evaluate(() => { const p = [...document.querySelectorAll("#pubs .pub")].find((x) => x.textContent.includes("The Woodman")); const a = p && p.querySelector(".link-insta"); return !!a && /instagram\.com\/woodmanbrum/.test(a.getAttribute("href")); }));
  ok("Instagram links open in a new tab safely", await page.evaluate(() => [...document.querySelectorAll(".link-insta")].every((a) => a.target === "_blank" && /noopener/.test(a.rel))));

  // ---- 10c-ii. Integrated pubs map (Leaflet, multi-pin) ----
  ok("pubs section has a map canvas", await page.locator("#pubs #pubs-map .pubs-map-canvas").count() === 1);
  ok("pubs map offers an 'open all pins' link with every pub", await page.evaluate(() => { const a = document.querySelector("#pubs-map .pubs-map-open"); if (!a) return false; const h = decodeURIComponent(a.getAttribute("href")); return /google\.com\/maps/.test(h) && /Woodman/.test(h) && /Wolf/.test(h) && /Burning Soul/.test(h); }));
  ok("pubs map container injected once (not rebuilt every render)", await page.evaluate(() => { const b = document.getElementById("pubs-map"); const first = b.querySelector(".pubs-map-canvas"); render(); return b.querySelector(".pubs-map-canvas") === first; }));

  // ---- 10c-iii. Weather forecast strip ----
  ok("weather strip element exists", await page.locator("#weather-days").count() === 1);

  // ---- 10b. Connection indicator (fixed, NOT in the nav) ----
  ok("connection indicator exists", await page.locator("#net-status").count() === 1);
  ok("connection indicator is NOT in the nav", await page.evaluate(() => !document.querySelector("nav.tabs #net-status")));
  ok("connection indicator is fixed-positioned", await page.evaluate(() => getComputedStyle(document.getElementById("net-status")).position === "fixed"));
  // Firebase is stubbed here (never connects) -> should read Offline, not Connected.
  ok("connection indicator shows a status", (await page.locator("#net-status").textContent()).trim().length > 0);
  ok("connection indicator visible on every tab", await page.evaluate(() => {
    const p = document.getElementById("net-status");
    return p && getComputedStyle(p).display !== "none";
  }));
  // Tap it to see who's connected (dismiss the one-time A2HS hint first)
  await page.evaluate(() => { const a = document.getElementById("a2hs"); if (a) a.remove(); document.body.classList.remove("has-a2hs"); });
  await page.locator("#net-status").click();
  await page.waitForTimeout(80);
  ok("tapping pill opens the who's-connected popover", await page.evaluate(() => !!document.getElementById("net-pop") && !!document.querySelector("#net-pop .roster")));
  ok("popover lists the claimed crew member", await page.evaluate(() => /Big Ben/.test(document.getElementById("net-pop").textContent)));
  await page.locator("#net-status").click();     // toggle closed
  await page.waitForTimeout(60);
  ok("tapping again closes the popover", await page.evaluate(() => !document.getElementById("net-pop")));

  // ---- 10c. Dares removed ----
  ok("dares tab & section gone", await page.evaluate(() => !document.getElementById("dares") && !document.getElementById("dare-deck") && ![...document.querySelectorAll(".tab")].some((t) => t.textContent.includes("Dares"))));

  // ---- 10d. Live stats ----
  ok("stats section renders tiles", await page.locator("#stats #stats-wrap .stat-tiles").count() === 1);
  ok("stats show group total drinks", await page.evaluate(() => { const t = [...document.querySelectorAll("#stats .stat-tile")].find((x) => /total drinks/i.test(x.textContent)); return !!t && Number(t.querySelector(".st-v").textContent) >= 1; }));
  ok("stats show per-man pace rows", await page.evaluate(() => document.querySelectorAll("#stats .stat-row").length >= 1));
  ok("stats show a drinks/hour rate tile", await page.evaluate(() => [...document.querySelectorAll("#stats .stat-tile")].some((x) => /drinks\s*\/\s*hour/i.test(x.textContent))));
  ok("stats render the over-time chart (with data)", await page.evaluate(() => !!document.querySelector("#stats .stat-chart svg.chart-svg path")));
  // Tap the ⓘ on the chart → the model explanation opens
  ok("model info hidden by default", await page.evaluate(() => { const m = document.getElementById("model-info"); return !!m && !m.classList.contains("open"); }));
  await page.locator("#stats .chart-info-btn").click();
  await page.waitForTimeout(80);
  ok("tapping ⓘ reveals how the projection works", await page.evaluate(() => { const m = document.getElementById("model-info"); return !!m && m.classList.contains("open") && /worked out|asleep|pace/i.test(m.textContent); }));
  // Chart: toggle to per-person lines + legend
  ok("chart starts in group mode (1 amber line)", await page.evaluate(() => document.querySelectorAll("#stats .chart-svg path").length <= 2 && !document.querySelector("#stats .chart-legend")));
  await page.locator("#stats .chart-mode-btn").click();
  await page.waitForTimeout(100);
  ok("per-person toggle shows a legend", await page.evaluate(() => { const lg = document.querySelector("#stats .chart-legend"); return !!lg && lg.querySelectorAll(".lg-item").length >= 2; }));
  ok("per-person mode draws a line per drinker", await page.evaluate(() => document.querySelectorAll("#stats .chart-svg path").length >= 2));
  await page.locator("#stats .chart-mode-btn").click();  // back to group
  await page.waitForTimeout(100);
  ok("toggle back to group removes the legend", await page.evaluate(() => !document.querySelector("#stats .chart-legend")));

  // ---- 10e-ii. Beef & Bragging funny stats ----
  ok("Beef & Bragging card renders in Stats", await page.locator("#stats #bragging .brag-card").count() === 1);
  ok("bragging shows an empty/unlocked state before any bets/awards settle", await page.evaluate(() => { const e = document.getElementById("bragging"); return /Beef/.test(e.textContent) && (/gossip/i.test(e.textContent) || e.querySelector(".brag-row")); }));

  // ---- 10e. Trip mode (pre-trip today) + pull-to-refresh ----
  ok("pre-trip: LIVE hero hidden, no trip-live class", await page.evaluate(() => document.getElementById("hero-live").classList.contains("hidden") && !document.body.classList.contains("trip-live")));
  await page.evaluate(() => doPullRefresh());
  await page.waitForTimeout(80);
  ok("pull-to-refresh triggers a sync toast", await page.evaluate(() => !!document.querySelector(".toast")));

  // ---- 11. No horizontal overflow ----
  const of = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("no horizontal page overflow", of === false);

  ok("no uncaught page errors", errors.length === 0, errors.join(" | "));

  console.log(out.join("\n"));
  const passed = out.filter((x) => x.startsWith("PASS")).length;
  console.log(`\n${passed}/${out.length} checks passed`);
  await b.close();
  process.exit(passed === out.length ? 0 : 1);
})();
