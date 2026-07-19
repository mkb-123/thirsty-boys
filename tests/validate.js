/* Validates the trip config so a bad edit fails LOUDLY (in CI) instead of
   silently breaking the live site. Pure Node, no dependencies.
   Run: node tests/validate.js   (exits non-zero on any error) */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { err(`${rel} is missing`); return null; }
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { err(`${rel} is not valid JSON: ${e.message}`); return null; }
}

// --- common.json: shared classics ---
const common = readJson("assets/common.json");
if (common) {
  if (!Array.isArray(common.bets)) err("common.json: `bets` must be an array");
  if (!Array.isArray(common.bingo)) err("common.json: `bingo` must be an array");
  checkCatalog("common.json bets", common.bets || []);
  checkBingo("common.json bingo", common.bingo || []);
}

// --- database.rules.json parses ---
readJson("database.rules.json");

// --- trips.json registry ---
const reg = readJson("assets/trips.json");
const seenIds = new Set();
const seenHouse = new Set();
if (reg) {
  if (!Array.isArray(reg.trips) || !reg.trips.length) {
    err("trips.json: `trips` must be a non-empty array");
  } else {
    reg.trips.forEach((t, i) => {
      const where = `trips.json[${i}]`;
      if (!t.id) err(`${where}: missing "id"`);
      if (!t.label) err(`${where}: missing "label"`);
      if (!t.file) { err(`${where}: missing "file"`); return; }
      if (t.id && seenIds.has(t.id)) err(`${where}: duplicate id "${t.id}"`);
      seenIds.add(t.id);
      validateTripFile(t);
    });
    if (reg.default && !seenIds.has(reg.default)) {
      err(`trips.json: default "${reg.default}" is not one of the listed trip ids`);
    }
  }
}

function validateTripFile(entry) {
  const t = readJson(entry.file);
  if (!t) return;
  const w = entry.file;
  ["city", "year", "houseCode"].forEach((k) => { if (!t[k]) err(`${w}: missing "${k}"`); });
  if (t.houseCode) {
    if (t.houseCode !== entry.id) err(`${w}: houseCode "${t.houseCode}" must match its registry id "${entry.id}"`);
    if (seenHouse.has(t.houseCode)) err(`${w}: houseCode "${t.houseCode}" is used by another trip (rooms must be unique)`);
    seenHouse.add(t.houseCode);
    if (!/^[a-z0-9_-]+$/i.test(t.houseCode)) err(`${w}: houseCode "${t.houseCode}" has odd characters (use letters/numbers/-/_)`);
  }
  if (!t.dates || !t.dates.start || !t.dates.end) err(`${w}: needs dates.start and dates.end (YYYY-MM-DDTHH:MM)`);
  else {
    ["start", "end"].forEach((k) => {
      const v = t.dates[k];
      if (isNaN(new Date(v + ":00").getTime())) err(`${w}: dates.${k} "${v}" is not a valid YYYY-MM-DDTHH:MM date`);
    });
    if (t.dates.start && t.dates.end && new Date(t.dates.end) < new Date(t.dates.start)) {
      err(`${w}: dates.end is before dates.start`);
    }
  }
  if (!Array.isArray(t.crew) || !t.crew.length) err(`${w}: needs a non-empty "crew" array`);
  else t.crew.forEach((c, i) => { if (!c || !c.name) err(`${w}: crew[${i}] missing "name"`); });
  if (t.bets != null && !Array.isArray(t.bets)) err(`${w}: "bets" must be an array`);
  if (t.bingo != null && !Array.isArray(t.bingo)) err(`${w}: "bingo" must be an array`);
  if (t.locked != null && typeof t.locked !== "boolean") err(`${w}: "locked" must be true/false`);
  checkCatalog(w + " bets", t.bets || []);
  checkBingo(w + " bingo", t.bingo || []);
}

// Bets: unique ids, each with id/q/type; type person|text.
function checkCatalog(label, arr) {
  const ids = new Set();
  arr.forEach((b, i) => {
    if (!b || !b.id) { err(`${label}[${i}]: missing "id"`); return; }
    if (ids.has(b.id)) err(`${label}: duplicate bet id "${b.id}"`);
    ids.add(b.id);
    if (!b.q) err(`${label} "${b.id}": missing "q" (the question)`);
    if (b.type && b.type !== "person" && b.type !== "text") err(`${label} "${b.id}": type must be "person" or "text"`);
  });
}
// Bingo: unique ids, each with id + t (text).
function checkBingo(label, arr) {
  const ids = new Set();
  arr.forEach((b, i) => {
    if (!b || !b.id) { err(`${label}[${i}]: missing "id"`); return; }
    if (ids.has(b.id)) err(`${label}: duplicate bingo id "${b.id}"`);
    ids.add(b.id);
    if (!b.t) err(`${label} "${b.id}": missing "t" (the square text)`);
  });
}

// --- report ---
warns.forEach((m) => console.log("⚠️  " + m));
if (errors.length) {
  errors.forEach((m) => console.log("❌ " + m));
  console.log(`\n${errors.length} problem${errors.length === 1 ? "" : "s"} found — fix before this goes live.`);
  process.exit(1);
}
console.log(`✅ Trip config is valid — ${seenIds.size} trip(s): ${[...seenIds].join(", ")}`);
