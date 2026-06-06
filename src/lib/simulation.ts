import { getPointsForPosition, hasFastestLapPoint } from './points';
import type {
  ChampionshipStanding,
  ConstructorOption,
  Driver,
  DriverOption,
  FantasyPool,
  GridEntry,
  Race,
  RaceResult,
  SimulatedRace,
  UserTeam,
} from '../types';

function driverName(d: Driver): string {
  return `${d.givenName} ${d.familyName}`;
}

function ratingFromWins(wins: number, maxWins: number): number {
  if (maxWins <= 0) return 45;
  return Math.min(96, 32 + (wins / maxWins) * 58);
}

export function buildFantasyGrid(
  pool: FantasyPool,
  userTeam: UserTeam,
): GridEntry[] {
  const maxDriverWins = Math.max(
    ...pool.drivers.map((d) => d.careerWins),
    1,
  );

  const userDriverIds = new Set(
    userTeam.drivers.map((d) => d.driverId),
  );

  const winMap = new Map(
    pool.drivers.map((d) => [d.driver.driverId, d.careerWins]),
  );

  const available = pool.drivers
    .filter((d) => !userDriverIds.has(d.driver.driverId))
    .sort((a, b) => b.careerWins - a.careerWins);

  const otherConstructors = pool.constructors.filter(
    (c) =>
      c.constructor.constructorId !== userTeam.constructor.constructorId,
  );

  const entries: GridEntry[] = [];
  let idx = 0;

  for (const c of otherConstructors) {
    for (let slot = 0; slot < 2 && idx < available.length; slot += 1) {
      const option = available[idx];
      idx += 1;
      entries.push({
        driverId: option.driver.driverId,
        driver: option.driver,
        constructorId: c.constructor.constructorId,
        constructor: c.constructor,
        rating: ratingFromWins(option.careerWins, maxDriverWins),
        isUserDriver: false,
        isUserConstructor: false,
      });
    }
  }

  for (const driver of userTeam.drivers) {
    const wins = winMap.get(driver.driverId) ?? 0;
    entries.push({
      driverId: driver.driverId,
      driver,
      constructorId: userTeam.constructor.constructorId,
      constructor: userTeam.constructor,
      rating: ratingFromWins(wins, maxDriverWins),
      isUserDriver: true,
      isUserConstructor: true,
    });
  }

  return entries;
}

function randomNoise(scale: number): number {
  // heavier-tailed noise: use more samples so extremes are likelier
  let sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Math.random();
  return (sum - 5) * scale;
}

function simulateRace(grid: GridEntry[], season: number, difficulty = 1): RaceResult[] {
  // difficulty >1 makes races harder (more DNFs, more variability)
  const scored = grid.map((entry) => {
    // base DNF increases with difficulty and lower-rated drivers
    const baseDnf = 0.12; // higher baseline
    const ratingFactor = Math.max(0, (90 - entry.rating) / 220);
    const dnfChance = Math.min(0.9, Math.max(0.02, baseDnf + ratingFactor * 0.35) * difficulty);
    const dnf = Math.random() < dnfChance;
    const performance = entry.rating + randomNoise(14 * difficulty);
    return { entry, performance, dnf };
  });

  const finishers = scored
    .filter((s) => !s.dnf)
    .sort((a, b) => b.performance - a.performance);

  const dnfs = scored
    .filter((s) => s.dnf)
    .sort((a, b) => b.performance - a.performance);

  const ordered = [...finishers, ...dnfs];

  let fastestLapDriverId: string | null = null;
  if (hasFastestLapPoint(season) && finishers.length > 0) {
    const topTen = finishers.slice(0, Math.min(10, finishers.length));
    const flWinner = topTen.reduce((best, cur) =>
      cur.performance > best.performance ? cur : best,
    );
    fastestLapDriverId = flWinner.entry.driverId;
  }

  return ordered.map(({ entry, dnf }, index) => {
    const position = index + 1;
    let points = dnf ? 0 : getPointsForPosition(season, position);
    if (
      !dnf &&
      fastestLapDriverId === entry.driverId &&
      position <= 10
    ) {
      points += 1;
    }

    return {
      position,
      driverId: entry.driverId,
      driver: entry.driver,
      constructorId: entry.constructorId,
      constructor: entry.constructor,
      points,
      status: dnf ? 'DNF' : 'Finished',
      isUserDriver: entry.isUserDriver,
    };
  });
}

export function simulateSeason(
  races: Race[],
  pool: FantasyPool,
  userTeam: UserTeam,
  difficulty = 1,
): SimulatedRace[] {
  const grid = buildFantasyGrid(pool, userTeam);

  return races.map((race, index) => ({
    round: index + 1,
    raceName: race.raceName,
    circuit: {
      circuitId: race.Circuit.circuitId,
      circuitName: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      wikiUrl: race.Circuit.url ?? race.Circuit.wikiUrl,
      layoutUrl: race.Circuit.layoutUrl ?? null,
    },
    results: simulateRace(grid, parseInt(race.season, 10), difficulty),
  }));
}

export function calculateStandings(
  simulatedRaces: SimulatedRace[],
  userTeam: UserTeam,
): {
  drivers: ChampionshipStanding[];
  constructors: ChampionshipStanding[];
} {
  const driverPoints = new Map<
    string,
    { points: number; wins: number; name: string; isUser: boolean }
  >();
  const constructorPoints = new Map<
    string,
    { points: number; wins: number; name: string; isUser: boolean }
  >();

  const userDriverIds = new Set(
    userTeam.drivers.map((d) => d.driverId),
  );

  for (const race of simulatedRaces) {
    for (const result of race.results) {
      const dKey = result.driverId;
      const dExisting = driverPoints.get(dKey) ?? {
        points: 0,
        wins: 0,
        name: driverName(result.driver),
        isUser: userDriverIds.has(dKey),
      };
      dExisting.points += result.points;
      if (result.position === 1 && result.status === 'Finished') {
        dExisting.wins += 1;
      }
      driverPoints.set(dKey, dExisting);

      const cKey = result.constructorId;
      const cExisting = constructorPoints.get(cKey) ?? {
        points: 0,
        wins: 0,
        name: result.constructor.name,
        isUser: cKey === userTeam.constructor.constructorId,
      };
      cExisting.points += result.points;
      if (result.position === 1 && result.status === 'Finished') {
        cExisting.wins += 1;
      }
      constructorPoints.set(cKey, cExisting);
    }
  }

  const toSorted = (
    map: Map<
      string,
      { points: number; wins: number; name: string; isUser: boolean }
    >,
    idKey: 'driverId' | 'constructorId',
  ): ChampionshipStanding[] =>
    [...map.entries()]
      .map(([id, data]) => ({
        [idKey]: id,
        name: data.name,
        points: data.points,
        wins: data.wins,
        isUser: data.isUser,
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);

  return {
    drivers: toSorted(driverPoints, 'driverId'),
    constructors: toSorted(constructorPoints, 'constructorId'),
  };
}

export type { ConstructorOption, DriverOption };
