import React, { useState, useEffect, useRef } from 'react';
import CountUp from '../components/CountUp';
import Illustration from '../components/Illustration';
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
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="dsa-log-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header Banner */}
      <header className="page-header tone-dsa">

        <div className="page-header-main">
          <div className="page-header-icon">
            <Code2 size={20} />
          </div>
          <div>
            <h1 className="page-header-title">DSA practice</h1>
            <p className="page-header-subtitle">Log LeetCode questions and see how you are progressing</p>
          </div>
        </div>
      </header>

      {/* Log form and tallies */}
      <div className="dsa-top">

        {/* Rapid Form card */}
        <div className="glass-card">
          <h2 className="ui-section-title">Log a question</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && <div className="text-error">{formError}</div>}

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label htmlFor="qNum" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Question number</label>
              <input
                id="qNum"
                ref={questionInputRef}
                type="text"
                className="input-control"
                placeholder="LeetCode number, like 146"
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
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Found on LeetCode
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={title}>
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
                      fontWeight: 600,
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
              <label htmlFor="notes" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes (optional)</label>
              <textarea
                id="notes"
                rows="2"
                className="input-control"
                style={{ resize: 'vertical' }}
                placeholder="Key idea, complexity, what tripped you up"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="ui-btn ui-btn-primary dsa-submit-btn"
              disabled={submitting}
            >
              <Plus size={15} />
              <span>{submitting ? 'Logging...' : 'Log question'}</span>
            </button>
          </form>
        </div>

        {/* Tallies */}
        <div className="dsa-tallies">
          {[
            { label: 'Today', stats: dailyStats },
            { label: 'This week', stats: weeklyStats },
            { label: 'This month', stats: monthlyStats },
            { label: 'All time', stats: overallStats },
          ].map(({ label, stats }) => (
            <div key={label} className="ui-stat">
              <div className="ui-stat-label">{label}</div>
              <div className="ui-stat-value"><CountUp value={stats.total} /></div>
              <div className="dsa-tally-split">
                <span className="easy">{stats.Easy}</span>
                <span className="medium">{stats.Medium}</span>
                <span className="hard">{stats.Hard}</span>
              </div>
            </div>
          ))}
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
        <h2 className="ui-section-title">History <small>{totalLogs} {totalLogs === 1 ? 'question' : 'questions'}</small></h2>

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
            <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              {!hasFilters && <Illustration name="dsa-empty" />}
              <p style={{ margin: 0 }}>{hasFilters ? 'No questions match these filters.' : 'No questions logged yet. Go solve one!'}</p>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                    <th style={{ padding: '1rem 1.5rem' }}>Date</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Problem</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Difficulty</th>
                    <th style={{ padding: '1rem 1.5rem' }}>Notes</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.85rem', color: 'var(--text-primary)' }} className="table-row-hover">
                      <td style={{ padding: '0.85rem 1.5rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(log.date)}</td>
                      <td style={{ padding: '0.85rem 1.5rem', fontWeight: 500 }}>
                        <span className="dsa-qnum">#{log.questionNumber}</span>
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
                    Showing <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.min((currentPage - 1) * limit + 1, totalLogs)}</span> to <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.min(currentPage * limit, totalLogs)}</span> of <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalLogs}</span> questions
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
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '70px', textAlign: 'center' }}>
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
