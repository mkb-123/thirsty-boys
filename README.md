# 🍺 Thirsty Boys — Birmingham '25

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

Everything is static — no build step, no dependencies. All data is saved in the
browser (`localStorage`) per device.

## Files

```
index.html         # markup
assets/style.css   # styles (dark "night out" theme)
assets/app.js      # itinerary data, countdown, live-now, drink tracker
```

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

> Note: the tracker stores drinks per-device. Each man tracking on his own
> phone keeps his own tally — pick one "house phone" if you want a shared count.
