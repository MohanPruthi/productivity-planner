import React, { useState, useEffect, useRef } from 'react';
import CountUp from '../components/CountUp';
import { useAuth } from '../context/AuthContext';
import { Trash2, Code2, ChevronLeft, ChevronRight, Bookmark, Search, X } from 'lucide-react';
import { API_BASE_URL } from '../config';
import DsaInsights from '../components/DsaInsights';
import '../styles/dsa.css';

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
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
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

  // Voice assistant logged a problem
  useEffect(() => {
    const onDataChanged = (e) => {
      if (e.detail?.scope === 'dsa') fetchLogs(currentPage, true);
    };
    window.addEventListener('data-changed', onDataChanged);
    return () => window.removeEventListener('data-changed', onDataChanged);
  }, [filters, currentPage]);

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
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/dsa-logs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          questionNumber,
          difficulty,
          title,
          notes: '',
          date: new Date().toISOString() // Set date to today
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log question');

      const loggedLabel = `#${questionNumber.trim()}${title ? ` ${title}` : ''}`;
      // Refresh data
      setCurrentPage(1);
      await fetchLogs(1);
      setInsightsVersion(v => v + 1);

      // Reset form
      setQuestionNumber('');
      setTitle('');
      setPreviewTopics([]);
      setDifficulty('Medium'); // Keep difficulty defaulted to Medium

      setSuccess(`Logged ${loggedLabel}`);

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

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const diffClass = (d) => String(d).toLowerCase();
  const small = [
    { label: 'This week', value: weeklyStats.total },
    { label: 'This month', value: monthlyStats.total },
    { label: 'All time', value: overallStats.total },
  ];

  return (
    <div className="dsa-page">
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

      <div className="dsa-top">
        <section className="cc-tile tone-dsa" aria-labelledby="dsa-log-title">
          <div className="cc-tile-head">
            <h2 id="dsa-log-title">Log a question</h2>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="dsa-log-row">
              <input
                id="qNum"
                ref={questionInputRef}
                type="text"
                inputMode="numeric"
                aria-label="LeetCode question number"
                aria-invalid={formError ? 'true' : undefined}
                placeholder="LeetCode number, like 146"
                value={questionNumber}
                onChange={(e) => { setQuestionNumber(e.target.value); setSuccess(''); }}
                autoFocus
              />
              <button type="submit" className="ui-btn ui-btn-primary" disabled={submitting}>
                {submitting ? 'Logging...' : 'Log'}
              </button>
            </div>
            {title && (
              <p className="dsa-preview">
                <span className="dsa-preview-title" title={title}>{title}</span>
                <span className={`cc-diff ${diffClass(difficulty)}`}>{difficulty}</span>
                {previewTopics.length > 0 && <small>{previewTopics.slice(0, 3).join(' · ')}</small>}
              </p>
            )}
            <div aria-live="polite">
              {formError && <p className="dsa-msg error" role="alert">{formError}</p>}
              {!formError && success && <p className="dsa-msg ok">{success}</p>}
            </div>
          </form>
        </section>

        <section className="cc-tile tone-dsa" aria-labelledby="dsa-progress-title">
          <div className="cc-tile-head">
            <h2 id="dsa-progress-title">Progress</h2>
          </div>
          <div className="dsa-progress">
            <div className="cc-figure">
              <strong><CountUp value={dailyStats.total} /></strong>
              <span>today</span>
            </div>
            <div className="dsa-small-figs">
              {small.map(f => (
                <div key={f.label}>
                  <strong><CountUp value={f.value} /></strong>
                  <span>{f.label.toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dsa-split dsa-grow" aria-label="All-time split by difficulty">
            <span className="easy"><b>{overallStats.Easy}</b> easy</span>
            <span className="medium"><b>{overallStats.Medium}</b> medium</span>
            <span className="hard"><b>{overallStats.Hard}</b> hard</span>
          </div>
        </section>
      </div>

      <DsaInsights
        version={insightsVersion}
        activeTopic={filters.topic}
        onTopicClick={(topic) => setFilters(prev => ({ ...prev, topic: prev.topic === topic ? '' : topic }))}
        onTopicsLoaded={setTopicOptions}
      />

      <section className="cc-tile tone-dsa" aria-labelledby="dsa-history-title">
        <div className="cc-tile-head">
          <h2 id="dsa-history-title">History</h2>
          <span className="cc-meta">{totalLogs} {totalLogs === 1 ? 'question' : 'questions'}</span>
        </div>

        <div className="dsa-filters">
          <label className="dsa-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              aria-label="Search history"
              placeholder="Search number, title or notes"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <select
            className="input-control"
            aria-label="Filter by difficulty"
            value={filters.difficulty}
            onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
          >
            <option value="">All difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <select
            className="input-control"
            aria-label="Filter by topic"
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
            className={`dsa-chip-btn ${filters.revisit ? 'active' : ''}`}
            aria-pressed={filters.revisit}
            onClick={() => setFilters(prev => ({ ...prev, revisit: !prev.revisit }))}
          >
            <Bookmark size={13} fill={filters.revisit ? 'currentColor' : 'none'} />
            <span>To revisit</span>
          </button>
          {hasFilters && (
            <button type="button" className="dsa-chip-btn" onClick={clearFilters}>
              <X size={13} />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        {loading ? (
          <p className="cc-empty">Loading history...</p>
        ) : logs.length === 0 ? (
          <p className="cc-empty">
            {hasFilters ? 'No questions match these filters. Try clearing them.' : 'No questions logged yet. Enter a LeetCode number above to log your first.'}
          </p>
        ) : (
          <>
            <ul className="cc-list">
              {logs.map(log => (
                <li key={log.id} className="cc-row dsa-row">
                  <span className="cc-qnum">#{log.questionNumber}</span>
                  <div className="cc-row-text">
                    <span>
                      {log.titleSlug ? (
                        <a
                          href={`https://leetcode.com/problems/${log.titleSlug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {log.title || 'Unknown question'}
                        </a>
                      ) : (
                        log.title || 'Unknown question'
                      )}
                    </span>
                    {(log.topics?.length > 0 || log.notes) && (
                      <small title={log.notes || undefined}>
                        {[log.topics?.slice(0, 3).join(' · '), log.notes].filter(Boolean).join(' · ')}
                      </small>
                    )}
                  </div>
                  <span className={`cc-diff ${diffClass(log.difficulty)}`}>{log.difficulty}</span>
                  <span className="dsa-date">{formatDate(log.date)}</span>
                  <div className="dsa-actions">
                    <button
                      type="button"
                      onClick={() => toggleRevisit(log)}
                      className={`ui-icon-btn ${log.revisit ? 'on' : ''}`}
                      aria-pressed={!!log.revisit}
                      aria-label={log.revisit ? `Remove #${log.questionNumber} from revisit` : `Mark #${log.questionNumber} to revisit`}
                      title={log.revisit ? 'Marked to revisit' : 'Mark to revisit'}
                    >
                      <Bookmark size={16} fill={log.revisit ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(log.id)}
                      className="ui-icon-btn danger"
                      aria-label={`Delete #${log.questionNumber}`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="dsa-pager">
              <span>
                {Math.min((currentPage - 1) * limit + 1, totalLogs)}-{Math.min(currentPage * limit, totalLogs)} of {totalLogs}
              </span>
              <div className="dsa-pager-ctrl">
                <button
                  type="button"
                  className="ui-icon-btn"
                  aria-label="Previous page"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  className="ui-icon-btn"
                  aria-label="Next page"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default DsaLog;
