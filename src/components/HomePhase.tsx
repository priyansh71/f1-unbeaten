// inline SVG used for the hero car to avoid external asset loading

interface Props {
  onRoll: () => void;
  loading: boolean;
  loadingMessage?: string;
  error: string | null;
}

export function HomePhase({
  onRoll,
  loading,
  loadingMessage,
  error,
}: Props) {
  return (
    <section className="phase home-phase">
      <div className="home-hero-visual simple-hero">
        <div className="hero-copy">
          <h1 className="hero-title">Build your dream team.</h1>
          <p style={{ maxWidth: 640, margin: '0.5rem auto 1.25rem', color: 'var(--text-muted)' }}>
            Pick a constructor and two drivers from across F1 history, then simulate the season — did you win them all?
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && loadingMessage && (
        <>
          <div className="spinner" aria-hidden="true" />
          <p className="loading-msg">{loadingMessage}</p>
        </>
      )}

      <button
        className="btn-primary dice-btn"
        onClick={onRoll}
        disabled={loading}
      >
        {loading ? 'Working…' : 'Pick my team →'}
      </button>
    </section>
  );
}
