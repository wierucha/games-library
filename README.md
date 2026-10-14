# wierucha's Games Library

A simple mobile-friendly web app for browsing a personal game collection.

Supports multiple platforms (PC, PlayStation, Switch, PSP, etc.).

### Features
- Search by game name or developer
- Filter by rating and release year
- Platform tabs
- Region flags for console games
- Works great on phones

### How to use it for your own library

1. Fork this repo (or just download the files)
2. Replace `games.json` with your own list of games
3. Enable GitHub Pages

That's it.

### games.json format

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

**Field notes:**
- `Score` — Metacritic (or Steam rating for PC games)
- `Review Summary` — generated from the score
- `Link` — Steam store page or MobyGames page
- `ProductID` — Steam AppID or platform serial / TitleID
- `Region` — `WW`, `US`, `EU`, `JP`, etc. (shows a flag)

Feel free to steal this and make it your own.
