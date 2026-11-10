import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const WEEKS = 26;

const toLocalDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Columns of 7 days (Mon-Sun), oldest week first, ending with the current week
const buildWeeks = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const mondayOffset = (today.getDay() + 6) % 7;
  start.setDate(today.getDate() - mondayOffset - (WEEKS - 1) * 7);

  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      days.push(date > today ? null : date);
    }
    weeks.push(days);
  }
  return weeks;
};

const cellLevel = (count) => (count >= 4 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0);

const DsaInsights = ({ version, activeTopic, onTopicClick, onTopicsLoaded }) => {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/dsa-logs/insights`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to load DSA insights');
        const json = await res.json();
        setData(json);
        onTopicsLoaded?.(json.topics);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [version]);

  if (!data) return null;

  const weeks = buildWeeks();
  const activeDays = Object.keys(data.perDay).length;
  const recentTotal = Object.values(data.perDay).reduce((sum, n) => sum + n, 0);

  return (
    <section className="cc-tile tone-dsa" aria-labelledby="dsa-activity-title">
      <div className="cc-tile-head">
        <h2 id="dsa-activity-title">Activity</h2>
        <span className="cc-meta">
          {recentTotal} solved on {activeDays} {activeDays === 1 ? 'day' : 'days'} in the last 6 months
        </span>
      </div>

      <div className="dsa-heat-scroll" role="img" aria-label={`Activity heatmap: ${recentTotal} solved on ${activeDays} days in the last 6 months`}>
        <div className="dsa-heatmap">
          {weeks.map((days, w) => (
            <div key={w} className="dsa-heatmap-week">
              {days.map((date, d) => {
                if (!date) return <div key={d} className="dsa-cell empty" />;
                const key = toLocalDateStr(date);
                const count = data.perDay[key] || 0;
                const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={d}
                    className={`dsa-cell level-${cellLevel(count)}`}
                    title={`${label}: ${count} solved`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="dsa-act-block">
        <p className="dsa-act-label">Difficulty, {data.total} solved in total</p>
        <div className="dsa-bar" aria-hidden="true">
          {['Easy', 'Medium', 'Hard'].map(level => (
            data.difficulty[level] > 0 && (
              <i
                key={level}
                className={level.toLowerCase()}
                style={{ flex: data.difficulty[level] }}
                title={`${level}: ${data.difficulty[level]}`}
              />
            )
          ))}
        </div>
      </div>

      {data.topics.length > 0 && (
        <div className="dsa-act-block">
          <p className="dsa-act-label">Top topics. Select one to filter history.</p>
          <div className="dsa-topics-list">
            {data.topics.slice(0, 8).map(t => (
              <button
                key={t.name}
                type="button"
                className={`dsa-topic ${activeTopic === t.name ? 'active' : ''}`}
                aria-pressed={activeTopic === t.name}
                onClick={() => onTopicClick(t.name)}
                title={`Filter history by ${t.name}`}
              >
                {t.name}<small>{t.count}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default DsaInsights;
