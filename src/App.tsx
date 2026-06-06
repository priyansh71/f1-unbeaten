import { useCallback, useState } from 'react';
import {
  loadCalendar,
  loadChampions,
  loadFantasyPool,
  rollSeason,
} from './api/f1';
import { BuildPhase } from './components/BuildPhase';
import { CalendarPhase } from './components/CalendarPhase';
import { HomePhase } from './components/HomePhase';
import { ResultsPhase } from './components/ResultsPhase';
import { SimulatePhase } from './components/SimulatePhase';
import { calculateStandings, simulateSeason } from './lib/simulation';
import type {
  FantasyPool,
  GamePhase,
  Race,
  SimulatedRace,
  UserTeam,
} from './types';
import './App.css';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('home');
  const [season, setSeason] = useState<number | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [fantasyPool, setFantasyPool] = useState<FantasyPool | null>(null);
  const [actualDriverChampion, setActualDriverChampion] =
    useState<UserTeam['drivers'][0]>();
  const [actualConstructorChampion, setActualConstructorChampion] =
    useState<UserTeam['constructor']>();
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  const [simulatedRaces, setSimulatedRaces] = useState<SimulatedRace[]>([]);
  const [loading, setLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCareerWins, setShowCareerWins] = useState(false);

  const handleRoll = useCallback(async () => {
    setLoading(true);
    setError(null);
    let picked = await rollSeason();
    let attempts = 0;

    while (attempts < 5) {
      try {
        setLoadingMessage(`Loading ${picked} calendar…`);
        const calendar = await loadCalendar(picked);
        setLoadingMessage(`Scouting drivers, teams & photos…`);
        const pool = await loadFantasyPool(picked);
        const champions = await loadChampions(picked);

        setSeason(picked);
        setRaces(calendar);
        setFantasyPool(pool);
        setActualDriverChampion(champions.actualDriverChampion);
        setActualConstructorChampion(champions.actualConstructorChampion);
        setPhase('calendar');
        setLoading(false);
        setLoadingMessage('');
        return;
      } catch {
        picked = await rollSeason();
        attempts += 1;
      }
    }

    setError(
      'Could not load season data. Run npm run setup-data, then try again.',
    );
    setLoading(false);
    setLoadingMessage('');
  }, []);

  const handleCalendarContinue = useCallback(() => {
    if (fantasyPool) setPhase('build');
  }, [fantasyPool]);

  const handleBuildComplete = useCallback(
    (team: UserTeam) => {
      if (!fantasyPool || !races.length) return;
      setUserTeam(team);
      setSimulatedRaces(simulateSeason(races, fantasyPool, team));
      setPhase('simulate');
    },
    [fantasyPool, races],
  );

  const handleSimulateComplete = useCallback(() => {
    setPhase('results');
  }, []);

  const handleRestart = useCallback(() => {
    setPhase('home');
    setSeason(null);
    setRaces([]);
    setFantasyPool(null);
    setActualDriverChampion(undefined);
    setActualConstructorChampion(undefined);
    setUserTeam(null);
    setSimulatedRaces([]);
    setError(null);
    setLoadingMessage('');
    setPoolLoading(false);
    setShowCareerWins(false);
  }, []);

  const standings =
    userTeam && simulatedRaces.length > 0
      ? calculateStandings(simulatedRaces, userTeam)
      : null;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/f1-logo.svg" alt="Formula 1" className="f1-logo" />
          <div className="brand-text">
            <span className="logo-text">Unbeaten</span>
            <p className="tagline">Dream Season · 1950 — 2025</p>
          </div>
        </div>
      </header>

      <main className="main">
        {phase === 'home' && (
          <HomePhase
            onRoll={handleRoll}
            loading={loading}
            loadingMessage={loadingMessage}
            error={error}
          />
        )}

        {phase === 'calendar' && season && races.length > 0 && (
          <CalendarPhase
            season={season}
            races={races}
            showCareerWins={showCareerWins}
            onShowCareerWinsChange={setShowCareerWins}
            onContinue={handleCalendarContinue}
            loading={poolLoading}
            loadingMessage={loadingMessage}
            error={error}
          />
        )}

        {phase === 'build' && season && fantasyPool && (
          <BuildPhase
            season={season}
            drivers={fantasyPool.drivers}
            constructors={fantasyPool.constructors}
            showCareerWins={showCareerWins}
            onComplete={handleBuildComplete}
          />
        )}

        {phase === 'simulate' && simulatedRaces.length > 0 && (
          <SimulatePhase
            races={simulatedRaces}
            onComplete={handleSimulateComplete}
          />
        )}

        {phase === 'results' && standings && userTeam && season && (
          <ResultsPhase
            season={season}
            userTeam={userTeam}
            races={simulatedRaces}
            driverStandings={standings.drivers}
            constructorStandings={standings.constructors}
            actualDriverChampion={actualDriverChampion}
            actualConstructorChampion={actualConstructorChampion}
            onRestart={handleRestart}
          />
        )}
      </main>

      <footer className="footer">
        <span>Data via F1DB (local)</span>
        <span>Roll · Build · Simulate · Champion</span>
      </footer>
    </div>
  );
}
