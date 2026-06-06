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
  const userWonWdc = wdc?.isUser ?? false;
  const userWonWcc = wcc?.isUser ?? false;
  const userCtorWins = races.reduce((acc, race) => {
    const winner = race.results.find((r) => r.position === 1 && r.status === 'Finished');
    return acc + (winner && winner.constructorId === userTeam.constructor.constructorId ? 1 : 0);
  }, 0);

  return (
    <section className="phase results-phase">
      <p className="phase-label">{season} · Simulated</p>
      <div
        className={`champion-banner ${userWonWdc || userWonWcc ? 'victory' : 'defeat'}`}
      >
        <>
          <h2 className="wins-count">{userCtorWins}/{races.length} wins</h2>
        </>
      </div>

  {/* detailed standings and lists follow */}

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
                Actual winner in {season}: {driverLabel(actualDriverChampion)}
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
                Actual winner in {season}: {actualConstructorChampion.name}
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

      {/* Summary: show how many races each constructor won out of total */}
  {/* detailed race wins removed per request */}

      <button className="btn-primary" onClick={onRestart}>
        Roll again →
      </button>
    </section>
  );
}
