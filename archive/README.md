# Trip archive — Birmingham '26

Snapshots of the live shared state (the Firebase Realtime Database room
each phone synced to during the weekend), committed as a permanent record.

## brum26.json

A faithful, pretty-printed dump of `houses/brum26` from the Realtime
Database, exactly as the app stored it.

- **Trip:** Birmingham, 17–19 July 2026
- **House code:** `brum26`
- **Crew:** Mr Finance 💰, Big Ben 🔔, The Director 🎬, Dr Science 🔬
- **Pulled:** 2026-07-19T13:41Z (REST GET of `houses/brum26.json`)

### What's inside
| Key | Meaning |
|-----|---------|
| `names` | Crew display names at end of trip |
| `tallies` | Per-person drink counts by type |
| `log` | Every logged drink (`{ who, drink, ts }`), keyed by id — 165 entries |
| `bets` | Each bet's per-person `calls`, `result`, `revealed` — 44 bets |
| `bingo` | Bingo squares → index of the crew member who first spotted it |
| `quotes` | Quote(s) of the weekend |
| `round`, `present`, `shop`, `selectedDrink` | Whose-round verdict, presence, shopping list, last-picked drink |

Indices in `calls`/`bingo`/`round` map to the position in `names`
(0 = Mr Finance, 1 = Big Ben, 2 = The Director, 3 = Dr Science). A bet
`result` of `"none"` means "didn't happen"; a numeric result is the crew
index who it landed on.

### Re-importing (optional)
This is the raw tree, so it can be restored to any room:
```
curl -X PUT -d @archive/brum26.json \
  "https://thirstyboys-61919-default-rtdb.europe-west1.firebasedatabase.app/houses/<code>.json"
```
