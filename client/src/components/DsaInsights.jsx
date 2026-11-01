import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const WEEKS = 26;
const DIFFICULTY_COLORS = { Easy: '#30d158', Medium: '#ffcc00', Hard: '#ff2d55' };

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
    <div className="glass-card dsa-insights">
      <div className="dsa-insights-heatmap">
        <div className="dsa-insights-label">
          Last 6 months
          <span>{recentTotal} solved on {activeDays} {activeDays === 1 ? 'day' : 'days'}</span>
        </div>
        <div className="dsa-heatmap">
          {weeks.map((days, w) => (
            <div key={w} className="dsa-heatmap-week" style={{ '--col': w }}>
              {days.map((date, d) => {
                if (!date) return <div key={d} className="dsa-heatmap-cell empty" />;
                const key = toLocalDateStr(date);
                const count = data.perDay[key] || 0;
                const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={d}
                    className={`dsa-heatmap-cell level-${cellLevel(count)}`}
                    title={`${label}: ${count} solved`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="dsa-insights-side">
        <div>
          <div className="dsa-insights-label">
            Difficulty
            <span>{data.total} solved in total</span>
          </div>
          <div className="dsa-difficulty-bar">
            {['Easy', 'Medium', 'Hard'].map(level => (
              data.difficulty[level] > 0 && (
                <div
                  key={level}
                  style={{ flex: data.difficulty[level], background: DIFFICULTY_COLORS[level] }}
                  title={`${level}: ${data.difficulty[level]}`}
                />
              )
            ))}
          </div>
          <div className="dsa-difficulty-legend">
            {['Easy', 'Medium', 'Hard'].map(level => (
              <span key={level}>
                <i style={{ background: DIFFICULTY_COLORS[level] }} />
                {level} {data.difficulty[level]}
              </span>
            ))}
          </div>
        </div>

        {data.topics.length > 0 && (
          <div>
            <div className="dsa-insights-label">Top topics</div>
            <div className="dsa-topic-chips">
              {data.topics.slice(0, 8).map(t => (
                <button
                  key={t.name}
                  type="button"
                  className={`dsa-topic-chip ${activeTopic === t.name ? 'active' : ''}`}
                  onClick={() => onTopicClick(t.name)}
                  title={`Filter history by ${t.name}`}
                >
                  {t.name} <span>{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DsaInsights;
