# wierucha's Games Library

Personal multi-platform game collection browser. Static site — no backend, no build step. Works on GitHub Pages, any static host, or offline.

Built mainly for phone use.

## Features

- Platform tabs (PlayStation, Nintendo, Xbox, PC physical/Steam, older systems…)
- Search by name, developer, or notes
- Filters: physical/digital, region, rating, year
- Sort by name, year, or score
- Light / dark theme (remembers your choice)
- Export the current filtered list as CSV
- Region flags on console games
- Sticky header on mobile
- Optional notes on cards (CIB, missing manual, etc.)

## Adding & editing games

Use **[add-game.html](add-game.html)** — no hand-editing JSON.

**Add**
- Form with required Name, Platform, Developer
- Search MobyGames / Metacritic from the form
- Platform names normalized automatically (`PS3` → `PlayStation 3`)
- Queue multiple games, undo, or clear the queue
- Bulk import from CSV / Excel (template included)
- Quick parse from a pipe-separated line

**Edit**
- Search games already in your library and update them (notes, year, score, etc.)
- Edit items still in the queue before saving

**Save**
- **Apply & download** merges the queue into your library
- Automatic timestamped backup of the previous `games.json`
- Confirm when merging a large queue

## Use it for your own library

1. Fork the repo (or copy the files)
2. Replace `games.json` with your collection
3. Enable GitHub Pages (or host the files anywhere static)

That’s it.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main library browser |
| `app.js` | App logic |
| `styles.css` | Styles |
| `games.json` | Your collection data |
| `add-game.html` | Add / edit / import tool |
| `favicon.svg` | Tab icon |

Feel free to take it and adapt it.
