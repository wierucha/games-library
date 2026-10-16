# wierucha's Games Library

Personal game collection browser. Built as a static site so it runs anywhere (GitHub Pages, any web host, or even offline).

Made primarily for phone use, but works fine on desktop too.

## Features

- Platform tabs (PlayStation, Nintendo, Xbox, PC physical/Steam, older systems…)
- Search by name or developer
- Filters: physical/digital, region, rating, year
- Sort by name, year, or score
- Light / dark theme (remembers your choice)
- Export the current filtered list as CSV
- Region flags on console games
- Sticky header so search and filters stay reachable while scrolling

## How to use it for your own library

1. Fork the repo (or just copy the files)
2. Replace `games.json` with your own data
3. Turn on GitHub Pages (or drop the files on any static host)

That's it. No build step, no backend.

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

- `Score` — Metacritic score, or Steam rating percentage for digital PC games
- `Review Summary` — derived from the score (Overwhelmingly Positive / Very Positive / Mostly Positive / Mixed / Mostly Negative)
- `Link` — MobyGames, Steam page, or whatever you prefer
- `ProductID` — platform serial, TitleID, or Steam AppID
- `Region` — `WW`, `US`, `EU`, `JP`, `ASIA`, etc. (a flag is shown when available)
- `Platform` — free text; tabs are generated automatically from whatever platforms exist in the file

Feel free to take it and adapt it.
