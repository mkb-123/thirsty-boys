# Tests

End-to-end checks for the Thirsty Boys PWA, driven by Playwright against a
headless Chromium. They run the **real committed app** (a tiny server serves
the repo root) — no build step, no staging copy.

## Running

```bash
cd tests
npm install                 # installs playwright-core
node run.js                 # run every suite
node run.js e2e malta       # run just these suites
```

Chromium: the suites look for `$CHROMIUM`, falling back to a common
pre-installed path. If neither exists, point it at your browser:

```bash
CHROMIUM=/path/to/chrome node run.js
```

`run.js` starts `server.js` (port 8735, override with `$PORT`) as its own
process, runs each file in `suites/`, and exits non-zero if any suite fails.

## What the server does (test-only)

- Serves the repo root, so suites hit the actual `assets/*` files.
- Reports `version.json` as `{ "build": "__BUILD__" }` to match the page's
  build stamp, so the in-app update checker never triggers a reload mid-test.
- Serves trip files **unlocked** so suites can exercise the live trip; the
  read-only lock is verified separately by `locked.js` against the real file.

## Suites (highlights)

| Suite | Covers |
|-------|--------|
| `e2e` | Tabs, identity modal, drink tracker, bets flow, bingo, quotes-removed |
| `betsplit` | Common vs local bets/bingo merge (`common.json` + trip locals) |
| `malta` | Malta '27 loads; per-trip identity isolation |
| `locked` | Archived trips are read-only (FAB hidden, writes blocked) + rules file |
| `reskin` | Everything trip-specific derives from `trip.json` (rebrand test) |
| `wrapped` / `recapimg` | Weekend Wrapped stats + share-as-image |
| `bragging` | Bet-based "Beef & Bragging" gossip |
| `betresult` / `didnt` / `revealall` | Bet outcomes, "didn't happen", bulk reveal |
| `softdrinks` | Coffee/soft excluded from the booze total |
| `pace` / `tripmode` / `fun` / `quickadd` / `drinkalert` / `reset` | misc |
