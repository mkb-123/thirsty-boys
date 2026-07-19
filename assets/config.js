/* ==========================================================================
   Thirsty Boys — shared sync config
   --------------------------------------------------------------------------
   OPTIONAL. Leave this as-is and the site works per-device (localStorage).

   To make ALL four phones share ONE live tally (drinks, bets, awards,
   shopping list, quotes), turn on Firebase — it's free and takes 5 minutes:

     1. Go to https://console.firebase.google.com  →  Add project
        (skip Google Analytics, it's not needed).
     2. Build → Realtime Database → Create Database.
        Pick a location, then choose "Start in test mode" (fine for a
        weekend — see the note at the bottom to lock it down later).
     3. Project Overview → the </> "Web" icon → register an app (any nickname).
        Firebase shows you a `firebaseConfig` object. Copy its values below.
        Make sure `databaseURL` is included — if it's missing, grab it from
        the Realtime Database page (looks like
        https://YOUR-PROJECT-default-rtdb.europe-west1.firebasedatabase.app).
     4. Pick a shared `houseCode` (any word) and tell the other three lads.
        Everyone using the same code sees the same live data.
     5. Commit + push. Open the site on all four phones — you're synced. 🟢

   Note: the values below are NOT secrets. Firebase web config is meant to be
   public; access is controlled by database rules, not by hiding these keys.
   ========================================================================== */
window.THIRSTY_CONFIG = {
  // FALLBACK ONLY. Each trip now carries its own houseCode in its trip file
  // (assets/trip.json / assets/trips/*.json), and THAT is the room every phone
  // shares for that trip. This value is used only if a trip file has none.
  houseCode: "brum26",

  // Paste your Firebase web config here. Leave apiKey/databaseURL blank to
  // stay in per-device mode.
  firebase: {
    apiKey: "",
    authDomain: "thirstyboys-61919.firebaseapp.com",
    databaseURL: "https://thirstyboys-61919-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "thirstyboys-61919",
    storageBucket: "thirstyboys-61919.appspot.com",
    messagingSenderId: "",
    appId: "",
  },
};

/* --------------------------------------------------------------------------
   Optional — lock down your database once it's working.
   In Realtime Database → Rules, paste this so only your house's data is
   readable/writable (still open, but scoped — fine for a mates' weekend):

   The recommended rules live in database.rules.json at the repo root — they
   keep every room readable but block writes to any trip listed in a `locked`
   map, so a FINISHED trip can be frozen (add locked/<code> = true in the
   console) and never accidentally overwritten. Paste that file's `rules` into
   Realtime Database → Rules, or `firebase deploy --only database`.

   Test mode expires after ~30 days; these rules don't. For anything more
   serious you'd add Firebase Anonymous Auth, but that's overkill here.
   -------------------------------------------------------------------------- */
