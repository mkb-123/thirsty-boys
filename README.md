# 🍺 Thirsty Boys

A little GitHub Pages PWA for a lads' weekend — live itinerary, drink tracker,
predictions, bingo and a Sunday "Weekend Wrapped" recap. It now hosts **multiple
trips**: pick one from the dropdown in the header. First outing was Birmingham
'26; Malta '27 is next.

Everything is static — no build step, no dependencies. Per-device data lives in
`localStorage`; turn on Firebase (below) to share one live tally across phones.

## What's in it

- **Trip selector** — a dropdown in the header switches between trips. Each trip
  is its own room (own drinks/bets/bingo); switching never mixes them.
- **Live itinerary** — the day as a timeline; the current stop lights up during
  the trip. "Booked"/"Walk-in" tags, 📍 map + 🚕 Uber links, Instagram links.
- **Countdown** → flips to live mode during the trip, then to the recap after.
- **Drink tracker** — tap a drink per person; live leaderboard (👑 Thirstiest
  Boy). Coffee/soft drinks are tracked separately and don't count as booze.
- **Predictions & bets** — secret calls, reveal, settle, and a ranked scoreboard.
  Bets come in two groups: **Classics** (shared by every trip) and **This trip**
  (its own venue/activity bets).
- **Bingo** — spot-it squares, first-to-spot gets the credit. Also split into
  shared **classics** + trip-local squares.
- **Weekend Wrapped** — a rich recap card you can **share as an image**.
- **Archived trips are read-only** — a finished trip shows a "view only" banner
  and blocks new writes so its record can't be changed.
- **Export** — a footer button downloads a JSON snapshot of the current trip.
- **Add to Home Screen** — installable PWA with its own icon.

## Files

```
index.html            # markup
assets/style.css      # styles (dark "night out" theme)
assets/app.js         # generic app logic — reads trips from the JSON below
assets/trips.json     # REGISTRY: the list of trips shown in the dropdown
assets/common.json    # CLASSIC bets + bingo shared by EVERY trip
assets/trip.json      # Birmingham '26 (the first trip)
assets/trips/*.json   # every other trip (e.g. malta27.json), + _template.json
assets/config.js      # OPTIONAL Firebase config for shared live sync
database.rules.json   # Firebase security rules (per-room + lock finished trips)
archive/              # committed snapshots of finished trips' data
tests/                # Playwright end-to-end suite (see tests/README.md)
```

## Trips — editing and adding

Each trip is one JSON file. `assets/trips.json` is the **registry** — the list
the dropdown shows and which file each trip loads:

```json
{
  "default": "brum26",
  "trips": [
    { "id": "brum26",  "label": "Birmingham '26 🍺", "file": "assets/trip.json" },
    { "id": "malta27", "label": "Malta '27 🌴",       "file": "assets/trips/malta27.json" }
  ]
}
```

- `default` — which trip loads when someone opens the site with no `?trip=`.
- `id` — must match the trip file's `houseCode`; it's also the `?trip=<id>` deep link.
- `label` — what shows in the dropdown.

### Edit an existing trip

Open its file (e.g. `assets/trip.json` or `assets/trips/malta27.json`) and change
what you need, then commit + push — the site picks it up on next load (it's plain
JSON, no build step). Fields:

- `city`, `year`, `tagline`, `datesLabel`, `footerLabel` — the wording everywhere.
- `dates.start` / `dates.end` — drive the countdown + live mode. Format
  `YYYY-MM-DDTHH:MM` (local time).
- `hq` — `address`, `mapsQuery`, `lat`/`lon` (feed "Walk home" + "Uber home").
- `weather` — `lat`/`lon` (forecast) + a `bbc` link + `start`/`end` dates.
- `crew` — `name` / `emoji` / `role` for each person.
- `itinerary` — days → `stops` (`t`, `iso`, `emoji`, `title`, `desc`, optional
  `tag`, `map`, `menu`, `lat`, `lon`, `insta`, `intensity`).
- `bets` — **only this trip's local bets** (venues/activities). The 34 classics
  come from `common.json` automatically.
- `bingo` — **only this trip's local squares**. The 8 classics come from
  `common.json`.
- `pubs` — the pub crawl bench (grouped by `area`, with `map`/`lat`/`lon`/`insta`).

> The **classics** (bets + bingo shared by every trip) live in `assets/common.json`.
> A local item that reuses a classic's `id` overrides it for that trip.

### Add a new trip (copy-paste)

1. **Copy the template:** `assets/trips/_template.json` → `assets/trips/<id>.json`
   (e.g. `leeds28.json`). Fill it in (see fields above). Give it a **unique
   `houseCode`** — that's its shared Firebase room *and* its reset password.
2. **Register it:** add one line to `assets/trips.json`:
   ```json
   { "id": "<id>", "label": "<City> '<YY> 🎉", "file": "assets/trips/<id>.json" }
   ```
   Use the same value for `id` and the file's `houseCode`.
3. **Commit + push.** It appears in the dropdown; open with `?trip=<id>` to jump
   straight to it. To make it the one everyone lands on, set `"default": "<id>"`.

### Archiving a finished trip

Set `"locked": true` in the trip's file. The app goes read-only for it (banner,
no new writes). For real protection, also lock it server-side (see Security).

## Shared live sync (optional)

By default everything is per-device. To make all phones share **one live tally**,
turn on Firebase (free):

1. Follow the step-by-step notes at the top of `assets/config.js`.
2. Paste your Firebase web config in. Each **trip's `houseCode`** is the room its
   phones share — no need to set a global one.
3. Commit, push, open the site on every phone (on the same trip).

A badge under the Drink tracker shows **🟢 Live** when synced. Writes are granular
(per-drink deltas, keyed log entries, first-writer-wins bingo claims), so two
phones acting at once don't clobber each other. Firebase web keys are public by
design; access is controlled by database rules.

## Security (Firebase rules)

`database.rules.json` keeps every room readable but blocks writes to any trip in
a `locked` map — so a finished trip can be frozen and never overwritten.

1. Paste its `rules` into **Realtime Database → Rules** (or
   `firebase deploy --only database`).
2. To archive a trip, add `locked/<houseCode> = true` in the console (and set
   `"locked": true` in the trip file for the read-only UI).

## Tests

```bash
cd tests && npm install && node run.js
```

~280 Playwright checks across 18+ suites, run against the real app. See
`tests/README.md`.

## Run locally

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy to GitHub Pages

`.github/workflows/pages.yml` deploys on every push to the default branch. Turn
it on: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
The site publishes at `https://<user>.github.io/thirsty-boys/`.
