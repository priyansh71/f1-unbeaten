import {
  hasConstructorChampionship,
  hasDriverChampionship,
} from '../lib/points';
import type {
  ChampionshipStanding,
  Constructor,
  Driver,
  SimulatedRace,
  UserTeam,
} from '../types';

interface Props {
  season: number;
  userTeam: UserTeam;
  races: SimulatedRace[];
  driverStandings: ChampionshipStanding[];
  constructorStandings: ChampionshipStanding[];
  actualDriverChampion?: Driver;
  actualConstructorChampion?: Constructor;
  onRestart: () => void;
}

function driverLabel(d: Driver): string {
  return `${d.givenName} ${d.familyName}`;
}

export function ResultsPhase({
  season,
  userTeam,
  races,
  driverStandings,
  constructorStandings,
  actualDriverChampion,
  actualConstructorChampion,
  onRestart,
}: Props) {
  const wdc = driverStandings[0];
  const wcc = constructorStandings[0];
  const userWdcPos =
    driverStandings.findIndex((s) => s.isUser) + 1;
  const userWccPos =
    constructorStandings.findIndex((s) => s.isUser) + 1;
  const userWonWdc = wdc?.isUser ?? false;
  const userWonWcc = wcc?.isUser ?? false;

  return (
    <section className="phase results-phase">
      <p className="phase-label">{season} · Simulated</p>

      <div
        className={`champion-banner ${userWonWdc || userWonWcc ? 'victory' : 'defeat'}`}
      >
        {userWonWdc && userWonWcc && (
          <>
            <h2>Double champion!</h2>
            <p>You won both WDC and WCC</p>
          </>
        )}
        {userWonWdc && !userWonWcc && (
          <>
            <h2>World Drivers&apos; Champion!</h2>
            <p>Your driver took the WDC</p>
          </>
        )}
        {!userWonWdc && userWonWcc && (
          <>
            <h2>Constructors&apos; Champions!</h2>
            <p>Your team won the WCC</p>
          </>
        )}
        {!userWonWdc && !userWonWcc && (
          <>
            <h2>Season over</h2>
            <p>
              WDC P{userWdcPos} · WCC P{userWccPos}
            </p>
          </>
        )}
      </div>

      <div className="standings-grid">
        {hasDriverChampionship(season) && (
          <div className="standings-panel">
            <h3>World Drivers&apos; Championship</h3>
            <div className="standings-list">
              {driverStandings.slice(0, 10).map((s, i) => (
                <div
                  key={s.driverId}
                  className={`standings-row ${s.isUser ? 'user-row' : ''} ${i === 0 ? 'champion' : ''}`}
                >
                  <span className="pos">{i + 1}</span>
                  <span className="name">{s.name}</span>
                  <span className="wins">{s.wins}W</span>
                  <span className="pts">{s.points}</span>
                </div>
              ))}
            </div>
            {actualDriverChampion && (
              <p className="actual-result">
                Real {season}: {driverLabel(actualDriverChampion)}
              </p>
            )}
          </div>
        )}

        {hasConstructorChampionship(season) && (
          <div className="standings-panel">
            <h3>World Constructors&apos; Championship</h3>
            <div className="standings-list">
              {constructorStandings.slice(0, 10).map((s, i) => (
                <div
                  key={s.constructorId}
                  className={`standings-row ${s.isUser ? 'user-row' : ''} ${i === 0 ? 'champion' : ''}`}
                >
                  <span className="pos">{i + 1}</span>
                  <span className="name">{s.name}</span>
                  <span className="wins">{s.wins}W</span>
                  <span className="pts">{s.points}</span>
                </div>
              ))}
            </div>
            {actualConstructorChampion && (
              <p className="actual-result">
                Real {season}: {actualConstructorChampion.name}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="your-team">
        <strong>Your team</strong>
        <p>
          {userTeam.constructor.name} —{' '}
          {userTeam.drivers.map(driverLabel).join(' & ')}
        </p>
      </div>

      <details className="race-log">
        <summary>Full race results ({races.length} GPs)</summary>
        {races.map((race) => (
          <div key={race.round} className="race-log-entry">
            <h4>
              R{race.round} — {race.raceName}
            </h4>
            <ol>
              {race.results
                .filter((r) => r.status === 'Finished')
                .slice(0, 5)
                .map((r) => (
                  <li
                    key={r.driverId}
                    className={r.isUserDriver ? 'user-row' : ''}
                  >
                    P{r.position} {r.driver.givenName}{' '}
                    {r.driver.familyName} ({r.constructor.name}) —{' '}
                    {r.points} pts
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </details>

      <button className="btn-primary" onClick={onRestart}>
        Roll again →
      </button>
    </section>
  );
}
