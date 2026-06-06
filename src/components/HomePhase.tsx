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
        <div className="hero-trophy">
          <img src="/trophy.png" alt="Trophy" className="hero-img trophy-img" />
        </div>

        <div className="hero-car">
          <img src="/car.png" alt="F1 car" className="hero-img car-img" />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && loadingMessage && (
        <p className="loading-msg">{loadingMessage}</p>
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
