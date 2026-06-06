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
      <h1 className="hero-title">
        Roll the dice.
        <br />
        <em>Build your team.</em>
      </h1>

      {error && <p className="error">{error}</p>}
      {loading && loadingMessage && (
        <p className="loading-msg">{loadingMessage}</p>
      )}

      <button
        className="btn-primary dice-btn"
        onClick={onRoll}
        disabled={loading}
      >
        {loading ? 'Rolling…' : 'Roll →'}
      </button>
    </section>
  );
}
