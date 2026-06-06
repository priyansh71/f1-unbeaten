# F1 Unbeaten

Dream F1 season simulator inspired by [7a0](https://7a0.com.br/en).

Roll a random season (1950–2025) for the **calendar only**. Drivers and constructors are pulled from **random eras** with career win counts through that year.

## Fonts

Uses [Orbitron](https://fonts.google.com/specimen/Orbitron) for body text, headings, cards, calendars, and driver data (loaded via `src/fonts.css`).

## Requirements

- Node.js 20+
- npm

## Run the app

### First time

```bash
git clone <repo-url>
cd f1-unbeaten
npm install
```

`npm install` runs `postinstall` and builds local F1 data into `public/data/` if it is missing (downloads [F1DB](https://github.com/f1db/f1db) and fetches track layout images — can take a couple of minutes).

### Development

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Use **Roll** on the home screen to start a season.

### Production build

```bash
npm run build
npm run preview
```

`preview` serves the production build locally (default `http://localhost:4173`).

### If season data fails to load

Rebuild the local database:

```bash
npm run setup-data
```

Skip Wikipedia track images for a faster rebuild:

```bash
SKIP_WIKI_IMAGES=1 npm run setup-data
```

### Other commands

| Command | Purpose |
|---------|---------|
| `npm run lint` | Run ESLint |
| `npm run setup-data` | Download F1DB and rebuild `public/data/` |

## Data

Seasons, calendars, drivers, constructors, and standings come from a **local copy** of [F1DB](https://github.com/f1db/f1db) (CC BY 4.0), built into `public/data/` by `scripts/build-f1db.mjs`. No live F1 API calls during play.

Track layouts are baked into the data during setup. Driver portraits and constructor car photos load from Wikipedia in the browser when you roll a season.

## How it works

1. **Roll** — random season + full race calendar from local F1 data
2. **Build** — pick 1 constructor + 2 drivers from a random cross-era pool (career wins shown)
3. **Simulate** — race-by-race results weighted by career wins; images from Wikipedia where available
4. **Results** — full points tables with era-correct scoring (1950 rules through modern 25-point system)
