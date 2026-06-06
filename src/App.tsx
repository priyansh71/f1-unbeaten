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
  const [difficulty, setDifficulty] = useState<number>(1);
  // footer uses static numbers for now

  const handleRoll = useCallback(async () => {
    setLoading(true);
    setError(null);
    let picked = await rollSeason();
    let attempts = 0;

    while (attempts < 5) {
      try {
        setLoadingMessage(`Loading ${picked} calendar…`);
        const calendar = await loadCalendar(picked);
        setLoadingMessage(`Scouting drivers, constructors and tracks…`);
        const pool = await loadFantasyPool(picked);
        const champions = await loadChampions(picked);

        setSeason(picked);
        setRaces(calendar);
        setFantasyPool(pool);
        setActualDriverChampion(champions.actualDriverChampion);
        setActualConstructorChampion(champions.actualConstructorChampion);
  // Show constructors & drivers first (build) with wins checkbox
  setPhase('build');
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

  // (Flow now handled inline when build/calendar complete)

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
    <div className={`app ${phase === 'home' ? 'home-full' : ''}`}>
      <header className="header">
        <div className="brand">
          <img src="/f1-logo.svg" alt="Formula 1" className="f1-logo" />
          <div className="brand-text">
            <span className="logo-text">21-0</span>
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

        {phase === 'build' && season && fantasyPool && (
          <BuildPhase
            season={season}
            drivers={fantasyPool.drivers}
            constructors={fantasyPool.constructors}
            showCareerWins={showCareerWins}
            onShowCareerWinsChange={setShowCareerWins}
            onComplete={(team: UserTeam, d: number) => {
              // after picking drivers/constructors, save difficulty and show the tracks page
              setUserTeam(team);
              setDifficulty(d);
              setPhase('calendar');
            }}
          />
        )}

        {phase === 'calendar' && season && races.length > 0 && (
          <CalendarPhase
            season={season}
            races={races}
            onContinue={() => {
              if (fantasyPool && userTeam) {
                // simulate using chosen team and difficulty
                setSimulatedRaces(simulateSeason(races, fantasyPool, userTeam, difficulty));
                setPhase('simulate');
              }
            }}
            loading={poolLoading}
            loadingMessage={loadingMessage}
            error={error}
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
        <div className="footer-top-stats">
          <div className="stat">
            <div className="stat-num">185</div>
            <div className="stat-label">constructors</div>
          </div>
          <div className="stat">
            <div className="stat-num">77</div>
            <div className="stat-label">tracks</div>
          </div>
          <div className="stat">
            <div className="stat-num">915</div>
            <div className="stat-label">drivers</div>
          </div>
        </div>

        <div className="footer-middle">made by Priyansh ❤️</div>
      </footer>
    </div>
  );
}
