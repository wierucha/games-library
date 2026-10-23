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
- Filters and search are kept in the URL, so views survive a refresh and can be shared
- Export the current view as CSV
- Jump-to-top on long lists
- Works offline and can be added to the home screen

**Manage** ([add-game.html](add-game.html))
- Add games with a simple form
- Edit existing library entries
- Bulk import from CSV or Excel
- Queue, undo, clear — the queue survives a refresh
- Auto backup before save
- Optional live saving on PHP hosting: log in, hit Save, and the site updates — no download or upload
- Platform name normalization (`PS3` → `PlayStation 3`)
- Input validation and duplicate detection
- Quick links to MobyGames and Metacritic

---

## Quick start

1. Fork this repo (or copy the files)
2. Replace `games.json` with your collection
3. Enable GitHub Pages — or host the files anywhere static

Open **add-game.html** to add or edit games. Use **Save** to download an updated `games.json`, then commit it.

---

## Live saving (optional, PHP hosting)

1. Open `hash-password.php` in your browser (over https), choose a username and password
2. Paste the result into `config.php`, upload it, then delete `hash-password.php`
3. Open **add-game.html**, log in, and **Save** writes straight to `games.json`

Without PHP the page falls back to downloading `games.json`. The last 10 saves are kept in `backups/`.

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
| `save.php`, `config.php` | Live saving (optional) |
| `manifest.webmanifest` | Home-screen install info |
| `favicon.svg`, `*.png` | Icons |

---

Feel free to take it and make it yours.
