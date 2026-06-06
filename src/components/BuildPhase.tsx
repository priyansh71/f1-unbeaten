import { useMemo, useState } from 'react';
import {
  constructorPlaceholder,
  driverPlaceholder,
} from '../lib/images';
import type {
  ConstructorOption,
  DriverOption,
  UserTeam,
} from '../types';

interface Props {
  season: number;
  drivers: DriverOption[];
  constructors: ConstructorOption[];
  showCareerWins: boolean;
  onComplete: (team: UserTeam) => void;
}

function driverLabel(d: DriverOption['driver']): string {
  return `${d.givenName} ${d.familyName}`;
}

export function BuildPhase({
  season,
  drivers,
  constructors,
  showCareerWins,
  onComplete,
}: Props) {
  const [constructorId, setConstructorId] = useState<string | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const displayedConstructors = useMemo(() => {
    const list = [...constructors];
    if (showCareerWins) return list;
    return list.sort((a, b) =>
      a.constructor.name.localeCompare(b.constructor.name),
    );
  }, [constructors, showCareerWins]);

  const displayedDrivers = useMemo(() => {
    const list = [...drivers];
    if (showCareerWins) return list;
    return list.sort((a, b) =>
      driverLabel(a.driver).localeCompare(driverLabel(b.driver)),
    );
  }, [drivers, showCareerWins]);

  const filteredDrivers = displayedDrivers.filter((d) => {
    const label = driverLabel(d.driver).toLowerCase();
    return (
      label.includes(search.toLowerCase()) ||
      d.driver.code.toLowerCase().includes(search.toLowerCase())
    );
  });

  const selectedConstructor = constructors.find(
    (c) => c.constructor.constructorId === constructorId,
  );

  const toggleDriver = (id: string) => {
    setSelectedDrivers((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const canSubmit = constructorId && selectedDrivers.length === 2;

  const handleSubmit = () => {
    if (!canSubmit || !selectedConstructor) return;
    const d1 = drivers.find(
      (d) => d.driver.driverId === selectedDrivers[0],
    )?.driver;
    const d2 = drivers.find(
      (d) => d.driver.driverId === selectedDrivers[1],
    )?.driver;
    if (!d1 || !d2) return;
    onComplete({
      constructor: selectedConstructor.constructor,
      drivers: [d1, d2],
    });
  };

  return (
    <section className="phase build-phase">
      <p className="phase-label">Build · {season} calendar</p>
      <h2>Pick your team</h2>
      <p className="phase-desc">
        Pick 1 constructor and 2 drivers from the pool.
      </p>

      <h3 className="panel-title">Constructors</h3>
      <div className="card-grid">
        {displayedConstructors.map((c) => {
          const selected =
            constructorId === c.constructor.constructorId;
          return (
            <button
              key={c.constructor.constructorId}
              type="button"
              className={`pick-card ${selected ? 'selected' : ''}`}
              onClick={() =>
                setConstructorId(c.constructor.constructorId)
              }
            >
              <img
                src={
                  c.imageUrl ??
                  c.constructor.imageUrl ??
                  constructorPlaceholder(c.constructor.name)
                }
                alt={c.constructor.name}
                className="constructor-img"
              />
              <div className="pick-card-body">
                <span className="pick-name">{c.constructor.name}</span>
                {showCareerWins && (
                  <div className="pick-badges">
                    <span className="badge wins">
                      {c.careerWins} career wins
                    </span>
                    <span className="badge muted">
                      through {season}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <h3 className="panel-title">Drivers · pick 2</h3>
      <input
        className="search-input"
        placeholder="Search drivers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="driver-grid">
        {filteredDrivers.map((d) => {
          const selected = selectedDrivers.includes(d.driver.driverId);
          return (
            <button
              key={d.driver.driverId}
              type="button"
              className={`pick-card driver-card ${selected ? 'selected' : ''}`}
              onClick={() => toggleDriver(d.driver.driverId)}
              disabled={!constructorId}
            >
              <img
                src={
                  d.imageUrl ??
                  d.driver.imageUrl ??
                  driverPlaceholder(d.driver.code)
                }
                alt={driverLabel(d.driver)}
                className="driver-img"
              />
              <div className="pick-card-body">
                <span className="pick-name">
                  {d.driver.code && (
                    <span className="driver-code">{d.driver.code}</span>
                  )}
                  {driverLabel(d.driver)}
                </span>
                {showCareerWins && (
                  <div className="pick-badges">
                    <span className="badge wins">
                      {d.careerWins} career wins
                    </span>
                    <span className="badge muted">
                      through {season}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedConstructor && selectedDrivers.length === 2 && (
        <div className="team-preview">
          <strong>Your lineup</strong>
          <p>
            {selectedConstructor.constructor.name} —{' '}
            {selectedDrivers
              .map((id) =>
                driverLabel(
                  drivers.find((d) => d.driver.driverId === id)!.driver,
                ),
              )
              .join(' & ')}
          </p>
        </div>
      )}

      <button
        className="btn-primary"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        Simulate {season} season →
      </button>
    </section>
  );
}
