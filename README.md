# wierucha's Games Library

A personal multi-platform game collection browser.

Static site — no backend, no build step. Runs on GitHub Pages, any static host, or offline after the first visit.

Made primarily for phone use.

---

## Features

**Browse**
- Platform tabs (PlayStation, Nintendo, Xbox, PC physical / Steam, older systems…)
- Search by name, developer, or notes
- Filters: physical / digital, region, rating, year
- Sort by name, year, or score
- Light & dark theme
- Export the current view as CSV
- Jump-to-top on long lists
- Works offline (service worker)

**Manage** ([add-game.html](add-game.html))
- Add games with a simple form
- Edit existing library entries
- Bulk import from CSV or Excel
- Queue, undo, clear
- Auto backup before save
- Platform name normalization (`PS3` → `PlayStation 3`)
- Quick links to MobyGames and Metacritic

---

## Quick start

1. Fork this repo (or copy the files)
2. Replace `games.json` with your collection
3. Enable GitHub Pages — or host the files anywhere static

Open **add-game.html** to add or edit games. Use **Save** to download an updated `games.json`, then commit it.

---

## Files

| File | Role |
|------|------|
| `index.html` | Main library |
| `app.js` | App logic |
| `styles.css` | Styles |
| `games.json` | Your data |
| `add-game.html` | Add / edit / import |
| `sw.js` | Offline cache |
| `favicon.svg` | Tab icon |

---

Feel free to take it and make it yours.
