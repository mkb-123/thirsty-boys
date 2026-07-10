# 🍺 Thirsty Boys — Birmingham '26

A little GitHub Pages site for four men and one weekend in Birmingham
(17–19 July). Built for **Mitul, the Sausage Twins & Mr Science**.

## What's in it

- **Live itinerary** — all three days as a timeline. During the weekend the
  current stop lights up green ("Happening now") and past stops fade out.
  "Booked" vs "Walk-in" tags on each venue, plus a 📍 map link.
- **Countdown** — ticks down to 12:00 Friday, then flips to weekend mode.
- **Drink tracker** — tap a drink type for each man, tracks totals + UK units,
  and ranks everyone on a live leaderboard (👑 Thirstiest Boy). Data is saved
  in the browser (`localStorage`), so it survives refreshes on that device.
- **Predictions & bets** — everyone logs their pre-trip calls (first to tap out,
  disc golf champ, World Cup score…); fill in the actual result and settle up.
- **The Awards** — hand out superlatives Sunday morning; tap a name to crown a winner.
- **Off-licence run** — a BYOB checklist for the Balti Triangle pit stop; tick
  items off and add your own.
- **Quote wall** — capture the daft things said all weekend, attributed and timestamped.
- **Crew roster** — rename anyone by editing their name in the tracker.
- **Route maps** — each day has a 🗺️ link that opens a Google Maps route through
  that day's venues in order.
- **Add to Home Screen** — installable as a phone app (PWA manifest + icons);
  opens full-screen with its own beer-mug icon.

Everything is static — no build step, no dependencies. All data is saved in the
browser (`localStorage`) per device.

## Add to Home Screen

- **iPhone (Safari):** open the site → Share → *Add to Home Screen*.
- **Android (Chrome):** open the site → ⋮ menu → *Install app* / *Add to Home screen*.

It launches full-screen with the beer-mug icon.

## Files

```
index.html         # markup
assets/style.css   # styles (dark "night out" theme)
assets/app.js      # itinerary data, countdown, live-now, tracker, sync
assets/config.js   # OPTIONAL Firebase config for shared live sync
```

## Shared live sync (optional)

By default everything is saved per-device. To make all four phones share **one
live tally** — drinks, bets, awards, shopping list and quotes updating in real
time — turn on Firebase (free):

1. Follow the step-by-step instructions at the top of `assets/config.js`.
2. Paste your Firebase web config in and pick a shared `houseCode`.
3. Commit, push, and open the site on every phone using the same code.

A badge under the Drink Tracker heading shows the status: **🟢 Live** when
synced, **📴 this device only** otherwise. The Firebase web keys are safe to
commit — they're public by design; access is controlled by database rules
(a sample ruleset is in `config.js`). Sync is last-write-wins on the whole
state, which is plenty for four mates tapping pints.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy to GitHub Pages

A workflow (`.github/workflows/pages.yml`) deploys the site automatically on
every push to the default branch. To turn it on:

1. Push these files to the default branch (e.g. `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. The site publishes at `https://<user>.github.io/thirsty-boys/`.

> Note: without Firebase (see above) the tracker stores drinks per-device, so
> each phone keeps its own tally — pick one "house phone", or turn on shared
> sync to have all four phones share a single live count.
