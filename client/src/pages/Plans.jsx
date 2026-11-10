import React, { useEffect, useMemo, useState } from 'react';
import CountUp from '../components/CountUp';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronDown, Check, Trash2, CalendarRange, Settings2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';
import PageHeader from '../components/PageHeader';
import Illustration from '../components/Illustration';
import Dialog from '../components/Dialog';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#14b8a6', '#f59e0b', '#f43f5e', '#a855f7', '#ec4899', '#64748b'];
const LAYOUT_LABELS = { daily: 'Each day', split: 'Weekday + weekend', single: 'One block' };
const EMPTY_PLAN = {
  name: '',
  description: '',
  color: COLORS[0],
  cadence: 'weekly',
  layout: 'daily',
  weekdayHours: '',
  weekendHours: '',
  isPersonal: false,
};

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Period and day dates are stored as UTC midnight: compare and format calendar days in UTC
const utcDay = (dateStr) => new Date(dateStr).toISOString().split('T')[0];
const fmt = (dateStr, opts) => new Date(dateStr).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

const periodName = (plan, period) =>
  plan.cadence === 'monthly' ? fmt(period.startDate, { month: 'long', year: 'numeric' }) : `Week ${period.weekNumber}`;

const effortSummary = (plan) => {
  const parts = [plan.cadence === 'monthly' ? 'Monthly' : 'Weekly', LAYOUT_LABELS[plan.layout].toLowerCase()];
  if (plan.layout === 'split') {
    if (plan.weekdayHours) parts.push(`${plan.weekdayHours}h weekdays`);
    if (plan.weekendHours) parts.push(`${plan.weekendHours}h weekends`);
  } else if (plan.weekdayHours) {
    parts.push(`${plan.weekdayHours}h ${plan.layout === 'daily' ? 'a day' : `a ${plan.cadence === 'monthly' ? 'month' : 'week'}`}`);
  }
  return parts.join(' · ');
};

const PlanSettingsDialog = ({ open, initial, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState(EMPTY_PLAN);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY_PLAN, ...initial, weekdayHours: initial.weekdayHours ?? '', weekendHours: initial.weekendHours ?? '' } : EMPTY_PLAN);
      setError('');
    }
  }, [open, initial]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      setError('Give the plan a name');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Plan settings' : 'New plan'}
      subtitle={isEdit ? 'Changes to the layout apply to new weeks or months' : 'Set up how this plan is broken down'}
      footer={
        <>
          {isEdit && (
            <button className="ui-btn ui-btn-danger" onClick={() => onDelete(initial)}>
              <Trash2 size={15} />
              Delete plan
            </button>
          )}
          <span className="spacer" />
          <button className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ui-btn ui-btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save' : 'Create plan'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="text-error">{error}</div>}
        <div className="ui-field">
          <label htmlFor="planName">Name</label>
          <input id="planName" className="input-control" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Fitness, Reading, System design" autoFocus />
        </div>
        <div className="ui-field">
          <label htmlFor="planDesc">Description</label>
          <input id="planDesc" className="input-control" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What this plan is for (optional)" />
        </div>
        <div className="ui-field">
          <span className="ui-label">Color</span>
          <div className="ui-swatches">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`ui-swatch ${form.color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => set('color', c)}
                title={c}
              />
            ))}
          </div>
        </div>
        <div className="ui-field">
          <span className="ui-label">Plan in</span>
          <div className="ui-segmented">
            {['weekly', 'monthly'].map(c => (
              <button key={c} type="button" className={form.cadence === c ? 'active' : ''} onClick={() => set('cadence', c)}>
                {c === 'weekly' ? 'Weeks' : 'Months'}
              </button>
            ))}
          </div>
        </div>
        <div className="ui-field">
          <span className="ui-label">Break each {form.cadence === 'monthly' ? 'month' : 'week'} into</span>
          <div className="ui-segmented">
            {Object.entries(LAYOUT_LABELS).map(([key, label]) => (
              <button key={key} type="button" className={form.layout === key ? 'active' : ''} onClick={() => set('layout', key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {form.layout === 'split' ? (
          <div className="ui-field-row">
            <div className="ui-field">
              <label htmlFor="wdh">Weekday effort (hours)</label>
              <input id="wdh" type="number" min="0" className="input-control" value={form.weekdayHours} onChange={(e) => set('weekdayHours', e.target.value)} placeholder="10" />
            </div>
            <div className="ui-field">
              <label htmlFor="weh">Weekend effort (hours)</label>
              <input id="weh" type="number" min="0" className="input-control" value={form.weekendHours} onChange={(e) => set('weekendHours', e.target.value)} placeholder="10" />
            </div>
          </div>
        ) : (
          <div className="ui-field">
            <label htmlFor="eff">Effort (hours {form.layout === 'daily' ? 'a day' : `a ${form.cadence === 'monthly' ? 'month' : 'week'}`})</label>
            <input id="eff" type="number" min="0" className="input-control" value={form.weekdayHours} onChange={(e) => set('weekdayHours', e.target.value)} placeholder="Optional" />
          </div>
        )}
        <div className="ui-switch-row">
          <div>
            <strong>Personal plan</strong>
            <span>Hidden while you are in the office workspace</span>
          </div>
          <button type="button" className={`ui-switch ${form.isPersonal ? 'on' : ''}`} onClick={() => set('isPersonal', !form.isPersonal)} aria-pressed={form.isPersonal} />
        </div>
      </form>
    </Dialog>
  );
};

const Plans = () => {
  const { getAuthHeaders, privacyMode } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openPeriodId, setOpenPeriodId] = useState(null);
  const [savingStates, setSavingStates] = useState({});
  const [dialog, setDialog] = useState({ open: false, plan: null });
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ startDate: '', goalText: '' });

  const api = async (path, options = {}) => {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };

  useEffect(() => {
    api('/api/plans')
      .then(setPlans)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Voice assistant created a plan or a week
  useEffect(() => {
    const onDataChanged = (e) => {
      if (e.detail?.scope === 'plans') api('/api/plans').then(setPlans).catch(() => {});
    };
    window.addEventListener('data-changed', onDataChanged);
    return () => window.removeEventListener('data-changed', onDataChanged);
  }, []);

  // Personal plans disappear in the office workspace, like personal notes
  const visiblePlans = useMemo(() => (privacyMode ? plans.filter(p => !p.isPersonal) : plans), [plans, privacyMode]);
  const selectedId = searchParams.get('plan');
  const plan = visiblePlans.find(p => p.id === selectedId) || visiblePlans[0];

  const todayStr = getLocalDateString();
  const isCurrent = (period) => todayStr >= utcDay(period.startDate) && todayStr <= utcDay(period.endDate);

  // Open the current (or latest) period whenever the selected plan changes
  useEffect(() => {
    if (!plan) return;
    const current = plan.periods.find(isCurrent) || plan.periods[plan.periods.length - 1];
    setOpenPeriodId(current?.id || null);
    setAddingPeriod(false);
  }, [plan?.id]);

  const selectPlan = (id) => setSearchParams({ plan: id }, { replace: true });

  const replacePlan = (updated) => setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  const patchPeriods = (planId, fn) => setPlans(prev => prev.map(p => (p.id === planId ? { ...p, periods: fn(p.periods) } : p)));

  const savePlan = async (form) => {
    const body = JSON.stringify(form);
    if (dialog.plan?.id) {
      replacePlan(await api(`/api/plans/${dialog.plan.id}`, { method: 'PATCH', body }));
    } else {
      const created = await api('/api/plans', { method: 'POST', body });
      setPlans(prev => [...prev, created]);
      selectPlan(created.id);
    }
    setDialog({ open: false, plan: null });
  };

  const deletePlan = async (target) => {
    if (!window.confirm(`Delete "${target.name}" and all its weeks? This can't be undone.`)) return;
    await api(`/api/plans/${target.id}`, { method: 'DELETE' });
    setPlans(prev => prev.filter(p => p.id !== target.id));
    setDialog({ open: false, plan: null });
    setSearchParams({}, { replace: true });
  };

  const startAddPeriod = () => {
    const last = plan.periods[plan.periods.length - 1];
    let start = todayStr;
    if (last) {
      const next = new Date(last.endDate);
      next.setUTCDate(next.getUTCDate() + 1);
      start = next.toISOString().split('T')[0];
    }
    setNewPeriod({ startDate: start, goalText: '' });
    setAddingPeriod(true);
  };

  const createPeriod = async (e) => {
    e.preventDefault();
    try {
      const period = await api(`/api/plans/${plan.id}/periods`, { method: 'POST', body: JSON.stringify(newPeriod) });
      patchPeriods(plan.id, periods => [...periods, period].sort((a, b) => a.weekNumber - b.weekNumber));
      setOpenPeriodId(period.id);
      setAddingPeriod(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePeriod = async (period) => {
    if (!window.confirm(`Delete ${periodName(plan, period)}? Its topics will be lost.`)) return;
    await api(`/api/plan/weeks/${period.id}`, { method: 'DELETE' });
    patchPeriods(plan.id, periods => periods.filter(p => p.id !== period.id));
  };

  const updateDay = async (periodId, day, changes) => {
    setSavingStates(prev => ({ ...prev, [day.id]: 'saving' }));
    try {
      await api(`/api/plan/days/${day.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      patchPeriods(plan.id, periods => periods.map(p => (
        p.id === periodId ? { ...p, planDays: p.planDays.map(d => (d.id === day.id ? { ...d, ...changes } : d)) } : p
      )));
      setSavingStates(prev => ({ ...prev, [day.id]: 'saved' }));
      setTimeout(() => setSavingStates(prev => {
        const copy = { ...prev };
        delete copy[day.id];
        return copy;
      }), 1500);
    } catch {
      setSavingStates(prev => ({ ...prev, [day.id]: 'error' }));
    }
  };

  const saveGoal = async (period, goalText) => {
    if (goalText === period.goalText) return;
    const updated = await api(`/api/plans/periods/${period.id}`, { method: 'PATCH', body: JSON.stringify({ goalText }) });
    patchPeriods(plan.id, periods => periods.map(p => (p.id === period.id ? { ...p, goalText: updated.goalText } : p)));
  };

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const dayLabel = (day) => {
    if (plan.layout === 'split') {
      const hours = day.isWeekend ? plan.weekendHours : plan.weekdayHours;
      return { main: day.isWeekend ? 'Weekend' : 'Weekdays', sub: `${day.isWeekend ? 'Sat – Sun' : 'Mon – Fri'}${hours ? ` · ${hours}h` : ''}` };
    }
    if (plan.layout === 'single') {
      return { main: plan.cadence === 'monthly' ? 'This month' : 'This week', sub: plan.weekdayHours ? `${plan.weekdayHours}h` : '' };
    }
    return { main: fmt(day.date, { weekday: 'short' }), sub: fmt(day.date, { month: 'short', day: 'numeric' }) };
  };

  if (loading) return <Loader text="Loading plans..." />;

  const unit = plan?.cadence === 'monthly' ? 'month' : 'week';
  const currentPeriod = plan?.periods.find(isCurrent);
  const allDays = plan ? plan.periods.flatMap(p => p.planDays) : [];
  const overallPercent = allDays.length ? Math.round((allDays.filter(d => d.isDone).length / allDays.length) * 100) : 0;
  const hiddenCount = plans.length - visiblePlans.length;

  return (
    <div className="plans-page" style={plan ? { '--tone': plan.color } : undefined}>
      <PageHeader
        icon={CalendarRange}
        title="Plans"
        subtitle="Weekly and monthly plans, set up your way"
        actions={
          <button className="ui-btn ui-btn-primary" onClick={() => setDialog({ open: true, plan: null })}>
            <Plus size={16} />
            New plan
          </button>
        }
      />

      {error && <div className="text-error">{error}</div>}

      {visiblePlans.length > 0 && (
        <nav className="plan-tabs" aria-label="Plans">
          {visiblePlans.map(p => (
            <button
              key={p.id}
              className={`plan-tab ${plan?.id === p.id ? 'active' : ''}`}
              style={{ '--tone': p.color }}
              onClick={() => selectPlan(p.id)}
            >
              <span className="plan-tab-dot" />
              {p.name}
              {p.isPersonal && <Lock size={11} className="plan-tab-lock" />}
            </button>
          ))}
          {hiddenCount > 0 && <span className="plan-tabs-hidden">{hiddenCount} personal hidden</span>}
        </nav>
      )}

      {!plan ? (
        <div className="glass-card plan-empty">
          <Illustration name="plan-empty" size={150} />
          <p className="plan-empty-title">{plans.length ? 'All your plans are personal' : 'No plans yet'}</p>
          <p className="plan-empty-text">
            {plans.length ? 'Switch to your personal workspace to see them.' : 'Create a plan for anything you want to work through week by week or month by month.'}
          </p>
          {!plans.length && (
            <button className="ui-btn ui-btn-primary" onClick={() => setDialog({ open: true, plan: null })}>
              <Plus size={16} />
              New plan
            </button>
          )}
        </div>
      ) : (
        <div key={plan.id} className="plan-body">
          <div className="plan-summary">
            <div className="plan-summary-text">
              <h2>{plan.name}</h2>
              <p>{[plan.description, effortSummary(plan)].filter(Boolean).join(' — ')}</p>
            </div>
            <div className="plan-summary-actions">
              <button className="ui-btn ui-btn-ghost" onClick={() => setDialog({ open: true, plan })}>
                <Settings2 size={15} />
                Settings
              </button>
              <button className="ui-btn ui-btn-secondary" onClick={startAddPeriod}>
                <Plus size={15} />
                Add {unit}
              </button>
            </div>
          </div>

          {plan.periods.length > 0 && (
            <div className="ui-stat-row">
              <div className="ui-stat">
                <div className="ui-stat-label">This {unit}</div>
                <div className="ui-stat-value">
                  {currentPeriod ? `${currentPeriod.planDays.filter(d => d.isDone).length} of ${currentPeriod.planDays.length}` : '—'}
                </div>
                <div className="ui-stat-meta">{currentPeriod ? `${periodName(plan, currentPeriod)} done` : `No ${unit} covers today`}</div>
              </div>
              <div className="ui-stat">
                <div className="ui-stat-label">Overall</div>
                <div className="ui-stat-value"><CountUp value={overallPercent} suffix="%" /></div>
                <div className="ui-progress" style={{ marginTop: '0.5rem' }}><div style={{ width: `${overallPercent}%` }} /></div>
              </div>
              <div className="ui-stat">
                <div className="ui-stat-label">{unit === 'week' ? 'Weeks' : 'Months'} planned</div>
                <div className="ui-stat-value"><CountUp value={plan.periods.length} /></div>
                <div className="ui-stat-meta">{plan.periods.filter(p => p.planDays.every(d => d.isDone)).length} completed</div>
              </div>
            </div>
          )}

          {addingPeriod && (
            <form className="glass-card plan-add-form" onSubmit={createPeriod}>
              <h3 className="ui-section-title">New {unit}</h3>
              <div className="ui-field-row">
                <div className="ui-field">
                  <label htmlFor="pStart">Starts on</label>
                  <input id="pStart" type="date" className="input-control" value={newPeriod.startDate} onChange={(e) => setNewPeriod(p => ({ ...p, startDate: e.target.value }))} required />
                </div>
                <div className="ui-field">
                  <label htmlFor="pGoal">Goal</label>
                  <input id="pGoal" className="input-control" value={newPeriod.goalText} onChange={(e) => setNewPeriod(p => ({ ...p, goalText: e.target.value }))} placeholder={`What this ${unit} is about`} />
                </div>
              </div>
              <div className="plan-add-actions">
                <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setAddingPeriod(false)}>Cancel</button>
                <button type="submit" className="ui-btn ui-btn-primary">Add {unit}</button>
              </div>
            </form>
          )}

          {plan.periods.length === 0 && !addingPeriod ? (
            <div className="glass-card plan-empty">
              <p className="plan-empty-title">No {unit}s in this plan yet</p>
              <p className="plan-empty-text">Add the first {unit} and fill in what you want to cover.</p>
              <button className="ui-btn ui-btn-primary" onClick={startAddPeriod}>
                <Plus size={16} />
                Add {unit}
              </button>
            </div>
          ) : (
            <div className="plan-weeks">
              {plan.periods.map(period => {
                const isOpen = openPeriodId === period.id;
                const done = period.planDays.filter(d => d.isDone).length;
                const percent = period.planDays.length ? Math.round((done / period.planDays.length) * 100) : 0;
                const days = plan.layout === 'split'
                  ? [...period.planDays].sort((a, b) => (a.isWeekend === b.isWeekend ? 0 : a.isWeekend ? -1 : 1))
                  : period.planDays;

                return (
                  <section key={period.id} className={`glass-card plan-week ${isOpen ? 'open' : ''}`}>
                    <div className="plan-week-head" onClick={() => setOpenPeriodId(isOpen ? null : period.id)}>
                      <div className="plan-week-title">
                        <div className="plan-week-name">
                          {periodName(plan, period)}
                          {isCurrent(period) && <span className="plan-pill">This {unit}</span>}
                        </div>
                        <div className="plan-week-meta">
                          {fmt(period.startDate, { month: 'short', day: 'numeric' })} – {fmt(period.endDate, { month: 'short', day: 'numeric' })}
                          {period.goalText && <> · {period.goalText}</>}
                        </div>
                      </div>
                      <div className="plan-week-progress">
                        <div className="ui-progress"><div style={{ width: `${percent}%` }} /></div>
                        <span>{done}/{period.planDays.length}</span>
                      </div>
                      <div className="plan-week-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="ui-icon-btn danger" onClick={() => deletePeriod(period)} title={`Delete ${unit}`}>
                          <Trash2 size={15} />
                        </button>
                        <button className="ui-icon-btn" onClick={() => setOpenPeriodId(isOpen ? null : period.id)} title={isOpen ? 'Collapse' : 'Expand'}>
                          <ChevronDown size={18} className={`plan-chevron ${isOpen ? 'up' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="plan-days">
                        <div className="plan-goal">
                          <span>Goal</span>
                          <input
                            className="plan-topic"
                            defaultValue={period.goalText}
                            placeholder={`What this ${unit} is about`}
                            onBlur={(e) => saveGoal(period, e.target.value)}
                          />
                        </div>
                        {days.map(day => {
                          const label = dayLabel(day);
                          const today = plan.layout === 'daily' && utcDay(day.date) === todayStr;
                          return (
                            <div key={day.id} className={`plan-day ${day.isDone ? 'done' : ''} ${today ? 'today' : ''}`}>
                              <button
                                className={`plan-check ${day.isDone ? 'checked' : ''}`}
                                onClick={() => updateDay(period.id, day, { isDone: !day.isDone })}
                                title={day.isDone ? 'Mark as not done' : 'Mark as done'}
                              >
                                {day.isDone && <Check size={13} strokeWidth={3} />}
                              </button>
                              <div className="plan-day-label">
                                <span>{label.main}{today && <em> · Today</em>}</span>
                                {label.sub && <small>{label.sub}</small>}
                              </div>
                              {plan.layout === 'daily' ? (
                                <input
                                  className="plan-topic"
                                  placeholder="Add a topic"
                                  defaultValue={day.topic}
                                  onBlur={(e) => e.target.value !== (day.topic || '') && updateDay(period.id, day, { topic: e.target.value })}
                                />
                              ) : (
                                <textarea
                                  className="plan-topic"
                                  rows={2}
                                  ref={autoGrow}
                                  onInput={(e) => autoGrow(e.target)}
                                  placeholder="What you plan to cover"
                                  defaultValue={day.topic}
                                  onBlur={(e) => e.target.value !== (day.topic || '') && updateDay(period.id, day, { topic: e.target.value })}
                                />
                              )}
                              <span className={`plan-save ${savingStates[day.id] || ''}`}>
                                {savingStates[day.id] === 'saving' && 'Saving'}
                                {savingStates[day.id] === 'saved' && 'Saved'}
                                {savingStates[day.id] === 'error' && 'Not saved'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      <PlanSettingsDialog
        open={dialog.open}
        initial={dialog.plan}
        onClose={() => setDialog({ open: false, plan: null })}
        onSave={savePlan}
        onDelete={deletePlan}
      />
    </div>
  );
};

export default Plans;
