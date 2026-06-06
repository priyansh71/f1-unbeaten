export function getScoringPositions(season: number): number {
  if (season >= 2010) return 10;
  if (season >= 2003) return 8;
  if (season >= 1960) return 6;
  return 5;
}

export function getPointsForPosition(
  season: number,
  position: number,
): number {
  const tables: [number, number[]][] = [
    [2010, [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]],
    [2003, [10, 8, 6, 5, 4, 3, 2, 1]],
    [1991, [10, 6, 4, 3, 2, 1]],
    [1961, [9, 6, 4, 3, 2, 1]],
    [1960, [8, 6, 4, 3, 2, 1]],
    [1950, [8, 6, 4, 3, 2]],
  ];

  for (const [from, table] of tables) {
    if (season >= from) {
      return position <= table.length ? table[position - 1] : 0;
    }
  }
  return 0;
}

export function hasFastestLapPoint(season: number): boolean {
  return season >= 2019;
}

export function hasConstructorChampionship(season: number): boolean {
  return season >= 1958;
}

export function hasDriverChampionship(season: number): boolean {
  return season >= 1950;
}
