/* ==========================================================================
   Thirsty Boys — a reskinnable lads'-weekend PWA
   Itinerary, live-now, countdown & drink tracker (localStorage-backed).
   Everything trip-specific lives in assets/trip.json — see below.
   ========================================================================== */

/* ==========================================================================
   TRIP CONFIG — everything trip-specific lives in assets/trip.json.
   Edit that one file (city, dates, crew, HQ, itinerary, local bets, bingo)
   to reuse this whole app for another city/date. Cross-trip "classic" bets
   live in assets/common.json. Loaded at startup.
   ========================================================================== */
let TRIP = {};
let ITINERARY = [], CREW = [], DEFAULT_NAMES = [], BETS = [], BINGO = [], PUBS = [];
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
  { id: "gandt",    label: "G&T",      emoji: "🍹" },
  { id: "shot",     label: "Shot",     emoji: "🍶" },
  { id: "whiskey",  label: "Whiskey",  emoji: "🥃" },
  { id: "soft",     label: "Soft",     emoji: "🧃", soft: true },
  { id: "coffee",   label: "Coffee",   emoji: "☕", soft: true },
];
// Soft drinks & coffee are tracked but DON'T count toward the drinking total.
const BOOZE = DRINKS.filter((d) => !d.soft);
const SOFT = DRINKS.filter((d) => d.soft);
const TITLES = { top: "👑 Thirstiest Boy", zero: "😇 Designated" };

/* Multiple trips can live side by side. assets/trips.json lists them; the
   header dropdown switches between them. Each trip has its own houseCode, so
   switching trip means a fresh room + local store — past trips stay intact. */
const SELECTED_TRIP_KEY = "thirstyboys.trip.selected";
const V = () => "?v=" + (window.TB_BUILD || "dev");

async function loadTripRegistry() {
  try {
    const r = await fetch("assets/trips.json" + V(), { cache: "no-cache" });
    if (r.ok) {
      const reg = await r.json();
      if (reg && Array.isArray(reg.trips) && reg.trips.length) { reg.__fromFile = true; return reg; }
    }
  } catch (e) { /* fall through to single-trip back-compat */ }
  // No registry (or unreadable): behave exactly like before — one trip.json.
  return { default: null, trips: [{ id: "trip", label: "Trip", file: "assets/trip.json" }] };
}
/* Which trip to show: ?trip= in the URL wins (and is remembered), else the
   last picked, else the registry default, else the first listed. */
function pickTripId(reg) {
  const ids = reg.trips.map((t) => t.id);
  let want = null;
  try { want = new URLSearchParams(location.search).get("trip"); } catch (e) { /* ignore */ }
  if (want) { try { localStorage.setItem(SELECTED_TRIP_KEY, want); } catch (e) { /* ignore */ } }
  if (!want) { try { want = localStorage.getItem(SELECTED_TRIP_KEY); } catch (e) { /* ignore */ } }
  if (want && ids.includes(want)) return want;
  if (reg.default && ids.includes(reg.default)) return reg.default;
  return reg.trips[0].id;
}
/* Cross-trip shared config (currently the "classic" bets every trip reuses). */
async function loadCommon() {
  try {
    const r = await fetch("assets/common.json" + V(), { cache: "no-cache" });
    if (r.ok) return await r.json();
  } catch (e) { /* fall through */ }
  return {};
}
async function loadTrip() {
  const reg = await loadTripRegistry();
  const id = pickTripId(reg);
  window.__tripRegistry = reg;
  window.__tripId = id;
  const entry = reg.trips.find((t) => t.id === id) || reg.trips[0];
  try {
    const r = await fetch(entry.file + V(), { cache: "no-cache" });
    if (r.ok) return await r.json();
  } catch (e) { /* offline or missing — fall through to empty */ }
  return {};
}
/* Common (reusable) bets first, then this trip's local bets. Same id in the
   local set overrides the common one in place, so a trip can tweak a classic. */
function mergeBets(common, local) {
  const out = (common || []).map((b) => Object.assign({ scope: "common" }, b));
  (local || []).forEach((b) => {
    const i = out.findIndex((x) => x.id === b.id);
    const tagged = Object.assign({ scope: "local" }, b);
    if (i >= 0) out[i] = tagged; else out.push(tagged);
  });
  return out;
}
function applyTrip(t) {
  TRIP = t || {};
  ITINERARY = TRIP.itinerary || [];
  CREW = (TRIP.crew || []).map((c) => ({ emoji: c.emoji, role: c.role }));
  DEFAULT_NAMES = (TRIP.crew || []).map((c) => c.name);
  // Bets = the shared "classics" (assets/common.json) + this trip's own local
  // bets (venues/activities in trip.json). A local bet with the same id as a
  // classic overrides it in place; otherwise locals are appended.
  BETS = mergeBets((window.__common && window.__common.bets) || [], TRIP.bets || []);
  BINGO = TRIP.bingo || [];
  PUBS = TRIP.pubs || [];
  const d = TRIP.dates || {};
  TRIP_START = new Date((d.start || "1970-01-01T00:00") + ":00");
  TRIP_END = new Date((d.end || "1970-01-01T00:00") + ":00");
  const hc = String(TRIP.houseCode || "trip").replace(/[^a-z0-9_-]/gi, "_");
  STORE_KEY = "thirstyboys." + hc + ".v1";
  OUTBOX_KEY = "thirstyboys." + hc + ".outbox";
  window.__houseCode = hc;
  RESET_PASSWORD = hc.toLowerCase();
  ME_KEY = "thirstyboys." + hc + ".me";   // identity is per-trip (different trips can have different crews)
  HQ_ADDRESS = (TRIP.hq && TRIP.hq.address) || "";
}

/* ---------- STATE ---------- */
let state;

/* ---------- PER-DEVICE IDENTITY (who is holding THIS phone) ----------
   Stored locally only — never synced, so each phone keeps its own "me".
   Scoped per-trip (set in applyTrip) so switching trips can mean a different
   crew / a different you. */
const LEGACY_ME_KEY = "thirstyboys.me";
let ME_KEY = LEGACY_ME_KEY;
let me;
function loadMe() {
  try {
    let v = localStorage.getItem(ME_KEY);
    // One-time migration: adopt a pre-per-trip global "me" for this trip.
    if (v === null && ME_KEY !== LEGACY_ME_KEY) {
      const legacy = localStorage.getItem(LEGACY_ME_KEY);
      if (legacy !== null) { v = legacy; localStorage.setItem(ME_KEY, legacy); }
    }
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
  // Clear the per-trip key AND the legacy global, so a deliberate "change who I am"
  // isn't silently undone by the legacy migration on the next load.
  try { localStorage.removeItem(ME_KEY); localStorage.removeItem(LEGACY_ME_KEY); } catch (e) { /* ignore */ }
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
    quotes: [], // { text, who, ts }
    bingo: {},  // bingoId -> spotter index (synced)
    present: {}, // personIndex -> lastSeen ms (synced: who has joined)
    round: null, // last "whose round" verdict: { winner, by, ts } (synced)
  };
}
/* Firebase collapses collections with sparse/sequential numeric keys into
   arrays (and drops empties), so a room can come back with tallies as an object
   {"2":{...}}, present as an array, etc. Coerce everything back to the shapes
   the app expects — otherwise things like state.tallies.forEach() blow up. */
function normalizeState(s) {
  const n = (Array.isArray(s.names) && s.names.length) || DEFAULT_NAMES.length;
  // tallies → dense array of per-person objects
  const arr = [];
  for (let i = 0; i < n; i++) arr[i] = {};
  if (Array.isArray(s.tallies)) s.tallies.forEach((t, i) => { if (t && i < n) arr[i] = t; });
  else if (s.tallies && typeof s.tallies === "object") {
    Object.keys(s.tallies).forEach((k) => { const i = Number(k); if (!isNaN(i) && i >= 0 && i < n) arr[i] = s.tallies[k] || {}; });
  }
  s.tallies = arr;
  // log → array of {id,who,drink,ts}. Firebase stores entries as keyed children
  // (so concurrent logs merge); the key IS the entry id. Coerce either shape,
  // backfill an id for any legacy entry, and sort chronologically since object
  // key order isn't guaranteed.
  if (Array.isArray(s.log)) {
    s.log = s.log.filter(Boolean).map((e, i) => (e && e.id != null) ? e : Object.assign({ id: "legacy-" + (e && e.ts ? e.ts : "0") + "-" + i }, e));
  } else if (s.log && typeof s.log === "object") {
    s.log = Object.keys(s.log).map((k) => Object.assign({ id: k }, s.log[k]));
  } else {
    s.log = [];
  }
  s.log.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (!Array.isArray(s.quotes)) s.quotes = s.quotes ? Object.keys(s.quotes).map((k) => s.quotes[k]) : [];
  // present → object { index: lastSeen }
  if (Array.isArray(s.present)) { const o = {}; s.present.forEach((v, i) => { if (v != null) o[i] = v; }); s.present = o; }
  else if (!s.present || typeof s.present !== "object") s.present = {};
  // bingo / bets → objects
  if (!s.bingo || typeof s.bingo !== "object") s.bingo = {};
  if (!s.bets || typeof s.bets !== "object") s.bets = {};
  return s;
}
function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeState(Object.assign(base, JSON.parse(raw)));
  } catch (e) { /* ignore */ }
  return base;
}
function save() {
  // Local cache only. Remote writes are granular (see rtSet/rtAdd) so two
  // phones acting at once never clobber each other's whole state.
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* ==========================================================================
   FIREBASE SYNC (optional — shared live state across all phones)
   Enabled only when assets/config.js has a Firebase config with a databaseURL.
   Falls back silently to per-device localStorage otherwise.
   ========================================================================== */
let syncRef = null;
let applyingRemote = false;   // guards against echoing remote updates back
let presencePushed = false;   // only announce "I'm in" once per load

let lastSyncText = "", lastSyncCls = "";
function setSyncStatus(text, cls) {
  lastSyncText = text; lastSyncCls = cls || "";
  // Detailed line inside the Drinks tab.
  const el = document.getElementById("sync-status");
  if (el) { el.textContent = text; el.className = "sync-status " + (cls || ""); }
  updateNetPill();
}

/* How many crew are online right now (heartbeat seen within FRESH_MS). */
function connectedCount() {
  const now = Date.now(), p = state && state.present ? state.present : {};
  return (state ? state.names : []).reduce((n, _, i) => n + (p[i] && (now - p[i] < FRESH_MS) ? 1 : 0), 0);
}
/* Compact, always-visible connection pill — shows connection + head-count. */
function updateNetPill() {
  const net = document.getElementById("net-status");
  if (!net) return;
  const cls = lastSyncCls;
  const connecting = /connect/i.test(lastSyncText) && cls !== "on";
  const syncing = /Syncing/i.test(lastSyncText);
  let label;
  if (connecting) label = "Connecting…";
  else if (syncing) label = "Syncing…";
  else if (cls === "on") { const n = connectedCount(); label = n > 0 ? n + " online" : "Connected"; }
  else if (cls === "err") label = "Sync issue";
  else label = "Offline";
  net.className = "net-status " + (cls || "off");
  net.innerHTML = `<span class="net-dot"></span>${label}`;
  const pop = document.getElementById("net-pop");
  if (pop) renderNetPop(pop);       // keep an open "who's here" list fresh
}
function renderNetPop(pop) {
  pop.innerHTML = `<div class="net-pop-title">Who's connected</div>${rosterHtml()}`;
}
function toggleNetPop() {
  const existing = document.getElementById("net-pop");
  if (existing) { existing.remove(); document.removeEventListener("click", closeNetPopOutside); return; }
  const pop = document.createElement("div");
  pop.id = "net-pop";
  pop.className = "net-pop";
  renderNetPop(pop);
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener("click", closeNetPopOutside), 0);
}
function closeNetPopOutside(e) {
  const pop = document.getElementById("net-pop");
  if (!pop) { document.removeEventListener("click", closeNetPopOutside); return; }
  if (!pop.contains(e.target) && !(e.target.closest && e.target.closest("#net-status"))) {
    pop.remove();
    document.removeEventListener("click", closeNetPopOutside);
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
function rtClaim(path, value) {               // set only if empty — first writer wins
  if (applyingRemote) return;
  if (rtLive()) { try { syncRef.child(path).transaction((v) => (v == null ? value : v)); return; } catch (e) { /* fall through */ } }
  enqueue({ op: "claim", path: path, value: value });
}
function seedRemote() {                        // full-room overwrite (reset / first seed)
  const snapshot = JSON.parse(JSON.stringify(state));
  // Seed the log as keyed children (not an array) so later per-entry writes
  // merge with it instead of fighting an array shape.
  const logObj = {};
  (state.log || []).forEach((e) => { if (e && e.id != null) logObj[e.id] = { who: e.who, drink: e.drink, ts: e.ts }; });
  snapshot.log = logObj;
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
      else if (o.op === "claim") syncRef.child(o.path).transaction((v) => (v == null ? o.value : v));
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
      if (connected) { flushOutbox(); beat(); }   // re-stamp presence on every (re)connect
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
      // Firebase may return collections as arrays/objects and drop empties;
      // normaliseState coerces everything back to the shapes the app expects.
      state = normalizeState(Object.assign(defaults(), remote));
      applyingRemote = false;
      applyLegacyRenames();     // rebrand any old default name in the shared room
      save();     // remote is now the local truth too (outbox still holds any un-synced edits)
      // Any edits made while offline are in the outbox — push them now so this
      // snapshot's overwrite doesn't lose them.
      flushOutbox();
      // Keep MY own presence fresh locally so a stale server snapshot can't
      // make me read as "Away" the moment I connect; the heartbeat (+ beat on
      // connect) writes it out so the others see me too.
      if (me != null && !Number.isNaN(me) && state.names[me]) {
        state.present = state.present || {};
        state.present[me] = Date.now();
        if (!presencePushed) { presencePushed = true; rtSet("present/" + me, state.present[me]); }
      }
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
function countFor(i) {   // the drinking count — BOOZE only (soft/coffee excluded)
  const tally = state.tallies[i] || {};
  return BOOZE.reduce((sum, d) => sum + (tally[d.id] || 0), 0);
}
function softCountFor(i) {   // soft drinks + coffees, tracked separately
  const tally = state.tallies[i] || {};
  return SOFT.reduce((sum, d) => sum + (tally[d.id] || 0), 0);
}
function drinkById(id) { return DRINKS.find((d) => d.id === id); }
function isSoft(id) { const d = drinkById(id); return !!(d && d.soft); }

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
      // Compact icon-only action links so the row never wraps the nav.
      const map = s.map
        ? `<a class="ic" title="Open in Maps" aria-label="Open in Maps" href="https://www.google.com/maps/search/${encodeURIComponent(s.map)}" target="_blank" rel="noopener">📍</a>`
        : "";
      // Uber prefills the destination reliably only with coordinates, so use
      // them when we have them; otherwise fall back to Maps directions.
      const uber = (s.lat != null && s.lon != null)
        ? `<a class="ic" title="Uber here" aria-label="Uber here" href="https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff%5Blatitude%5D=${s.lat}&dropoff%5Blongitude%5D=${s.lon}&dropoff%5Bnickname%5D=${encodeURIComponent(s.title)}" target="_blank" rel="noopener">🚕</a>`
        : (s.map ? `<a class="ic" title="Directions" aria-label="Directions" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.map)}" target="_blank" rel="noopener">🚕</a>` : "");
      const menu = s.menu
        ? `<a class="ic" title="Menu" aria-label="Menu" href="${escapeAttr(s.menu)}" target="_blank" rel="noopener">🍽️</a>`
        : "";
      const insta = s.insta
        ? `<a class="ic link-insta" title="Instagram" aria-label="Instagram" href="${escapeAttr(s.insta)}" target="_blank" rel="noopener">📸</a>`
        : "";
      const tags = (tag || map || uber || menu || insta) ? `<div class="stop-tags">${tag}${map}${uber}${menu}${insta}</div>` : "";

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
    const cd = document.getElementById("countdown"); if (cd) cd.classList.remove("live");
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
    // The scoreboard speaks for itself — no green caption cluttering the hero.
    cap.textContent = now <= TRIP_END ? "" : "🏁 Final tally. Legends, all of you.";
    cap.classList.toggle("live", now > TRIP_END);
    const cd = document.getElementById("countdown"); if (cd) cd.classList.add("live");
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
  // During the trip: LIVE hero with just the live stats. Now/Next lives in the
  // fixed bottom bar, so it isn't duplicated up here.
  if (kicker) kicker.textContent = "🔴 LIVE · " + now.toLocaleDateString([], { weekday: "long" });
  if (!live) return;
  live.classList.remove("hidden");
  const log = (state.log || []).filter((e) => e && e.ts && !isSoft(e.drink));
  const lastHour = log.filter((e) => Date.now() - e.ts <= 3600000).length;
  const pace = paceState(Date.now());
  const paceSeg = pace ? `<span class="hl-pace pace-${pace.cls}">${pace.label}</span>` : "";
  live.innerHTML =
    `<div class="hl-stats"><span>🍺 ${total}</span><span>👑 ${escapeHtml(topName())}</span><span>🔥 ${lastHour} last hr</span>${paceSeg}</div>`;
}
function topName() {
  const rows = state.names.map((n, i) => ({ n, c: countFor(i) })).sort((a, b) => b.c - a.c);
  return rows[0] && rows[0].c > 0 ? rows[0].n : "—";
}
/* Which tab opens by default depends on the trip phase. */
function defaultTab() {
  const now = new Date();
  if (now > TRIP_END) return "recap";                       // after: the wrap-up
  if (now >= TRIP_START) return "tracker";                  // live: land on Drinks
  return "itinerary";                                       // before: the plan
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
  updateNetPill();       // head-count changes as presence updates
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
  grid.innerHTML = state.names.map((n, i) => {
    const tally = state.tallies[i] || {};
    const breakdown = DRINKS.filter((d) => tally[d.id])
      .map((d) => `${d.emoji}${tally[d.id]}`).join("  ") || "—";
    const isYou = i === me;
    // Tap the exact drink for THIS person — logs their drink, not yours.
    const drinkBtns = DRINKS.map((d) => `<button class="person-drink" data-i="${i}" data-drink="${d.id}" title="Add ${d.label}" aria-label="Add ${d.label} for ${escapeAttr(n)}">${d.emoji}</button>`).join("");
    return `
      <div class="person ${isYou ? "you" : ""}">
        <div class="person-name-static">${escapeHtml(n)}${isYou ? `<span class="you-tag">You</span>` : ""}</div>
        <div class="person-count">${countFor(i)}</div>
        <div class="person-count-lab">${countFor(i) === 1 ? "drink" : "drinks"}</div>
        <div class="person-drinks">${drinkBtns}</div>
        <div class="person-mini">${breakdown}</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".person-drink").forEach((btn) =>
    btn.addEventListener("click", () => addDrinkFor(Number(btn.dataset.i), btn.dataset.drink))
  );
}

/* ==========================================================================
   RENDER: LOG
   ========================================================================== */
function renderLog() {
  const ul = document.getElementById("log");
  if (!ul) return;
  const countEl = document.getElementById("log-count");
  if (countEl) countEl.textContent = state.log.length ? " (" + state.log.length + ")" : "";
  if (!state.log.length) {
    ul.innerHTML = `<li class="log-empty">No drinks logged yet. Get thirsty.</li>`;
    return;
  }
  // Full audit log — every drink, newest first, with who / what / when.
  ul.innerHTML = state.log.slice().reverse().map((e) => {
    const d = drinkById(e.drink);
    const dt = new Date(e.ts);
    const when = dt.toLocaleDateString([], { weekday: "short" }) + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `<li><span class="log-who">${d ? d.emoji : "🍺"} ${escapeHtml(state.names[e.who] || "?")} — ${d ? d.label : escapeHtml(String(e.drink))}</span><span class="log-when">${escapeHtml(when)}</span></li>`;
  }).join("");
  drinkNotify();     // buzz + banner every phone when a new drink lands
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
// Unique id for each log entry so it can be written as its OWN child in
// Firebase — concurrent logs then merge instead of clobbering the whole array.
let logSeq = 0;
function newLogId() { return Date.now().toString(36) + "-" + (logSeq++).toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
function logAdd(entry) {
  state.log.push(entry);
  if (state.log.length > 400) state.log = state.log.slice(-400);
  // Granular child write — never overwrites another device's entries.
  rtSet("log/" + entry.id, { who: entry.who, drink: entry.drink, ts: entry.ts });
}
function addDrink(i) { addDrinkFor(i, selectedDrink); }   // "quick add for me" path
function addDrinkFor(i, id) {
  if (!id) id = selectedDrink;
  const prevLeader = currentLeader();
  state.tallies[i] = state.tallies[i] || {};
  state.tallies[i][id] = (state.tallies[i][id] || 0) + 1;
  logAdd({ id: newLogId(), who: i, drink: id, ts: Date.now() });
  save();
  // Both the count (delta) and the log entry (its own child) are concurrency-safe
  // online, and queue safely offline.
  rtAdd("tallies/" + i + "/" + id, 1);
  render();
  // Celebrate: small burst from the button; big fanfare when the crown changes.
  const btn = document.querySelector('.person-drink[data-i="' + i + '"][data-drink="' + id + '"]') || document.querySelector('.person-add[data-i="' + i + '"]');
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
  if (entry.id != null) rtRemove("log/" + entry.id);
  render();
}

/* ---------- ADMIN: edit anyone's drinks (password-gated) ----------
   Adjusts a person's count for a specific drink by ±1, keeping the log in step
   so stats/undo stay consistent. Uses delta writes so it's sync-safe. */
let adminUnlocked = false;
function adminAdjust(i, drinkId, delta) {
  state.tallies[i] = state.tallies[i] || {};
  const cur = state.tallies[i][drinkId] || 0;
  const next = Math.max(0, cur + delta);
  if (next === cur) return;                     // nothing to do (already 0)
  state.tallies[i][drinkId] = next;
  if (delta > 0) {
    logAdd({ id: newLogId(), who: i, drink: drinkId, ts: Date.now() });
  } else {
    for (let k = state.log.length - 1; k >= 0; k--) {
      if (state.log[k].who === i && state.log[k].drink === drinkId) {
        const removed = state.log.splice(k, 1)[0];
        if (removed && removed.id != null) rtRemove("log/" + removed.id);
        break;
      }
    }
  }
  save();
  rtAdd("tallies/" + i + "/" + drinkId, next - cur);
  render();
}
function toggleAdmin() {
  if (!adminUnlocked) {
    const pw = prompt("Admin — edit everyone's drinks.\nEnter the password:");
    if (pw == null) return;
    if (pw.trim().toLowerCase() !== RESET_PASSWORD) { alert("Wrong password."); return; }
    adminUnlocked = true;
  } else {
    adminUnlocked = false;   // tapping again hides the editor
  }
  renderAdminEditor();
}
function renderAdminEditor() {
  const box = document.getElementById("admin-editor");
  if (!box) return;
  const btn = document.getElementById("admin-btn");
  if (!adminUnlocked) {
    box.classList.add("hidden");
    box.innerHTML = "";
    if (btn) btn.textContent = "✏️ Edit drinks";
    return;
  }
  if (btn) btn.textContent = "✅ Done editing";
  box.classList.remove("hidden");
  box.innerHTML =
    `<p class="admin-note">✏️ Admin edit — adjust anyone's drinks. Changes sync to everyone.</p>` +
    state.names.map((n, i) => `
      <div class="admin-person">
        <div class="admin-person-head"><span>${escapeHtml(n)}</span><span class="admin-total">${countFor(i)}</span></div>
        <div class="admin-drinks">
          ${DRINKS.map((d) => {
            const c = (state.tallies[i] || {})[d.id] || 0;
            return `<div class="admin-chip ${c ? "has" : ""}">
              <button class="admin-step" data-i="${i}" data-drink="${d.id}" data-delta="-1" aria-label="minus" ${c ? "" : "disabled"}>−</button>
              <span class="admin-c">${d.emoji} ${c}</span>
              <button class="admin-step" data-i="${i}" data-drink="${d.id}" data-delta="1" aria-label="plus">+</button>
            </div>`;
          }).join("")}
        </div>
      </div>`).join("");
  box.querySelectorAll(".admin-step").forEach((b) =>
    b.addEventListener("click", () => adminAdjust(Number(b.dataset.i), b.dataset.drink, Number(b.dataset.delta)))
  );
}

/* The admin/reveal password is simply the house code — one word to remember,
   and it rotates automatically each trip (set in applyTrip). */
let RESET_PASSWORD = "reset";

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
  // Full wipe: drinks, names, bets, quotes and the presence roster.
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
/* Tap the ⓘ or the "Projected by Sun" tile to explain the projection model. */
document.addEventListener("click", (e) => {
  if (!e.target.closest) return;
  if (!e.target.closest(".chart-info-btn, .stat-tile.hot")) return;
  modelInfoOpen = !modelInfoOpen;
  const panel = document.getElementById("model-info");
  if (panel) panel.classList.toggle("open", modelInfoOpen);
});
/* Toggle the chart between group total and a line per person. */
document.addEventListener("click", (e) => {
  if (!e.target.closest || !e.target.closest(".chart-mode-btn")) return;
  chartMode = chartMode === "group" ? "person" : "group";
  try { localStorage.setItem("thirstyboys.chartmode", chartMode); } catch (err) { /* ignore */ }
  if (typeof renderStats === "function") renderStats();
});

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
/* Did a call match the result? Handles the "none" (didn't happen / nobody) case. */
function betHit(type, call, result) {
  if (result === "" || result == null) return false;
  if (type === "person") {
    if (result === "none") return call === "none";        // both said it wouldn't happen
    return call != null && call !== "" && call !== "none" && Number(call) === Number(result);
  }
  return String(call).trim().toLowerCase() === String(result).trim().toLowerCase();
}
function betScores() {
  const scores = state.names.map(() => 0);
  BETS.forEach((bet) => {
    const b = getBet(bet.id);
    if (!b.revealed || b.result === "" || b.result == null) return;
    Object.keys(b.calls).forEach((voter) => {
      if (betHit(bet.type, b.calls[voter], b.result) && scores[voter] != null) scores[Number(voter)]++;
    });
  });
  return scores;
}
/* Richer bet stats: correct calls, how many settled bets each person actually
   called (for accuracy), and how many bets are settled so far. */
function betStats() {
  const correct = betScores();
  const called = state.names.map(() => 0);
  let settled = 0;
  BETS.forEach((bet) => {
    const b = getBet(bet.id);
    if (!(b.revealed && b.result !== "" && b.result != null)) return;
    settled++;
    Object.keys(b.calls).forEach((v) => { if (b.calls[v] != null && b.calls[v] !== "") called[Number(v)]++; });
  });
  return { correct, called, settled };
}

function renderBets() {
  const wrap = document.getElementById("bets-list");
  const claimed = hasClaimed();
  const total = state.names.length;

  // Bet standings — ranked leaderboard with accuracy (only once bets settle).
  const bs = betStats();
  let scoreboard = "";
  if (bs.settled > 0) {
    const rows = state.names.map((n, i) => ({ n, c: bs.correct[i], t: bs.called[i], acc: bs.called[i] ? bs.correct[i] / bs.called[i] : 0 }))
      .sort((a, b) => (b.c - a.c) || (b.acc - a.acc));
    const medal = ["🥇", "🥈", "🥉"];
    const maxC = Math.max(1, ...rows.map((r) => r.c));
    const list = rows.map((r, idx) => `
      <div class="bet-stat-row">
        <span class="bs-rank">${medal[idx] || (idx + 1) + "."}</span>
        <span class="bs-name">${escapeHtml(r.n)}</span>
        <span class="bs-bar-wrap"><span class="bs-bar" style="width:${(r.c / maxC) * 100}%"></span></span>
        <span class="bs-score"><b>${r.c}</b><small>/${r.t}</small>${r.t ? ` · ${Math.round(r.acc * 100)}%` : ""}</span>
      </div>`).join("");
    const elig = rows.filter((r) => r.t >= 2);
    const oracle = elig.length ? elig.slice().sort((a, b) => (b.acc - a.acc) || (b.c - a.c))[0] : null;
    const chancer = rows.slice().sort((a, b) => b.t - a.t)[0];
    const supers = [];
    if (oracle && oracle.acc > 0) supers.push(`🔮 Oracle: <b>${escapeHtml(oracle.n)}</b> ${Math.round(oracle.acc * 100)}%`);
    if (chancer && chancer.t > 0) supers.push(`🎲 Most calls: <b>${escapeHtml(chancer.n)}</b> (${chancer.t})`);
    scoreboard = `<div class="bet-scoreboard bet-stats">
      <div class="bet-stats-h">🎯 Bet standings <span>· ${bs.settled} settled · right/called</span></div>
      ${list}
      ${supers.length ? `<div class="bet-supers">${supers.join(" · ")}</div>` : ""}
    </div>`;
  }

  // Your own progress: how many you've called vs still need to call.
  const myProg = claimed ? progressBar(
    BETS.filter((bt) => { const bb = getBet(bt.id); return bb.calls[me] != null && bb.calls[me] !== ""; }).length,
    BETS.length, "called", "call") : "";

  // Bets are listed in the chronological order of the weekend (see trip.json),
  // so swiping through them mirrors how the day unfolds — TOCA before disc golf,
  // Sunday's "first out of bed" near the end, whole-trip totals last.
  const orderedBets = BETS;

  // Bulk "reveal everything that's been settled" — reveals every bet that has an
  // outcome logged but isn't revealed yet (one password prompt for the lot).
  const settledUnrevealed = BETS.filter((bt) => { const bb = getBet(bt.id); return !bb.revealed && bb.result !== "" && bb.result != null; });
  const revealAll = settledUnrevealed.length
    ? `<button class="btn-add reveal-all" id="bets-reveal-all">👁 Reveal all ${settledUnrevealed.length} settled bet${settledUnrevealed.length === 1 ? "" : "s"}</button>`
    : "";

  const prevScroll = (document.getElementById("bets-deck") || {}).scrollLeft || 0;
  wrap.innerHTML = scoreboard + myProg + revealAll + deckWrap(orderedBets.map((bet) => {
    const b = getBet(bet.id);
    const callCount = Object.keys(b.calls).length;
    const mineIn = claimed && b.calls[me] != null && b.calls[me] !== "";
    const cardCls = b.revealed ? "is-revealed" : (!claimed ? "" : (mineIn ? "mine-done" : "mine-todo"));
    const mark = b.revealed ? `<span class="mine-mark revealed">👁 Revealed</span>`
      : (!claimed ? "" : (mineIn ? `<span class="mine-mark done">✅ Called</span>` : `<span class="mine-mark todo">◻️ Your call needed</span>`));
    let body;
    // The actual result can be logged at ANY time — settle it the moment it
    // happens on the trip. Revealing only controls whether everyone's CALLS
    // are shown, so the same result control appears before and after reveal.
    const resultCtl = bet.type === "person"
      ? `<select class="award-select" data-bet-result="${bet.id}">
           <option value="">— what actually happened —</option>` +
         state.names.map((n, i) => `<option value="${i}" ${String(b.result) === String(i) ? "selected" : ""}>${escapeHtml(n)}</option>`).join("") +
         `<option value="none" ${b.result === "none" ? "selected" : ""}>🚫 Didn't happen / nobody</option>` +
         `</select>`
      : `<input type="text" class="bet-result-input" data-bet-result="${bet.id}" value="${escapeAttr(b.result || "")}" placeholder="actual result…" maxlength="40" />`;
    const hasResult = b.result !== "" && b.result != null;

    if (b.revealed) {
      // Everyone's calls on the table + settle the result
      const rows = state.names.map((n, i) => {
        const call = b.calls[i];
        const callTxt = call == null || call === ""
          ? `<span class="bet-nocall">no call</span>`
          : call === "none" ? `🚫 Won't happen`
          : bet.type === "person" ? escapeHtml(state.names[call] || "?") : escapeHtml(String(call));
        const hit = hasResult && betHit(bet.type, call, b.result);
        return `<div class="bet-call-row ${hit ? "hit" : ""}">
          <span class="bet-caller">${escapeHtml(n)}</span>
          <span class="bet-callval">${callTxt}${hit ? " ✅" : ""}</span>
        </div>`;
      }).join("");
      body = `${rows}
        <div class="bet-result"><label>✅ Actual result</label>${resultCtl}</div>
        <button class="btn-ghost bet-reopen" data-bet="${bet.id}">↩ Re-open calls</button>`;
    } else if (!claimed) {
      body = `<p class="award-hint">👆 Claim who you are (top of the Drinks tab) to make your call.</p>
        <p class="award-status">🤙 ${callCount}/${total} called${hasResult ? " · result logged 🔒" : ""}</p>`;
    } else {
      const mine = b.calls[me];
      const editing = betEditCall.has(bet.id);
      // CALL ZONE — show the picker until you've called; then collapse it to a
      // tidy "your call" line with an Edit button (re-opens the picker).
      let callZone;
      if (!mineIn || editing) {
        const ctl = bet.type === "person"
          ? `<select class="award-select" data-bet-call="${bet.id}">
               <option value="">— call it —</option>` +
             state.names.map((n, i) => `<option value="${i}" ${String(mine) === String(i) ? "selected" : ""}>${escapeHtml(n)}</option>`).join("") +
             `<option value="none" ${mine === "none" ? "selected" : ""}>🚫 Won't happen</option>` +
             `</select>`
          : `<input type="text" class="bet-result-input" data-bet-call="${bet.id}" value="${escapeAttr(mine == null ? "" : String(mine))}" placeholder="call it… (e.g. 2-1)" maxlength="30" />`;
        callZone = `${ctl}<button class="btn-add bet-submit" data-bet="${bet.id}">${mineIn ? "✅ Update call" : "✅ Submit call"}</button>`;
      } else {
        // Keep the pick itself hidden (even from you at a glance) — tap Edit to see/change it.
        callZone = `<div class="bet-yourcall"><span>🔒 Your call's locked in</span>
          <button class="btn-ghost bet-editcall" data-bet="${bet.id}">✏️ Edit call</button></div>`;
      }
      // OUTCOME ZONE — only appears when you ask for it (or a result's logged).
      const showOutcome = betEnterOutcome.has(bet.id) || hasResult;
      const outcomeZone = showOutcome
        ? `<div class="bet-result pre-reveal"><label>✅ Actual result <span class="bet-result-hint">— logged; calls stay secret</span></label>${resultCtl}
             ${hasResult ? `<p class="bet-locked">🔒 Result logged — hits hidden until you reveal</p>` : ""}</div>`
        : `<button class="btn-ghost bet-enteroutcome" data-bet="${bet.id}">🏁 Enter outcome</button>`;
      body = `${callZone}
        <p class="award-status">🤙 ${callCount}/${total} called</p>
        ${outcomeZone}
        <button class="btn-ghost bet-reveal" data-bet="${bet.id}">👁 Reveal calls</button>`;
    }

    return `<div class="bet-card ${cardCls}">${mark}<p class="bet-q"><span class="emoji">${bet.emoji}</span> ${bet.q}</p>${body}</div>`;
  }).join(""), "bets-deck");

  // Picking/typing saves silently as a safety net; the card stays on the picker
  // so the explicit "Submit call" button is what locks it in and collapses it.
  function saveCall(id, v) {
    const b = getBet(id);
    if (v === "") { delete b.calls[me]; rtRemove("bets/" + id + "/calls/" + me); }
    else { b.calls[me] = (BETS.find((x) => x.id === id).type === "person" && v !== "none") ? Number(v) : v; rtSet("bets/" + id + "/calls/" + me, b.calls[me]); }
    state.bets[id] = b;
    save();
  }
  wrap.querySelectorAll("[data-bet-call]").forEach((el) =>
    el.addEventListener("change", () => saveCall(el.dataset.betCall, el.value))
  );
  wrap.querySelectorAll(".bet-submit").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.bet;
      const el = wrap.querySelector('[data-bet-call="' + id + '"]');
      if (el) saveCall(id, el.value);   // read the current value (covers text inputs that never blurred)
      betEditCall.delete(id);
      renderBets();
    })
  );
  wrap.querySelectorAll(".bet-editcall").forEach((btn) =>
    btn.addEventListener("click", () => { betEditCall.add(btn.dataset.bet); renderBets(); })
  );
  wrap.querySelectorAll(".bet-enteroutcome").forEach((btn) =>
    btn.addEventListener("click", () => { betEnterOutcome.add(btn.dataset.bet); renderBets(); })
  );
  wrap.querySelectorAll("[data-bet-result]").forEach((el) =>
    el.addEventListener("change", () => {
      const id = el.dataset.betResult, b = getBet(id);
      b.result = el.value === "" ? "" : ((BETS.find((x) => x.id === id).type === "person" && el.value !== "none") ? Number(el.value) : el.value);
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
  const revealAllBtn = document.getElementById("bets-reveal-all");
  if (revealAllBtn) revealAllBtn.addEventListener("click", () => {
    if (!settledUnrevealed.length) return;
    if (!confirmReveal(`all ${settledUnrevealed.length} settled bets' calls`)) return;
    settledUnrevealed.forEach((bt) => { const b = getBet(bt.id); b.revealed = true; state.bets[bt.id] = b; rtSet("bets/" + bt.id + "/revealed", true); });
    save();
    renderBets();
  });
  wrap.querySelectorAll(".bet-reopen").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.bet, b = getBet(id);
      b.revealed = false; state.bets[id] = b; save(); rtSet("bets/" + id + "/revealed", false); renderBets();
    })
  );
  wireDeck("bets-deck", prevScroll);
  safe(renderBragging);   // keep the funny-stats card in sync with settled bets
}

/* ==========================================================================
   RENDER: SUNDAY RECAP ("wrapped") + share
   ========================================================================== */
/* ==========================================================================
   BEEF & BRAGGING — funny stats mined from the settled bets.
   ========================================================================== */
function braggingData() {
  const correct = betScores();                          // right calls per person (settled bets)
  const called = state.names.map(() => 0);              // bets each person actually called
  BETS.forEach((bet) => {
    const b = getBet(bet.id);
    if (!b.revealed || b.result === "" || b.result == null) return;
    Object.keys(b.calls).forEach((v) => { if (b.calls[v] != null && b.calls[v] !== "") called[Number(v)]++; });
  });
  const nSettled = BETS.filter((bet) => { const b = getBet(bet.id); return b.revealed && b.result !== "" && b.result != null; }).length;
  return { correct, called, nSettled };
}
/* names tied at the max (or min) of a numeric array → { names:[], val } */
function extremeNames(arr, wantMax) {
  const vals = arr.slice();
  const target = wantMax ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
  const names = state.names.filter((_, i) => vals[i] === target);
  return { names, val: target };
}
function renderBragging() {
  const el = document.getElementById("bragging");
  if (!el) return;
  const d = braggingData();
  const rows = [];

  // 🎯 Who's got the most bets right — a compact ranked line answers "how many did anyone get right".
  if (d.nSettled > 0) {
    const order = state.names.map((n, i) => ({ n, c: d.correct[i], t: d.called[i] }))
      .sort((a, b) => b.c - a.c);
    const best = extremeNames(d.correct, true);
    if (best.val > 0) rows.push(`<div class="brag-row"><span class="brag-emoji">🎯</span><span class="brag-txt"><b>Sharpest caller:</b> ${escapeHtml(best.names.join(" & "))} — ${best.val} right</span></div>`);
    rows.push(`<div class="brag-mini">${order.map((r) => `<span>${escapeHtml(r.n)} <b>${r.c}</b>${r.t ? `/${r.t}` : ""}</span>`).join("")}</div>`);
    // 🤡 fewest right (only worth showing once a few bets are settled)
    if (d.nSettled >= 3) {
      const worst = extremeNames(d.correct, false);
      if (worst.val < best.val) rows.push(`<div class="brag-row"><span class="brag-emoji">🤡</span><span class="brag-txt"><b>Worst tipster:</b> ${escapeHtml(worst.names.join(" & "))} — ${worst.val} right</span></div>`);
    }
  }

  if (!rows.length) {
    el.innerHTML = `<div class="brag-card"><h3 class="brag-h">🎭 Beef &amp; Bragging</h3><p class="brag-empty">Settle a few bets and reveal the calls — the gossip unlocks here. 🍿</p></div>`;
    return;
  }
  el.innerHTML = `<div class="brag-card"><h3 class="brag-h">🎭 Beef &amp; Bragging</h3>${rows.join("")}</div>`;
}

function recapData() {
  const rows = state.names.map((n, i) => ({ n, i, c: countFor(i) })).sort((a, b) => b.c - a.c);
  const total = rows.reduce((s, r) => s + r.c, 0);
  const crew = state.names.length || 1;
  const perHead = total / crew;
  const maxC = Math.max(0, ...rows.map((r) => r.c));
  const thirstiest = maxC > 0 ? rows.filter((r) => r.c === maxC).map((r) => r.n).join(" & ") : null;

  // Per-drink group totals → breakdown chips + group favourite + hydration.
  const byDrink = {};
  (state.tallies || []).forEach((t) => { if (t) Object.keys(t).forEach((k) => { byDrink[k] = (byDrink[k] || 0) + (t[k] || 0); }); });
  const boozeBreak = BOOZE.filter((dk) => byDrink[dk.id] > 0).map((dk) => ({ emoji: dk.emoji, n: byDrink[dk.id] })).sort((a, b) => b.n - a.n);
  const favBooze = boozeBreak[0] ? { emoji: boozeBreak[0].emoji, n: boozeBreak[0].n } : null;
  const softTotal = SOFT.reduce((s, dk) => s + (byDrink[dk.id] || 0), 0);

  // Time-based (booze log): biggest single hour + per-day split.
  const blog = (state.log || []).filter((e) => e && e.ts && !isSoft(e.drink));
  const buckets = {}, perDay = {};
  blog.forEach((e) => {
    const dt = new Date(e.ts);
    const hk = dt.toLocaleDateString([], { weekday: "short" }) + " " + String(dt.getHours()).padStart(2, "0") + ":00";
    buckets[hk] = (buckets[hk] || 0) + 1;
    const dk = dt.toLocaleDateString([], { weekday: "short" });
    perDay[dk] = (perDay[dk] || 0) + 1;
  });
  let bigHour = "", bigN = 0;
  Object.keys(buckets).forEach((k) => { if (buckets[k] > bigN) { bigN = buckets[k]; bigHour = k; } });
  const days = ["Fri", "Sat", "Sun"].filter((d) => perDay[d]).map((d) => ({ d, n: perDay[d] }));

  // Bets: most correct (pundit) + best accuracy (oracle).
  const bstats = betStats();
  const maxS = Math.max(0, ...bstats.correct);
  const pundit = maxS > 0 ? state.names.filter((n, i) => bstats.correct[i] === maxS).join(" & ") : null;
  const elig = state.names.map((n, i) => ({ n, acc: bstats.called[i] ? bstats.correct[i] / bstats.called[i] : 0, t: bstats.called[i] })).filter((x) => x.t >= 2 && x.acc > 0);
  const oracle = elig.length ? elig.sort((a, b) => b.acc - a.acc)[0] : null;

  // Bingo: total + top spotter.
  const bingoN = BINGO.filter((x) => state.bingo && state.bingo[x.id] != null).length;
  const bingoBy = {};
  Object.keys(state.bingo || {}).forEach((id) => { const w = state.bingo[id]; if (w != null) bingoBy[w] = (bingoBy[w] || 0) + 1; });
  let bingoTop = null, bingoTopN = 0;
  Object.keys(bingoBy).forEach((w) => { if (bingoBy[w] > bingoTopN) { bingoTopN = bingoBy[w]; bingoTop = state.names[w]; } });

  // First round of the weekend + who closed it out (last drink logged).
  const sortedBooze = blog.slice().sort((a, b) => a.ts - b.ts);
  const firstRound = sortedBooze.length ? state.names[sortedBooze[0].who] : null;
  const lastStanding = sortedBooze.length ? state.names[sortedBooze[sortedBooze.length - 1].who] : null;

  // Power hour — most drinks any one person put away in a single clock-hour.
  const ph = {};
  blog.forEach((e) => { const dt = new Date(e.ts); const k = e.who + "|" + dt.toLocaleDateString([], { weekday: "short" }) + dt.getHours(); ph[k] = (ph[k] || 0) + 1; });
  let phWho = null, phN = 0;
  Object.keys(ph).forEach((k) => { if (ph[k] > phN) { phN = ph[k]; phWho = state.names[Number(k.split("|")[0])]; } });

  // The connoisseur — most different booze types tried.
  const variety = state.names.map((_, i) => { const t = state.tallies[i] || {}; return BOOZE.filter((dk) => (t[dk.id] || 0) > 0).length; });
  const maxVar = Math.max(0, ...variety);
  const connoisseur = maxVar >= 3 ? state.names.filter((n, i) => variety[i] === maxVar).join(" & ") : null;

  // Hydration hero — most soft drinks / coffees (the sensible one).
  const softC = state.names.map((_, i) => softCountFor(i));
  const maxSoft = Math.max(0, ...softC);
  const hydrationHero = maxSoft > 0 ? state.names.filter((n, i) => softC[i] === maxSoft).join(" & ") : null;

  // Wooden spoon — fewest drinks (the lightweight / designated one).
  const minC = rows.length ? Math.min(...rows.map((r) => r.c)) : 0;
  const woodenSpoon = (total > 0 && minC < maxC) ? state.names.filter((n, i) => countFor(i) === minC).join(" & ") : null;

  return { rows, total, perHead, maxC, thirstiest, boozeBreak, favBooze, softTotal, bigHour, bigN, days, maxS, pundit, oracle, bingoN, bingoTop, bingoTopN,
    firstRound, lastStanding, phWho, phN, connoisseur, maxVar, hydrationHero, maxSoft, woodenSpoon, minC };
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
       <div class="recap-stat"><div class="rc-v">${d.perHead.toFixed(1)}</div><div class="rc-k">Per head</div></div>
       <div class="recap-stat"><div class="rc-v">${d.bigN || 0}</div><div class="rc-k">Biggest hour</div></div>
       <div class="recap-stat"><div class="rc-v">${d.bingoN}/${BINGO.length}</div><div class="rc-k">Bingo spotted</div></div>
     </div>
     ${d.boozeBreak.length ? `<div class="recap-break">${d.boozeBreak.map((x) => `<span class="rc-chip">${x.emoji} ${x.n}</span>`).join("")}${d.softTotal ? `<span class="rc-chip soft">🧃 ${d.softTotal}</span>` : ""}</div>` : ""}
     ${d.days.length > 1 ? `<div class="recap-days">${d.days.map((x) => `<span><b>${x.n}</b> ${x.d}</span>`).join("")}</div>` : ""}
     ${renderRecapAwards(d)}`;
}
/* Winners grid — one tidy card per award instead of a wall of text lines. */
function renderRecapAwards(d) {
  const items = [];
  const push = (icon, label, name, detail) => { if (name) items.push({ icon, label, name, detail: detail || "" }); };
  push("⚡", "Power hour", d.phWho, d.phN ? d.phN + " in an hour" : "");
  push("🌅", "First round in", d.firstRound);
  push("🌙", "Last one standing", d.lastStanding);
  push("🍹", "The connoisseur", d.connoisseur, d.maxVar ? d.maxVar + " types" : "");
  push("💧", "Hydration hero", d.hydrationHero, d.maxSoft ? d.maxSoft + " soft" : "");
  push("🥄", "Wooden spoon", d.woodenSpoon, d.minC != null ? d.minC + " drinks" : "");
  push("🎯", "Best pundit", d.pundit, d.maxS ? d.maxS + " correct" : "");
  push("🔮", "Sharpest odds", d.oracle && d.oracle.n, d.oracle ? Math.round(d.oracle.acc * 100) + "%" : "");
  push("🥏", "Top spotter", d.bingoTop, d.bingoTopN ? d.bingoTopN + " spotted" : "");
  if (!items.length) {
    return `<div class="recap-awards"><div class="recap-empty">Log drinks, spot bingo &amp; settle bets — it all lands here 🏆</div></div>`;
  }
  return `<div class="recap-awards">
    <div class="rc-aw-head">🏆 Superlatives</div>
    <div class="rc-aw-grid">${items.map((x) =>
    `<div class="rc-aw-card">
       <span class="rc-aw-ico">${x.icon}</span>
       <span class="rc-aw-body">
         <span class="rc-aw-lab">${escapeHtml(x.label)}</span>
         <span class="rc-aw-win">${escapeHtml(x.name)}</span>
       </span>
       ${x.detail ? `<span class="rc-aw-det">${escapeHtml(x.detail)}</span>` : ""}
     </div>`).join("")}</div>
  </div>`;
}
function buildRecapText() {
  const d = recapData();
  const lines = ["🍺 " + (TRIP.city || "") + " '" + (TRIP.year || "") + " — Thirsty Boys"];
  if (d.thirstiest) lines.push("👑 Thirstiest Boy: " + d.thirstiest + " (" + d.maxC + ")");
  lines.push("🍻 " + d.rows.map((r) => r.n + " " + r.c).join(" · "));
  lines.push("📊 " + d.total + " total · " + d.perHead.toFixed(1) + " each" + (d.bigN ? " · biggest hour " + d.bigN : ""));
  if (d.days.length > 1) lines.push("📅 " + d.days.map((x) => x.d + " " + x.n).join(" · "));
  if (d.phWho) lines.push("⚡ Power hour: " + d.phWho + " (" + d.phN + ")");
  if (d.connoisseur) lines.push("🍹 Connoisseur: " + d.connoisseur + " (" + d.maxVar + " types)");
  if (d.hydrationHero) lines.push("💧 Hydration hero: " + d.hydrationHero + " (" + d.maxSoft + ")");
  if (d.woodenSpoon) lines.push("🥄 Wooden spoon: " + d.woodenSpoon + " (" + d.minC + ")");
  if (d.pundit) lines.push("🎯 Best pundit: " + d.pundit + " (" + d.maxS + ")");
  if (d.oracle) lines.push("🔮 Sharpest odds: " + d.oracle.n + " (" + Math.round(d.oracle.acc * 100) + "%)");
  lines.push("🥏 Bingo: " + d.bingoN + "/" + BINGO.length + (d.bingoTop ? " · top spotter " + d.bingoTop : ""));
  return lines.join("\n");
}
function loadHtml2Canvas() {
  if (window.__h2c) return window.__h2c;
  window.__h2c = new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    const js = document.createElement("script");
    js.src = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
    js.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error("html2canvas missing"));
    js.onerror = () => reject(new Error("html2canvas failed"));
    document.head.appendChild(js);
    setTimeout(() => reject(new Error("html2canvas timeout")), 8000);
  });
  return window.__h2c;
}
/* Render the recap card to a PNG blob (null if it can't). */
async function recapImageBlob() {
  const card = document.getElementById("recap-card");
  if (!card || !card.offsetWidth) return null; // must be visible
  const h2c = await loadHtml2Canvas();
  const canvas = await h2c(card, {
    backgroundColor: "#1c2138",
    scale: Math.min(3, (window.devicePixelRatio || 1) * 1.5),
    useCORS: true,
    logging: false,
  });
  return await new Promise((res) => canvas.toBlob(res, "image/png"));
}
async function shareRecap() {
  const text = buildRecapText();
  const url = location.origin + location.pathname;
  const fname = ((TRIP.city || "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + (TRIP.year || "") + "-wrapped.png").replace(/-+/g, "-");
  const title = (TRIP.city || "") + " '" + (TRIP.year || "");

  // Preferred path: share/export a PICTURE of the recap card.
  try {
    toast("📸 Building your recap image…");
    const blob = await recapImageBlob();
    if (blob) {
      const file = new File([blob], fname, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title, text }); return; }
        catch (e) { if (e.name === "AbortError") return; /* else fall through to download */ }
      }
      // No file-share support (or it failed): download the PNG.
      const dl = document.createElement("a");
      dl.href = URL.createObjectURL(blob);
      dl.download = fname;
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
      setTimeout(() => URL.revokeObjectURL(dl.href), 4000);
      toast("🖼️ Recap image saved — share it in the chat");
      return;
    }
  } catch (e) { /* fall through to text share */ }

  // Fallback: text + link (older browsers / image build failed).
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
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
        // First to spot keeps the credit: claim only lands if the square is
        // still empty; a snapshot then corrects us if someone pipped us to it.
        state.bingo[id] = who; rtClaim("bingo/" + id, who);
        const r = cell.getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 10);
      }
      save();
      renderBingo();
    })
  );
  bingoNotify();
}

/* ==========================================================================
   RENDER: PUBS ON THE BENCH — reserve boozers, grouped by area, with map +
   Uber deep links. Not timed; dip in during free time or if a plan falls flat.
   ========================================================================== */
function renderPubs() {
  const wrap = document.getElementById("pubs-list");
  if (!wrap) return;
  if (!PUBS.length) { wrap.innerHTML = ""; return; }
  renderPubsMap();
  const areas = [];
  PUBS.forEach((p) => { if (areas.indexOf(p.area || "More") === -1) areas.push(p.area || "More"); });
  wrap.innerHTML = areas.map((area) => {
    const items = PUBS.filter((p) => (p.area || "More") === area).map((p) => {
      const map = p.map ? `<a class="ic" title="Open in Maps" aria-label="Open in Maps" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.map)}" target="_blank" rel="noopener">📍</a>` : "";
      const uber = (p.lat != null && p.lon != null)
        ? `<a class="ic" title="Uber here" aria-label="Uber here" href="https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff%5Blatitude%5D=${p.lat}&dropoff%5Blongitude%5D=${p.lon}&dropoff%5Bnickname%5D=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">🚕</a>`
        : "";
      const menu = p.menu ? `<a class="ic" title="Menu" aria-label="Menu" href="${escapeAttr(p.menu)}" target="_blank" rel="noopener">🍽️</a>` : "";
      const insta = p.insta ? `<a class="ic link-insta" title="Instagram" aria-label="Instagram" href="${escapeAttr(p.insta)}" target="_blank" rel="noopener">📸</a>` : "";
      return `<div class="pub">
        <div class="pub-head"><span class="pub-emoji">${p.emoji || "🍺"}</span><span class="pub-name">${escapeHtml(p.name)}</span></div>
        <p class="pub-desc">${escapeHtml(p.desc || "")}</p>
        <div class="pub-links">${map}${uber}${menu}${insta}</div>
      </div>`;
    }).join("");
    return `<div class="pub-area"><h3 class="pub-area-h">${escapeHtml(area)}</h3>${items}</div>`;
  }).join("");
}

/* Integrated map for the Pubs section. Leaflet (loaded on demand, like
   Firebase) gives us a real multi-pin map — one emoji pin per bench pub —
   which the single-marker OSM embed couldn't. Falls back to that embed if
   Leaflet can't load (offline / CDN blocked), so there's always a map. */
function loadLeaflet() {
  if (window.__leaflet) return window.__leaflet;
  window.__leaflet = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => window.L ? resolve(window.L) : reject(new Error("leaflet missing"));
    js.onerror = () => reject(new Error("leaflet failed"));
    document.head.appendChild(js);
    setTimeout(() => reject(new Error("leaflet timeout")), 8000);
  });
  return window.__leaflet;
}
function pubMapPoints() { return PUBS.filter((p) => p.lat != null && p.lon != null); }
function googleAllPinsUrl(pts) {
  const city = TRIP.city ? " " + TRIP.city : "";
  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(pts.map((p) => p.name + city).join(" OR "));
}
/* Build the container + fallback link once (not rebuilt every render). */
function renderPubsMap() {
  const box = document.getElementById("pubs-map");
  if (!box || box.dataset.ready === "1") return;
  const pts = pubMapPoints();
  if (!pts.length) { box.style.display = "none"; return; }
  box.dataset.ready = "1";
  box.innerHTML =
    `<div class="pubs-map-canvas" id="pubs-map-canvas"></div>` +
    `<a class="pubs-map-open" href="${escapeAttr(googleAllPinsUrl(pts))}" target="_blank" rel="noopener">↗ Open all pins in Google Maps</a>`;
}
let pubsMap = null;
/* Init/refresh the Leaflet map. Must run when the container is VISIBLE (a map
   built in a display:none box gets zero size), so it's driven from showTab. */
function initPubsMap() {
  const canvas = document.getElementById("pubs-map-canvas");
  if (!canvas) return;
  if (pubsMap) { try { pubsMap.invalidateSize(); } catch (e) { /* ignore */ } return; }
  const pts = pubMapPoints();
  if (!pts.length) return;
  loadLeaflet().then((L) => {
    if (pubsMap || !document.getElementById("pubs-map-canvas")) return;
    const map = L.map(canvas, { scrollWheelZoom: false, attributionControl: true });
    pubsMap = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap",
    }).addTo(map);
    pts.forEach((p) => {
      // Emoji pin via divIcon — no external marker image to break.
      const icon = L.divIcon({ className: "pub-pin", html: `<span>${p.emoji || "🍺"}</span>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
      L.marker([p.lat, p.lon], { icon, title: p.name })
        .addTo(map)
        .bindPopup(`<b>${escapeHtml(p.emoji || "🍺")} ${escapeHtml(p.name)}</b><br>${escapeHtml(p.area || "")}`);
    });
    map.fitBounds(pts.map((p) => [p.lat, p.lon]), { padding: [28, 28], maxZoom: 15 });
    setTimeout(() => { try { map.invalidateSize(); } catch (e) { /* ignore */ } }, 60);
  }).catch(() => {
    // Leaflet unavailable → single-marker OSM embed so a map still shows.
    const canvas2 = document.getElementById("pubs-map-canvas");
    if (!canvas2 || pubsMap) return;
    const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon), pad = 0.006;
    const bbox = [Math.min.apply(null, lons) - pad, Math.min.apply(null, lats) - pad,
      Math.max.apply(null, lons) + pad, Math.max.apply(null, lats) + pad].join(",");
    const cLat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2;
    const cLon = (Math.min.apply(null, lons) + Math.max.apply(null, lons)) / 2;
    const src = "https://www.openstreetmap.org/export/embed.html?bbox=" + encodeURIComponent(bbox) + "&layer=mapnik&marker=" + cLat + "," + cLon;
    canvas2.outerHTML = `<iframe class="pubs-map-frame" src="${escapeAttr(src)}" loading="lazy" title="Map of the bench pubs"></iframe>`;
  });
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

/* Buzz + banner every phone when someone logs a drink. Fires only for a SINGLE
   new entry (a live round → notify; many at once is a bulk load/sync → stay
   quiet), and not for your own (you already get the confetti). */
let seenDrinks = {};
function drinkSnapshot() {
  const cur = {};
  (state.log || []).forEach((e) => { if (e && e.id != null) cur[e.id] = 1; });
  return cur;
}
function drinkNotify() {
  const cur = drinkSnapshot();
  const fresh = Object.keys(cur).filter((id) => !seenDrinks[id]);
  seenDrinks = cur;
  if (fresh.length !== 1) return;                    // 0 = nothing new, >1 = bulk sync
  const e = (state.log || []).find((x) => x && x.id === fresh[0]);
  if (!e || e.who === me) return;                    // skip your own (you saw the confetti)
  const who = state.names[e.who];
  const d = drinkById(e.drink);
  if (who == null || !d) return;
  const tail = isSoft(e.drink) ? "" : " · " + countFor(e.who);
  buzz([40, 30, 40]);
  pop();
  bigBanner(`${d.emoji} <b>${escapeHtml(who)}</b> just had a ${escapeHtml(d.label)}${tail}`);
}

/* ==========================================================================
   RENDER: LIVE STATS — computed from the drink tallies + timestamped log.
   Totals come from the tallies (authoritative); pace/biggest-hour/projection
   come from the log. Recomputed on the 1s tick so it's genuinely live.
   ========================================================================== */
/* ---- Itinerary-aware drink projection ----
   "current rate × hours left" over-counts sleep and quiet stretches. Instead we
   weight each future half-hour by how boozy the itinerary is then, calibrate
   against drinks-per-weighted-hour actually logged so far, and integrate. */
function stopIntensity(s) {
  if (s && typeof s.intensity === "number") return s.intensity;         // per-stop override (trip.json)
  const e = (s && s.emoji) || "";
  const has = (set) => set.some((x) => e.indexOf(x) >= 0);
  if (has(["🍛"])) return 1.0;                                          // BYOB curry
  if (has(["🍺", "🍷", "🍸", "🍹", "🤠", "⚽", "🎤", "🍾"])) return 1.2;   // bar / nightlife
  if (has(["🎯", "🏎", "🎮"])) return 0.9;                              // games, drink in hand
  if (has(["🔄"])) return 0.7;                                          // free time
  if (has(["🌮", "🍔", "🥙", "🍗", "🍕", "🌯"])) return 0.6;            // food
  if (has(["🥏"])) return 0.4;                                          // sober-ish activity
  if (has(["🥐", "☕", "🍩"])) return 0.2;                              // recovery brunch
  if (has(["🚆", "🔑", "🚕", "👋", "🧭"])) return 0.1;                  // logistics
  return 0.5;
}
function flatStopsSorted() {
  const f = [];
  ITINERARY.forEach((d) => (d.stops || []).forEach((s) => f.push(s)));
  return f.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
}
function intensityAt(ts, flat) {
  let active = null;
  for (let i = 0; i < flat.length; i++) {
    if (new Date(flat[i].iso).getTime() <= ts) active = flat[i]; else break;
  }
  if (!active) return 0;
  const base = stopIntensity(active);
  // Small-hours sleep floor — but only while coasting on the PREVIOUS night's
  // stop. If the itinerary kicks off something in the morning (disc golf,
  // brunch) you're up, so use that stop instead of pretending you're asleep.
  const h = new Date(ts).getHours();
  if (h >= 3 && h < 11) {
    const sh = new Date(active.iso).getHours();
    if (!(sh >= 3 && sh < 11)) return Math.min(base, 0.05);
  }
  return base;
}
function weightedHours(from, to, flat) {
  if (to <= from) return 0;
  let w = 0; const step = 1800000;
  for (let t = from; t < to; t += step) w += intensityAt(t, flat) * (Math.min(step, to - t) / 3600000);
  return w;
}
/* Returns { projected, points } — the model's end total and the bent curve.
   Rate blends your whole-trip average with your RECENT pace (last 3h) so it
   tracks the session you're actually in, not just the long-run average. */
function projectDrinks(logTs, firstTs, now) {
  const tripEnd = TRIP_END.getTime();
  const N = (logTs || []).length;
  if (!(now >= TRIP_START.getTime() && now <= tripEnd) || N <= 0 || !firstTs) return { projected: null, points: [] };
  const flat = flatStopsSorted();
  const wElapsed = Math.max(0.5, weightedHours(firstTs, now, flat));
  const overallPerW = N / wElapsed;
  // Recent pace over the last 3h of (weighted) drinking time.
  const recentFrom = Math.max(firstTs, now - 3 * 3600000);
  const recentDrinks = logTs.filter((t) => t >= recentFrom).length;
  const recentW = weightedHours(recentFrom, now, flat);
  const recentPerW = recentW > 0.3 ? recentDrinks / recentW : null;
  const blended = (recentPerW != null && recentDrinks >= 2) ? (0.6 * recentPerW + 0.4 * overallPerW) : overallPerW;
  // Cap the pace so a tiny elapsed window (e.g. a couple of early-morning drinks
  // that land in the floored "asleep" hours) can't calibrate to an absurd rate
  // and project a silly number. ~2.5 drinks/person per full-intensity hour is
  // already a hard ceiling.
  const crew = Math.max(1, (state.names || []).length);
  const perW = Math.min(blended, 2.5 * crew);
  const maxTotal = Math.max(N, crew * 40);   // safety backstop only — should rarely bind now
  // Fatigue taper: nobody holds their opening pace for a whole weekend. Weight
  // the hours just ahead at full pace and fade the far-off ones, so the number
  // stays realistic AND keeps moving with each new drink (instead of pinning at
  // the cap). Pace roughly halves ~every 14h you look ahead.
  const TAU = 14 * 3600000;
  const points = [];
  let cum = N; const step = 1800000;
  for (let t = now; t < tripEnd; t += step) {
    const seg = Math.min(step, tripEnd - t) / 3600000;
    const fatigue = Math.exp(-(t - now) / TAU);
    cum = Math.min(maxTotal, cum + perW * fatigue * intensityAt(t, flat) * seg);
    points.push({ t: Math.min(t + step, tripEnd), c: cum });
  }
  return { projected: Math.round(cum), points: points };
}

/* Live momentum: recent drinking rate (last 90 min) vs the trip-so-far average.
   Answers "are we going harder or easing off right now?" Returns null until
   there's enough history to be meaningful. */
function paceState(now) {
  const bl = (state.log || []).filter((e) => e && e.ts && !isSoft(e.drink));
  const ts = bl.map((e) => e.ts).sort((a, b) => a - b);
  const n = ts.length;
  if (n < 3) return null;
  const elapsedH = (now - ts[0]) / 3600000;
  if (elapsedH < 1.2) return null;                       // too early to compare
  const avg = n / elapsedH;                               // drinks/hour, whole trip so far
  const winH = 1.5;
  const recentRate = bl.filter((e) => now - e.ts <= winH * 3600000).length / winH;
  const ratio = recentRate / Math.max(0.4, avg);
  if (ratio >= 1.25) return { label: "🔥 Running hot", cls: "hot", ratio };
  if (ratio <= 0.6) return { label: "🐢 Easing off", cls: "cool", ratio };
  return { label: "🍺 On pace", cls: "on", ratio };
}

function renderStats() {
  const wrap = document.getElementById("stats-wrap");
  if (!wrap) return;
  const now = Date.now();
  const totals = state.names.map((_, i) => countFor(i));
  const total = totals.reduce((a, b) => a + b, 0);

  // Per-drink breakdown across the whole group.
  const byDrink = {};
  (state.tallies || []).forEach((t) => { if (t) Object.keys(t).forEach((k) => { byDrink[k] = (byDrink[k] || 0) + (t[k] || 0); }); });

  // Time-based numbers from the timestamped log — BOOZE only, so soft drinks /
  // coffees never inflate the pace, rate, projection or chart.
  const log = (state.log || []).filter((e) => e && e.ts && !isSoft(e.drink));
  const firstTs = log.length ? Math.min.apply(null, log.map((e) => e.ts)) : null;
  const lastHour = log.filter((e) => now - e.ts <= 3600000).length;
  // Floor the window at 1h so the first few drinks don't extrapolate to a silly
  // rate/projection; it stabilises naturally as the weekend (incl. sleep) goes on.
  const spanH = firstTs ? Math.max(1, (now - firstTs) / 3600000) : 0;
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

  // Longest gap between drinks (group) — the "dry spell".
  const ts = log.map((e) => e.ts).sort((a, b) => a - b);
  let dryMs = 0;
  for (let i = 1; i < ts.length; i++) dryMs = Math.max(dryMs, ts[i] - ts[i - 1]);
  const dryLabel = dryMs >= 3600000 ? Math.floor(dryMs / 3600000) + "h " + Math.round((dryMs % 3600000) / 60000) + "m" : Math.round(dryMs / 60000) + "m";

  // Itinerary-aware projection (bent curve + end total), recency-weighted.
  const proj = projectDrinks(ts, firstTs, now);
  const projected = proj.projected;

  const tiles = [
    `<div class="stat-tile"><div class="st-v">${total}</div><div class="st-k">Total drinks</div></div>`,
    `<div class="stat-tile"><div class="st-v">${state.names.length ? (total / state.names.length).toFixed(1) : "0"}</div><div class="st-k">Per head</div></div>`,
    `<div class="stat-tile"><div class="st-v">${rate.toFixed(1)}</div><div class="st-k">Drinks / hour</div></div>`,
    `<div class="stat-tile"><div class="st-v">${lastHour}</div><div class="st-k">Last hour</div></div>`,
    `<div class="stat-tile"><div class="st-v">${bigN || 0}</div><div class="st-k">Biggest hour${bigN ? `<br><span class="st-sub">${escapeHtml(bigHour)}</span>` : ""}</div></div>`,
  ];
  if (ts.length >= 2) tiles.push(`<div class="stat-tile"><div class="st-v">${dryLabel}</div><div class="st-k">Longest dry spell</div></div>`);
  const pace = paceState(now);
  if (pace) tiles.push(`<div class="stat-tile pace-${pace.cls}"><div class="st-v pace-v">${pace.label}</div><div class="st-k">Right now vs your average</div></div>`);
  if (projected != null) tiles.push(`<div class="stat-tile hot"><div class="st-v">${projected}</div><div class="st-k">Projected by Sun</div></div>`);

  const rows = state.names.map((n, i) => ({ n, i, c: totals[i] }))
    .sort((a, b) => b.c - a.c)
    .map((r) => {
      const pace = spanH ? log.filter((e) => e.who === r.i).length / spanH : 0;
      return `<div class="stat-row"><span class="sr-name">${escapeHtml(r.n)}</span><span class="sr-c">${r.c}</span><span class="sr-pace">${pace.toFixed(1)}/hr</span></div>`;
    }).join("");

  const dbreak = BOOZE.filter((d) => (byDrink[d.id] || 0) > 0).map((d) => `<span class="db-chip">${d.emoji} ${byDrink[d.id]}</span>`).join("");
  const chart = drinkChartSvg(log, now, firstTs, proj.points);

  // Separate soft-drink & coffee tracker — kept out of the total on purpose.
  const softTotal = SOFT.reduce((s, d) => s + (byDrink[d.id] || 0), 0);
  let softBlock = "";
  if (softTotal > 0) {
    const softTiles = SOFT.filter((d) => (byDrink[d.id] || 0) > 0)
      .map((d) => `<div class="soft-tile"><div class="st-v">${byDrink[d.id]}</div><div class="st-k">${d.emoji} ${escapeHtml(d.label)}</div></div>`).join("");
    const softRows = state.names.map((n, i) => ({ n, c: softCountFor(i) })).filter((r) => r.c > 0)
      .sort((a, b) => b.c - a.c)
      .map((r) => `<div class="soft-row"><span>${escapeHtml(r.n)}</span><span>${r.c}</span></div>`).join("");
    softBlock =
      `<div class="soft-track">
         <div class="soft-head">☕ Soft &amp; coffee <span class="soft-sub">— stays hydrated, doesn't count</span></div>
         <div class="soft-tiles">${softTiles}</div>
         ${softRows ? `<div class="soft-rows">${softRows}</div>` : ""}
       </div>`;
  }

  wrap.innerHTML =
    `<div class="stat-tiles">${tiles.join("")}</div>` +
    (total > 0
      ? chart +
        `<div class="stat-break">${dbreak}</div>
         <div class="stat-rows"><div class="stat-rows-head">Pace per man</div>${rows}</div>`
      : (softTotal > 0 ? "" : `<p class="stat-empty">No drinks logged yet — the stats wake up on the first round. 🍺</p>`)) +
    softBlock;
}

/* Drinks over time as an inline SVG line chart. Two modes (toggle in the title):
   GROUP — one amber cumulative line + the itinerary-aware projection (dashed);
   PERSON — a cumulative line per lad (validated colour set), with a legend so
   identity is never colour-alone. */
const CREW_COLORS = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767"];
let chartMode = (function () { try { return localStorage.getItem("thirstyboys.chartmode") === "person" ? "person" : "group"; } catch (e) { return "group"; } })();
function drinkChartSvg(log, now, firstTs, projPoints) {
  const valid = (log || []).filter((e) => e && e.ts).sort((a, b) => a.ts - b.ts);
  if (!valid.length || !firstTs) return "";
  const W = 320, H = 150, padL = 12, padR = 14, padT = 16, padB = 20;
  const N = valid.length;
  const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const modeBtn = `<button class="chart-mode-btn" type="button">${chartMode === "group" ? "Per person" : "Group"}</button>`;

  if (chartMode === "person") {
    const xEnd = Math.max(now, valid[N - 1].ts);
    const spanX = Math.max(1, xEnd - firstTs);
    const sx = (t) => padL + (Math.min(Math.max(t, firstTs), xEnd) - firstTs) / spanX * (W - padL - padR);
    const perTotals = state.names.map((_, i) => valid.filter((e) => e.who === i).length);
    const ymax = Math.max(4, ...perTotals);
    const sy = (c) => H - padB - (c / ymax) * (H - padT - padB);
    let paths = "", legend = "";
    state.names.forEach((nm, i) => {
      const mine = valid.filter((e) => e.who === i);
      if (!mine.length) return;
      const col = CREW_COLORS[i % CREW_COLORS.length];
      let dd = `M ${sx(firstTs).toFixed(1)} ${sy(0).toFixed(1)}`;
      mine.forEach((e, k) => { dd += ` L ${sx(e.ts).toFixed(1)} ${sy(k + 1).toFixed(1)}`; });
      dd += ` L ${sx(xEnd).toFixed(1)} ${sy(mine.length).toFixed(1)}`;
      paths += `<path d="${dd}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      legend += `<span class="lg-item"><span class="lg-dot" style="background:${col}"></span>${escapeHtml(nm)} ${mine.length}</span>`;
    });
    return `<div class="stat-chart">
      <div class="chart-title">Drinks over time · per person<span class="chart-actions">${modeBtn}</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Cumulative drinks over time, one line per person">
        <line x1="${padL}" y1="${sy(0).toFixed(1)}" x2="${W - padR}" y2="${sy(0).toFixed(1)}" class="chart-axis"/>
        <line x1="${padL}" y1="${sy(ymax).toFixed(1)}" x2="${W - padR}" y2="${sy(ymax).toFixed(1)}" class="chart-grid"/>
        <text x="${padL}" y="${(sy(ymax) - 4).toFixed(1)}" class="chart-ymax">${ymax}</text>
        ${paths}
      </svg>
      <div class="chart-x"><span>${hhmm(firstTs)}</span><span>now</span></div>
      <div class="chart-legend">${legend}</div>
    </div>`;
  }

  // GROUP mode (with projection)
  const pts = projPoints || [];
  const projecting = pts.length > 0;
  const projEnd = projecting ? Math.round(pts[pts.length - 1].c) : N;
  const tripEnd = TRIP_END.getTime();
  const xStart = firstTs, xEnd = projecting ? tripEnd : Math.max(now, valid[N - 1].ts);
  const ymax = Math.max(4, projEnd, N);
  const spanX = Math.max(1, xEnd - xStart);
  const sx = (t) => padL + (Math.min(Math.max(t, xStart), xEnd) - xStart) / spanX * (W - padL - padR);
  const sy = (c) => H - padB - (c / ymax) * (H - padT - padB);
  // Midnight day-dividers + labels so the flat overnight stretches (the model
  // floors 3–11am while everyone's asleep) read as nights, not glitches.
  let dayGuides = "";
  let sleepBands = "";
  if (projecting) {
    const first = new Date(xStart); first.setHours(24, 0, 0, 0);
    for (let t = first.getTime(); t < xEnd; t += 86400000) {
      const gx = sx(t).toFixed(1);
      const lab = new Date(t).toLocaleDateString([], { weekday: "short" });
      dayGuides += `<line x1="${gx}" y1="${padT}" x2="${gx}" y2="${H - padB}" class="chart-day"/>` +
        `<text x="${gx}" y="${(padT - 5).toFixed(1)}" text-anchor="middle" class="chart-day-lab">${lab}</text>`;
    }
    // Shade the "asleep" stretches so the flat bits read as kip, not a glitch.
    const flatS = flatStopsSorted();
    let bandStart = null;
    const closeBand = (endT) => {
      if (bandStart == null) return;
      const x1 = sx(bandStart), x2 = sx(endT);
      if (x2 - x1 > 3) {
        sleepBands += `<rect x="${x1.toFixed(1)}" y="${padT}" width="${(x2 - x1).toFixed(1)}" height="${(H - padB - padT).toFixed(1)}" class="chart-sleep"/>`;
        if (x2 - x1 > 20) sleepBands += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${(H - padB - 6).toFixed(1)}" text-anchor="middle" class="chart-sleep-lab">💤</text>`;
      }
      bandStart = null;
    };
    for (let t = xStart; t < xEnd; t += 1800000) {
      if (intensityAt(t, flatS) <= 0.06) { if (bandStart == null) bandStart = t; }
      else closeBand(t);
    }
    closeBand(xEnd);
  }
  let d = `M ${sx(xStart).toFixed(1)} ${sy(0).toFixed(1)}`;
  valid.forEach((e, i) => { d += ` L ${sx(e.ts).toFixed(1)} ${sy(i + 1).toFixed(1)}`; });
  const nowX = sx(now).toFixed(1), nowY = sy(N).toFixed(1);
  d += ` L ${nowX} ${nowY}`;
  let proj = "";
  if (projecting) {
    let pd = `M ${nowX} ${nowY}`;
    pts.forEach((p) => { pd += ` L ${sx(p.t).toFixed(1)} ${sy(p.c).toFixed(1)}`; });
    proj = `<path d="${pd}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-dasharray="4 4" opacity="0.55" stroke-linecap="round" stroke-linejoin="round"/>
       <text x="${(sx(tripEnd) - 2).toFixed(1)}" y="${(sy(projEnd) - 5).toFixed(1)}" text-anchor="end" class="chart-proj">~${projEnd}</text>`;
  }
  const endLab = projecting ? new Date(tripEnd).toLocaleDateString([], { weekday: "short" }) + " " + new Date(tripEnd).toLocaleTimeString([], { hour: "2-digit" }) : "now";
  return `<div class="stat-chart">
    <div class="chart-title">Drinks over time${projecting ? " · projected to Sun" : ""}<span class="chart-actions">${modeBtn}<button class="chart-info-btn" type="button" aria-label="How the projection works">ⓘ</button></span></div>
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Cumulative drinks over time with an itinerary-aware projection to the end of the trip">
      <line x1="${padL}" y1="${sy(0).toFixed(1)}" x2="${W - padR}" y2="${sy(0).toFixed(1)}" class="chart-axis"/>
      <line x1="${padL}" y1="${sy(ymax).toFixed(1)}" x2="${W - padR}" y2="${sy(ymax).toFixed(1)}" class="chart-grid"/>
      <text x="${padL}" y="${(sy(ymax) - 4).toFixed(1)}" class="chart-ymax">${ymax}</text>
      ${sleepBands}
      ${dayGuides}
      <path d="${d}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${proj}
      <circle cx="${nowX}" cy="${nowY}" r="3.5" fill="var(--amber-2)"/>
      <text x="${nowX}" y="${(parseFloat(nowY) - 7).toFixed(1)}" text-anchor="middle" class="chart-now">${N}</text>
    </svg>
    <div class="chart-x"><span>${hhmm(xStart)}</span><span>${escapeHtml(endLab)}</span></div>
    ${modelInfoHtml()}
  </div>`;
}
/* Tap-to-explain panel describing the projection model (persists across the
   1s re-render via modelInfoOpen). */
let modelInfoOpen = false;
// Per-bet UI toggles (device-local, not synced): which bets currently show the
// call editor, and which show the outcome editor.
const betEditCall = new Set();
const betEnterOutcome = new Set();
function modelInfoHtml() {
  return `<div class="model-info${modelInfoOpen ? " open" : ""}" id="model-info">
    <div class="mi-h">📊 How “Projected by Sun” is worked out</div>
    <p>Every drink is timestamped, so we know your pace so far (drinks per “drinking hour”). Then we look ahead at the itinerary and weight each upcoming half-hour by how boozy it's likely to be:</p>
    <ul>
      <li>🍺 Bars &amp; nightlife — full pace</li>
      <li>🍛 BYOB curry — full</li>
      <li>🎯 Games (TOCA / F1) — most of it</li>
      <li>🍔 Food — about half</li>
      <li>🥏 Activities — a bit</li>
      <li>🥐 Recovery brunch — barely</li>
      <li>🛌 3–11am (asleep) — next to nothing</li>
    </ul>
    <p>Your pace × those weighted hours to Sunday = the dashed line — steep through the pubs, flat overnight. It's a bit of fun, not a promise. 🍻</p>
  </div>`;
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
function wxDayLabel(iso) {
  // "2026-07-17" -> "Fri" (parsed as UTC noon to dodge TZ edge cases)
  const d = new Date(iso + "T12:00:00Z");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] || iso.slice(5);
}
async function fetchWeather() {
  const el = document.getElementById("weather-days");
  if (!el) return;
  const w = TRIP.weather || {};
  if (!w.lat || !w.lon) { el.innerHTML = ""; return; }
  const base = "https://api.open-meteo.com/v1/forecast?latitude=" + w.lat + "&longitude=" + w.lon +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLondon";
  // Prefer the trip's own days; if they're outside the forecast window (opened
  // weeks early) the API returns no rows, so fall back to a rolling 3-day view
  // so there's ALWAYS a live forecast on screen instead of a dead fallback.
  const tripUrl = base + "&start_date=" + (w.start || "") + "&end_date=" + (w.end || "");
  const rollUrl = base + "&forecast_days=3";
  try {
    let d = null;
    if (w.start && w.end) {
      const r = await fetch(tripUrl, { cache: "no-store" });
      if (r.ok) d = await r.json();
    }
    if (!d || !d.daily || !d.daily.time || !d.daily.time.length) {
      const r2 = await fetch(rollUrl, { cache: "no-store" });
      if (!r2.ok) throw new Error("wx");
      d = await r2.json();
    }
    if (!d.daily || !d.daily.time || !d.daily.time.length) throw new Error("wx-empty");
    const days = d.daily.time.map((t, i) => {
      const hi = Math.round(d.daily.temperature_2m_max[i]);
      const lo = Math.round(d.daily.temperature_2m_min[i]);
      const rain = d.daily.precipitation_probability_max[i];
      return `<div class="wx-day">
        <span class="wx-d">${wxDayLabel(t)}</span>
        <span class="wx-emoji">${wxEmoji(d.daily.weather_code[i])}</span>
        <span class="wx-temp">${hi}°/${lo}°</span>
        <span class="wx-rain">💧${rain == null ? "–" : rain}%</span>
      </div>`;
    }).join("");
    // A freshness stamp so a stable forecast still visibly reads as "live".
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    el.innerHTML = days + `<span class="wx-updated" title="Forecast last refreshed">↻ ${stamp}</span>`;
  } catch (e) {
    // Don't clobber a good forecast we already painted on a transient blip —
    // only show the fallback if the strip is still empty/loading.
    if (!el.querySelector(".wx-day")) {
      el.innerHTML = `<span class="muted">🌦️ ${escapeHtml(TRIP.city || "Weather")} forecast — tap BBC for the latest</span>`;
    }
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
/* Run a renderer defensively — a failure in one section must never blank the
   rest of the app (this is what turned an unexpected data shape into a dead
   screen on the installed PWA). */
function safe(fn) {
  try { fn(); } catch (e) { try { console.error("render error: " + (fn.name || "anon"), e); } catch (_) { /* ignore */ } }
}
function render() {
  [renderWhoami, renderLeaderboard, renderTracker, renderLog, renderBets,
   renderBingo, renderPubs, renderRound, renderStats, renderBragging, renderAdminEditor, renderRecap, renderCrew].forEach(safe);
}

function tick() {
  // pace / last-hour / projection are time-based → keep renderStats live
  [renderCountdown, renderTripMode, renderItinerary, renderNowNext, renderStats].forEach(safe);
}

/* ---------- TABBED VIEW: show one section at a time (no giant scroll) ---------- */
const TAB_IDS = ["itinerary", "pubs", "tracker", "bets", "bingo", "stats", "recap", "crew"];
function showTab(id) {
  if (TAB_IDS.indexOf(id) === -1) id = "itinerary";
  TAB_IDS.forEach((s) => { const el = document.getElementById(s); if (el) el.style.display = (s === id) ? "" : "none"; });
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.getAttribute("href") === "#" + id));
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  // The pub map must init while its container is visible (Leaflet needs real
  // dimensions), so kick it off / resize it the moment the Pubs tab opens.
  if (id === "pubs") { try { initPubsMap(); } catch (e) { /* ignore */ } }
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
  // During the trip the connection dot folds INTO this bar (tap for who's here),
  // so the separate floating pill is hidden and the bottom isn't crowded.
  bar.innerHTML =
    `<button class="nn-net ${lastSyncCls || "off"}" type="button" aria-label="Who's connected"><span class="net-dot"></span></button>` +
    `<span class="nn-seg"><span class="nn-lab">NOW</span>${nowTxt}</span>` +
    `<span class="nn-seg nn-next"><span class="nn-lab">NEXT</span>${nextTxt}</span>`;
  bar.classList.remove("hidden");
  document.body.classList.add("has-nownext");
}

document.getElementById("undo-btn").addEventListener("click", undoLast);
document.getElementById("reset-btn").addEventListener("click", resetAll);
document.getElementById("spin-btn").addEventListener("click", spinRound);
document.getElementById("admin-btn").addEventListener("click", toggleAdmin);
document.getElementById("recap-share").addEventListener("click", shareRecap);
document.getElementById("net-status").addEventListener("click", (e) => { e.stopPropagation(); toggleNetPop(); });
/* The connection dot folded into the Now/Next bar opens the same popover. */
document.addEventListener("click", (e) => {
  if (!e.target.closest || !e.target.closest(".nn-net")) return;
  e.preventDefault(); e.stopPropagation();
  toggleNetPop();
});
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
    document.body.classList.remove("has-a2hs");
  });
  document.body.appendChild(bar);
  document.body.classList.add("has-a2hs");   // lift the connection pill clear of it
}
setTimeout(maybeShowA2HS, 2500);

/* ---------- QUICK-ADD — the floating 🍺 fans out a drink picker so you can log
   one in a tap or two from anywhere, without hopping to the Drinks tab. ---------- */
(function quickAdd() {
  const fab = document.getElementById("fab-beer");
  if (!fab) return;
  let menu = null;
  function close() {
    if (menu) { menu.remove(); menu = null; }
    fab.setAttribute("aria-expanded", "false");
    fab.classList.remove("open");
    document.removeEventListener("click", onDoc, true);
  }
  function onDoc(e) { if (menu && !menu.contains(e.target) && e.target !== fab) close(); }
  function open() {
    menu = document.createElement("div");
    menu.className = "fab-menu";
    menu.innerHTML =
      `<div class="fab-menu-title">Add a drink for ${escapeHtml(state.names[me] || "you")}</div>` +
      `<div class="fab-menu-grid">` +
      DRINKS.map((d) => `<button class="fab-drink" data-drink="${d.id}" aria-label="Add ${escapeAttr(d.label)}"><span class="fd-emoji">${d.emoji}</span><span class="fd-lab">${escapeHtml(d.label)}</span></button>`).join("") +
      `</div>`;
    document.body.appendChild(menu);
    fab.setAttribute("aria-expanded", "true");
    fab.classList.add("open");
    menu.querySelectorAll(".fab-drink").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addDrinkFor(me, btn.dataset.drink);
        const r = btn.getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top, 12);
        close();
      })
    );
    setTimeout(() => document.addEventListener("click", onDoc, true), 0);
  }
  fab.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!hasClaimed()) { openWhoamiModal(); return; }   // need to know who you are first
    if (menu) close(); else open();
  });
})();

/* ---------- PULL-TO-REFRESH — pull down at the top to force a resync. ---------- */
function doPullRefresh() {
  flushOutbox();
  render();
  tick();
  fetchWeather();   // a manual pull should visibly refresh the forecast too
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
  // Bingo heading + share/SEO description follow the city too.
  const bingoTitle = document.getElementById("bingo-title");
  if (bingoTitle) bingoTitle.textContent = (TRIP.city ? city + " " : "") + "Bingo";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    const crew = (TRIP.crew || []).map((c) => c.name).join(", ");
    meta.setAttribute("content",
      (crew ? crew + " take " + city + ". " : "") + (TRIP.datesLabel || "Live itinerary, drink tracker, bets & bingo."));
  }
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
  renderTripSwitcher();
}
/* Header dropdown to switch between the trips in assets/trips.json. Hidden
   unless a real registry with trips is present. Switching reloads with
   ?trip=<id> so the new trip's houseCode/store/room initialise cleanly. */
function renderTripSwitcher() {
  const wrap = document.getElementById("trip-switch");
  const sel = document.getElementById("trip-switch-sel");
  const reg = window.__tripRegistry;
  if (!wrap || !sel || !reg || !reg.__fromFile || !reg.trips.length) return;
  sel.innerHTML = reg.trips.map((t) =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label || t.id)}</option>`).join("");
  sel.value = window.__tripId;
  wrap.classList.remove("hidden");
  if (sel.dataset.wired === "1") return;   // bind once
  sel.dataset.wired = "1";
  sel.addEventListener("change", () => {
    try { localStorage.setItem(SELECTED_TRIP_KEY, sel.value); } catch (e) { /* ignore */ }
    location.href = location.pathname + "?trip=" + encodeURIComponent(sel.value);
  });
}

async function boot() {
  window.__common = await loadCommon();   // shared "classic" bets, merged in applyTrip
  applyTrip(await loadTrip());
  state = load();
  outbox = loadOutbox();     // resume any edits parked while offline last time
  lastRoundTs = (state.round && state.round.ts) || 0;  // don't re-celebrate an old verdict on load
  seenBingo = bingoSnapshot();                         // don't re-announce already-spotted squares
  seenDrinks = drinkSnapshot();                         // ditto for drinks already in the log
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
  // Keep the forecast live: refresh every 30 min and whenever the app is
  // brought back to the foreground (a PWA can sit open for days).
  setInterval(fetchWeather, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) fetchWeather(); });

  // First thing on first load: ask who you are.
  if (me == null || Number.isNaN(me) || !state.names[me]) openWhoamiModal();
  else beat();   // already claimed → stamp presence now so you show as "In" immediately

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
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => { /* offline install fails silently */ });
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
