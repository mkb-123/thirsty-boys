/* ==========================================================================
   Thirsty Boys — Birmingham '26
   Itinerary, live-now, countdown & drink tracker (localStorage-backed)
   ========================================================================== */

/* ==========================================================================
   TRIP CONFIG — everything trip-specific lives in assets/trip.json.
   Edit that one file (city, dates, crew, HQ, itinerary, bets, awards, bingo)
   to reuse this whole app for another city/date. Loaded at startup.
   ========================================================================== */
let TRIP = {};
let ITINERARY = [], CREW = [], DEFAULT_NAMES = [], BETS = [], AWARDS = [], BINGO = [];
let TRIP_START = new Date(0), TRIP_END = new Date(0);
let STORE_KEY = "thirstyboys.trip.v1";
let OUTBOX_KEY = "thirstyboys.trip.outbox";
let HQ_ADDRESS = "";

/* Drink types and titles are generic — not trip-specific. */
const DRINKS = [
  { id: "pint",     label: "Pint",     emoji: "🍺" },
  { id: "half",     label: "Half",     emoji: "🥛" },
  { id: "wine",     label: "Wine",     emoji: "🍷" },
  { id: "cocktail", label: "Cocktail", emoji: "🍸" },
  { id: "shot",     label: "Shot",     emoji: "🍶" },
  { id: "whiskey",  label: "Whiskey",  emoji: "🥃" },
  { id: "soft",     label: "Soft",     emoji: "🧃" },
];
const TITLES = { top: "👑 Thirstiest Boy", zero: "😇 Designated" };

async function loadTrip() {
  try {
    const r = await fetch("assets/trip.json?v=" + (window.TB_BUILD || "dev"), { cache: "no-cache" });
    if (r.ok) return await r.json();
  } catch (e) { /* offline or missing — fall through to empty */ }
  return {};
}
function applyTrip(t) {
  TRIP = t || {};
  ITINERARY = TRIP.itinerary || [];
  CREW = (TRIP.crew || []).map((c) => ({ emoji: c.emoji, role: c.role }));
  DEFAULT_NAMES = (TRIP.crew || []).map((c) => c.name);
  BETS = TRIP.bets || [];
  AWARDS = TRIP.awards || [];
  BINGO = TRIP.bingo || [];
  const d = TRIP.dates || {};
  TRIP_START = new Date((d.start || "1970-01-01T00:00") + ":00");
  TRIP_END = new Date((d.end || "1970-01-01T00:00") + ":00");
  const hc = String(TRIP.houseCode || "trip").replace(/[^a-z0-9_-]/gi, "_");
  STORE_KEY = "thirstyboys." + hc + ".v1";
  OUTBOX_KEY = "thirstyboys." + hc + ".outbox";
  window.__houseCode = hc;
  HQ_ADDRESS = (TRIP.hq && TRIP.hq.address) || "";
}

/* ---------- STATE ---------- */
let state;

/* ---------- PER-DEVICE IDENTITY (who is holding THIS phone) ----------
   Stored locally only — never synced, so each phone keeps its own "me". */
const ME_KEY = "thirstyboys.me";
let me;
function loadMe() {
  try {
    const v = localStorage.getItem(ME_KEY);
    return v === null ? null : Number(v);
  } catch (e) { return null; }
}

/* Which drink THIS phone has selected — per-device, never synced. */
const DRINK_KEY = "thirstyboys.drink";
let selectedDrink = "pint";
function loadSelectedDrink() {
  try { return localStorage.getItem(DRINK_KEY) || "pint"; } catch (e) { return "pint"; }
}
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
  presencePushed = true;
  save();
  rtSet("present/" + i, state.present[i]);
  closeWhoamiModal();
  render();
}
function clearMe() {
  const old = me;
  if (old != null && state.present) delete state.present[old];  // mark "out"
  presencePushed = false;      // allow re-announcing after re-claim
  me = null;
  try { localStorage.removeItem(ME_KEY); } catch (e) { /* ignore */ }
  save();
  if (old != null) rtRemove("present/" + old);
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
    bets: {},    // betId -> { calls: {voterIdx: value}, result, revealed }
    awards: {},  // awardId -> { votes: {voterIdx: nomineeIdx}, revealed }
    quotes: [], // { text, who, ts }
    bingo: {},  // bingoId -> spotter index (synced)
    present: {}, // personIndex -> lastSeen ms (synced: who has joined)
    round: null, // last "whose round" verdict: { winner, by, ts } (synced)
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
  // Local cache only. Remote writes are granular (see rtSet/rtAdd) so two
  // phones acting at once never clobber each other's whole state.
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* One-off rename that also reaches the already-seeded shared room: crew names
   live in synced state, so changing the default alone wouldn't update a room
   that was seeded under the old name. Idempotent — once the new name has
   propagated there's no "Mitul" left to match. Scoped to this trip's room. */
const LEGACY_RENAMES = { Mitul: "Mr Finance", Director: "The Director" };
function applyLegacyRenames() {
  if (window.__houseCode !== "brum26") return;
  let changed = false;
  state.names.forEach((n, i) => {
    if (LEGACY_RENAMES[n]) { state.names[i] = LEGACY_RENAMES[n]; rtSet("names/" + i, state.names[i]); changed = true; }
  });
  if (changed) save();
}

/* ==========================================================================
   FIREBASE SYNC (optional — shared live state across all phones)
   Enabled only when assets/config.js has a Firebase config with a databaseURL.
   Falls back silently to per-device localStorage otherwise.
   ========================================================================== */
let syncRef = null;
let applyingRemote = false;   // guards against echoing remote updates back
let presencePushed = false;   // only announce "I'm in" once per load

function setSyncStatus(text, cls) {
  // Detailed line inside the Drinks tab.
  const el = document.getElementById("sync-status");
  if (el) { el.textContent = text; el.className = "sync-status " + (cls || ""); }
  // Compact, always-visible connection pill in the sticky nav.
  const net = document.getElementById("net-status");
  if (net) {
    const label = /connect/i.test(text) && cls !== "on" ? "Connecting…"
      : /Syncing/i.test(text) ? "Syncing…"
      : cls === "on" ? "Connected"
      : cls === "err" ? "Sync issue"
      : "Offline";
    net.className = "net-status " + (cls || "off");
    net.innerHTML = `<span class="net-dot"></span>${label}`;
  }
}

function syncEnabled() {
  const cfg = window.THIRSTY_CONFIG;
  // Realtime Database only needs databaseURL; apiKey is only for Auth/Firestore.
  return !!(cfg && cfg.firebase && cfg.firebase.databaseURL
            && typeof firebase !== "undefined" && firebase.initializeApp);
}

/* Load the Firebase SDK on demand so a slow/unreachable CDN can never
   block the page — the app renders instantly and sync joins when ready. */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("failed: " + src));
    document.head.appendChild(s);
  });
}
async function loadFirebase(timeoutMs) {
  if (typeof firebase !== "undefined" && firebase.initializeApp) return; // already loaded
  await Promise.race([
    (async () => {
      await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");
    })(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("firebase timeout")), timeoutMs)),
  ]);
}

/* ---- Offline-first granular writes ------------------------------------------
   Every change touches only its own child path (drink counts add a delta), so
   concurrent taps never clobber. When we're offline the write is parked in a
   durable localStorage OUTBOX and replayed, in order, the moment we reconnect —
   so anything done with no signal survives even a full reload and syncs later.
   `connected` mirrors Firebase's own .info/connected so we never double-count:
   online → write straight through (Firebase owns any in-session queue);
   offline → outbox only. ------------------------------------------------------ */
let connected = false;          // mirrors firebase .info/connected
let outbox = [];                // pending ops while offline: {op,path,value|delta}

function loadOutbox() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch (e) { return []; } }
function saveOutbox() { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); } catch (e) { /* ignore */ } }
function enqueue(op) { outbox.push(op); saveOutbox(); refreshSyncStatus(); }

function rtLive() { return !!(syncRef && connected); }
function rtSet(path, value) {
  if (applyingRemote) return;                 // don't echo a remote update back
  if (rtLive()) { try { syncRef.child(path).set(value); return; } catch (e) { /* fall through to outbox */ } }
  enqueue({ op: "set", path: path, value: value });
}
function rtRemove(path) {
  if (applyingRemote) return;
  if (rtLive()) { try { syncRef.child(path).remove(); return; } catch (e) { /* fall through */ } }
  enqueue({ op: "remove", path: path });
}
function rtAdd(path, delta) {                 // additive count change (± n)
  if (applyingRemote) return;
  if (rtLive()) { try { syncRef.child(path).transaction((v) => Math.max(0, (v || 0) + delta)); return; } catch (e) { /* fall through */ } }
  enqueue({ op: "add", path: path, delta: delta });
}
function seedRemote() {                        // full-room overwrite (reset / first seed)
  const snapshot = JSON.parse(JSON.stringify(state));
  // A whole-state write already captures every local edit, so any queued
  // deltas are now redundant — clearing them prevents a double-count on flush.
  if (rtLive()) { try { syncRef.set(snapshot); outbox = []; saveOutbox(); return; } catch (e) { /* fall through */ } }
  outbox = [{ op: "seedroot", value: snapshot }];
  saveOutbox();
  refreshSyncStatus();
}

/* Replay everything parked while offline, in order, then clear the outbox. */
function flushOutbox() {
  if (!syncRef || !connected || !outbox.length) return;
  const pending = outbox.slice();
  outbox = []; saveOutbox();
  const failed = [];
  pending.forEach((o) => {
    try {
      if (o.op === "set") syncRef.child(o.path).set(o.value);
      else if (o.op === "remove") syncRef.child(o.path).remove();
      else if (o.op === "add") syncRef.child(o.path).transaction((v) => Math.max(0, (v || 0) + o.delta));
      else if (o.op === "seedroot") syncRef.set(o.value);
    } catch (e) { failed.push(o); }
  });
  if (failed.length) { outbox = failed.concat(outbox); saveOutbox(); }
  refreshSyncStatus();
}

/* One place that decides what the little status pill says. */
function refreshSyncStatus() {
  const code = window.__houseCode || "";
  if (rtLive()) {
    setSyncStatus(outbox.length ? "🔄 Syncing " + outbox.length + "…" : "🟢 Live · house “" + code + "”", "on");
  } else if (syncRef || (window.THIRSTY_CONFIG && window.THIRSTY_CONFIG.firebase)) {
    setSyncStatus(outbox.length ? "📴 Offline · " + outbox.length + " change" + (outbox.length === 1 ? "" : "s") + " waiting" : "📴 Offline — saved here, will sync", "off");
  } else {
    setSyncStatus("📴 Saved on this device only", "off");
  }
}

async function initSync() {
  if (syncRef) return;            // already wired — Firebase auto-reconnects itself
  const cfgPre = window.THIRSTY_CONFIG;
  if (!cfgPre || !cfgPre.firebase || !cfgPre.firebase.databaseURL) {
    setSyncStatus("📴 Saved on this device only", "off");
    return;
  }
  setSyncStatus("🔄 Connecting…", "off");
  try {
    await loadFirebase(10000);
  } catch (e) {
    // No signal to fetch the SDK — everything still works locally and the
    // 'online' listener retries this the moment a connection appears.
    refreshSyncStatus();
    return;
  }
  if (!syncEnabled()) {
    setSyncStatus("📴 Saved on this device only", "off");
    return;
  }
  const cfg = window.THIRSTY_CONFIG;
  const code = (cfg.houseCode || "default").replace(/[.#$/\[\]]/g, "_");
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg.firebase);
    syncRef = firebase.database().ref("houses/" + code);
    setSyncStatus("🔄 Connecting…", "off");

    // Track the live connection so writes know whether to go straight through
    // or park in the outbox — and flush the outbox the instant we're back.
    firebase.database().ref(".info/connected").on("value", (s) => {
      connected = s.val() === true;
      if (connected) flushOutbox();
      refreshSyncStatus();
    });

    syncRef.on("value", (snap) => {
      const remote = snap.val();
      if (!remote) {
        // Nothing shared yet — seed the room with our current state.
        if (markMePresent()) presencePushed = true;
        seedRemote();
        refreshSyncStatus();
        return;
      }
      applyingRemote = true;
      state = Object.assign(defaults(), remote);
      // Firebase drops empty collections and may return keyed objects; normalise.
      if (state.log && !Array.isArray(state.log)) state.log = Object.keys(state.log).map((k) => state.log[k]);
      if (!Array.isArray(state.quotes)) state.quotes = state.quotes ? Object.keys(state.quotes).map((k) => state.quotes[k]) : [];
      applyingRemote = false;
      applyLegacyRenames();     // rebrand any old default name in the shared room
      save();     // remote is now the local truth too (outbox still holds any un-synced edits)
      // Any edits made while offline are in the outbox — push them now so this
      // snapshot's overwrite doesn't lose them.
      flushOutbox();
      // If this phone has claimed an identity, announce "I'm in" — but only once.
      if (!presencePushed && markMePresent()) { presencePushed = true; rtSet("present/" + me, state.present[me]); }
      refreshSyncStatus();
      renderDrinkBar();
      render();
    }, (err) => {
      setSyncStatus("⚠️ Sync error — check config/rules. Using this device.", "err");
    });
  } catch (e) {
    setSyncStatus("⚠️ Sync failed to start. Using this device.", "err");
  }
}

// Cold-started with no signal? Retry the whole handshake when a connection appears.
window.addEventListener("online", () => { if (!syncRef) initSync(); refreshSyncStatus(); });
window.addEventListener("offline", () => { connected = false; refreshSyncStatus(); });

/* ---------- HELPERS ---------- */
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
      // Uber prefills the destination reliably only with coordinates, so use
      // them when we have them; otherwise fall back to Maps directions.
      const uber = (s.lat != null && s.lon != null)
        ? `<a href="https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff%5Blatitude%5D=${s.lat}&dropoff%5Blongitude%5D=${s.lon}&dropoff%5Bnickname%5D=${encodeURIComponent(s.title)}" target="_blank" rel="noopener">🚕 Uber</a>`
        : (s.map ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.map)}" target="_blank" rel="noopener">🚕 Get there</a>` : "");
      const menu = s.menu
        ? `<a href="${escapeAttr(s.menu)}" target="_blank" rel="noopener">🍽️ Menu</a>`
        : "";
      const tags = (tag || map || uber || menu) ? `<div class="stop-tags">${tag}${map}${uber}${menu}</div>` : "";

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
  const blocks = document.querySelectorAll("#countdown .cd-block");
  const set = (id, v) => { document.getElementById(id).textContent = String(v).padStart(2, "0"); };

  if (now < TRIP_START) {
    // Before the trip: count down, restore the day/hr/min/sec labels.
    const diff = TRIP_START - now;
    set("cd-days", Math.floor(diff / 86400000));
    set("cd-hours", Math.floor((diff % 86400000) / 3600000));
    set("cd-mins", Math.floor((diff % 3600000) / 60000));
    set("cd-secs", Math.floor((diff % 60000) / 1000));
    const labs = ["days", "hrs", "min", "sec"];
    blocks.forEach((bl, i) => { const l = bl.querySelector(".cd-lab"); if (l) l.textContent = labs[i]; bl.classList.remove("cd-leader"); });
    cap.textContent = TRIP.tagline || "";
    cap.classList.remove("live");
  } else {
    // Trip's on (or done): the countdown becomes a live drink scoreboard.
    const rows = state.names.map((n, i) => ({ n, i, c: countFor(i) })).sort((a, b) => b.c - a.c);
    const maxC = Math.max(0, ...rows.map((r) => r.c));
    blocks.forEach((bl, i) => {
      const num = bl.querySelector(".cd-num"), lab = bl.querySelector(".cd-lab");
      const r = rows[i];
      if (!r) { if (num) num.textContent = "—"; if (lab) lab.textContent = ""; bl.classList.remove("cd-leader"); return; }
      if (num) num.textContent = r.c;
      if (lab) lab.textContent = r.n;
      bl.classList.toggle("cd-leader", maxC > 0 && r.c === maxC);
    });
    cap.textContent = now <= TRIP_END ? "🍺 Live drink count — pace yourselves" : "🏁 Final tally. Legends, all of you.";
    cap.classList.add("live");
  }
}

/* ==========================================================================
   TRIP MODE — the home page switches character on the day: a LIVE hero with
   the day, the current/next stop, and live stats; and a "wrapped" state once
   it's over. Before the trip it stays as the normal countdown.
   ========================================================================== */
function renderTripMode() {
  const now = new Date();
  const kicker = document.querySelector(".hero .kicker");
  const live = document.getElementById("hero-live");
  const before = now < TRIP_START;
  const after = now > TRIP_END;
  document.body.classList.toggle("trip-live", !before && !after);
  document.body.classList.toggle("trip-done", after);

  if (before) {
    if (kicker) kicker.textContent = "The Thirsty Boys present";
    if (live) { live.classList.add("hidden"); live.innerHTML = ""; }
    return;
  }
  const total = state.names.reduce((s, _, i) => s + countFor(i), 0);
  if (after) {
    if (kicker) kicker.textContent = "🏁 That's a wrap";
    if (live) {
      live.classList.remove("hidden");
      live.innerHTML = `<div class="hl-stats"><span>🍺 ${total} sunk</span><span>👑 ${escapeHtml(topName())}</span></div>`;
    }
    return;
  }
  // During the trip: LIVE hero with the day, now/next, and live stats.
  if (kicker) kicker.textContent = "🔴 LIVE · " + now.toLocaleDateString([], { weekday: "long" });
  if (!live) return;
  live.classList.remove("hidden");
  const flat = [];
  ITINERARY.forEach((d) => d.stops.forEach((s) => flat.push(s)));
  let cur = null, next = null;
  for (const s of flat) { if (new Date(s.iso) <= now) cur = s; else { next = s; break; } }
  const nowTxt = cur ? `${cur.emoji} ${escapeHtml(cur.title)}` : "warming up…";
  const nextTxt = next ? `${next.emoji} ${escapeHtml(next.title)} · ${next.t}` : "last one 🎉";
  const log = (state.log || []).filter((e) => e && e.ts);
  const lastHour = log.filter((e) => Date.now() - e.ts <= 3600000).length;
  live.innerHTML =
    `<div class="hl-nownext"><span class="hl-seg"><b>NOW</b> ${nowTxt}</span><span class="hl-seg hl-next"><b>NEXT</b> ${nextTxt}</span></div>` +
    `<div class="hl-stats"><span>🍺 ${total}</span><span>👑 ${escapeHtml(topName())}</span><span>🔥 ${lastHour} last hr</span></div>`;
}
function topName() {
  const rows = state.names.map((n, i) => ({ n, c: countFor(i) })).sort((a, b) => b.c - a.c);
  return rows[0] && rows[0].c > 0 ? rows[0].n : "—";
}
/* Which tab opens by default depends on the trip phase. */
function defaultTab() {
  return new Date() > TRIP_END ? "recap" : "itinerary";
}

/* ==========================================================================
   RENDER: DRINK BAR (picker)
   ========================================================================== */
function renderDrinkBar() {
  const bar = document.getElementById("drink-bar");
  bar.innerHTML = DRINKS.map((d) => `
    <button class="drink-pick ${d.id === selectedDrink ? "active" : ""}" data-drink="${d.id}">
      ${d.emoji} ${d.label}
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

/* Roster with live presence. "In" = seen recently (heartbeat), "Away" =
   joined but quiet for a while, "Waiting" = never joined. */
const FRESH_MS = 8 * 60 * 1000;   // seen within 8 min = online
function rosterHtml() {
  const present = state.present || {};
  const now = Date.now();
  const ins = [], away = [], outs = [];
  state.names.forEach((n, i) => {
    const seen = present[i];
    if (seen && now - seen < FRESH_MS) ins.push({ n, i });
    else if (seen) away.push({ n, i });
    else outs.push({ n, i });
  });
  const fmt = (x) => `${CREW[x.i] ? CREW[x.i].emoji : ""} ${escapeHtml(x.n)}${x.i === me ? " (you)" : ""}`;
  const awayRow = away.length
    ? `<div class="roster-row"><span class="roster-lab away">Away</span><span>${away.map(fmt).join(" · ")}</span></div>`
    : "";
  return `
    <div class="roster">
      <div class="roster-row">
        <span class="roster-lab in">In</span>
        <span>${ins.length ? ins.map(fmt).join(" · ") : `<span class="roster-none">nobody yet</span>`}</span>
      </div>
      ${awayRow}
      <div class="roster-row">
        <span class="roster-lab out">Waiting</span>
        <span>${outs.length ? outs.map((x) => escapeHtml(x.n)).join(" · ") : `<span class="roster-none">everyone's in! 🎉</span>`}</span>
      </div>
    </div>`;
}

/* Heartbeat: keep my "last seen" fresh so the roster shows who's really online. */
function beat() {
  if (me == null || Number.isNaN(me) || !state.names[me]) return;
  state.present = state.present || {};
  state.present[me] = Date.now();
  save();
  rtSet("present/" + me, state.present[me]);
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
  const rows = state.names.map((n, i) => ({ i, name: n, count: countFor(i) }));
  const maxCount = Math.max(0, ...rows.map((r) => r.count));
  const anyDrinks = maxCount > 0;

  // Rank by number of drinks.
  const ordered = [...rows].sort((a, b) => b.count - a.count);
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
        <div class="lb-units-lab">${r.count === 1 ? "drink" : "drinks"}</div>
        <div class="lb-title">${title}</div>
        <div class="lb-badges">${badgesFor(r.i).join(" ")}</div>
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
        <div class="person-count-lab">${countFor(i) === 1 ? "drink" : "drinks"}</div>
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
    return `<li><span>${d ? d.emoji : "🍺"} ${escapeHtml(state.names[e.who] || "?")} — ${d ? d.label : escapeHtml(String(e.drink))}</span><span>${escapeHtml(time)}</span></li>`;
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
      rtSet("names/" + i, state.names[i]);
      render();
    });
  });
}

/* ==========================================================================
   ACTIONS
   ========================================================================== */
function addDrink(i) {
  const id = selectedDrink;
  const prevLeader = currentLeader();
  state.tallies[i] = state.tallies[i] || {};
  state.tallies[i][id] = (state.tallies[i][id] || 0) + 1;
  state.log.push({ who: i, drink: id, ts: Date.now() });
  if (state.log.length > 400) state.log = state.log.slice(-400);
  save();
  // Count as a delta so simultaneous taps both land (online) or queue safely
  // (offline); log written whole.
  rtAdd("tallies/" + i + "/" + id, 1);
  rtSet("log", state.log);
  render();
  // Celebrate: small burst from the button; big fanfare when the crown changes.
  const btn = document.querySelector('.person-add[data-i="' + i + '"]');
  if (btn) { const r = btn.getBoundingClientRect(); burstConfetti(r.left + r.width / 2, r.top, 12); }
  const newLeader = currentLeader();
  if (newLeader != null && newLeader !== prevLeader) {
    burstConfetti(window.innerWidth / 2, 90, 40);
    pop();
    toast("👑 " + state.names[newLeader] + " is Thirstiest Boy!");
  }
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
  rtAdd("tallies/" + entry.who + "/" + entry.drink, -1);
  rtSet("log", state.log);
  render();
}

const RESET_PASSWORD = "brum26";

/* Password gate for irreversible "reveal to everyone" actions. Same password
   as reset so there's only one to remember. Returns true if OK to proceed. */
function confirmReveal(what) {
  const pw = prompt("Reveal " + what + " to the WHOLE crew — no un-seeing it.\nEnter the password to confirm:");
  if (pw == null) return false;             // cancelled
  if (pw.trim().toLowerCase() !== RESET_PASSWORD) { alert("Wrong password — nothing was revealed."); return false; }
  return true;
}

function resetAll() {
  const pw = prompt("This wipes ALL drinks & names for EVERYONE.\nEnter the reset password to confirm:");
  if (pw == null) return;                 // cancelled
  if (pw.trim().toLowerCase() !== RESET_PASSWORD) { alert("Wrong password — nothing was reset."); return; }
  // Full wipe: drinks, names, bets, awards, quotes and the presence roster.
  state = defaults();
  markMePresent();          // keep whoever's holding this phone marked "in"
  save();
  seedRemote();             // overwrite the whole shared room (this IS a full reset)
  renderDrinkBar();
  render();
}

/* ==========================================================================
   SWIPE DECK — turn a long list of cards into a swipeable, snap-scrolling deck
   so 34 bets aren't 34 screens of scrolling. One card at a time, next peeking;
   swipe (or tap ‹ ›) to move; a counter shows where you are.
   ========================================================================== */
function deckWrap(cardsHtml, id) {
  return `<div class="deck" id="${id}">${cardsHtml}</div>
    <div class="deck-nav">
      <button class="deck-arrow" type="button" data-deck="${id}" data-dir="-1" aria-label="Previous">‹</button>
      <span class="deck-count" id="${id}-count"></span>
      <button class="deck-arrow" type="button" data-deck="${id}" data-dir="1" aria-label="Next">›</button>
    </div>`;
}
function deckStep(deck) {
  const first = deck.children[0];
  if (!first) return deck.clientWidth || 1;
  const cs = getComputedStyle(deck);
  const gap = parseFloat(cs.columnGap || cs.gap || "0") || 0;
  return first.getBoundingClientRect().width + gap;
}
function wireDeck(id, restoreScroll) {
  const deck = document.getElementById(id);
  if (!deck) return;
  if (restoreScroll) deck.scrollLeft = restoreScroll;   // keep your place across re-renders
  const countEl = document.getElementById(id + "-count");
  const n = deck.children.length;
  const update = () => {
    if (!countEl || !n) return;
    const idx = Math.min(n, Math.max(1, Math.round(deck.scrollLeft / deckStep(deck)) + 1));
    countEl.textContent = idx + " / " + n;
  };
  deck.addEventListener("scroll", () => window.requestAnimationFrame(update), { passive: true });
  update();
}
/* "You've done N of M" bar shown above a deck so it's clear, at a glance,
   what you've completed and what's still outstanding. */
function progressBar(done, total, doneWord, todoWord) {
  const todo = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const tail = todo > 0
    ? ` · <b>${todo}</b> still to ${todoWord}`
    : ` · all done! 🎉`;
  return `<div class="mine-progress">
    <div class="mp-bar"><span style="width:${pct}%"></span></div>
    <div class="mp-text">You've ${doneWord} <b>${done}</b> / ${total}${tail}</div>
  </div>`;
}
/* One delegated handler for every deck's ‹ › arrows (survives re-renders). */
document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest(".deck-arrow");
  if (!btn) return;
  const deck = document.getElementById(btn.getAttribute("data-deck"));
  if (!deck || !deck.children.length) return;
  deck.scrollBy({ left: deckStep(deck) * Number(btn.getAttribute("data-dir")), behavior: "smooth" });
});

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

  // Your own progress: how many you've called vs still need to call.
  const myProg = claimed ? progressBar(
    BETS.filter((bt) => { const bb = getBet(bt.id); return bb.calls[me] != null && bb.calls[me] !== ""; }).length,
    BETS.length, "called", "call") : "";

  // Sort the ones still needing YOUR call to the front (stable within groups):
  // 0 = not called yet, 1 = called, 2 = revealed/locked.
  const betRank = (bet) => { const b = getBet(bet.id); return b.revealed ? 2 : (b.calls[me] != null && b.calls[me] !== "" ? 1 : 0); };
  const orderedBets = claimed ? BETS.map((b, i) => [b, i]).sort((x, y) => (betRank(x[0]) - betRank(y[0])) || (x[1] - y[1])).map((p) => p[0]) : BETS;

  const prevScroll = (document.getElementById("bets-deck") || {}).scrollLeft || 0;
  wrap.innerHTML = scoreboard + myProg + deckWrap(orderedBets.map((bet) => {
    const b = getBet(bet.id);
    const callCount = Object.keys(b.calls).length;
    const mineIn = claimed && b.calls[me] != null && b.calls[me] !== "";
    const cardCls = b.revealed ? "is-revealed" : (!claimed ? "" : (mineIn ? "mine-done" : "mine-todo"));
    const mark = b.revealed ? `<span class="mine-mark revealed">👁 Revealed</span>`
      : (!claimed ? "" : (mineIn ? `<span class="mine-mark done">✅ Called</span>` : `<span class="mine-mark todo">◻️ Your call needed</span>`));
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

    return `<div class="bet-card ${cardCls}">${mark}<p class="bet-q"><span class="emoji">${bet.emoji}</span> ${bet.q}</p>${body}</div>`;
  }).join(""), "bets-deck");

  wrap.querySelectorAll("[data-bet-call]").forEach((el) =>
    el.addEventListener("change", () => {
      const id = el.dataset.betCall, b = getBet(id);
      const v = el.value;
      if (v === "") { delete b.calls[me]; rtRemove("bets/" + id + "/calls/" + me); }
      else { b.calls[me] = BETS.find((x) => x.id === id).type === "person" ? Number(v) : v; rtSet("bets/" + id + "/calls/" + me, b.calls[me]); }
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
      rtSet("bets/" + id + "/result", b.result);
      renderBets();
    })
  );
  wrap.querySelectorAll(".bet-reveal").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!confirmReveal("everyone's calls")) return;
      const id = btn.dataset.bet, b = getBet(id);
      b.revealed = true; state.bets[id] = b; save(); rtSet("bets/" + id + "/revealed", true); renderBets();
    })
  );
  wrap.querySelectorAll(".bet-reopen").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.bet, b = getBet(id);
      b.revealed = false; state.bets[id] = b; save(); rtSet("bets/" + id + "/revealed", false); renderBets();
    })
  );
  wireDeck("bets-deck", prevScroll);
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

  const myProg = claimed ? progressBar(
    AWARDS.filter((aw) => getAward(aw.id).votes[me] != null).length,
    AWARDS.length, "voted", "vote") : "";

  // Ones still needing YOUR vote first: 0 = not voted, 1 = voted, 2 = revealed.
  const awardRank = (aw) => { const d = getAward(aw.id); return d.revealed ? 2 : (d.votes[me] != null ? 1 : 0); };
  const orderedAwards = claimed ? AWARDS.map((a, i) => [a, i]).sort((x, y) => (awardRank(x[0]) - awardRank(y[0])) || (x[1] - y[1])).map((p) => p[0]) : AWARDS;

  const prevScroll = (document.getElementById("awards-deck") || {}).scrollLeft || 0;
  wrap.innerHTML = myProg + deckWrap(orderedAwards.map((a) => {
    const data = getAward(a.id);
    const voteCount = Object.keys(data.votes).length;
    const tally = {};
    Object.values(data.votes).forEach((n) => { tally[n] = (tally[n] || 0) + 1; });
    const mineIn = claimed && data.votes[me] != null;
    const cardCls = data.revealed ? "is-revealed" : (!claimed ? "" : (mineIn ? "mine-done" : "mine-todo"));
    const mark = data.revealed ? `<span class="mine-mark revealed">👁 Revealed</span>`
      : (!claimed ? "" : (mineIn ? `<span class="mine-mark done">✅ Voted</span>` : `<span class="mine-mark todo">◻️ Your vote needed</span>`));

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
    return `<div class="award-card ${cardCls}">${mark}<p class="award-title">${a.title}</p>${body}</div>`;
  }).join(""), "awards-deck");

  wrap.querySelectorAll(".award-select").forEach((sel) =>
    sel.addEventListener("change", () => {
      const id = sel.dataset.award, a = getAward(id);
      if (sel.value === "") { delete a.votes[me]; rtRemove("awards/" + id + "/votes/" + me); }
      else { a.votes[me] = Number(sel.value); rtSet("awards/" + id + "/votes/" + me, a.votes[me]); }
      state.awards[id] = a;
      save();
      renderAwards();
    })
  );
  wrap.querySelectorAll(".award-reveal").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirmReveal("the award results")) return;
      const id = b.dataset.award, a = getAward(id);
      a.revealed = true; state.awards[id] = a; save(); rtSet("awards/" + id + "/revealed", true); renderAwards();
    })
  );
  wrap.querySelectorAll(".award-reopen").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.award, a = getAward(id);
      a.revealed = false; state.awards[id] = a; save(); rtSet("awards/" + id + "/revealed", false); renderAwards();
    })
  );
  wireDeck("awards-deck", prevScroll);
}

/* ==========================================================================
   RENDER: SUNDAY RECAP ("wrapped") + share
   ========================================================================== */
function awardWinner(id) {
  const a = getAward(id);
  if (!a.revealed) return null;
  const tally = {};
  Object.values(a.votes).forEach((n) => { tally[n] = (tally[n] || 0) + 1; });
  const max = Math.max(0, ...state.names.map((_, i) => tally[i] || 0));
  if (max <= 0) return null;
  const w = state.names.map((n, i) => ({ n, i })).filter((x) => (tally[x.i] || 0) === max);
  return w.length === 1 ? w[0].n : w.map((x) => x.n).join(" & ");
}
function recapData() {
  const rows = state.names.map((n, i) => ({ n, i, c: countFor(i) })).sort((a, b) => b.c - a.c);
  const total = rows.reduce((s, r) => s + r.c, 0);
  const maxC = Math.max(0, ...rows.map((r) => r.c));
  const thirstiest = maxC > 0 ? rows.filter((r) => r.c === maxC).map((r) => r.n).join(" & ") : null;
  const scores = betScores();
  const maxS = Math.max(0, ...scores);
  const pundit = maxS > 0 ? state.names.map((n, i) => ({ n, s: scores[i] })).filter((x) => x.s === maxS).map((x) => x.n).join(" & ") : null;
  const bingoN = BINGO.filter((x) => state.bingo && state.bingo[x.id] != null).length;
  const awards = AWARDS.map((a) => ({ title: a.title, w: awardWinner(a.id) })).filter((x) => x.w);
  return { rows, total, maxC, thirstiest, maxS, pundit, bingoN, awards };
}
function renderRecap() {
  const el = document.getElementById("recap-card");
  if (!el) return;
  const d = recapData();
  const medal = ["🥇", "🥈", "🥉"];
  el.innerHTML =
    `<div class="recap-head">
       <div class="rc-title">${escapeHtml((TRIP.city || "") + " '" + (TRIP.year || ""))} 🍺</div>
       <div class="rc-sub">${escapeHtml(TRIP.datesLabel || "")}</div>
     </div>
     <div class="recap-crown">
       <div class="rc-lab">👑 Thirstiest Boy</div>
       ${d.thirstiest
        ? `<div class="rc-name">${escapeHtml(d.thirstiest)}</div><div class="rc-sub">${d.maxC} drink${d.maxC === 1 ? "" : "s"}</div>`
        : `<div class="rc-none">No drinks logged yet</div>`}
     </div>
     <div class="recap-lb">${d.rows.map((r, i) =>
      `<div class="recap-lb-row"><span class="rc-rank">${medal[i] || (i + 1) + "."}</span><span class="rc-who">${escapeHtml(r.n)}</span><span class="rc-n">${r.c}</span></div>`).join("")}</div>
     <div class="recap-stats">
       <div class="recap-stat"><div class="rc-v">${d.total}</div><div class="rc-k">Total drinks</div></div>
       <div class="recap-stat"><div class="rc-v">${d.bingoN}/${BINGO.length}</div><div class="rc-k">Bingo spotted</div></div>
     </div>
     <div class="recap-awards">
       ${d.pundit ? `<div class="rc-aw">🎯 Best pundit: <b>${escapeHtml(d.pundit)}</b> (${d.maxS} correct)</div>` : ""}
       ${d.awards.map((x) => `<div class="rc-aw">${escapeHtml(x.title)}: <b>${escapeHtml(x.w)}</b></div>`).join("")}
       ${(!d.pundit && !d.awards.length) ? `<div class="recap-empty">Reveal some awards & settle bets and they'll show here 🏆</div>` : ""}
     </div>`;
}
function buildRecapText() {
  const d = recapData();
  const lines = ["🍺 " + (TRIP.city || "") + " '" + (TRIP.year || "") + " — Thirsty Boys"];
  if (d.thirstiest) lines.push("👑 Thirstiest Boy: " + d.thirstiest + " (" + d.maxC + ")");
  lines.push("🍻 " + d.rows.map((r) => r.n + " " + r.c).join(" · "));
  if (d.pundit) lines.push("🎯 Best pundit: " + d.pundit + " (" + d.maxS + ")");
  lines.push("🥏 Bingo: " + d.bingoN + "/" + BINGO.length);
  d.awards.forEach((x) => lines.push(x.title + ": " + x.w));
  return lines.join("\n");
}
async function shareRecap() {
  const text = buildRecapText();
  const url = location.origin + location.pathname;
  if (navigator.share) {
    try { await navigator.share({ title: (TRIP.city || "") + " '" + (TRIP.year || ""), text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text + "\n" + url); toast("📋 Recap copied — paste it in the chat"); }
  catch (e) { prompt("Copy the recap:", text + "\n" + url); }
}

/* ==========================================================================
   CELEBRATION: confetti, toast, crown-change, whose-round spinner
   ========================================================================== */
function reducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function burstConfetti(x, y, count) {
  if (reducedMotion()) return;
  const colors = ["#f4a933", "#ffcf6b", "#b83a5c", "#4bbf87", "#f4f1e9"];
  for (let k = 0; k < count; k++) {
    const p = document.createElement("div");
    p.className = "confetti";
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.background = colors[k % colors.length];
    const ang = (Math.random() * Math.PI * 2), dist = 40 + Math.random() * 90;
    p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--dy", (Math.sin(ang) * dist - 70) + "px");
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 350); }, 2600);
}
let audioCtx;
function pop() {
  if (reducedMotion()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "triangle"; o.frequency.value = 660;
    o.connect(g); g.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.start(t0); o.stop(t0 + 0.2);
  } catch (e) { /* audio blocked — no worries */ }
}
/* Index of the single outright drinks leader, or null (tie / nobody drinking). */
function currentLeader() {
  let max = 0, who = null, tie = false;
  state.names.forEach((_, i) => {
    const c = countFor(i);
    if (c > max) { max = c; who = i; tie = false; }
    else if (c === max && c > 0) tie = true;
  });
  return max > 0 && !tie ? who : null;
}
/* Little achievement badges from a person's tally. */
function badgesFor(i) {
  const t = state.tallies[i] || {}, c = countFor(i), out = [];
  if (c >= 20) out.push("🏆"); else if (c >= 10) out.push("🔟");
  if (t.shot) out.push("🥃");
  if (t.wine) out.push("🍷");
  if (t.cocktail) out.push("🍸");
  if (c === 0) out.push("😇");
  return out;
}
let roundSpinning = false;      // this phone is mid-animation
let lastRoundTs = 0;            // last verdict we've already reacted to
function spinRound() {
  const el = document.getElementById("round-result");
  if (!el || roundSpinning || !state.names.length) return;
  roundSpinning = true;
  const winner = Math.floor(Math.random() * state.names.length);
  let n = 0;
  const iv = setInterval(() => {
    el.textContent = state.names[Math.floor(Math.random() * state.names.length)];
    if (++n > 12) {
      clearInterval(iv);
      roundSpinning = false;
      // Publish the verdict so every phone lands on the same name.
      state.round = { winner: winner, by: (me != null && !Number.isNaN(me)) ? me : null, ts: Date.now() };
      lastRoundTs = state.round.ts;
      save();
      rtSet("round", state.round);
      showRoundVerdict(true);
    }
  }, 80);
}
/* Render the shared "whose round" verdict; celebrate a newly-arrived one once. */
function showRoundVerdict(celebrate) {
  const el = document.getElementById("round-result");
  if (!el) return;
  const r = state.round;
  if (!r || r.winner == null || !state.names[r.winner]) { if (!roundSpinning) el.textContent = ""; return; }
  if (roundSpinning) return;   // don't stomp an in-progress local animation
  const who = state.names[r.winner];
  const caller = (r.by != null && state.names[r.by]) ? ` (spun by ${escapeHtml(state.names[r.by])})` : "";
  el.innerHTML = `🍺 ${escapeHtml(who)}'s round!<span class="round-by">${caller}</span>`;
  if (celebrate) {
    const box = el.getBoundingClientRect();
    burstConfetti(box.left + box.width / 2, box.top + box.height / 2, 16);
    pop();
    buzz([90, 40, 90, 40, 180]);
    bigBanner(`🍺 <b>${escapeHtml(who)}</b>'s round!`);
  }
}
function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported */ } }
/* Full-width headline banner (used for the shared whose-round verdict). */
function bigBanner(html) {
  const old = document.getElementById("big-banner");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "big-banner";
  el.className = "big-banner";
  el.innerHTML = html;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 4000);
}
function renderRound() {
  const r = state.round;
  // Celebrate only a genuinely NEW verdict that just landed (e.g. another phone
  // spun) — not an old one being re-shown on load or re-sync.
  const fresh = r && r.ts && r.ts !== lastRoundTs && (Date.now() - r.ts < 15000);
  if (r && r.ts) lastRoundTs = r.ts;
  showRoundVerdict(!!fresh);
}

/* ==========================================================================
   RENDER: BIRMINGHAM BINGO
   ========================================================================== */
function renderBingo() {
  const grid = document.getElementById("bingo-grid");
  if (!grid) return;
  const spotted = BINGO.filter((x) => state.bingo && state.bingo[x.id] != null).length;
  const prog = document.getElementById("bingo-progress");
  if (prog) prog.textContent = `(${spotted}/${BINGO.length} spotted)`;
  grid.innerHTML = BINGO.map((x) => {
    const by = state.bingo ? state.bingo[x.id] : undefined;
    const done = by != null && state.names[by];
    return `
      <div class="bingo-cell ${done ? "spotted" : ""}" data-bingo="${x.id}">
        <span class="bingo-emoji">${x.emoji}</span>
        <span>${escapeHtml(x.t)}</span>
        <span class="bingo-by">${done ? "✅ " + escapeHtml(state.names[by]) : ""}</span>
      </div>`;
  }).join("");
  grid.querySelectorAll(".bingo-cell").forEach((cell) =>
    cell.addEventListener("click", () => {
      const id = cell.dataset.bingo;
      state.bingo = state.bingo || {};
      if (state.bingo[id] != null) { delete state.bingo[id]; rtRemove("bingo/" + id); }
      else {
        const who = (me != null && !Number.isNaN(me)) ? me : 0;
        state.bingo[id] = who; rtSet("bingo/" + id, who);
        const r = cell.getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 10);
      }
      save();
      renderBingo();
    })
  );
  bingoNotify();
}

/* Buzz + banner every phone when a new bingo square gets claimed. A single new
   claim is a live spot → notify; many at once is a bulk load/sync → stay quiet.
   Un-claims never notify. */
let seenBingo = {};
function bingoSnapshot() {
  const cur = {};
  Object.keys(state.bingo || {}).forEach((id) => { if (state.bingo[id] != null) cur[id] = state.bingo[id]; });
  return cur;
}
function bingoNotify() {
  const cur = bingoSnapshot();
  const fresh = Object.keys(cur).filter((id) => seenBingo[id] !== cur[id]);
  seenBingo = cur;
  if (fresh.length !== 1) return;           // 0 = nothing new, >1 = bulk sync
  const id = fresh[0];
  const item = BINGO.find((x) => x.id === id);
  const who = state.names[cur[id]];
  if (!item || who == null) return;
  buzz([60, 40, 120]);
  pop();
  bigBanner(`🎲 <b>${escapeHtml(who)}</b> spotted: ${item.emoji} ${escapeHtml(item.t)}`);
}

/* ==========================================================================
   RENDER: LIVE STATS — computed from the drink tallies + timestamped log.
   Totals come from the tallies (authoritative); pace/biggest-hour/projection
   come from the log. Recomputed on the 1s tick so it's genuinely live.
   ========================================================================== */
function renderStats() {
  const wrap = document.getElementById("stats-wrap");
  if (!wrap) return;
  const now = Date.now();
  const totals = state.names.map((_, i) => countFor(i));
  const total = totals.reduce((a, b) => a + b, 0);

  // Per-drink breakdown across the whole group.
  const byDrink = {};
  (state.tallies || []).forEach((t) => { if (t) Object.keys(t).forEach((k) => { byDrink[k] = (byDrink[k] || 0) + (t[k] || 0); }); });

  // Time-based numbers from the timestamped log.
  const log = (state.log || []).filter((e) => e && e.ts);
  const firstTs = log.length ? Math.min.apply(null, log.map((e) => e.ts)) : null;
  const lastHour = log.filter((e) => now - e.ts <= 3600000).length;
  const spanH = firstTs ? Math.max(0.25, (now - firstTs) / 3600000) : 0;
  const rate = spanH ? log.length / spanH : 0;

  // Biggest single clock-hour.
  const buckets = {};
  log.forEach((e) => {
    const dt = new Date(e.ts);
    const key = dt.toLocaleDateString([], { weekday: "short" }) + " " + String(dt.getHours()).padStart(2, "0") + ":00";
    buckets[key] = (buckets[key] || 0) + 1;
  });
  let bigHour = "", bigN = 0;
  Object.keys(buckets).forEach((k) => { if (buckets[k] > bigN) { bigN = buckets[k]; bigHour = k; } });

  const inTrip = now >= TRIP_START.getTime() && now <= TRIP_END.getTime();
  const hoursLeft = inTrip ? Math.max(0, (TRIP_END.getTime() - now) / 3600000) : 0;
  const projected = inTrip && total > 0 ? total + Math.round(rate * hoursLeft) : null;

  const tiles = [
    `<div class="stat-tile"><div class="st-v">${total}</div><div class="st-k">Total drinks</div></div>`,
    `<div class="stat-tile"><div class="st-v">${state.names.length ? (total / state.names.length).toFixed(1) : "0"}</div><div class="st-k">Per head</div></div>`,
    `<div class="stat-tile"><div class="st-v">${lastHour}</div><div class="st-k">Last hour</div></div>`,
    `<div class="stat-tile"><div class="st-v">${bigN || 0}</div><div class="st-k">Biggest hour${bigN ? `<br><span class="st-sub">${escapeHtml(bigHour)}</span>` : ""}</div></div>`,
  ];
  if (projected != null) tiles.push(`<div class="stat-tile hot"><div class="st-v">${projected}</div><div class="st-k">Projected by Sun</div></div>`);

  const rows = state.names.map((n, i) => ({ n, i, c: totals[i] }))
    .sort((a, b) => b.c - a.c)
    .map((r) => {
      const pace = spanH ? log.filter((e) => e.who === r.i).length / spanH : 0;
      return `<div class="stat-row"><span class="sr-name">${escapeHtml(r.n)}</span><span class="sr-c">${r.c}</span><span class="sr-pace">${pace.toFixed(1)}/hr</span></div>`;
    }).join("");

  const dbreak = DRINKS.filter((d) => (byDrink[d.id] || 0) > 0).map((d) => `<span class="db-chip">${d.emoji} ${byDrink[d.id]}</span>`).join("");

  wrap.innerHTML =
    `<div class="stat-tiles">${tiles.join("")}</div>` +
    (total > 0
      ? `<div class="stat-break">${dbreak}</div>
         <div class="stat-rows"><div class="stat-rows-head">Pace per man</div>${rows}</div>`
      : `<p class="stat-empty">No drinks logged yet — the stats wake up on the first round. 🍺</p>`);
}

/* ==========================================================================
   WEATHER — live 3-day (Fri/Sat/Sun) summary from Open-Meteo (no key, CORS ok)
   ========================================================================== */
function wxEmoji(c) {
  if (c === 0) return "☀️";
  if (c <= 3) return "⛅";
  if (c <= 48) return "🌫️";
  if (c <= 67) return "🌧️";
  if (c <= 77) return "❄️";
  if (c <= 82) return "🌦️";
  return "⛈️";
}
async function fetchWeather() {
  const el = document.getElementById("weather-days");
  if (!el) return;
  const w = TRIP.weather || {};
  if (!w.lat || !w.lon) { el.innerHTML = ""; return; }
  const labels = ["Fri", "Sat", "Sun"];
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + w.lat + "&longitude=" + w.lon +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=Europe%2FLondon&start_date=" + (w.start || "") + "&end_date=" + (w.end || "");
    const r = await fetch(url);
    if (!r.ok) throw new Error("wx");
    const d = await r.json();
    el.innerHTML = d.daily.time.map((t, i) => {
      const hi = Math.round(d.daily.temperature_2m_max[i]);
      const lo = Math.round(d.daily.temperature_2m_min[i]);
      const rain = d.daily.precipitation_probability_max[i];
      return `<div class="wx-day">
        <span class="wx-d">${labels[i] || t.slice(5)}</span>
        <span class="wx-emoji">${wxEmoji(d.daily.weather_code[i])}</span>
        <span class="wx-temp">${hi}°/${lo}°</span>
        <span class="wx-rain">💧${rain == null ? "–" : rain}%</span>
      </div>`;
    }).join("");
  } catch (e) {
    el.innerHTML = `<span class="muted">🌦️ Birmingham forecast — tap BBC for the latest</span>`;
  }
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
  renderBingo();
  renderRound();
  renderStats();
  renderRecap();
  renderCrew();
}

function tick() {
  renderCountdown();
  renderTripMode();
  renderItinerary();
  renderNowNext();
  renderStats();   // pace / last-hour / projection are time-based → keep live
}

/* ---------- TABBED VIEW: show one section at a time (no giant scroll) ---------- */
const TAB_IDS = ["itinerary", "tracker", "bets", "awards", "bingo", "stats", "recap", "crew"];
function showTab(id) {
  if (TAB_IDS.indexOf(id) === -1) id = "itinerary";
  TAB_IDS.forEach((s) => { const el = document.getElementById(s); if (el) el.style.display = (s === id) ? "" : "none"; });
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.getAttribute("href") === "#" + id));
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}
window.addEventListener("hashchange", () => showTab(location.hash.replace("#", "")));

/* Live "Now / Next" bar — only visible during the trip window. */
function renderNowNext() {
  const bar = document.getElementById("nownext");
  if (!bar) return;
  const now = new Date();
  if (now < TRIP_START || now > TRIP_END) {
    bar.classList.add("hidden");
    document.body.classList.remove("has-nownext");
    return;
  }
  const flat = [];
  ITINERARY.forEach((d) => d.stops.forEach((s) => flat.push(s)));
  let cur = null, next = null;
  for (const s of flat) {
    if (new Date(s.iso) <= now) cur = s;
    else { next = s; break; }
  }
  const nowTxt = cur ? `${cur.emoji} ${escapeHtml(cur.title)}` : "—";
  const nextTxt = next ? `${next.emoji} ${escapeHtml(next.title)} · ${next.t}` : "that's the lot 🎉";
  bar.innerHTML =
    `<span class="nn-seg"><span class="nn-lab">NOW</span>${nowTxt}</span>` +
    `<span class="nn-seg nn-next"><span class="nn-lab">NEXT</span>${nextTxt}</span>`;
  bar.classList.remove("hidden");
  document.body.classList.add("has-nownext");
}

document.getElementById("undo-btn").addEventListener("click", undoLast);
document.getElementById("reset-btn").addEventListener("click", resetAll);
document.getElementById("spin-btn").addEventListener("click", spinRound);
document.getElementById("recap-share").addEventListener("click", shareRecap);
document.getElementById("modal-skip").addEventListener("click", closeWhoamiModal);

/* Add-to-Home-Screen hint — shown once, only when not already installed. */
function maybeShowA2HS() {
  const A2HS_KEY = "thirstyboys.a2hs";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  let dismissed = false;
  try { dismissed = localStorage.getItem(A2HS_KEY) === "1"; } catch (e) { /* ignore */ }
  if (standalone || dismissed || document.getElementById("a2hs")) return;
  const bar = document.createElement("div");
  bar.id = "a2hs";
  bar.innerHTML = `<span class="a2hs-txt">📲 <b>Add to Home Screen</b> — tap Share, then “Add to Home Screen”.</span>
    <button class="a2hs-close" aria-label="Dismiss">✕</button>`;
  bar.querySelector(".a2hs-close").addEventListener("click", () => {
    try { localStorage.setItem(A2HS_KEY, "1"); } catch (e) { /* ignore */ }
    bar.remove();
  });
  document.body.appendChild(bar);
}
setTimeout(maybeShowA2HS, 2500);

/* ---------- PULL-TO-REFRESH — pull down at the top to force a resync. ---------- */
function doPullRefresh() {
  flushOutbox();
  render();
  tick();
  if (typeof checkForUpdate === "function") checkForUpdate(true);
  toast(rtLive() ? "Synced ✓" : (window.THIRSTY_CONFIG && window.THIRSTY_CONFIG.firebase ? "📴 Offline — will sync when connected" : "Saved on this device"));
}
(function pullToRefresh() {
  let startY = 0, pulling = false, ind = null;
  const THRESH = 70;
  function indicator() {
    if (!ind) { ind = document.createElement("div"); ind.className = "ptr"; document.body.appendChild(ind); }
    return ind;
  }
  window.addEventListener("touchstart", (e) => {
    pulling = window.scrollY <= 0 && e.touches.length === 1;
    if (pulling) startY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 4) { if (ind) ind.classList.remove("show"); return; }
    const el = indicator();
    el.classList.add("show");
    el.style.transform = `translateX(-50%) translateY(${Math.min(dy, 80)}px)`;
    el.textContent = dy >= THRESH ? "↑ Release to sync" : "↓ Pull to sync";
  }, { passive: true });
  window.addEventListener("touchend", () => {
    if (!pulling) return;
    pulling = false;
    if (!ind) return;
    const fire = ind.textContent.indexOf("Release") !== -1;
    ind.classList.remove("show");
    ind.style.transform = "";
    if (fire) doPullRefresh();
  }, { passive: true });
})();

/* HQ: copy address (for pasting into a taxi app etc.) */
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

/* ==========================================================================
   BOOT — load the trip config, then wire up state and render.
   ========================================================================== */
function applyTripToDOM() {
  const city = TRIP.city || "The Trip";
  const year = TRIP.year || "";
  document.title = "Thirsty Boys — " + city + (year ? " '" + year : "");
  const h1 = document.querySelector(".hero h1");
  if (h1) h1.innerHTML = escapeHtml(city.toUpperCase()) + (year ? ` <span>'${escapeHtml(year)}</span>` : "");
  const dates = document.querySelector(".hero .dates");
  if (dates && TRIP.datesLabel) dates.textContent = TRIP.datesLabel;
  const foot = document.querySelector(".footer .muted");
  if (foot && TRIP.footerLabel) foot.textContent = "Built for the Thirsty Boys · " + TRIP.footerLabel;
  // HQ card
  if (TRIP.hq) {
    const addr = document.querySelector(".hq-addr");
    if (addr) addr.textContent = TRIP.hq.address || "";
    const lab = document.querySelector(".hq-label");
    if (lab && TRIP.hq.label) lab.textContent = TRIP.hq.label;
    const walk = document.querySelector(".hq-walk");
    if (walk && TRIP.hq.mapsQuery) walk.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(TRIP.hq.mapsQuery) + "&travelmode=walking";
    // Uber home — prefills the destination reliably with coordinates.
    const uber = document.getElementById("hq-uber");
    if (uber && TRIP.hq.lat != null && TRIP.hq.lon != null) {
      uber.href = "https://m.uber.com/ul/?action=setPickup&pickup=my_location"
        + "&dropoff%5Blatitude%5D=" + TRIP.hq.lat
        + "&dropoff%5Blongitude%5D=" + TRIP.hq.lon
        + "&dropoff%5Bnickname%5D=" + encodeURIComponent(TRIP.hq.label || "HQ");
    }
  }
  // Weather link
  if (TRIP.weather && TRIP.weather.bbc) {
    const wc = document.querySelector(".weather-cta");
    if (wc) wc.href = TRIP.weather.bbc;
  }
}

async function boot() {
  applyTrip(await loadTrip());
  state = load();
  outbox = loadOutbox();     // resume any edits parked while offline last time
  lastRoundTs = (state.round && state.round.ts) || 0;  // don't re-celebrate an old verdict on load
  seenBingo = bingoSnapshot();                         // don't re-announce already-spotted squares
  applyLegacyRenames();      // rebrand old default names before first paint
  me = loadMe();
  selectedDrink = loadSelectedDrink();
  applyTripToDOM();

  renderDrinkBar();
  render();
  showTab(location.hash.replace("#", "") || defaultTab());
  tick();
  setInterval(tick, 1000);
  initSync();
  fetchWeather();

  // First thing on first load: ask who you are.
  if (me == null || Number.isNaN(me) || !state.names[me]) openWhoamiModal();

  // Heartbeat: refresh presence every 2 min + on foreground; re-render roster
  // each minute so stale lads slide to "Away".
  setInterval(() => { beat(); renderWhoami(); }, 120000);
  setInterval(renderWhoami, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { beat(); renderWhoami(); } });
}
boot();

/* ==========================================================================
   UPDATE CHECKER — make new deploys stick on Safari, Chrome & the PWA.
   The deploy stamps window.TB_BUILD and version.json with the commit hash.
   We poll version.json (cache: no-store); on mismatch we hard-navigate to a
   cache-busted URL (auto once per new build, otherwise a tap-to-update pill).
   ========================================================================== */
const BUILD = window.TB_BUILD || "dev";
const AUTOUPDATE_KEY = "tb.autoupdated";

/* Register the service worker so the app opens and runs with no signal.
   Skipped on file:// and when the build is unstamped (local dev). */
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && BUILD !== "__" + "BUILD__") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline install fails silently */ });
  });
}

function hardRefresh() {
  // A changed query string bypasses the cached HTML entirely.
  location.replace(location.pathname + "?u=" + Date.now() + location.hash);
}

function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  const el = document.createElement("button");
  el.id = "update-banner";
  el.textContent = "🔄 New version — tap to update";
  el.addEventListener("click", hardRefresh);
  document.body.appendChild(el);
}

async function checkForUpdate(allowAuto) {
  // Unstamped local copies (file:// or dev) have nothing to compare.
  if (BUILD === "__" + "BUILD__" || location.protocol === "file:") return;
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const v = await r.json();
    if (!v.build || v.build === BUILD) return;
    let guarded = false;
    try { guarded = sessionStorage.getItem(AUTOUPDATE_KEY) === v.build; } catch (e) { /* ignore */ }
    if (allowAuto && !guarded) {
      try { sessionStorage.setItem(AUTOUPDATE_KEY, v.build); } catch (e) { /* ignore */ }
      hardRefresh();          // silent refresh — state lives in localStorage/Firebase
    } else {
      showUpdateBanner();     // mid-session or already tried: let them tap
    }
  } catch (e) { /* offline — try again later */ }
}

// On open (only after parsing finishes — replacing the URL mid-parse wedges
// the next page), when the PWA/tab comes back to the foreground, after
// bfcache restores, and every 90s while visible.
function scheduleInitialUpdateCheck() { setTimeout(() => checkForUpdate(true), 1200); }
if (document.readyState !== "loading") scheduleInitialUpdateCheck();
else document.addEventListener("DOMContentLoaded", scheduleInitialUpdateCheck);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForUpdate(true); });
window.addEventListener("pageshow", (e) => { if (e.persisted) checkForUpdate(true); });
setInterval(() => { if (!document.hidden) checkForUpdate(false); }, 90000);
