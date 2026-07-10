/* ==========================================================================
   Thirsty Boys — Birmingham '26
   Itinerary, live-now, countdown & drink tracker (localStorage-backed)
   ========================================================================== */

/* ---------- ITINERARY DATA ----------
   Times are 2026 local (BST). `iso` drives the countdown + live-now logic. */
const ITINERARY = [
  {
    name: "Friday", date: "17 July",
    stops: [
      { t: "12:00", iso: "2026-07-17T12:00", emoji: "🚆", title: "Arrive Birmingham", desc: "Mitul, Big Ben & Director hit town." },
      { t: "12:30", iso: "2026-07-17T12:30", emoji: "🍺", title: "The Indian Brewery", desc: "Snow Hill arches · Birmingham Lager & fat naans.", tag: "booked", map: "The Indian Brewery Snow Hill Birmingham" },
      { t: "15:00", iso: "2026-07-17T15:00", emoji: "🔑", title: "Check into Airbnb", desc: "9 Sloane Street — HQ. Mr Science arrives.", map: "9 Sloane Street Birmingham B1 3DZ" },
      { t: "17:30", iso: "2026-07-17T17:30", emoji: "🎯", title: "TOCA Social", desc: "Bullring · football games & drinks. Booking ref: 4K2WGY43LF43", tag: "booked", map: "TOCA Social Bullring Birmingham" },
      { t: "19:30", iso: "2026-07-17T19:30", emoji: "🚕", title: "Uber to Balti Triangle", desc: "Off-licence pit stop en route (BYOB!)." },
      { t: "19:45", iso: "2026-07-17T19:45", emoji: "🍛", title: "Royal Watan Kashmiri", desc: "BYOB balti feast.", tag: "booked", map: "Royal Watan Kashmiri Birmingham" },
      { t: "21:30", iso: "2026-07-17T21:30", emoji: "🍷", title: "Arch 13", desc: "Another wine bar. Naturally.", map: "Arch 13 Birmingham" },
    ],
  },
  {
    name: "Saturday", date: "18 July",
    stops: [
      { t: "10:00", iso: "2026-07-18T10:00", emoji: "🥏", title: "Disc Golf @ Ackers", desc: "Ackers Adventure · shake off the balti.", tag: "booked", map: "Ackers Adventure Birmingham" },
      { t: "12:30", iso: "2026-07-18T12:30", emoji: "🌮", title: "El Azteca @ The Loft", desc: "1000 Trades · tacos.", tag: "walkin", map: "1000 Trades Birmingham" },
      { t: "14:00", iso: "2026-07-18T14:00", emoji: "🏎️", title: "F1 Arcade", desc: "Chamberlain Sq · race sims & rounds.", tag: "booked", map: "F1 Arcade Birmingham" },
      { t: "16:00", iso: "2026-07-18T16:00", emoji: "🔄", title: "F1 done — regroup", desc: "Breather. Rehydrate. Reassess." },
      { t: "18:30", iso: "2026-07-18T18:30", emoji: "🍔", title: "Alfred Works Food Hall", desc: "Big feed, many options.", tag: "walkin", map: "Alfred Works food hall Birmingham" },
      { t: "20:00", iso: "2026-07-18T20:00", emoji: "🤠", title: "Low Places", desc: "Honky-tonk. Yeehaw.", map: "Low Places Birmingham" },
      { t: "22:00", iso: "2026-07-18T22:00", emoji: "⚽", title: "World Cup 3rd Place Playoff", desc: "Luna Springs, Digbeth · big screen.", map: "Luna Springs Digbeth Birmingham" },
    ],
  },
  {
    name: "Sunday", date: "19 July",
    stops: [
      { t: "10:30", iso: "2026-07-19T10:30", emoji: "🥐", title: "Medicine Bakery", desc: "Pastries & coffee. Gentle recovery.", map: "Medicine Bakery Birmingham" },
      { t: "12:00", iso: "2026-07-19T12:00", emoji: "👋", title: "Exeunt", desc: "Home time. Until next year, boys." },
    ],
  },
];

const TRIP_START = new Date("2026-07-17T12:00:00");
/* End of the last stop window, for live-now bounds */
const TRIP_END = new Date("2026-07-19T13:00:00");

/* ---------- DRINK DEFINITIONS (UK-ish units) ---------- */
const DRINKS = [
  { id: "pint",     label: "Pint",     emoji: "🍺", units: 2 },
  { id: "half",     label: "Half",     emoji: "🥛", units: 1 },
  { id: "wine",     label: "Wine",     emoji: "🍷", units: 2 },
  { id: "cocktail", label: "Cocktail", emoji: "🍸", units: 2 },
  { id: "shot",     label: "Shot",     emoji: "🥃", units: 1 },
  { id: "soft",     label: "Soft",     emoji: "🧃", units: 0 },
];

const CREW = [
  { emoji: "🧑‍✈️", role: "The Ringleader" },
  { emoji: "🔔", role: "The Timekeeper" },
  { emoji: "🎬", role: "The Director" },
  { emoji: "🔬", role: "Mr Science" },
];
const DEFAULT_NAMES = ["Mitul", "Big Ben", "Director", "Mr Science"];

const TITLES = { top: "👑 Thirstiest Boy", zero: "😇 Designated" };

/* ---------- BETS ----------
   type "person": pick a crew member from a dropdown.
   type "text":   free-text call (e.g. a scoreline).
   Calls are secret (only your own shows) until someone reveals. */
const BETS = [
  { id: "tapout",   emoji: "😴", type: "person", q: "First man to tap out" },
  { id: "disc",     emoji: "🥏", type: "person", q: "Disc golf champion @ Ackers" },
  { id: "toca",     emoji: "🎯", type: "person", q: "TOCA Social champion" },
  { id: "f1",       emoji: "🏎️", type: "person", q: "F1 Arcade fastest lap" },
  { id: "wcscore",  emoji: "⚽", type: "text",   q: "World Cup 3rd-place score" },
  { id: "units",    emoji: "🍺", type: "person", q: "Most drinks by Sunday" },
  { id: "balti",    emoji: "🌶️", type: "person", q: "Orders the hottest balti" },
  { id: "lost",     emoji: "🧭", type: "person", q: "First to get lost" },
  { id: "spill",    emoji: "🫗", type: "person", q: "First to spill a drink" },
  { id: "dance",    emoji: "🤠", type: "person", q: "First to dance at Low Places" },
  { id: "phone",    emoji: "📱", type: "person", q: "First phone casualty (lost/dropped/dead)" },
  { id: "sunday",   emoji: "🥐", type: "person", q: "First out of bed on Sunday" },
];

/* ---------- AWARDS ---------- */
const AWARDS = [
  { id: "mvp",      title: "🏆 MVP of the Weekend" },
  { id: "balti",    title: "🌶️ Best Balti Order" },
  { id: "discgolf", title: "🥏 Disc Golf Hero" },
  { id: "f1",       title: "🏎️ F1 Arcade Champ" },
  { id: "lost",     title: "🧭 Most Lost" },
  { id: "bed",      title: "😴 First to Bed" },
  { id: "honky",    title: "🤠 Best Low Places Moment" },
  { id: "dancer",   title: "🕺 Best Mover" },
  { id: "rounds",   title: "💸 Biggest Round Buyer" },
  { id: "tight",    title: "🤏 Never Got a Round In" },
  { id: "phone",    title: "📱 Most Likely to Lose a Phone" },
  { id: "quote",    title: "💬 Quote of the Weekend" },
  { id: "satam",    title: "🥴 Worst State Saturday AM" },
  { id: "sunday",   title: "🤢 Worst State Sunday AM" },
];

/* ---------- OFF-LICENCE DEFAULTS ---------- */
const SHOP_DEFAULTS = [
  "Red wine (for the balti)", "White wine", "Beers / lager", "Cans / mixers",
  "Soft drinks", "Bottle of water", "Cash / card for the offie", "Bag to carry it all",
];

const STORE_KEY = "thirstyboys.brum26.v1";

/* ---------- STATE ---------- */
let state = load();

/* ---------- PER-DEVICE IDENTITY (who is holding THIS phone) ----------
   Stored locally only — never synced, so each phone keeps its own "me". */
const ME_KEY = "thirstyboys.me";
let me = loadMe();
function loadMe() {
  try {
    const v = localStorage.getItem(ME_KEY);
    return v === null ? null : Number(v);
  } catch (e) { return null; }
}

/* Which drink THIS phone has selected — per-device, never synced. */
const DRINK_KEY = "thirstyboys.drink";
let selectedDrink = (function () {
  try { return localStorage.getItem(DRINK_KEY) || "pint"; } catch (e) { return "pint"; }
})();
function setSelectedDrink(id) {
  selectedDrink = id;
  try { localStorage.setItem(DRINK_KEY, id); } catch (e) { /* ignore */ }
  renderDrinkBar();
  renderTracker();
  renderWhoami();
}
function setMe(i) {
  me = i;
  try { localStorage.setItem(ME_KEY, String(i)); } catch (e) { /* ignore */ }
  state.present = state.present || {};
  state.present[i] = Date.now();   // mark "in" for everyone (synced)
  save();
  closeWhoamiModal();
  render();
}
function clearMe() {
  if (me != null && state.present) delete state.present[me];  // mark "out"
  me = null;
  try { localStorage.removeItem(ME_KEY); } catch (e) { /* ignore */ }
  save();
  render();
  openWhoamiModal();               // re-prompt for who you are
}
/* Ensure the claimed identity is flagged present; returns true if it changed. */
function markMePresent() {
  if (me == null || Number.isNaN(me) || !state.names[me]) return false;
  state.present = state.present || {};
  if (state.present[me]) return false;
  state.present[me] = Date.now();
  return true;
}

function defaults() {
  return {
    names: [...DEFAULT_NAMES],
    // per person: { pint: n, half: n, ... }
    tallies: DEFAULT_NAMES.map(() => ({})),
    log: [], // {who, drink, ts}
    selectedDrink: "pint",
    bets: {},    // betId -> { picks: {0..3: str}, result: str }
    awards: {},  // awardId -> winner index
    shop: SHOP_DEFAULTS.map((label, i) => ({ id: "d" + i, label, checked: false })),
    quotes: [], // { text, who, ts }
    present: {}, // personIndex -> lastSeen ms (synced: who has joined)
  };
}
function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(base, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return base;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  pushRemote();
}

/* ==========================================================================
   FIREBASE SYNC (optional — shared live state across all phones)
   Enabled only when assets/config.js has a Firebase config with a databaseURL.
   Falls back silently to per-device localStorage otherwise.
   ========================================================================== */
let syncRef = null;
let applyingRemote = false;   // guards against echoing remote updates back
let pushTimer = null;

function setSyncStatus(text, cls) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  el.textContent = text;
  el.className = "sync-status " + (cls || "");
}

function syncEnabled() {
  const cfg = window.THIRSTY_CONFIG;
  // Realtime Database only needs databaseURL; apiKey is only for Auth/Firestore.
  return !!(cfg && cfg.firebase && cfg.firebase.databaseURL
            && typeof firebase !== "undefined" && firebase.initializeApp);
}

function pushRemote() {
  if (!syncRef || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    try { syncRef.set(JSON.parse(JSON.stringify(state))); }
    catch (e) { /* offline; localStorage still holds it */ }
  }, 250);
}

function initSync() {
  if (!syncEnabled()) {
    setSyncStatus("📴 Saved on this device only", "off");
    return;
  }
  const cfg = window.THIRSTY_CONFIG;
  const code = (cfg.houseCode || "default").replace(/[.#$/\[\]]/g, "_");
  try {
    firebase.initializeApp(cfg.firebase);
    syncRef = firebase.database().ref("houses/" + code);
    setSyncStatus("🔄 Connecting…", "off");

    syncRef.on("value", (snap) => {
      const remote = snap.val();
      if (!remote) {
        // Nothing shared yet — seed the room with our current state.
        markMePresent();
        setSyncStatus("🟢 Live · house “" + code + "”", "on");
        pushRemote();
        return;
      }
      applyingRemote = true;
      state = Object.assign(defaults(), remote);
      applyingRemote = false;
      // If this phone has claimed an identity, make sure it shows as "in".
      if (markMePresent()) pushRemote();
      setSyncStatus("🟢 Live · house “" + code + "”", "on");
      renderDrinkBar();
      render();
    }, (err) => {
      setSyncStatus("⚠️ Sync error — check config/rules. Using this device.", "err");
    });
  } catch (e) {
    setSyncStatus("⚠️ Sync failed to start. Using this device.", "err");
  }
}

/* ---------- HELPERS ---------- */
function unitsFor(i) {
  const tally = state.tallies[i] || {};
  return DRINKS.reduce((sum, d) => sum + (tally[d.id] || 0) * d.units, 0);
}
function countFor(i) {
  const tally = state.tallies[i] || {};
  return DRINKS.reduce((sum, d) => sum + (tally[d.id] || 0), 0);
}
function drinkById(id) { return DRINKS.find((d) => d.id === id); }

/* ==========================================================================
   RENDER: ITINERARY
   ========================================================================== */
function renderItinerary() {
  const now = new Date();
  const wrap = document.getElementById("days");

  // Flatten to find the current stop (last stop whose time <= now, within trip)
  const flat = [];
  ITINERARY.forEach((day) => day.stops.forEach((s) => flat.push(s)));
  let nowIdx = -1;
  if (now >= TRIP_START && now <= TRIP_END) {
    for (let i = 0; i < flat.length; i++) {
      if (new Date(flat[i].iso) <= now) nowIdx = i;
    }
  }
  const nowIso = nowIdx >= 0 ? flat[nowIdx].iso : null;

  wrap.innerHTML = ITINERARY.map((day) => {
    const stops = day.stops.map((s) => {
      const when = new Date(s.iso);
      let cls = "stop";
      if (s.iso === nowIso) cls += " now";
      else if (now > when && now <= TRIP_END) cls += " past";

      const tag =
        s.iso === nowIso ? `<span class="tag-pill tag-now">Happening now</span>`
        : s.tag === "booked" ? `<span class="tag-pill tag-booked">Booked</span>`
        : s.tag === "walkin" ? `<span class="tag-pill tag-walkin">Walk-in</span>`
        : "";
      const map = s.map
        ? `<a href="https://www.google.com/maps/search/${encodeURIComponent(s.map)}" target="_blank" rel="noopener">📍 Map</a>`
        : "";
      const tags = (tag || map) ? `<div class="stop-tags">${tag}${map}</div>` : "";

      return `
        <div class="${cls}">
          <div class="stop-time">${s.t}</div>
          <div class="stop-body">
            <h4><span class="emoji">${s.emoji}</span> ${s.title}</h4>
            <p>${s.desc}</p>
            ${tags}
          </div>
        </div>`;
    }).join("");

    // Build a reliable Google Maps route through this day's mappable venues.
    const mapStops = day.stops.filter((s) => s.map).map((s) => s.map);
    let dayMap = "";
    if (mapStops.length === 1) {
      dayMap = `<a class="day-map" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapStops[0])}" target="_blank" rel="noopener">🗺️ Map</a>`;
    } else if (mapStops.length > 1) {
      const origin = encodeURIComponent(mapStops[0]);
      const destination = encodeURIComponent(mapStops[mapStops.length - 1]);
      const waypoints = mapStops.slice(1, -1).map(encodeURIComponent).join("%7C"); // %7C = |
      const wp = waypoints ? `&waypoints=${waypoints}` : "";
      dayMap = `<a class="day-map" href="https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp}&travelmode=walking" target="_blank" rel="noopener">🗺️ Route</a>`;
    }

    return `
      <div class="day">
        <div class="day-head">
          <span class="day-name">${day.name}</span>
          <span class="day-date">${day.date}</span>
          ${dayMap}
        </div>
        <div class="stops">${stops}</div>
      </div>`;
  }).join("");
}

/* ==========================================================================
   RENDER: COUNTDOWN
   ========================================================================== */
function renderCountdown() {
  const now = new Date();
  const cap = document.getElementById("cd-caption");
  const set = (id, v) => { document.getElementById(id).textContent = String(v).padStart(2, "0"); };

  if (now < TRIP_START) {
    const diff = TRIP_START - now;
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    set("cd-days", days); set("cd-hours", hrs); set("cd-mins", mins); set("cd-secs", secs);
    cap.textContent = "It's going to be a big gay";
    cap.classList.remove("live");
  } else if (now <= TRIP_END) {
    ["cd-days", "cd-hours", "cd-mins", "cd-secs"].forEach((id) => (document.getElementById(id).textContent = "🍺"));
    cap.textContent = "The weekend is ON. Pace yourselves.";
    cap.classList.add("live");
  } else {
    ["cd-days", "cd-hours", "cd-mins", "cd-secs"].forEach((id) => (document.getElementById(id).textContent = "—"));
    cap.textContent = "That's a wrap. Legends, all of you.";
    cap.classList.remove("live");
  }
}

/* ==========================================================================
   RENDER: DRINK BAR (picker)
   ========================================================================== */
function renderDrinkBar() {
  const bar = document.getElementById("drink-bar");
  bar.innerHTML = DRINKS.map((d) => `
    <button class="drink-pick ${d.id === selectedDrink ? "active" : ""}" data-drink="${d.id}">
      ${d.emoji} ${d.label} <small>${d.units}u</small>
    </button>`).join("");
  bar.querySelectorAll(".drink-pick").forEach((btn) =>
    btn.addEventListener("click", () => setSelectedDrink(btn.dataset.drink))
  );
}

/* ==========================================================================
   RENDER: WHO ARE YOU? (per-device identity claim)
   ========================================================================== */
function hasClaimed() {
  return !(me == null || Number.isNaN(me) || !state.names[me]);
}

/* Roster of who has joined (synced) vs who hasn't. */
function rosterHtml() {
  const present = state.present || {};
  const ins = [], outs = [];
  state.names.forEach((n, i) => (present[i] ? ins : outs).push({ n, i }));
  const fmt = (x) => `${CREW[x.i] ? CREW[x.i].emoji : ""} ${escapeHtml(x.n)}${x.i === me ? " (you)" : ""}`;
  return `
    <div class="roster">
      <div class="roster-row">
        <span class="roster-lab in">In</span>
        <span>${ins.length ? ins.map(fmt).join(" · ") : `<span class="roster-none">nobody yet</span>`}</span>
      </div>
      <div class="roster-row">
        <span class="roster-lab out">Waiting</span>
        <span>${outs.length ? outs.map((x) => escapeHtml(x.n)).join(" · ") : `<span class="roster-none">everyone's in! 🎉</span>`}</span>
      </div>
    </div>`;
}

function pickButtonsHtml() {
  return `<div class="whoami-pick">` +
    state.names.map((n, i) => {
      const inHere = state.present && state.present[i];
      return `<button class="whoami-btn ${inHere ? "in" : ""}" data-me="${i}">${CREW[i] ? CREW[i].emoji : ""} ${escapeHtml(n)}${inHere ? " ✅" : ""}</button>`;
    }).join("") +
    `</div>`;
}

function renderWhoami() {
  const el = document.getElementById("whoami");
  if (el) {
    if (!hasClaimed()) {
      el.innerHTML = `<p class="whoami-q">👋 Which one are you?</p>${pickButtonsHtml()}${rosterHtml()}`;
      el.querySelectorAll(".whoami-btn").forEach((b) =>
        b.addEventListener("click", () => setMe(Number(b.dataset.me)))
      );
    } else {
      const sel = drinkById(selectedDrink);
      const emoji = CREW[me] ? CREW[me].emoji : "";
      el.innerHTML =
        `<div class="whoami-claimed">
           <span class="me-name">You're ${emoji} <b>${escapeHtml(state.names[me])}</b></span>
           <button class="whoami-change" id="whoami-change">not you? change</button>
           <button class="me-quickadd" id="me-quickadd">＋ ${sel.emoji} ${sel.label} for me</button>
         </div>
         ${rosterHtml()}`;
      el.querySelector("#whoami-change").addEventListener("click", clearMe);
      el.querySelector("#me-quickadd").addEventListener("click", () => addDrink(me));
    }
  }
  renderWhoamiModal();
}

/* ---------- First-load "Who are you?" modal ---------- */
function renderWhoamiModal() {
  const pick = document.getElementById("modal-pick");
  const roster = document.getElementById("modal-roster");
  if (!pick || !roster) return;
  pick.innerHTML = pickButtonsHtml();
  pick.querySelectorAll(".whoami-btn").forEach((b) =>
    b.addEventListener("click", () => setMe(Number(b.dataset.me)))
  );
  roster.innerHTML = rosterHtml();
}
function openWhoamiModal() {
  const m = document.getElementById("whoami-modal");
  if (m) { renderWhoamiModal(); m.classList.remove("hidden"); }
}
function closeWhoamiModal() {
  const m = document.getElementById("whoami-modal");
  if (m) m.classList.add("hidden");
}

/* ==========================================================================
   RENDER: LEADERBOARD
   ========================================================================== */
function renderLeaderboard() {
  const lb = document.getElementById("leaderboard");
  const rows = state.names.map((n, i) => ({ i, name: n, units: unitsFor(i), count: countFor(i) }));
  const maxCount = Math.max(0, ...rows.map((r) => r.count));
  const anyDrinks = maxCount > 0;

  // Rank by number of drinks (units as tie-breaker).
  const ordered = [...rows].sort((a, b) => b.count - a.count || b.units - a.units);
  lb.innerHTML = ordered.map((r) => {
    const isLeader = anyDrinks && r.count === maxCount;
    let title = "";
    if (isLeader) title = TITLES.top;
    else if (anyDrinks && r.count === 0) title = TITLES.zero;
    const isYou = r.i === me;
    return `
      <div class="lb-card ${isLeader ? "leader" : ""} ${isYou ? "you" : ""}">
        ${isLeader ? `<div class="lb-crown">👑</div>` : ""}
        <div class="lb-name">${escapeHtml(r.name)}${isYou ? `<span class="you-tag">You</span>` : ""}</div>
        <div class="lb-units">${r.count}</div>
        <div class="lb-units-lab">${r.count === 1 ? "drink" : "drinks"} · ${r.units} units</div>
        <div class="lb-title">${title}</div>
      </div>`;
  }).join("");
}

/* ==========================================================================
   RENDER: TRACKER GRID
   ========================================================================== */
function renderTracker() {
  const grid = document.getElementById("tracker-grid");
  const sel = drinkById(selectedDrink);
  grid.innerHTML = state.names.map((n, i) => {
    const tally = state.tallies[i] || {};
    const breakdown = DRINKS.filter((d) => tally[d.id])
      .map((d) => `${d.emoji}${tally[d.id]}`).join("  ") || "—";
    const isYou = i === me;
    return `
      <div class="person ${isYou ? "you" : ""}">
        <div class="person-name-static">${escapeHtml(n)}${isYou ? `<span class="you-tag">You</span>` : ""}</div>
        <div class="person-count">${countFor(i)}</div>
        <div class="person-count-lab">${unitsFor(i)} units</div>
        <button class="person-add" data-i="${i}">+ ${sel.emoji} ${sel.label}</button>
        <div class="person-mini">${breakdown}</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".person-add").forEach((btn) =>
    btn.addEventListener("click", () => addDrink(Number(btn.dataset.i)))
  );
}

/* ==========================================================================
   RENDER: LOG
   ========================================================================== */
function renderLog() {
  const ul = document.getElementById("log");
  if (!state.log.length) {
    ul.innerHTML = `<li class="log-empty">No rounds yet. Get thirsty.</li>`;
    return;
  }
  ul.innerHTML = state.log.slice(-8).reverse().map((e) => {
    const d = drinkById(e.drink);
    const time = new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `<li><span>${d ? d.emoji : "🍺"} ${escapeHtml(state.names[e.who] || "?")} — ${d ? d.label : e.drink}</span><span>${time}</span></li>`;
  }).join("");
}

/* ==========================================================================
   RENDER: CREW
   ========================================================================== */
function renderCrew() {
  const wrap = document.getElementById("crew");
  wrap.innerHTML = CREW.map((c, i) => `
    <div class="crew-card">
      <div class="crew-emoji">${c.emoji}</div>
      <input class="crew-name-input" data-i="${i}" value="${escapeAttr(state.names[i] || DEFAULT_NAMES[i])}" aria-label="Rename ${escapeAttr(c.role)}" maxlength="20" />
      <div class="crew-role">${c.role}</div>
    </div>`).join("");

  wrap.querySelectorAll(".crew-name-input").forEach((inp) => {
    inp.addEventListener("change", () => {
      const i = Number(inp.dataset.i);
      state.names[i] = inp.value.trim() || DEFAULT_NAMES[i];
      save();
      render();
    });
  });
}

/* ==========================================================================
   ACTIONS
   ========================================================================== */
function addDrink(i) {
  const id = selectedDrink;
  state.tallies[i] = state.tallies[i] || {};
  state.tallies[i][id] = (state.tallies[i][id] || 0) + 1;
  state.log.push({ who: i, drink: id, ts: Date.now() });
  save();
  render();
}
function undoLast() {
  // Undo YOUR own last drink if you've claimed a name; otherwise the last overall.
  let idx = -1;
  if (me != null && !Number.isNaN(me)) {
    for (let k = state.log.length - 1; k >= 0; k--) {
      if (state.log[k].who === me) { idx = k; break; }
    }
    if (idx === -1) { alert("You haven't logged a drink to undo."); return; }
  } else {
    idx = state.log.length - 1;
  }
  if (idx < 0) return;
  const entry = state.log.splice(idx, 1)[0];
  const t = state.tallies[entry.who];
  if (t && t[entry.drink]) t[entry.drink] -= 1;
  save();
  render();
}

const RESET_PASSWORD = "brum26";
function resetAll() {
  const pw = prompt("This wipes ALL drinks & names for EVERYONE.\nEnter the reset password to confirm:");
  if (pw == null) return;                 // cancelled
  if (pw.trim().toLowerCase() !== RESET_PASSWORD) { alert("Wrong password — nothing was reset."); return; }
  state.names = [...DEFAULT_NAMES];
  state.tallies = DEFAULT_NAMES.map(() => ({}));
  state.log = [];
  save();
  renderDrinkBar();
  render();
}

/* ==========================================================================
   RENDER: BETS
   ========================================================================== */
/* Normalise a bet to { calls: {voterIdx: value}, result, revealed }.
   For "person" bets values are crew indexes; for "text" bets, strings. */
function getBet(id) {
  let b = state.bets[id];
  if (b == null || typeof b !== "object" || !b.calls) b = { calls: {}, result: "", revealed: false };
  b.calls = b.calls || {};
  return b;
}

/* Correct calls per person across all revealed, settled bets. */
function betScores() {
  const scores = state.names.map(() => 0);
  BETS.forEach((bet) => {
    const b = getBet(bet.id);
    if (!b.revealed || b.result === "" || b.result == null) return;
    Object.keys(b.calls).forEach((voter) => {
      const call = b.calls[voter];
      const hit = bet.type === "person"
        ? Number(call) === Number(b.result)
        : String(call).trim().toLowerCase() === String(b.result).trim().toLowerCase();
      if (hit && scores[voter] != null) scores[Number(voter)]++;
    });
  });
  return scores;
}

function renderBets() {
  const wrap = document.getElementById("bets-list");
  const claimed = hasClaimed();
  const total = state.names.length;

  // Bragging-rights scoreboard (only once something's been settled)
  const scores = betScores();
  const anySettled = scores.some((s) => s > 0);
  const scoreboard = anySettled
    ? `<div class="bet-scoreboard">🏅 Correct calls: ` +
      state.names.map((n, i) => `<span class="bet-score">${escapeHtml(n)} <b>${scores[i]}</b></span>`).join(" ") +
      `</div>`
    : "";

  wrap.innerHTML = scoreboard + BETS.map((bet) => {
    const b = getBet(bet.id);
    const callCount = Object.keys(b.calls).length;
    let body;

    if (b.revealed) {
      // Everyone's calls on the table + settle the result
      const rows = state.names.map((n, i) => {
        const call = b.calls[i];
        const callTxt = call == null || call === ""
          ? `<span class="bet-nocall">no call</span>`
          : bet.type === "person" ? escapeHtml(state.names[call] || "?") : escapeHtml(String(call));
        const hit = b.result !== "" && b.result != null && (
          bet.type === "person" ? Number(call) === Number(b.result)
          : String(call || "").trim().toLowerCase() === String(b.result).trim().toLowerCase());
        return `<div class="bet-call-row ${hit ? "hit" : ""}">
          <span class="bet-caller">${escapeHtml(n)}</span>
          <span class="bet-callval">${callTxt}${hit ? " ✅" : ""}</span>
        </div>`;
      }).join("");
      const resultCtl = bet.type === "person"
        ? `<select class="award-select" data-bet-result="${bet.id}">
             <option value="">— what actually happened —</option>` +
           state.names.map((n, i) => `<option value="${i}" ${String(b.result) === String(i) ? "selected" : ""}>${escapeHtml(n)}</option>`).join("") +
           `</select>`
        : `<input type="text" class="bet-result-input" data-bet-result="${bet.id}" value="${escapeAttr(b.result || "")}" placeholder="actual result…" maxlength="40" />`;
      body = `${rows}
        <div class="bet-result"><label>✅ Actual result</label>${resultCtl}</div>
        <button class="btn-ghost bet-reopen" data-bet="${bet.id}">↩ Re-open calls</button>`;
    } else if (!claimed) {
      body = `<p class="award-hint">👆 Claim who you are (top of the Drinks tab) to make your call.</p>
        <p class="award-status">🤙 ${callCount}/${total} called</p>`;
    } else {
      const mine = b.calls[me];
      const ctl = bet.type === "person"
        ? `<select class="award-select" data-bet-call="${bet.id}">
             <option value="">— call it —</option>` +
           state.names.map((n, i) => `<option value="${i}" ${String(mine) === String(i) ? "selected" : ""}>${escapeHtml(n)}</option>`).join("") +
           `</select>`
        : `<input type="text" class="bet-result-input" data-bet-call="${bet.id}" value="${escapeAttr(mine == null ? "" : String(mine))}" placeholder="call it… (e.g. 2-1)" maxlength="30" />`;
      body = `${ctl}
        <p class="award-status">🤙 ${callCount}/${total} called${mine != null && mine !== "" ? " · your call is in 🔒" : ""}</p>
        <button class="btn-ghost bet-reveal" data-bet="${bet.id}">👁 Reveal calls</button>`;
    }

    return `<div class="bet-card"><p class="bet-q"><span class="emoji">${bet.emoji}</span> ${bet.q}</p>${body}</div>`;
  }).join("");

  wrap.querySelectorAll("[data-bet-call]").forEach((el) =>
    el.addEventListener("change", () => {
      const id = el.dataset.betCall, b = getBet(id);
      const v = el.value;
      if (v === "") delete b.calls[me];
      else b.calls[me] = BETS.find((x) => x.id === id).type === "person" ? Number(v) : v;
      state.bets[id] = b;
      save();
      renderBets();
    })
  );
  wrap.querySelectorAll("[data-bet-result]").forEach((el) =>
    el.addEventListener("change", () => {
      const id = el.dataset.betResult, b = getBet(id);
      b.result = el.value === "" ? "" : (BETS.find((x) => x.id === id).type === "person" ? Number(el.value) : el.value);
      state.bets[id] = b;
      save();
      renderBets();
    })
  );
  wrap.querySelectorAll(".bet-reveal").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.bet, b = getBet(id);
      b.revealed = true; state.bets[id] = b; save(); renderBets();
    })
  );
  wrap.querySelectorAll(".bet-reopen").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.bet, b = getBet(id);
      b.revealed = false; state.bets[id] = b; save(); renderBets();
    })
  );
}

/* ==========================================================================
   RENDER: AWARDS
   ========================================================================== */
/* Normalise an award to the blind-vote shape { votes: {voterIdx: nomineeIdx}, revealed } */
function getAward(id) {
  let a = state.awards[id];
  if (a == null || typeof a !== "object") a = { votes: {}, revealed: false };
  a.votes = a.votes || {};
  return a;
}

function renderAwards() {
  const wrap = document.getElementById("awards-list");
  const claimed = hasClaimed();
  const total = state.names.length;

  wrap.innerHTML = AWARDS.map((a) => {
    const data = getAward(a.id);
    const voteCount = Object.keys(data.votes).length;
    const tally = {};
    Object.values(data.votes).forEach((n) => { tally[n] = (tally[n] || 0) + 1; });

    let body;
    if (data.revealed) {
      const max = Math.max(0, ...state.names.map((_, i) => tally[i] || 0));
      const winners = state.names.map((n, i) => ({ n, i })).filter((x) => max > 0 && (tally[x.i] || 0) === max);
      const winLine = max <= 0
        ? "No votes cast"
        : winners.length > 1
          ? `🤝 Tie: ${winners.map((w) => escapeHtml(w.n)).join(" & ")}`
          : `🏆 ${escapeHtml(winners[0].n)}`;
      const rows = state.names.map((n, i) => {
        const c = tally[i] || 0;
        return `
          <div class="award-result-row">
            <span class="award-res-name">${escapeHtml(n)}</span>
            <span class="award-bar-wrap"><span class="award-bar" style="width:${max > 0 ? (c / max) * 100 : 0}%"></span></span>
            <span class="award-count">${c}</span>
          </div>`;
      }).join("");
      body = `<p class="award-winner">${winLine}</p>${rows}
        <button class="btn-ghost award-reopen" data-award="${a.id}">↩ Re-open voting</button>`;
    } else if (!claimed) {
      body = `<p class="award-hint">👆 Claim who you are (top of the Drinks tab) to cast your vote.</p>
        <p class="award-status">🗳️ ${voteCount}/${total} voted</p>`;
    } else {
      const mine = data.votes[me];
      const options = `<option value="">— cast your vote —</option>` +
        state.names.map((n, i) => `<option value="${i}" ${String(mine) === String(i) ? "selected" : ""}>${escapeHtml(n)}</option>`).join("");
      body = `<select class="award-select" data-award="${a.id}">${options}</select>
        <p class="award-status">🗳️ ${voteCount}/${total} voted${mine != null ? ` · your pick is in 🔒` : ""}</p>
        <button class="btn-ghost award-reveal" data-award="${a.id}">👁 Reveal results</button>`;
    }
    return `<div class="award-card"><p class="award-title">${a.title}</p>${body}</div>`;
  }).join("");

  wrap.querySelectorAll(".award-select").forEach((sel) =>
    sel.addEventListener("change", () => {
      const id = sel.dataset.award, a = getAward(id);
      if (sel.value === "") delete a.votes[me]; else a.votes[me] = Number(sel.value);
      state.awards[id] = a;
      save();
      renderAwards();
    })
  );
  wrap.querySelectorAll(".award-reveal").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.award, a = getAward(id);
      a.revealed = true; state.awards[id] = a; save(); renderAwards();
    })
  );
  wrap.querySelectorAll(".award-reopen").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.award, a = getAward(id);
      a.revealed = false; state.awards[id] = a; save(); renderAwards();
    })
  );
}

/* ==========================================================================
   RENDER: OFF-LICENCE CHECKLIST
   ========================================================================== */
function renderShop() {
  const ul = document.getElementById("shop-list");
  const done = state.shop.filter((s) => s.checked).length;
  document.getElementById("shop-progress").textContent =
    state.shop.length ? `(${done}/${state.shop.length} sorted)` : "";
  ul.innerHTML = state.shop.map((item) => `
    <li class="${item.checked ? "done" : ""}" data-id="${item.id}">
      <span class="chk-box">✓</span>
      <span class="chk-label">${escapeHtml(item.label)}</span>
      <button class="chk-del" data-del="${item.id}" aria-label="Remove">✕</button>
    </li>`).join("");

  ul.querySelectorAll("li").forEach((li) =>
    li.addEventListener("click", (e) => {
      if (e.target.closest(".chk-del")) return;
      const item = state.shop.find((s) => s.id === li.dataset.id);
      if (item) { item.checked = !item.checked; save(); renderShop(); }
    })
  );
  ul.querySelectorAll(".chk-del").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.shop = state.shop.filter((s) => s.id !== btn.dataset.del);
      save();
      renderShop();
    })
  );
}

/* ==========================================================================
   RENDER: QUOTE WALL
   ========================================================================== */
function renderQuoteWho() {
  const sel = document.getElementById("quote-who");
  const cur = sel.value;
  sel.innerHTML = `<option value="">— who said it —</option>` +
    state.names.map((n, i) => `<option value="${i}">${escapeHtml(n)}</option>`).join("");
  // Keep the current pick if any, otherwise default to "you".
  if (cur) sel.value = cur;
  else if (me != null && !Number.isNaN(me) && state.names[me]) sel.value = String(me);
}
function renderQuotes() {
  const wrap = document.getElementById("quotes-list");
  if (!state.quotes.length) {
    wrap.innerHTML = `<p class="quotes-empty">Nothing yet. The weekend is young.</p>`;
    return;
  }
  wrap.innerHTML = state.quotes.slice().reverse().map((q) => {
    const who = q.who !== "" && state.names[q.who] ? escapeHtml(state.names[q.who]) : "The Thirsty Boys";
    const when = q.ts
      ? " · " + new Date(q.ts).toLocaleDateString([], { weekday: "short" }) + " " +
        new Date(q.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    return `
      <div class="quote-card">
        <button class="quote-del" data-ts="${q.ts}" aria-label="Delete">🗑</button>
        <div class="quote-text">${escapeHtml(q.text)}</div>
        <div class="quote-meta">— ${who}${when}</div>
      </div>`;
  }).join("");

  wrap.querySelectorAll(".quote-del").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.quotes = state.quotes.filter((q) => String(q.ts) !== btn.dataset.ts);
      save();
      renderQuotes();
    })
  );
}

/* ---------- UTIL ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

/* ==========================================================================
   MAIN RENDER + LOOPS
   ========================================================================== */
function render() {
  renderWhoami();
  renderLeaderboard();
  renderTracker();
  renderLog();
  renderBets();
  renderAwards();
  renderShop();
  renderQuoteWho();
  renderQuotes();
  renderCrew();
}

function tick() {
  renderCountdown();
  renderItinerary();
}

document.getElementById("undo-btn").addEventListener("click", undoLast);
document.getElementById("reset-btn").addEventListener("click", resetAll);
document.getElementById("modal-skip").addEventListener("click", closeWhoamiModal);

/* HQ: copy address (for pasting into Uber etc.) */
const HQ_ADDRESS = "9 Sloane Street, Birmingham, B1 3DZ";
document.getElementById("hq-copy").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(HQ_ADDRESS);
    btn.textContent = "✅ Copied";
  } catch (err) {
    prompt("Copy the address:", HQ_ADDRESS); // clipboard blocked — show it instead
    return;
  }
  setTimeout(() => { btn.textContent = "📋 Copy address"; }, 1500);
});

/* Off-licence: add item */
document.getElementById("shop-add").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("shop-input");
  const label = input.value.trim();
  if (!label) return;
  state.shop.push({ id: "u" + Date.now(), label, checked: false });
  input.value = "";
  save();
  renderShop();
});

/* Quote wall: add quote */
document.getElementById("quote-add").addEventListener("submit", (e) => {
  e.preventDefault();
  const textEl = document.getElementById("quote-text");
  const whoEl = document.getElementById("quote-who");
  const text = textEl.value.trim();
  if (!text) return;
  state.quotes.push({ text, who: whoEl.value === "" ? "" : Number(whoEl.value), ts: Date.now() });
  textEl.value = "";
  whoEl.value = "";
  save();
  renderQuotes();
});

renderDrinkBar();
render();
tick();
setInterval(tick, 1000);
initSync();

// First thing on first load: ask who you are.
if (me == null || Number.isNaN(me) || !state.names[me]) openWhoamiModal();
