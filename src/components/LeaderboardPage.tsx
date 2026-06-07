import { useEffect, useState } from 'react';
import { getLeaderboards } from '../lib/engagement';

type ConstructorMap = Record<string, { constructorId: string; name: string }>;

export function LeaderboardPage() {
  const entries = getLeaderboards();
  const [ctors, setCtors] = useState<ConstructorMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/data/constructors.json')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setCtors(json);
      })
      .catch(() => {
        if (cancelled) return;
        setCtors(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = (id: string) => {
    if (!ctors) return id;
    return ctors[id]?.name ?? id;
  };

  return (
    <section className="phase leaderboard-phase">
      <h2>Local leaderboard</h2>
      <p className="phase-desc">Top local runs (sorted by wins)</p>

      <div className="standings-panel">
        <h3>Local runs</h3>
        <div className="standings-list">
          {/* header row with column names */}
          <div className="standings-row header">
            <span className="pos">#</span>
            <span className="name">Constructor</span>
            <span className="season">Year</span>
            <span className="wins">Wins</span>
            <span className="pts">Date / time</span>
          </div>
          {entries.length === 0 && (
            <div className="muted">No runs yet — simulate a season to appear here.</div>
          )}

          {entries.slice(0, 20).map((e, i) => {
            const totalRaces = e.__races ? e.__races.length : undefined;
            return (
              <div key={e.id} className={`standings-row ${i === 0 ? 'champion' : ''}`}>
                <span className="pos">{i + 1}</span>
                <span className="name">{displayName(e.constructor)}</span>
                <span className="season">{e.season}</span>
                <span className="wins">{e.wins}/{totalRaces ?? '–'}</span>
                <span className="pts muted">{new Date(e.date).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
