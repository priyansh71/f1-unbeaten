import type { Race } from '../types';

interface Props {
  season: number;
  races: Race[];
  onContinue: () => void;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
}

export function CalendarPhase({
  season,
  races,
  onContinue,
  loading,
  loadingMessage,
  error,
}: Props) {
  return (
    <section className="phase calendar-phase">
      <p className="phase-label">{season} season</p>
      <h2 className="season-display">{races.length} races</h2>

      <div className="calendar-grid">
        {races.map((race) => (
          <article key={race.round} className="calendar-card">
            <span className="round">R{race.round}</span>
            <h3>{race.raceName}</h3>
            <p className="circuit">{race.Circuit.circuitName}</p>
          </article>
        ))}
      </div>

  {/* wins checkbox removed from tracks page; it's shown on the Build page */}

      {error && <p className="error">{error}</p>}
      {loading && loadingMessage && (
        <p className="loading-msg">{loadingMessage}</p>
      )}

      <button
        className="btn-primary"
        onClick={onContinue}
        disabled={loading}
      >
        {loading ? 'Loading teams…' : 'Pick your team →'}
      </button>
    </section>
  );
}
