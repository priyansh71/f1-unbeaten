import type { Race } from '../types';

interface Props {
  season: number;
  races: Race[];
  showCareerWins: boolean;
  onShowCareerWinsChange: (value: boolean) => void;
  onContinue: () => void;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
}

export function CalendarPhase({
  season,
  races,
  showCareerWins,
  onShowCareerWinsChange,
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

      <label className="option-toggle">
        <input
          type="checkbox"
          checked={showCareerWins}
          onChange={(e) => onShowCareerWinsChange(e.target.checked)}
        />
        <span className="option-toggle-text">
          <strong>Show career wins</strong>
          <span>Reveal win counts when picking drivers & teams</span>
        </span>
      </label>

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
