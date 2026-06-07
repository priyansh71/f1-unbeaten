import { useCallback, useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Driver, Constructor } from './types';
import {
  loadCalendar,
  loadChampions,
  loadFantasyPool,
  rollSeason,
} from './api/f1';
import { prefetchPoolImages } from './lib/images';
import { prefetchPoolImages as prefetchPoolImagesForPool } from './lib/images';
import { BuildPhase } from './components/BuildPhase';
import { CalendarPhase } from './components/CalendarPhase';
import { HomePhase } from './components/HomePhase';
import { ResultsPhase } from './components/ResultsPhase';
import { SimulatePhase } from './components/SimulatePhase';
import { LeaderboardPage } from './components/LeaderboardPage';
import { ProfilePage } from './components/ProfilePage';
import { getLeaderboards, getAchievements } from './lib/engagement';
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
  const [phase, setPhase] = useState<GamePhase>(() => {
    const p = window.location.pathname.slice(1);
    if (p === 'leaderboard' || p === 'profile') return p as GamePhase;
    return 'home';
  });
  const [season, setSeason] = useState<number | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [fantasyPool, setFantasyPool] = useState<FantasyPool | null>(null);
  const allDriversRef = useRef<Driver[] | null>(null);
  const allConstructorsRef = useRef<Constructor[] | null>(null);
  // refresh fantasyPool when background pool images finish loading
  usePoolImagesRefresh(setFantasyPool);

  // on app mount, prefetch a small number of likely pools during idle time
  useEffect(() => {
    let cancelled = false;
    const onIdle = () => {
      // also warm entire lists (drivers & constructors) once
      void import('./api/f1').then(async (m) => {
        try {
          const [drivers, constructors] = await Promise.all([m.getAllDrivers(), m.getAllConstructors()]);
          if (!cancelled) {
            allDriversRef.current = drivers;
            allConstructorsRef.current = constructors;
          }
        } catch {
          // ignore fetch errors
        }
      }).catch(() => {
        // ignore dynamic import errors
      });
      // pick a few seasons to warm likely pools
      const seeds = [2022, 2019, 2012];
      for (const s of seeds) {
        void loadFantasyPool(s).then(async (p) => {
          if (cancelled) return;
          try {
            await prefetchPoolImagesForPool(p);
          } catch {
            // ignore
          }
        }).catch(() => {});
      }
    };
    const id = setTimeout(onIdle, 800);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);
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
        setLoadingMessage(`Loading ${picked} season data…`);

        // fetch calendar, pool and champions in parallel to reduce wait time
        const [calendar, pool, champions] = await Promise.all([
          loadCalendar(picked),
          loadFantasyPool(picked),
          loadChampions(picked),
        ]);

        // apply results
        setSeason(picked);
        setRaces(calendar);
        // try to resolve images before showing the Build phase so images are present immediately
        try {
          const poolWithImages = await prefetchPoolImages(pool);
          setFantasyPool(poolWithImages);
        } catch {
          // fallback: show pool immediately and let background prefetch finish
          setFantasyPool(pool);
          void prefetchPoolImages(pool).then((pWithImages) => setFantasyPool(pWithImages)).catch(() => {});
        }
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
          <img
            src="/f1-logo.svg"
            alt="Formula 1"
            className="f1-logo"
            role="button"
            tabIndex={0}
            onClick={() => {
              window.history.pushState({}, '', '/');
              setPhase('home');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                window.history.pushState({}, '', '/');
                setPhase('home');
              }
            }}
          />
          <div className="brand-text">
            <span className="logo-text">21-0</span>
            <p className="tagline">Dream Season · 1950 — 2025</p>
          </div>
        </div>
        <nav className="header-nav">
          {(() => {
            const lb = getLeaderboards();
            const ach = getAchievements();
            return (
              <>
                <button
                  type="button"
                  className={`nav-link ${phase === 'leaderboard' ? 'active' : ''}`}
                  onClick={() => {
                    window.history.pushState({}, '', '/leaderboard');
                    setPhase('leaderboard');
                  }}
                  aria-label="Leaderboard"
                  title="Local leaderboard"
                >
                  <span className="nav-icon" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 21h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 21V12a4 4 0 014-4h0a4 4 0 014 4v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="nav-label">Leaderboard</span>
                  <span className="nav-badge" aria-hidden>
                    {lb.length}
                  </span>
                </button>

                <button
                  type="button"
                  className={`nav-link ${phase === 'profile' ? 'active' : ''}`}
                  onClick={() => {
                    window.history.pushState({}, '', '/profile');
                    setPhase('profile');
                  }}
                  aria-label="Profile"
                  title="Your profile"
                >
                  <span className="nav-icon" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="nav-label">Profile</span>
                  <span className="nav-badge" aria-hidden>
                    {ach.length}
                  </span>
                </button>
              </>
            );
          })()}
        </nav>
      </header>

      {/* handle back/forward navigation */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('popstate', () => { const p = location.pathname.slice(1); window.dispatchEvent(new CustomEvent('app:navigate', {detail: p})); });`,
        }}
      />

  {/* listen for our custom event to update phase */}
  <EventListener setPhase={setPhase} />

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

        {phase === 'leaderboard' && <LeaderboardPage />}

        {phase === 'profile' && <ProfilePage />}
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

function EventListener({ setPhase }: { setPhase: (p: GamePhase) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      const p = detail ?? window.location.pathname.slice(1);
      if (p === 'leaderboard' || p === 'profile' || p === 'home') setPhase(p as GamePhase);
    };
    window.addEventListener('app:navigate', handler as EventListenerOrEventListenerObject);
    return () => window.removeEventListener('app:navigate', handler as EventListenerOrEventListenerObject);
  }, [setPhase]);
  return null;
}

// refresh fantasyPool state reference when background images for the pool are ready
function usePoolImagesRefresh(setFantasyPool: Dispatch<SetStateAction<FantasyPool | null>>) {
  useEffect(() => {
    const handler = () => {
  setFantasyPool((prev: FantasyPool | null) => (prev ? { ...prev } : prev));
    };
    window.addEventListener('f1:pool-images-ready', handler as EventListener);
    return () => window.removeEventListener('f1:pool-images-ready', handler as EventListener);
  }, [setFantasyPool]);
}
// hook defined above; it's invoked inside App where `setFantasyPool` is available
