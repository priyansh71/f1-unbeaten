import { useEffect, useMemo, useState } from 'react';
import {
  fetchWikiTrackLayout,
  isSvgImage,
  mapWithConcurrency,
  trackLayoutPlaceholder,
} from '../lib/images';
import type { SimulatedRace } from '../types';

interface Props {
  races: SimulatedRace[];
  onComplete: () => void;
}

function driverName(r: SimulatedRace['results'][0]): string {
  return `${r.driver.givenName} ${r.driver.familyName}`;
}

export function SimulatePhase({ races, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [layoutImage, setLayoutImage] = useState<string | null>(null);

  const current = races[currentIndex];
  const isLast = currentIndex >= races.length - 1;

  const uniqueCircuits = useMemo(
    () =>
      Array.from(
        new Map(
          races.map((race) => [race.circuit.circuitId, race.circuit]),
        ).values(),
      ),
    [races],
  );

  useEffect(() => {
    void mapWithConcurrency(
      uniqueCircuits,
      async (circuit) => {
        if (circuit.layoutUrl !== undefined) return;
        circuit.layoutUrl = await fetchWikiTrackLayout(circuit.wikiUrl);
      },
      3,
      150,
    );
  }, [uniqueCircuits]);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [currentIndex]);

  useEffect(() => {
    if (!visible || isLast) return;
    const t = setTimeout(() => setCurrentIndex((i) => i + 1), 1800);
    return () => clearTimeout(t);
  }, [visible, isLast, currentIndex]);

  useEffect(() => {
    const baked = current.circuit.layoutUrl;
    if (baked) {
      setLayoutImage(baked);
      return;
    }

    let cancelled = false;
    setLayoutImage(null);

    void fetchWikiTrackLayout(current.circuit.wikiUrl).then((url) => {
      if (cancelled) return;
      current.circuit.layoutUrl = url;
      setLayoutImage(url);
    });

    return () => {
      cancelled = true;
    };
  }, [current]);

  const topResults = current.results
    .filter((r) => r.status === 'Finished')
    .slice(0, 10);

  const layoutSrc =
    layoutImage ?? trackLayoutPlaceholder(current.circuit.circuitName);
  const layoutIsSvg = isSvgImage(layoutImage);

  return (
    <section className="phase simulate-phase">
      <p className="phase-label">
        Round {current.round} / {races.length}
      </p>

      <div className={`race-hero ${visible ? 'visible' : ''}`}>
        <div className="track-layout-frame">
          <img
            src={layoutSrc}
            alt={`${current.circuit.circuitName} track layout`}
            className={`circuit-layout-img${layoutIsSvg ? ' is-svg' : ''}`}
          />
        </div>
        <div className="race-hero-overlay">
          <p className="layout-label">Track layout</p>
          <h2 className="race-title">{current.raceName}</h2>
          <p className="circuit-name">
            {current.circuit.circuitName} · {current.circuit.locality},{' '}
            {current.circuit.country}
          </p>
        </div>
      </div>

      <div className={`results-table ${visible ? 'visible' : ''}`}>
        <div className="results-header">
          <span>Pos</span>
          <span>Driver</span>
          <span>Team</span>
          <span>Pts</span>
        </div>
        {topResults.map((r) => (
          <div
            key={r.driverId}
            className={`results-row ${r.isUserDriver ? 'user-row' : ''} ${r.position <= 3 ? `podium p${r.position}` : ''}`}
          >
            <span className="pos">{r.position}</span>
            <span className="driver">
              {r.driver.code && (
                <span className="driver-code">{r.driver.code}</span>
              )}
              {driverName(r)}
            </span>
            <span className="team">{r.constructor.name}</span>
            <span className="pts">{r.points}</span>
          </div>
        ))}
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${((currentIndex + 1) / races.length) * 100}%`,
          }}
        />
      </div>

      {isLast && visible && (
        <button className="btn-primary" onClick={onComplete}>
          See championship results →
        </button>
      )}

      {!isLast && (
        <button
          className="btn-secondary skip-btn"
          onClick={() => setCurrentIndex(races.length - 1)}
        >
          Skip to final round
        </button>
      )}
    </section>
  );
}
