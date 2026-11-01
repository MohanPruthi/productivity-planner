import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trash2, Plus, Code2, Calendar, ChevronLeft, ChevronRight, Bookmark, ExternalLink, Search, X } from 'lucide-react';
import { API_BASE_URL } from '../config';
import DsaInsights from '../components/DsaInsights';

const DsaLog = () => {
  const { getAuthHeaders } = useAuth();
  const [logs, setLogs] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({ Easy: 0, Medium: 0, Hard: 0, total: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ Easy: 0, Medium: 0, Hard: 0, total: 0 });
  const [overallStats, setOverallStats] = useState({ Easy: 0, Medium: 0, Hard: 0, total: 0 });
  const [dailyStats, setDailyStats] = useState({ Easy: 0, Medium: 0, Hard: 0, total: 0 });
  const [tallyRange, setTallyRange] = useState('week'); // 'week' | 'month' | 'overall'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const limit = 10;

  // History filters
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ q: '', difficulty: '', topic: '', revisit: false });
  const hasFilters = filters.q || filters.difficulty || filters.topic || filters.revisit;

  // Bumped after any change so the insights panel refetches
  const [insightsVersion, setInsightsVersion] = useState(0);
  const [topicOptions, setTopicOptions] = useState([]);

  // Form states
  const [questionNumber, setQuestionNumber] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [title, setTitle] = useState('');
  const [previewTopics, setPreviewTopics] = useState([]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const questionInputRef = useRef(null);

  const fetchLogs = async (page = 1, background = false) => {
    try {
      if (!background) setLoading(true);
      setError('');
      const params = new URLSearchParams({ page, limit });
      if (filters.q) params.set('q', filters.q);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.topic) params.set('topic', filters.topic);
      if (filters.revisit) params.set('revisit', 'true');
      const res = await fetch(`${API_BASE_URL}/api/dsa-logs?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load DSA logs');
      const data = await res.json();
      
      // Self-healing: if we deleted all items on a page, load the previous page
      if (data.logs.length === 0 && page > 1) {
        setCurrentPage(page - 1);
        fetchLogs(page - 1);
        return;
      }
      
      setLogs(data.logs);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalLogs(data.pagination?.totalLogs || 0);
      if (data.weeklyStats) setWeeklyStats(data.weeklyStats);
      if (data.monthlyStats) setMonthlyStats(data.monthlyStats);
      if (data.overallStats) setOverallStats(data.overallStats);
      if (data.dailyStats) setDailyStats(data.dailyStats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load (and reload from page 1) whenever the filters change
  useEffect(() => {
    setCurrentPage(1);
    fetchLogs(1);
  }, [filters]);

  // Debounce typing in the search box
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => (prev.q === searchInput.trim() ? prev : { ...prev, q: searchInput.trim() }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ q: '', difficulty: '', topic: '', revisit: false });
  };

  const toggleRevisit = async (log) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dsa-logs/${log.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ revisit: !log.revisit }),
      });
      if (!res.ok) throw new Error('Failed to update log');
      const updated = await res.json();
      if (filters.revisit && !updated.revisit) {
        await fetchLogs(currentPage);
      } else {
        setLogs(prev => prev.map(l => (l.id === updated.id ? updated : l)));
      }
      setInsightsVersion(v => v + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchLogs(newPage);
  };

  // Debounced auto-fetch LeetCode details based on question number
  useEffect(() => {
    const qNumClean = questionNumber.trim();
    if (!qNumClean || isNaN(qNumClean)) {
      setTitle('');
      setPreviewTopics([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/dsa-logs/question/${qNumClean}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const details = await res.json();
          if (details.title) setTitle(details.title);
          if (details.difficulty) setDifficulty(details.difficulty);
          setPreviewTopics(details.topics || []);
        }
      } catch (err) {
        console.error('Error auto-fetching question info:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [questionNumber]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionNumber) {
      setFormError('Question number is required');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/dsa-logs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          questionNumber,
          difficulty,
          title,
          notes,
          date: new Date().toISOString() // Set date to today
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log question');

      // Refresh data
      setCurrentPage(1);
      await fetchLogs(1);
      setInsightsVersion(v => v + 1);

      // Reset form
      setQuestionNumber('');
      setTitle('');
      setPreviewTopics([]);
      setNotes('');
      setDifficulty('Medium'); // Keep difficulty defaulted to Medium
      
      // Focus back to question input for rapid-fire submission
      if (questionInputRef.current) {
        questionInputRef.current.focus();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/dsa-logs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete log');
      await fetchLogs(currentPage);
      setInsightsVersion(v => v + 1);
    } catch (err) {
      console.error(err);
      alert('Failed to delete log');
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Easy': return '#30d158'; // Apple activity Green
      case 'Medium': return '#ffcc00'; // Apple activity Yellow/Orange
      case 'Hard': return '#ff2d55'; // Apple activity Red
      default: return 'var(--text-secondary)';
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeStats = tallyRange === 'week'
    ? weeklyStats
    : tallyRange === 'month'
    ? monthlyStats
    : overallStats;

  return (
    <div className="dsa-log-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Banner */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '1.25rem 2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          boxShadow: '0 10px 30px rgba(255,255,255,0.01), inset 0 1px 0 rgba(255,255,255,0.02)',
          borderRadius: '16px',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow Mesh background indicator */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255, 161, 22, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1 }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(255, 161, 22, 0.08)',
            border: '1px solid rgba(255, 161, 22, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(255, 161, 22, 0.15)'
          }}>
            <Code2 size={22} color="#ffa116" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
              DSA LeetCode <span className="gradient-text-dsa">Tracker</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.85rem' }}>Fast logging for daily practice questions</p>
          </div>
        </div>
      </div>

      {/* Grid: Form and Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        
        {/* Rapid Form card */}
        <div className="glass-card glow-dsa">
          <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            <Plus size={16} color="#ffa116" />
            <span>Log Completed Question</span>
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && <div className="text-error">{formError}</div>}
            
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label htmlFor="qNum" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Question Number *</label>
              <input
                id="qNum"
                ref={questionInputRef}
                type="text"
                className="input-control"
                placeholder="Type LeetCode question number (e.g. 1)..."
                value={questionNumber}
                onChange={(e) => setQuestionNumber(e.target.value)}
                autoFocus
                required
              />

              {/* Auto-detected LeetCode question preview */}
              {title && (
                <div 
                  className="glass-card" 
                  style={{ 
                    padding: '0.65rem 0.85rem', 
                    background: 'rgba(255, 255, 255, 0.015)', 
                    border: '1px solid var(--border-light)', 
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.15rem',
                    animation: 'modalSlideUp 0.2s ease-out'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxWidth: '75%' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Auto-Detected Question
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={title}>
                      {title}
                    </span>
                    {previewTopics.length > 0 && (
                      <span className="dsa-topics">{previewTopics.slice(0, 3).join(' · ')}</span>
                    )}
                  </div>
                  <span 
                    className="badge" 
                    style={{ 
                      color: getDifficultyColor(difficulty), 
                      background: `${getDifficultyColor(difficulty)}10`,
                      borderColor: `${getDifficultyColor(difficulty)}20`,
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.45rem'
                    }}
                  >
                    {difficulty}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="notes" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Notes / Observations (Optional)</label>
              <textarea
                id="notes"
                rows="2"
                className="input-control"
                style={{ resize: 'vertical' }}
                placeholder="Key insights, runtime complexity or tricks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="mirror-btn-pill dsa-submit" 
              style={{ 
                marginTop: '0.5rem',
                width: '100%',
                opacity: submitting ? 0.7 : 1
              }}
              disabled={submitting}
            >
              <Plus size={15} style={{ marginRight: '2px' }} />
              <span>{submitting ? 'Logging...' : 'Log Question'}</span>
            </button>
          </form>
        </div>

        {/* Stats card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Today's Tally */}
          <div className="glass-card glow-stats-orange" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={14} color="#ffa116" />
              <span>Today's Submissions</span>
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: '0.25rem 0', color: 'var(--text-primary)' }}>{dailyStats.total}</p>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
              <span className="badge" style={{ color: '#30d158', background: 'rgba(48, 209, 88, 0.1)', borderColor: 'rgba(48, 209, 88, 0.2)' }}>Easy: {dailyStats.Easy}</span>
              <span className="badge" style={{ color: '#ffcc00', background: 'rgba(255, 204, 0, 0.1)', borderColor: 'rgba(255, 204, 0, 0.2)' }}>Medium: {dailyStats.Medium}</span>
              <span className="badge" style={{ color: '#ff2d55', background: 'rgba(255, 45, 85, 0.1)', borderColor: 'rgba(255, 45, 85, 0.2)' }}>Hard: {dailyStats.Hard}</span>
            </div>
          </div>

          {/* Running Weekly Tally */}
          <div className="glass-card glow-stats-orange" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Code2 size={14} color="#ffa116" />
                <span>
                  {tallyRange === 'week' ? "This Week's Tally" : tallyRange === 'month' ? "This Month's Tally" : "Overall Tally"}
                </span>
              </h3>
              
              {/* Range Toggle */}
              <div style={{ 
                display: 'flex', 
                gap: '3px', 
                background: 'transparent', 
                padding: '2px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.05))',
                zIndex: 2
              }}>
                {['week', 'month', 'overall'].map(r => {
                  const isActive = tallyRange === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTallyRange(r)}
                      style={{
                        padding: '0.22rem 0.55rem',
                        fontSize: '0.62rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isActive ? 'rgba(255, 161, 22, 0.18)' : 'transparent',
                        background: isActive ? 'var(--glass-bg, rgba(255, 255, 255, 0.04))' : 'transparent',
                        color: isActive ? '#ffa116' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        transition: 'all 0.18s ease',
                        outline: 'none'
                      }}
                      onMouseOver={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.background = 'var(--glass-border, rgba(255,255,255,0.02))';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <p style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: '0.25rem 0', color: 'var(--text-primary)' }}>{activeStats.total}</p>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
              <span className="badge" style={{ color: '#30d158', background: 'rgba(48, 209, 88, 0.1)', borderColor: 'rgba(48, 209, 88, 0.2)' }}>Easy: {activeStats.Easy}</span>
              <span className="badge" style={{ color: '#ffcc00', background: 'rgba(255, 204, 0, 0.1)', borderColor: 'rgba(255, 204, 0, 0.2)' }}>Medium: {activeStats.Medium}</span>
              <span className="badge" style={{ color: '#ff2d55', background: 'rgba(255, 45, 85, 0.1)', borderColor: 'rgba(255, 45, 85, 0.2)' }}>Hard: {activeStats.Hard}</span>
            </div>
          </div>

        </div>

      </div>

      <DsaInsights
        version={insightsVersion}
        activeTopic={filters.topic}
        onTopicClick={(topic) => setFilters(prev => ({ ...prev, topic: prev.topic === topic ? '' : topic }))}
        onTopicsLoaded={setTopicOptions}
      />

      {/* History table */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', color: 'var(--text-primary)' }}>Submission History</h2>

        <div className="dsa-filter-bar">
          <div className="dsa-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by number, title or notes"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            className="input-control dsa-filter-select"
            value={filters.difficulty}
            onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
          >
            <option value="">All difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <select
            className="input-control dsa-filter-select"
            value={filters.topic}
            onChange={(e) => setFilters(prev => ({ ...prev, topic: e.target.value }))}
          >
            <option value="">All topics</option>
            {topicOptions.map(t => (
              <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
            ))}
          </select>
          <button
            type="button"
            className={`dsa-revisit-filter ${filters.revisit ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, revisit: !prev.revisit }))}
          >
            <Bookmark size={13} />
            <span>To revisit</span>
          </button>
          {hasFilters && (
            <button type="button" className="dsa-clear-filters" onClick={clearFilters}>
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
        
        <div className="glass-card" style={{ padding: '0', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.03)' }}>
          {loading ? (
            <p style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>Loading history...</p>
          ) : logs.length === 0 ? (
            <p style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {hasFilters ? 'No questions match these filters.' : 'No questions logged yet. Go solve one!'}
            </p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.5rem' }}>Date</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Question #</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Title</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Difficulty</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Notes</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.85rem', color: 'var(--text-primary)' }} className="table-row-hover">
                      <td style={{ padding: '0.85rem 1.5rem', color: 'var(--text-secondary)' }}>{formatDate(log.date)}</td>
                      <td style={{ padding: '0.85rem 1.5rem', fontWeight: 700 }}>#{log.questionNumber}</td>
                      <td style={{ padding: '0.85rem 1.5rem', fontWeight: 500 }}>
                        {log.titleSlug ? (
                          <a
                            href={`https://leetcode.com/problems/${log.titleSlug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dsa-problem-link"
                          >
                            {log.title}
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          log.title || <span style={{ color: 'var(--text-muted)' }}>Unknown question</span>
                        )}
                        {log.topics?.length > 0 && (
                          <div className="dsa-topics">{log.topics.slice(0, 3).join(' · ')}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1.5rem' }}>
                        <span 
                          className="badge" 
                          style={{ 
                            color: getDifficultyColor(log.difficulty), 
                            background: `${getDifficultyColor(log.difficulty)}10`,
                            borderColor: `${getDifficultyColor(log.difficulty)}20`
                          }}
                        >
                          {log.difficulty}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.5rem', maxWidth: '250px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={log.notes}>
                        {log.notes || '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => toggleRevisit(log)}
                          className={`dsa-revisit-btn ${log.revisit ? 'active' : ''}`}
                          title={log.revisit ? 'Marked to revisit' : 'Mark to revisit'}
                        >
                          <Bookmark size={16} fill={log.revisit ? 'currentColor' : 'none'} />
                        </button>
                        <button 
                          onClick={() => handleDelete(log.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                          className="btn-trash-hover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {totalLogs > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem', color: 'var(--text-secondary)' }} className="pagination-bar">
                  <div style={{ paddingLeft: '1.5rem' }}>
                    Showing <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.min((currentPage - 1) * limit + 1, totalLogs)}</span> to <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.min(currentPage * limit, totalLogs)}</span> of <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{totalLogs}</span> questions
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingRight: '1.5rem', paddingBottom: '1rem' }}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="mirror-btn-pill"
                      style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '2px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, border: '1px solid var(--border-light)' }}
                    >
                      <ChevronLeft size={12} />
                      <span>Prev</span>
                    </button>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: '70px', textAlign: 'center' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="mirror-btn-pill"
                      style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '2px', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', opacity: (currentPage === totalPages || totalPages === 0) ? 0.4 : 1, border: '1px solid var(--border-light)' }}
                    >
                      <span>Next</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default DsaLog;
