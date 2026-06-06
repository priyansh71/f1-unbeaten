import {
  fetchWikiConstructorImage,
  fetchWikiImage,
  mapWithConcurrency,
} from '../lib/images';
import type {
  Constructor,
  ConstructorStanding,
  Driver,
  DriverStanding,
  FantasyPool,
  Race,
} from '../types';

const DATA = '/data';

const DRIVER_COUNT = 20;
const CONSTRUCTOR_COUNT = 10;

interface Meta {
  seasons: number[];
  minSeason: number;
  maxSeason: number;
}

type DriverWins = Record<string, Record<string, number>>;

const calendarCache = new Map<number, Race[]>();
const poolCache = new Map<number, FantasyPool>();
const standingsCache = new Map<string, DriverStanding[]>();
const constructorStandingsCache = new Map<string, ConstructorStanding[]>();
const careerWinsCache = new Map<string, number>();

let metaPromise: Promise<Meta> | null = null;
let driverWinsPromise: Promise<DriverWins> | null = null;
let constructorWinsPromise: Promise<DriverWins> | null = null;

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA}/${path}`);
  if (!res.ok) {
    throw new Error(`Missing local F1 data: ${path} (run npm run setup-data)`);
  }
  return res.json() as Promise<T>;
}

async function getMeta(): Promise<Meta> {
  metaPromise ??= loadJson<Meta>('meta.json');
  return metaPromise;
}

async function getDriverWins(): Promise<DriverWins> {
  driverWinsPromise ??= loadJson<DriverWins>('driver-wins.json');
  return driverWinsPromise;
}

async function getConstructorWins(): Promise<DriverWins> {
  constructorWinsPromise ??= loadJson<DriverWins>('constructor-wins.json');
  return constructorWinsPromise;
}

function careerWins(
  winsByEntity: DriverWins,
  entityId: string,
  asOfSeason: number,
): number {
  const key = `${entityId}-${asOfSeason}`;
  const cached = careerWinsCache.get(key);
  if (cached !== undefined) return cached;

  const perYear = winsByEntity[entityId];
  if (!perYear) {
    careerWinsCache.set(key, 0);
    return 0;
  }

  let total = 0;
  for (const [year, count] of Object.entries(perYear)) {
    if (parseInt(year, 10) <= asOfSeason) total += count;
  }
  careerWinsCache.set(key, total);
  return total;
}

async function getDriverStandings(season: number): Promise<DriverStanding[]> {
  const key = String(season);
  const cached = standingsCache.get(key);
  if (cached) return cached;

  const standings = await loadJson<DriverStanding[]>(
    `driver-standings/${season}.json`,
  );
  standingsCache.set(key, standings);
  return standings;
}

async function getConstructorStandings(
  season: number,
): Promise<ConstructorStanding[]> {
  const key = String(season);
  const cached = constructorStandingsCache.get(key);
  if (cached) return cached;

  const standings = await loadJson<ConstructorStanding[]>(
    `constructor-standings/${season}.json`,
  );
  constructorStandingsCache.set(key, standings);
  return standings;
}

async function pickRandomDrivers(
  asOfSeason: number,
): Promise<{ driver: Driver; originSeason: number }[]> {
  const seen = new Set<string>();
  const picks: { driver: Driver; originSeason: number }[] = [];
  let guard = 0;

  while (picks.length < DRIVER_COUNT && guard < 80) {
    guard += 1;
    const season =
      1950 + Math.floor(Math.random() * (asOfSeason - 1950 + 1));
    const standings = await getDriverStandings(season);
    if (!standings.length) continue;

    const row = standings[Math.floor(Math.random() * standings.length)];
    if (seen.has(row.Driver.driverId)) continue;

    seen.add(row.Driver.driverId);
    picks.push({ driver: row.Driver, originSeason: season });
  }

  return picks;
}

async function pickRandomConstructors(
  asOfSeason: number,
): Promise<{ constructor: Constructor; originSeason: number }[]> {
  const seen = new Set<string>();
  const picks: { constructor: Constructor; originSeason: number }[] = [];
  let guard = 0;
  const minSeason = 1958;

  while (picks.length < CONSTRUCTOR_COUNT && guard < 60) {
    guard += 1;
    const season =
      minSeason +
      Math.floor(Math.random() * (asOfSeason - minSeason + 1));
    const standings = await getConstructorStandings(season);
    if (!standings.length) continue;

    const row = standings[Math.floor(Math.random() * standings.length)];
    if (seen.has(row.Constructor.constructorId)) continue;

    seen.add(row.Constructor.constructorId);
    picks.push({
      constructor: row.Constructor,
      originSeason: season,
    });
  }

  return picks;
}

export async function loadFantasyPool(
  asOfSeason: number,
): Promise<FantasyPool> {
  const cached = poolCache.get(asOfSeason);
  if (cached) return cached;

  const [driverPicks, constructorPicks, driverWins, constructorWins] =
    await Promise.all([
      pickRandomDrivers(asOfSeason),
      pickRandomConstructors(asOfSeason),
      getDriverWins(),
      getConstructorWins(),
    ]);

  const drivers = driverPicks.map((pick) => ({
    driver: pick.driver,
    originSeason: pick.originSeason,
    careerWins: careerWins(driverWins, pick.driver.driverId, asOfSeason),
    imageUrl: pick.driver.imageUrl ?? null,
  }));

  const constructors = constructorPicks.map((pick) => ({
    constructor: pick.constructor,
    originSeason: pick.originSeason,
    careerWins: careerWins(
      constructorWins,
      pick.constructor.constructorId,
      asOfSeason,
    ),
    imageUrl: pick.constructor.imageUrl ?? null,
  }));

  const pool = {
    drivers: drivers.sort((a, b) => b.careerWins - a.careerWins),
    constructors: constructors.sort((a, b) => b.careerWins - a.careerWins),
  };

  await Promise.all([
    mapWithConcurrency(pool.drivers, async (d) => {
      if (!d.imageUrl) {
        d.imageUrl =
          d.driver.imageUrl ?? (await fetchWikiImage(d.driver.url));
      }
    }),
    mapWithConcurrency(pool.constructors, async (c) => {
      if (!c.imageUrl) {
        c.imageUrl =
          c.constructor.imageUrl ??
          (await fetchWikiConstructorImage(c.constructor.url));
      }
    }),
  ]);

  poolCache.set(asOfSeason, pool);
  return pool;
}

export async function loadCalendar(season: number): Promise<Race[]> {
  const cached = calendarCache.get(season);
  if (cached) return cached;

  const races = await loadJson<Race[]>(`calendar/${season}.json`);
  if (races.length === 0) throw new Error(`No races found for ${season}`);

  calendarCache.set(season, races);
  return races;
}

export async function loadChampions(season: number): Promise<{
  actualDriverChampion?: Driver;
  actualConstructorChampion?: Constructor;
}> {
  try {
    const [ds, cs] = await Promise.all([
      getDriverStandings(season),
      getConstructorStandings(season),
    ]);
    return {
      actualDriverChampion: ds[0]?.Driver,
      actualConstructorChampion: cs[0]?.Constructor,
    };
  } catch {
    return {};
  }
}

export async function rollSeason(min = 1950, max = 2025): Promise<number> {
  const meta = await getMeta();
  const lo = Math.max(min, meta.minSeason);
  const hi = Math.min(max, meta.maxSeason);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
