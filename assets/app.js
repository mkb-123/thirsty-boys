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
      { t: "15:00", iso: "2026-07-17T15:00", emoji: "🔑", title: "Check into Airbnb", desc: "Jewellery Quarter HQ. Mr Science arrives." },
      { t: "17:30", iso: "2026-07-17T17:30", emoji: "🎯", title: "TOCA Social", desc: "Bullring · football games & drinks.", tag: "booked", map: "TOCA Social Bullring Birmingham" },
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

/* ---------- BETS ---------- */
const BETS = [
  { id: "tapout",  emoji: "😴", q: "First man to tap out" },
  { id: "disc",    emoji: "🥏", q: "Disc golf champion @ Ackers" },
  { id: "f1",      emoji: "🏎️", q: "F1 Arcade fastest lap" },
  { id: "wcscore", emoji: "⚽", q: "World Cup 3rd-place score" },
  { id: "units",   emoji: "🍺", q: "Most units by Sunday" },
  { id: "balti",   emoji: "🌶️", q: "Orders the hottest balti" },
  { id: "lost",    emoji: "🧭", q: "First to get lost" },
];

/* ---------- AWARDS ---------- */
const AWARDS = [
  { id: "mvp",    title: "🏆 MVP of the Weekend" },
  { id: "balti",  title: "🌶️ Best Balti Order" },
  { id: "lost",   title: "🧭 Most Lost" },
  { id: "bed",    title: "😴 First to Bed" },
  { id: "honky",  title: "🎤 Best Honky-Tonk Moment" },
  { id: "rounds", title: "💸 Biggest Round Buyer" },
  { id: "sunday", title: "🤢 Worst State Sunday AM" },
];

/* ---------- OFF-LICENCE DEFAULTS ---------- */
const SHOP_DEFAULTS = [
  "Red wine (for the balti)", "White wine", "Beers / lager", "Cans / mixers",
  "Soft drinks", "Bottle of water", "Cash / card for the offie", "Bag to carry it all",
];

const STORE_KEY = "thirstyboys.brum26.v1";

/* ---------- STATE ---------- */
let state = load();

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
    quotes: [],  // { text, who, ts }
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
        setSyncStatus("🟢 Live · house “" + code + "”", "on");
        pushRemote();
        return;
      }
      applyingRemote = true;
      state = Object.assign(defaults(), remote);
      applyingRemote = false;
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

    const mapStops = day.stops.filter((s) => s.map).map((s) => encodeURIComponent(s.map));
    const dayMap = mapStops.length
      ? `<a class="day-map" href="https://www.google.com/maps/dir/${mapStops.join("/")}" target="_blank" rel="noopener">🗺️ Route</a>`
      : "";

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
    cap.textContent = "until the boys hit Snow Hill";
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
    <button class="drink-pick ${d.id === state.selectedDrink ? "active" : ""}" data-drink="${d.id}">
      ${d.emoji} ${d.label} <small>${d.units}u</small>
    </button>`).join("");
  bar.querySelectorAll(".drink-pick").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.selectedDrink = btn.dataset.drink;
      save();
      renderDrinkBar();
      renderTracker();
    })
  );
}

/* ==========================================================================
   RENDER: LEADERBOARD
   ========================================================================== */
function renderLeaderboard() {
  const lb = document.getElementById("leaderboard");
  const rows = state.names.map((n, i) => ({ i, name: n, units: unitsFor(i), count: countFor(i) }));
  const maxUnits = Math.max(...rows.map((r) => r.units));
  const anyDrinks = maxUnits > 0;

  const ordered = [...rows].sort((a, b) => b.units - a.units);
  lb.innerHTML = ordered.map((r) => {
    const isLeader = anyDrinks && r.units === maxUnits;
    let title = "";
    if (isLeader) title = TITLES.top;
    else if (anyDrinks && r.count === 0) title = TITLES.zero;
    return `
      <div class="lb-card ${isLeader ? "leader" : ""}">
        ${isLeader ? `<div class="lb-crown">👑</div>` : ""}
        <div class="lb-name">${escapeHtml(r.name)}</div>
        <div class="lb-units">${r.units}</div>
        <div class="lb-units-lab">units · ${r.count} drinks</div>
        <div class="lb-title">${title}</div>
      </div>`;
  }).join("");
}

/* ==========================================================================
   RENDER: TRACKER GRID
   ========================================================================== */
function renderTracker() {
  const grid = document.getElementById("tracker-grid");
  const sel = drinkById(state.selectedDrink);
  grid.innerHTML = state.names.map((n, i) => {
    const tally = state.tallies[i] || {};
    const breakdown = DRINKS.filter((d) => tally[d.id])
      .map((d) => `${d.emoji}${tally[d.id]}`).join("  ") || "—";
    return `
      <div class="person">
        <input class="person-name" data-i="${i}" value="${escapeAttr(n)}" aria-label="Name" />
        <div class="person-count">${countFor(i)}</div>
        <div class="person-count-lab">${unitsFor(i)} units</div>
        <button class="person-add" data-i="${i}">+ ${sel.emoji} ${sel.label}</button>
        <div class="person-mini">${breakdown}</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".person-add").forEach((btn) =>
    btn.addEventListener("click", () => addDrink(Number(btn.dataset.i)))
  );
  grid.querySelectorAll(".person-name").forEach((inp) => {
    inp.addEventListener("change", () => {
      const i = Number(inp.dataset.i);
      state.names[i] = inp.value.trim() || DEFAULT_NAMES[i];
      save();
      render();
    });
  });
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
      <div class="crew-name">${escapeHtml(state.names[i] || DEFAULT_NAMES[i])}</div>
      <div class="crew-role">${c.role}</div>
    </div>`).join("");
}

/* ==========================================================================
   ACTIONS
   ========================================================================== */
function addDrink(i) {
  const id = state.selectedDrink;
  state.tallies[i] = state.tallies[i] || {};
  state.tallies[i][id] = (state.tallies[i][id] || 0) + 1;
  state.log.push({ who: i, drink: id, ts: Date.now() });
  save();
  render();
}
function undoLast() {
  const last = state.log.pop();
  if (!last) return;
  const t = state.tallies[last.who];
  if (t && t[last.drink]) t[last.drink] -= 1;
  save();
  render();
}
function resetAll() {
  if (!confirm("Reset all drinks and names for the weekend? (Bets, awards, list & quotes stay.)")) return;
  state.names = [...DEFAULT_NAMES];
  state.tallies = DEFAULT_NAMES.map(() => ({}));
  state.log = [];
  state.selectedDrink = "pint";
  save();
  renderDrinkBar();
  render();
}

/* ==========================================================================
   RENDER: BETS
   ========================================================================== */
function renderBets() {
  const wrap = document.getElementById("bets-list");
  wrap.innerHTML = BETS.map((bet) => {
    const data = state.bets[bet.id] || { picks: {}, result: "" };
    const picks = state.names.map((n, i) => `
      <div class="bet-pick">
        <label>${escapeHtml(n)}</label>
        <input type="text" data-bet="${bet.id}" data-who="${i}" value="${escapeAttr(data.picks[i] || "")}" placeholder="call it…" maxlength="30" />
      </div>`).join("");
    return `
      <div class="bet-card">
        <p class="bet-q"><span class="emoji">${bet.emoji}</span> ${bet.q}</p>
        <div class="bet-picks">${picks}</div>
        <div class="bet-result">
          <label>✅ Actual result</label>
          <input type="text" data-bet-result="${bet.id}" value="${escapeAttr(data.result || "")}" placeholder="who / what won…" maxlength="40" />
        </div>
      </div>`;
  }).join("");

  wrap.querySelectorAll("input[data-bet]").forEach((inp) =>
    inp.addEventListener("change", () => {
      const id = inp.dataset.bet, who = inp.dataset.who;
      state.bets[id] = state.bets[id] || { picks: {}, result: "" };
      state.bets[id].picks[who] = inp.value;
      save();
    })
  );
  wrap.querySelectorAll("input[data-bet-result]").forEach((inp) =>
    inp.addEventListener("change", () => {
      const id = inp.dataset.betResult;
      state.bets[id] = state.bets[id] || { picks: {}, result: "" };
      state.bets[id].result = inp.value;
      save();
    })
  );
}

/* ==========================================================================
   RENDER: AWARDS
   ========================================================================== */
function renderAwards() {
  const wrap = document.getElementById("awards-list");
  wrap.innerHTML = AWARDS.map((a) => {
    const winner = state.awards[a.id];
    const opts = state.names.map((n, i) =>
      `<button class="award-opt ${winner === i ? "won" : ""}" data-award="${a.id}" data-who="${i}">${escapeHtml(n)}</button>`
    ).join("");
    const line = (winner != null && state.names[winner])
      ? `🏅 Winner: <strong>${escapeHtml(state.names[winner])}</strong>` : "Not awarded yet";
    return `
      <div class="award-card">
        <p class="award-title">${a.title}</p>
        <p class="award-winner">${line}</p>
        <div class="award-opts">${opts}</div>
      </div>`;
  }).join("");

  wrap.querySelectorAll(".award-opt").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.award, who = Number(btn.dataset.who);
      state.awards[id] = state.awards[id] === who ? null : who; // tap again to un-award
      save();
      renderAwards();
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
  if (cur) sel.value = cur;
}
function renderQuotes() {
  const wrap = document.getElementById("quotes-list");
  if (!state.quotes.length) {
    wrap.innerHTML = `<p class="quotes-empty">Nothing yet. The weekend is young.</p>`;
    return;
  }
  wrap.innerHTML = state.quotes.slice().reverse().map((q) => {
    const who = q.who !== "" && state.names[q.who] ? escapeHtml(state.names[q.who]) : "Anon";
    const when = new Date(q.ts).toLocaleDateString([], { weekday: "short" }) + " " +
      new Date(q.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `
      <div class="quote-card">
        <button class="quote-del" data-ts="${q.ts}" aria-label="Delete">🗑</button>
        <div class="quote-text">${escapeHtml(q.text)}</div>
        <div class="quote-meta">— ${who} · ${when}</div>
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
