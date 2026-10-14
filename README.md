# wierucha's Games Library

A simple mobile-friendly web app for browsing a personal game collection.

It started as a Steam library viewer and later got support for multiple platforms (PC, PlayStation, Switch, PSP, etc.).

### Features
- Search by game name or developer
- Filter by rating and release year
- Platform tabs
- Works great on phones

### How to use it for your own library

1. Fork this repo (or just download the files)
2. Replace `games.json` with your own list of games
3. Enable GitHub Pages

That's it.

### games.json format

```json
{
  "Name": "Half-Life 2",
  "Platform": "PC",
  "Release Year": 2004,
  "Steam Review %": 97.6,
  "Review Summary": "Overwhelmingly Positive",
  "Developer": "Valve",
  "Steam Store URL": "https://store.steampowered.com/app/220",
  "App ID": 220
}
```

`Platform` can be anything you want (`PC`, `PlayStation 2`, `Nintendo Switch`, `PSP`...). New platforms automatically appear as tabs.

Feel free to steal this and make it your own.
