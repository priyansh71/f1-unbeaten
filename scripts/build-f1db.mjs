#!/usr/bin/env node
/**
 * Downloads F1DB JSON release and builds compact local data for the app.
 * https://github.com/f1db/f1db
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'data');
const TMP = join(ROOT, '.tmp-f1db');
const RELEASE = 'v2025.24.0';
const ZIP_URL = `https://github.com/f1db/f1db/releases/download/${RELEASE}/f1db-json-splitted.zip`;
const WIKI_API = 'https://en.wikipedia.org/api/rest_v1';
const GP_TYPES = new Set(['RACE', 'STREET', 'ROAD']);
const WIKI_DELAY_MS = 150;
const SKIP_WIKI = process.env.SKIP_WIKI_IMAGES === '1';

const NEED = [
  'f1db-seasons.json',
  'f1db-drivers.json',
  'f1db-constructors.json',
  'f1db-circuits.json',
  'f1db-countries.json',
  'f1db-grands-prix.json',
  'f1db-races.json',
  'f1db-races-race-results.json',
  'f1db-seasons-driver-standings.json',
  'f1db-seasons-constructor-standings.json',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wikiSlug(name) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
}

function wikiTitleFromSlug(url) {
  return decodeURIComponent(url.split('/wiki/')[1] ?? '');
}

function readJson(dir, name) {
  return JSON.parse(readFileSync(join(dir, name), 'utf8'));
}

function curlJson(url, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const out = execSync(
        `curl -fsSL --compressed -A "f1-unbeaten-setup/1.0" --max-time 20 ${JSON.stringify(url)}`,
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      return JSON.parse(out);
    } catch {
      if (attempt < attempts - 1) {
        execSync(`sleep ${0.4 * (attempt + 1)}`);
      }
    }
  }
  return null;
}

function mediaItemUrl(item) {
  const set = item?.srcset;
  if (!set?.length) return null;
  const best = set[set.length - 1];
  return best.src.startsWith('//') ? `https:${best.src}` : best.src;
}

function scoreTrackMedia(title, leadImage) {
  const t = title.toLowerCase().replace(/^file:/, '');
  let score = 0;
  if (/track[_\s-]?map/.test(t)) score += 120;
  if (/circuit[_\s-]?map/.test(t)) score += 110;
  if (/grand[_\s-]?prix[_\s-]?layout|_layout/.test(t)) score += 100;
  if (/circuit.*20\d{2}/.test(t) && /\.(png|svg)/.test(t)) score += 80;
  if (/_20\d{2}[^/]*\.(png|svg)/.test(t)) score += 70;
  if (/\.svg$/.test(t)) score += 40;
  if (/\.png$/.test(t) && /circuit/.test(t)) score += 30;
  if (leadImage && /\.(png|svg)/.test(t) && !/logo/.test(t)) score += 25;
  if (/logo/.test(t)) score -= 100;
  if (/\.jpe?g$/.test(t)) score -= 60;
  if (
    /skysat|panorama|tower|crowd|paddock|formulae|nascar|rally|motogp|alpine|grand prix at|_gp_/.test(
      t,
    )
  ) {
    score -= 50;
  }
  return score;
}

function fetchWikiTrackLayout(title) {
  const data = curlJson(
    `${WIKI_API}/page/media-list/${encodeURIComponent(title)}`,
  );
  const images = (data?.items ?? []).filter((item) => item.type === 'image');
  let best = null;
  let bestScore = 0;
  for (const item of images) {
    const score = scoreTrackMedia(item.title, item.leadImage ?? false);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best && bestScore > 0 ? mediaItemUrl(best) : null;
}

async function enrichCircuitLayouts(circuits) {
  const list = Object.values(circuits);
  let done = 0;
  for (const circuit of list) {
    const title = wikiTitleFromSlug(circuit.wikiUrl);
    circuit.layoutUrl = fetchWikiTrackLayout(title);
    done += 1;
    if (done % 10 === 0 || done === list.length) {
      process.stdout.write(`\r  track layouts: ${done}/${list.length}`);
    }
    await sleep(WIKI_DELAY_MS);
  }
  process.stdout.write('\n');
}

async function main() {
  const zipPath = join(TMP, 'f1db.zip');
  mkdirSync(TMP, { recursive: true });

  if (!existsSync(zipPath)) {
    execSync(`curl -fsSL "${ZIP_URL}" -o "${zipPath}"`, { stdio: 'inherit' });
  }

  const extractDir = join(TMP, 'json');
  if (!existsSync(join(extractDir, NEED[0]))) {
    console.log('Extracting…');
    rmSync(extractDir, { recursive: true, force: true });
    mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -q -o "${zipPath}" ${NEED.map((f) => `"${f}"`).join(' ')} -d "${extractDir}"`);
  }

  const seasons = readJson(extractDir, 'f1db-seasons.json').map((s) => s.year);
  const countries = Object.fromEntries(
    readJson(extractDir, 'f1db-countries.json').map((c) => [
      c.id,
      c.name,
    ]),
  );
  const grandsPrix = Object.fromEntries(
    readJson(extractDir, 'f1db-grands-prix.json').map((g) => [g.id, g]),
  );
  const circuitsRaw = readJson(extractDir, 'f1db-circuits.json');
  const circuits = Object.fromEntries(
    circuitsRaw.map((c) => [
      c.id,
      {
        circuitId: c.id,
        circuitName: c.fullName,
        locality: c.placeName,
        country: countries[c.countryId] ?? c.countryId,
        wikiUrl: wikiSlug(c.fullName),
        layoutUrl: null,
        imageUrl: null,
      },
    ]),
  );

  const drivers = Object.fromEntries(
    readJson(extractDir, 'f1db-drivers.json').map((d) => [
      d.id,
      {
        driverId: d.id,
        code: d.abbreviation ?? '',
        givenName: d.firstName,
        familyName: d.lastName,
        nationality: countries[d.nationalityCountryId] ?? d.nationalityCountryId,
        permanentNumber: d.permanentNumber
          ? String(d.permanentNumber)
          : undefined,
        url: wikiSlug(d.fullName || d.name),
        imageUrl: null,
      },
    ]),
  );

  const constructors = Object.fromEntries(
    readJson(extractDir, 'f1db-constructors.json').map((c) => [
      c.id,
      {
        constructorId: c.id,
        name: c.fullName || c.name,
        nationality: countries[c.countryId] ?? c.countryId,
        url: wikiSlug(c.fullName || c.name),
        imageUrl: null,
      },
    ]),
  );

  if (SKIP_WIKI) {
    console.log('Skipping Wikipedia images (SKIP_WIKI_IMAGES=1)');
  } else {
    console.log('Fetching track layout images…');
    await enrichCircuitLayouts(circuits);
  }

  const driverWins = {};
  const constructorWins = {};
  for (const row of readJson(extractDir, 'f1db-races-race-results.json')) {
    if (row.positionNumber !== 1) continue;
    const y = String(row.year);
    driverWins[row.driverId] ??= {};
    driverWins[row.driverId][y] = (driverWins[row.driverId][y] ?? 0) + 1;
    constructorWins[row.constructorId] ??= {};
    constructorWins[row.constructorId][y] =
      (constructorWins[row.constructorId][y] ?? 0) + 1;
  }

  const calendars = {};
  for (const race of readJson(extractDir, 'f1db-races.json')) {
    if (!GP_TYPES.has(race.circuitType)) continue;
    const gp = grandsPrix[race.grandPrixId];
    const circuit = circuits[race.circuitId];
    if (!gp || !circuit) continue;

    const entry = {
      season: String(race.year),
      round: String(race.round),
      raceName: gp.fullName,
      date: race.date,
      Circuit: {
        ...circuit,
        url: circuit.wikiUrl,
        Location: {
          locality: circuit.locality,
          country: circuit.country,
        },
      },
    };

    calendars[race.year] ??= [];
    calendars[race.year].push(entry);
  }

  for (const year of Object.keys(calendars)) {
    calendars[year].sort(
      (a, b) => parseInt(a.round, 10) - parseInt(b.round, 10),
    );
  }

  const driverStandings = {};
  for (const row of readJson(
    extractDir,
    'f1db-seasons-driver-standings.json',
  )) {
    const driver = drivers[row.driverId];
    if (!driver) continue;
    const standing = {
      position: row.positionText,
      points: String(row.points ?? 0),
      wins: String(driverWins[row.driverId]?.[String(row.year)] ?? 0),
      Driver: driver,
      Constructors: [],
    };
    driverStandings[row.year] ??= [];
    driverStandings[row.year].push(standing);
  }

  for (const year of Object.keys(driverStandings)) {
    driverStandings[year].sort(
      (a, b) => parseInt(a.position, 10) - parseInt(b.position, 10),
    );
  }

  const constructorStandings = {};
  for (const row of readJson(
    extractDir,
    'f1db-seasons-constructor-standings.json',
  )) {
    const constructor = constructors[row.constructorId];
    if (!constructor) continue;
    const standing = {
      position: row.positionText,
      points: String(row.points ?? 0),
      wins: String(
        constructorWins[row.constructorId]?.[String(row.year)] ?? 0,
      ),
      Constructor: constructor,
    };
    constructorStandings[row.year] ??= [];
    constructorStandings[row.year].push(standing);
  }

  for (const year of Object.keys(constructorStandings)) {
    constructorStandings[year].sort(
      (a, b) => parseInt(a.position, 10) - parseInt(b.position, 10),
    );
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'calendar'), { recursive: true });
  mkdirSync(join(OUT, 'driver-standings'), { recursive: true });
  mkdirSync(join(OUT, 'constructor-standings'), { recursive: true });

  writeFileSync(
    join(OUT, 'meta.json'),
    JSON.stringify({
      source: 'f1db',
      release: RELEASE,
      seasons,
      minSeason: Math.min(...seasons),
      maxSeason: Math.max(...seasons),
    }),
  );
  writeFileSync(join(OUT, 'drivers.json'), JSON.stringify(drivers));
  writeFileSync(join(OUT, 'constructors.json'), JSON.stringify(constructors));
  writeFileSync(join(OUT, 'circuits.json'), JSON.stringify(circuits));
  writeFileSync(join(OUT, 'driver-wins.json'), JSON.stringify(driverWins));
  writeFileSync(
    join(OUT, 'constructor-wins.json'),
    JSON.stringify(constructorWins),
  );

  for (const [year, races] of Object.entries(calendars)) {
    writeFileSync(
      join(OUT, 'calendar', `${year}.json`),
      JSON.stringify(races),
    );
  }
  for (const [year, rows] of Object.entries(driverStandings)) {
    writeFileSync(
      join(OUT, 'driver-standings', `${year}.json`),
      JSON.stringify(rows),
    );
  }
  for (const [year, rows] of Object.entries(constructorStandings)) {
    writeFileSync(
      join(OUT, 'constructor-standings', `${year}.json`),
      JSON.stringify(rows),
    );
  }

  const y2024 = calendars[2024]?.length ?? 0;
  console.log(`Built local F1DB → public/data (${seasons.length} seasons, 2024 has ${y2024} races)`);
}

await main();
