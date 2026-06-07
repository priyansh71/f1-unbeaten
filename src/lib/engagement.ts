// Local engagement utilities: daily missions, leaderboards, achievements
// All data persisted to localStorage under project-scoped keys.

import type {
  SimulatedRace,
  ChampionshipStanding,
} from '../types';

type MissionTemplate = {
  id: string;
  desc: string;
  kind: 'winRace' | 'podiums' | 'championship' | 'winsCount' | 'noRetirements';
  target: number;
};

export type Mission = MissionTemplate & {
  progress: number;
  completed: boolean;
};

export type LeaderboardEntry = {
  id: string; // season-timestamp
  season: number;
  date: string;
  wins: number;
  championship: boolean;
  constructor: string;
  // ephemeral fields to help evaluation (not persisted to canonical leaderboard)
  __races?: SimulatedRace[];
  __constructorStandings?: ChampionshipStanding[];
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  unlockedAt?: string;
};

const PREFIX = 'f1ub:';
const KEY_LEADERBOARD = `${PREFIX}leaderboard`;
const KEY_ACHIEVEMENTS = `${PREFIX}achievements`;
const KEY_MISSIONS = (date: string) => `${PREFIX}missions:${date}`;

function todayKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

const TEMPLATE_POOL: MissionTemplate[] = [
  { id: 'win-1', desc: 'Win at least 1 race', kind: 'winRace', target: 1 },
  { id: 'pod-3', desc: 'Finish on the podium 3 times', kind: 'podiums', target: 3 },
  { id: 'champ', desc: 'Win the championship', kind: 'championship', target: 1 },
  { id: 'wins-5', desc: 'Win 5 races', kind: 'winsCount', target: 5 },
  { id: 'no-retire', desc: 'No retirements this season', kind: 'noRetirements', target: 1 },
];

function pickDailyTemplates(dateKey: string): MissionTemplate[] {
  // deterministic pseudo-random selection based on dateKey
  const seed = Array.from(dateKey).reduce((s, c) => s + c.charCodeAt(0), 0);
  const out: MissionTemplate[] = [];
  for (let i = 0; i < 3; i += 1) {
    const idx = (seed + i * 37) % TEMPLATE_POOL.length;
    const t = TEMPLATE_POOL[idx];
    if (!out.find((o) => o.id === t.id)) out.push(t);
  }
  return out;
}

export function getDailyMissions(): Mission[] {
  const date = todayKey();
  const key = KEY_MISSIONS(date);
  const saved = load<Mission[]>(key);
  if (saved) return saved;
  const templates = pickDailyTemplates(date);
  const missions: Mission[] = templates.map((t) => ({ ...t, progress: 0, completed: false }));
  save(key, missions);
  return missions;
}

export function evaluateMissions(
  missions: Mission[],
  payload: {
    races: SimulatedRace[];
    userTeamConstructorId: string;
    constructorStandings?: ChampionshipStanding[];
  },
) {
  const { races, userTeamConstructorId } = payload;
  // compute helper stats
  const wins = races.reduce((acc, r) => {
    const winner = r.results.find((x) => x.position === 1 && x.status === 'Finished');
    return acc + (winner && winner.constructorId === userTeamConstructorId ? 1 : 0);
  }, 0);
  const podiums = races.reduce((acc, r) => {
    const p = r.results.find((x) => x.isUserDriver && x.position <= 3 && x.status === 'Finished');
    return acc + (p ? 1 : 0);
  }, 0);
  const retirements = races.reduce((acc, r) => {
    const hasUserRetire = r.results.some((x) => x.isUserDriver && x.status !== 'Finished');
    return acc + (hasUserRetire ? 1 : 0);
  }, 0);

  const updated = missions.map((m) => {
    let progress = m.progress;
    if (m.kind === 'winRace' || m.kind === 'winsCount') progress = wins;
    if (m.kind === 'podiums') progress = podiums;
    if (m.kind === 'noRetirements') progress = retirements === 0 ? 1 : 0;
    if (m.kind === 'championship') {
      // check standings for user as champion
      const isChampion = (payload.constructorStandings && payload.constructorStandings[0] && payload.constructorStandings[0].isUser) || false;
      progress = isChampion ? 1 : 0;
    }
    const completed = progress >= m.target;
    return { ...m, progress, completed };
  });

  // persist
  const date = todayKey();
  save(KEY_MISSIONS(date), updated);
  return updated;
}

export function recordResult(entry: LeaderboardEntry): { leaderboard: LeaderboardEntry[]; newlyUnlocked: Achievement[]; missions: Mission[] } {
  // update leaderboard
  const raw = load<LeaderboardEntry[]>(KEY_LEADERBOARD) ?? [];

  // deduplicate: if a very similar entry (same season, constructor, wins) exists recently, skip adding
  const isDuplicate = raw.some((r) => {
    if (r.season !== entry.season) return false;
    if (r.constructor !== entry.constructor) return false;
    if (r.wins !== entry.wins) return false;
    try {
      const td = Math.abs(Number(new Date(r.date)) - Number(new Date(entry.date)));
      return td < 5000; // within 5s -> treat as duplicate (covers StrictMode double-mount)
    } catch {
      return false;
    }
  });

  const merged = isDuplicate ? raw : [entry, ...raw];
  const sorted = merged.sort((a, b) => b.wins - a.wins || Number(new Date(b.date)) - Number(new Date(a.date))).slice(0, 50);
  save(KEY_LEADERBOARD, sorted);

  // achievements
  const known = load<Achievement[]>(KEY_ACHIEVEMENTS) ?? [];
  const unlocked: Achievement[] = [];

  const checkAndUnlock = (ach: Achievement) => {
    if (!known.find((k) => k.id === ach.id)) {
      const copy = { ...ach, unlockedAt: new Date().toISOString() };
      known.push(copy);
      unlocked.push(copy);
    }
  };

  // if detailed races were provided, compute driver- and constructor-level wins defensively
  let driverWins = 0;
  let constructorWins = entry.wins ?? 0;
  try {
    const races = entry.__races ?? [];
    driverWins = races.reduce((acc, r) => {
      const winner = r.results.find((x) => x.position === 1 && x.status === 'Finished' && x.isUserDriver);
      return acc + (winner ? 1 : 0);
    }, 0);
    // compute constructor wins from races as a fallback
    constructorWins = races.reduce((acc, r) => {
      const winner = r.results.find((x) => x.position === 1 && x.status === 'Finished');
      return acc + (winner && winner.constructorId === entry.constructor ? 1 : 0);
    }, constructorWins ?? 0);
  } catch {
    // ignore parsing errors
  }

  if (driverWins >= 1 || constructorWins >= 1) checkAndUnlock({ id: 'first-win', name: 'First Win', description: 'Win your first race' });
  if (entry.championship) checkAndUnlock({ id: 'champ', name: 'Champion', description: 'Win the championship' });
  if (entry.wins >= 10) checkAndUnlock({ id: 'win-10', name: 'Decade of Wins', description: 'Win 10 races in a single season' });
  if (entry.wins === 0) checkAndUnlock({ id: 'tough-season', name: 'Tough Season', description: 'No wins this season — try again!' });

  save(KEY_ACHIEVEMENTS, known);

  // evaluate missions for today and return them
  const missions = evaluateMissions(getDailyMissions(), { races: entry.__races ?? [], userTeamConstructorId: entry.constructor, constructorStandings: entry.__constructorStandings });

  return { leaderboard: sorted, newlyUnlocked: unlocked, missions };
}

export function getLeaderboards(): LeaderboardEntry[] {
  return load<LeaderboardEntry[]>(KEY_LEADERBOARD) ?? [];
}

export function getAchievements(): Achievement[] {
  return load<Achievement[]>(KEY_ACHIEVEMENTS) ?? [];
}
