import {
  hasConstructorChampionship,
  hasDriverChampionship,
} from '../lib/points';
import { recordResult, getDailyMissions, getAchievements, type Achievement } from '../lib/engagement';
import { useEffect, useState } from 'react';
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

    // record to local leaderboards / achievements / missions once on mount
    const [recorded, setRecorded] = useState(false);
    const [newAchievements, setNewAchievements] = useState(() => [] as Achievement[]);
    const [missions, setMissions] = useState(() => getDailyMissions());

    useEffect(() => {
      if (recorded) return;
      const entry = {
        id: `${season}-${Date.now()}`,
        season,
        date: new Date().toISOString(),
        wins: userCtorWins,
        championship: userWonWcc || userWonWdc,
        constructor: userTeam.constructor.constructorId,
        __races: races,
        __constructorStandings: constructorStandings,
      };
      const res = recordResult(entry);
      // apply state async to avoid synchronous cascading renders
      setTimeout(() => {
        setNewAchievements(res.newlyUnlocked);
        setMissions(res.missions);
        setRecorded(true);
      }, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


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

      {/* Missions & Achievements summary */}
      <div className="engagement-grid">
        <div className="missions-panel">
          <h3>Daily missions</h3>
          <div className="missions-cards">
            {missions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              return (
                <div key={m.id} className={`mission-card ${m.completed ? 'completed' : ''}`}>
                  <div className="mission-row-top">
                    <strong className="mission-desc">{m.desc}</strong>
                    {m.completed ? <span className="badge wins">Completed</span> : <span className="mission-progress muted">{m.progress}/{m.target}</span>}
                  </div>
                  <div className="mission-progress-bar">
                    <div className="mission-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="achievements-panel">
          <h3>Achievements</h3>
          <div className="achievements-list">
            {getAchievements().length === 0 && (
              <div className="muted">No achievements yet — try to win a race!</div>
            )}

            {getAchievements().map((a) => (
              <div key={a.id} className={`achievement-row ${newAchievements.find(n => n.id === a.id) ? 'unlocked' : ''}`}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <strong>{a.name}</strong>
                  <div className="muted small">{a.unlockedAt ? new Date(a.unlockedAt).toLocaleString() : ''}</div>
                </div>
                <div className="muted">{a.description}</div>
              </div>
            ))}

            {newAchievements.length > 0 && (
              <div className="recent-unlocked">
                <h4>New</h4>
                {newAchievements.map((a) => (
                  <div key={a.id} className="achievement-row unlocked">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <strong>{a.name}</strong>
                      <div className="muted small">{a.unlockedAt ? new Date(a.unlockedAt).toLocaleString() : ''}</div>
                    </div>
                    <div className="muted">{a.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary: show how many races each constructor won out of total */}
  {/* detailed race wins removed per request */}

      <button className="btn-primary" onClick={onRestart}>
        Roll again →
      </button>
    </section>
  );
}
