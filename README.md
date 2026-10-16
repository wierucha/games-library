# wierucha's Games Library

Personal game collection browser. Static site — no backend, no build step. Runs on GitHub Pages, any static host, or offline.

Built mainly for phone use.

## Features

- Platform tabs (PlayStation, Nintendo, Xbox, PC physical/Steam, older systems…)
- Search by name or developer
- Filters: physical/digital, region, rating, year
- Sort by name, year, or score
- Light / dark theme (remembers your choice)
- Export the current filtered list as CSV
- Region flags on console games
- Sticky header so search and filters stay visible while scrolling

## Adding games

Use **`add-game.html`** instead of editing JSON by hand.

1. Open `add-game.html` (locally or on the site)
2. Load your current `games.json` (it tries automatically)
3. Fill in the form
   - **Search MobyGames** / **Search Metacritic** open the right pages so you can copy score, year, developer, link
   - Platform names are normalized on submit (e.g. `PS3` → `PlayStation 3`) so you don't create duplicate tabs
4. Queue as many games as you want
5. Hit **Download updated JSON**
   - Saves a timestamped backup of the previous file first
   - Then downloads the new `games.json`
6. Replace the old file and commit/upload

## How to use it for your own library

1. Fork the repo (or copy the files)
2. Replace `games.json` with your collection
3. Enable GitHub Pages (or drop the files on any static host)

That's it.

## games.json format

```json
{
  "Name": "MotorStorm",
  "Platform": "PlayStation 3",
  "Region": "EU",
  "Release Year": 2007,
  "Score": 82,
  "Review Summary": "Very Positive",
  "Developer": "Evolution Studios",
  "Link": "https://www.mobygames.com/game/12345",
  "ProductID": "BCES-00006"
}
```

**Field notes**

- `Score` — Metacritic score, or Steam rating for digital PC games
- `Review Summary` — derived from the score (Overwhelmingly Positive / Very Positive / Mostly Positive / Mixed / Mostly Negative)
- `Link` — MobyGames, Steam, or whatever you prefer
- `ProductID` — platform serial, TitleID, or Steam AppID
- `Region` — `WW`, `US`, `EU`, `JP`, `ASIA`, `NA`, or a custom code (e.g. `DE`)
- `Platform` — free text; tabs are generated from whatever platforms exist in the file

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main app |
| `app.js` | Logic |
| `styles.css` | Styles |
| `games.json` | Your library data |
| `add-game.html` | Tool to add games without hand-editing JSON |
| `favicon.svg` | Tab icon |

Feel free to take it and adapt it.
