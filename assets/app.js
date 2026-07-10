/* ==========================================================================
   Thirsty Boys — Birmingham '25
   Itinerary, live-now, countdown & drink tracker (localStorage-backed)
   ========================================================================== */

/* ---------- ITINERARY DATA ----------
   Times are 2025 local (BST). `iso` drives the countdown + live-now logic. */
const ITINERARY = [
  {
    name: "Friday", date: "17 July",
    stops: [
      { t: "12:00", iso: "2025-07-17T12:00", emoji: "🚆", title: "Arrive Birmingham", desc: "Mitul + the Sausage Twins hit town." },
      { t: "12:30", iso: "2025-07-17T12:30", emoji: "🍺", title: "The Indian Brewery", desc: "Snow Hill arches · Birmingham Lager & fat naans.", tag: "booked", map: "The Indian Brewery Snow Hill Birmingham" },
      { t: "15:00", iso: "2025-07-17T15:00", emoji: "🔑", title: "Check into Airbnb", desc: "Jewellery Quarter HQ. Mr Science arrives." },
      { t: "17:30", iso: "2025-07-17T17:30", emoji: "🎯", title: "TOCA Social", desc: "Bullring · football games & drinks.", tag: "booked", map: "TOCA Social Bullring Birmingham" },
      { t: "19:30", iso: "2025-07-17T19:30", emoji: "🚕", title: "Uber to Balti Triangle", desc: "Off-licence pit stop en route (BYOB!)." },
      { t: "19:45", iso: "2025-07-17T19:45", emoji: "🍛", title: "Royal Watan Kashmiri", desc: "BYOB balti feast.", tag: "booked", map: "Royal Watan Kashmiri Birmingham" },
      { t: "21:30", iso: "2025-07-17T21:30", emoji: "🍷", title: "Arch 13", desc: "Another wine bar. Naturally.", map: "Arch 13 Birmingham" },
    ],
  },
  {
    name: "Saturday", date: "18 July",
    stops: [
      { t: "10:00", iso: "2025-07-18T10:00", emoji: "🥏", title: "Disc Golf @ Ackers", desc: "Ackers Adventure · shake off the balti.", tag: "booked", map: "Ackers Adventure Birmingham" },
      { t: "12:30", iso: "2025-07-18T12:30", emoji: "🌮", title: "El Azteca @ The Loft", desc: "1000 Trades · tacos.", tag: "walkin", map: "1000 Trades Birmingham" },
      { t: "14:00", iso: "2025-07-18T14:00", emoji: "🏎️", title: "F1 Arcade", desc: "Chamberlain Sq · race sims & rounds.", tag: "booked", map: "F1 Arcade Birmingham" },
      { t: "16:00", iso: "2025-07-18T16:00", emoji: "🔄", title: "F1 done — regroup", desc: "Breather. Rehydrate. Reassess." },
      { t: "18:30", iso: "2025-07-18T18:30", emoji: "🍔", title: "Alfred Works Food Hall", desc: "Big feed, many options.", tag: "walkin", map: "Alfred Works food hall Birmingham" },
      { t: "20:00", iso: "2025-07-18T20:00", emoji: "🤠", title: "Low Places", desc: "Honky-tonk. Yeehaw.", map: "Low Places Birmingham" },
      { t: "22:00", iso: "2025-07-18T22:00", emoji: "⚽", title: "World Cup 3rd Place Playoff", desc: "Luna Springs, Digbeth · big screen.", map: "Luna Springs Digbeth Birmingham" },
    ],
  },
  {
    name: "Sunday", date: "19 July",
    stops: [
      { t: "10:30", iso: "2025-07-19T10:30", emoji: "🥐", title: "Medicine Bakery", desc: "Pastries & coffee. Gentle recovery.", map: "Medicine Bakery Birmingham" },
      { t: "12:00", iso: "2025-07-19T12:00", emoji: "👋", title: "Exeunt", desc: "Home time. Until next year, boys." },
    ],
  },
];

const TRIP_START = new Date("2025-07-17T12:00:00");
/* End of the last stop window, for live-now bounds */
const TRIP_END = new Date("2025-07-19T13:00:00");

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
  { emoji: "🌭", role: "Sausage Twin I" },
  { emoji: "🌭", role: "Sausage Twin II" },
  { emoji: "🔬", role: "Mr Science" },
];
const DEFAULT_NAMES = ["Mitul", "Twin One", "Twin Two", "Mr Science"];

const TITLES = { top: "👑 Thirstiest Boy", zero: "😇 Designated" };

const STORE_KEY = "thirstyboys.brum25.v1";

/* ---------- STATE ---------- */
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {
    names: [...DEFAULT_NAMES],
    // per person: { pint: n, half: n, ... }
    tallies: DEFAULT_NAMES.map(() => ({})),
    log: [], // {who, drink, ts}
    selectedDrink: "pint",
  };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
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

    return `
      <div class="day">
        <div class="day-head">
          <span class="day-name">${day.name}</span>
          <span class="day-date">${day.date}</span>
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
    cap.textContent = "until the Sausage Twins hit Snow Hill";
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
  if (!confirm("Reset all drinks and names for the weekend?")) return;
  state = {
    names: [...DEFAULT_NAMES],
    tallies: DEFAULT_NAMES.map(() => ({})),
    log: [],
    selectedDrink: "pint",
  };
  save();
  renderDrinkBar();
  render();
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
  renderCrew();
}

function tick() {
  renderCountdown();
  renderItinerary();
}

document.getElementById("undo-btn").addEventListener("click", undoLast);
document.getElementById("reset-btn").addEventListener("click", resetAll);

renderDrinkBar();
render();
tick();
setInterval(tick, 1000);
