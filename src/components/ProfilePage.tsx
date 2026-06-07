import { useState } from 'react';
import { getAchievements } from '../lib/engagement';

export function ProfilePage() {
  const [achievements, setAchievements] = useState(() => getAchievements());

  const handleClearLeaderboards = () => {
    try {
      localStorage.removeItem('f1ub:leaderboard');
      // force re-read (achievements unaffected)
      setAchievements(getAchievements());
    } catch {
      // noop
    }
  };

  const handleClearAchievements = () => {
    try {
      localStorage.removeItem('f1ub:achievements');
      setAchievements([]);
    } catch {
      // noop
    }
  };

  return (
    <section className="phase profile-phase">
      <h2>Your profile</h2>
      <p className="phase-desc">Unlocked achievements and local storage controls</p>

      <div className="achievements-panel">
        <h3>Unlocked achievements</h3>
        {achievements.length === 0 && <div className="muted">No achievements yet — play and win to unlock badges.</div>}
        <div className="achievements-list">
          {achievements.map((a) => (
            <div key={a.id} className="achievement-row">
              <strong>{a.name}</strong>
              <div className="muted">{a.description}</div>
              <div className="muted small">{a.unlockedAt ? new Date(a.unlockedAt).toLocaleString() : ''}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn-secondary" onClick={handleClearLeaderboards}>Clear local leaderboard</button>
        <button className="btn-secondary" onClick={handleClearAchievements}>Clear achievements</button>
      </div>
    </section>
  );
}
