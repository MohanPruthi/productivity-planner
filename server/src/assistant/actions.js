// Executes assistant tool calls. Writes mirror the existing controllers (same Prisma calls and date handling).
const crypto = require('crypto');
const prisma = require('../db');
const { getProblem } = require('../leetcode');
const { periodEnd, buildDays } = require('../controllers/plansController');
const { bestMatch } = require('./fuzzy');
const { isValidDate, addDays, serverToday, dateAtHour, dayRange, fmt } = require('./dates');

const MAX_CALLS = 10;
const BULK_TASKS = 8; // creating more tasks than this in one command needs a confirm
const CONFIRM_TTL_MS = 2 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PAGE_ROUTES = {
  dashboard: '/', plans: '/plans', dsa: '/dsa-log', board: '/task-history', meds: '/meds',
  contacts: '/hr-directory', notes: '/notes', settings: '/settings', themes: '/themes',
};

class ActionError extends Error {
  constructor(message, errorKind = 'bad_request') {
    super(message);
    this.errorKind = errorKind;
  }
}

const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function pickDate(value, ctx) {
  if (value === undefined || value === null || value === '') return ctx.today;
  if (!isValidDate(value)) throw new ActionError('That date was not understood');
  return value;
}

function prettyDate(dateStr, ctx) {
  if (dateStr === ctx.today) return 'today';
  if (dateStr === addDays(ctx.today, 1)) return 'tomorrow';
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

async function visibleNotes(ctx) {
  return prisma.note.findMany({
    where: { userId: ctx.userId, ...(ctx.privacyMode && { isPersonal: false }) },
    select: { id: true, title: true, type: true, content: true, checklist: true },
  });
}

async function findNote(query, ctx) {
  const q = clip(query, 120);
  if (!q) throw new ActionError('Which note?');
  const hit = bestMatch(q, await visibleNotes(ctx), (n) => n.title);
  if (!hit) throw new ActionError(`No note matching "${q}"`, 'not_found');
  return hit.item;
}

// ---- pending helpers (same rule as the Work board: not done and dated before today) ----
async function findPending(ctx) {
  const before = dateAtHour(ctx.today, 0);
  const [tasks, days] = await Promise.all([
    prisma.normalTask.findMany({ where: { userId: ctx.userId, isDone: false, date: { lt: before } }, select: { id: true } }),
    prisma.planDay.findMany({ where: { userId: ctx.userId, isDone: false, date: { lt: before } }, select: { id: true } }),
  ]);
  return { tasks, days };
}

const handlers = {
  async create_tasks(args, ctx) {
    const items = Array.isArray(args.items) ? args.items : [];
    const rows = items
      .map((it) => ({ text: clip(it && it.text, 300), date: pickDate(it && it.date, ctx) }))
      .filter((r) => r.text);
    if (!rows.length) throw new ActionError('No task text found');
    await prisma.normalTask.createMany({
      data: rows.map((r) => ({ userId: ctx.userId, date: dateAtHour(r.date, 12), text: r.text, isDone: false })),
    });
    const dates = [...new Set(rows.map((r) => r.date))];
    const when = dates.length === 1 ? ` for ${prettyDate(dates[0], ctx)}` : '';
    return { summary: `Added ${plural(rows.length, 'task')}${when}`, ui: [{ type: 'refresh', scope: 'tasks' }] };
  },

  async complete_task(args, ctx) {
    const query = clip(args.query, 200);
    if (!query) throw new ActionError('Which task?');
    let where;
    if (args.date) {
      const { start, end } = dayRange(pickDate(args.date, ctx));
      where = { userId: ctx.userId, isDone: false, date: { gte: start, lte: end } };
    } else {
      where = { userId: ctx.userId, isDone: false, date: { gte: dateAtHour(addDays(ctx.today, -30), 0), lte: dateAtHour(addDays(ctx.today, 30), 23) } };
    }
    const tasks = await prisma.normalTask.findMany({ where, select: { id: true, text: true } });
    const hit = bestMatch(query, tasks, (t) => t.text);
    if (!hit) throw new ActionError(`No open task matching "${query}"`, 'not_found');
    await prisma.normalTask.update({ where: { id: hit.item.id }, data: { isDone: true } });
    return { summary: `Done: ${hit.item.text}`, ui: [{ type: 'refresh', scope: 'tasks' }] };
  },

  async show_pending() {
    return { summary: 'Showing pending tasks', ui: [{ type: 'navigate', to: '/task-history' }, { type: 'openPending' }] };
  },

  async move_pending_to_today(args, ctx) {
    const { tasks, days } = await findPending(ctx);
    const total = tasks.length + days.length;
    if (!total) return { summary: 'No pending tasks to move' };
    const target = dateAtHour(ctx.today, 0);
    const wd = target.getDay();
    await prisma.$transaction([
      prisma.normalTask.updateMany({ where: { id: { in: tasks.map((t) => t.id) }, userId: ctx.userId }, data: { date: target } }),
      prisma.planDay.updateMany({
        where: { id: { in: days.map((d) => d.id) }, userId: ctx.userId },
        data: { date: target, dayLabel: DAY_NAMES[wd], isWeekend: wd === 0 || wd === 6 },
      }),
    ]);
    return { summary: `Moved ${plural(total, 'pending task')} to today`, ui: [{ type: 'refresh', scope: 'tasks' }, { type: 'refresh', scope: 'plans' }] };
  },

  async log_dsa(args, ctx) {
    const number = String(args.number == null ? '' : args.number).replace(/^#/, '').trim();
    if (!/^\d{1,5}$/.test(number)) throw new ActionError('Which problem number?');
    const date = pickDate(args.date, ctx);
    // Same enrichment as POST /api/dsa-logs
    const problem = await getProblem(number);
    let difficulty = problem ? problem.difficulty : 'Medium';
    if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) difficulty = 'Medium';
    await prisma.dsaLog.create({
      data: {
        userId: ctx.userId,
        date: dateAtHour(date, 0),
        questionNumber: number,
        difficulty,
        title: problem ? problem.title : '',
        titleSlug: problem?.titleSlug || null,
        topics: problem?.topics || [],
        notes: '',
      },
    });
    return { summary: `Logged DSA #${number}${problem ? ` ${problem.title}` : ''}`, ui: [{ type: 'refresh', scope: 'dsa' }] };
  },

  async log_med(args, ctx) {
    const slot = args.slot === 'morning' ? 'morning' : ['evening', 'night'].includes(args.slot) ? 'evening' : null;
    if (!slot) throw new ActionError('Morning or evening?');
    const date = dateAtHour(pickDate(args.date, ctx), 0);
    await prisma.medLog.upsert({
      where: { userId_date: { userId: ctx.userId, date } },
      update: { [slot]: true },
      create: { userId: ctx.userId, date, morning: slot === 'morning', evening: slot === 'evening' },
    });
    return { summary: `Logged ${slot} meds`, ui: [{ type: 'refresh', scope: 'meds' }] };
  },

  async open_note(args, ctx) {
    const note = await findNote(args.query, ctx);
    return { summary: `Opening "${note.title}"`, ui: [{ type: 'openNote', noteId: note.id }] };
  },

  async append_to_note(args, ctx) {
    const text = clip(args.text, 2000);
    if (!text) throw new ActionError('What should I add?');
    const note = await findNote(args.query, ctx);
    if (note.type === 'todo') {
      const list = Array.isArray(note.checklist) ? note.checklist : [];
      const item = { id: `item_${Date.now()}`, text, isDone: false };
      await prisma.note.update({ where: { id: note.id }, data: { checklist: [...list, item] } });
    } else {
      const content = `${note.content || ''}<p>${escapeHtml(text)}</p>`.trim();
      await prisma.note.update({ where: { id: note.id }, data: { content } });
    }
    return { summary: `Added to "${note.title}"`, ui: [{ type: 'refresh', scope: 'notes' }] };
  },

  async create_note(args, ctx) {
    const title = clip(args.title, 200);
    if (!title) throw new ActionError('What is the note title?');
    const text = clip(args.text, 5000);
    const note = await prisma.note.create({
      data: {
        userId: ctx.userId,
        title,
        content: text ? `<p>${escapeHtml(text)}</p>` : '',
        type: 'note',
        checklist: [],
        colorTag: '#6366f1',
        isPersonal: false,
        isPinned: false,
        pinnedAt: null,
      },
    });
    return { summary: `Created note "${title}"`, ui: [{ type: 'refresh', scope: 'notes' }, { type: 'openNote', noteId: note.id }] };
  },

  async zen(args) {
    const op = ['start', 'pause', 'reset', 'mode'].includes(args.op) ? args.op : null;
    if (!op) throw new ActionError('Start, pause or reset?');
    const ui = { type: 'zen', op };
    let label = { start: 'Timer started', pause: 'Timer paused', reset: 'Timer reset' }[op];
    if (op === 'mode') {
      if (!['focus', 'short', 'long'].includes(args.mode)) throw new ActionError('Which timer mode?');
      ui.mode = args.mode;
      label = `Switched to ${args.mode === 'focus' ? 'focus' : `${args.mode} break`}`;
    }
    return { summary: label, ui: [ui] };
  },

  async create_plan(args, ctx) {
    const name = clip(args.name, 120);
    if (!name) throw new ActionError('What is the plan called?');
    const cadence = args.cadence === 'monthly' ? 'monthly' : 'weekly';
    const count = await prisma.plan.count({ where: { userId: ctx.userId } });
    await prisma.plan.create({ data: { userId: ctx.userId, name, cadence, sortOrder: count } });
    return { summary: `Created ${cadence} plan "${name}"`, ui: [{ type: 'refresh', scope: 'plans' }] };
  },

  async add_plan_week(args, ctx) {
    const query = clip(args.planQuery, 120);
    if (!query) throw new ActionError('Which plan?');
    const plans = await prisma.plan.findMany({
      where: { userId: ctx.userId, ...(ctx.privacyMode && { isPersonal: false }) },
      select: { id: true, userId: true, name: true, cadence: true, layout: true },
    });
    const hit = bestMatch(query, plans, (p) => p.name);
    if (!hit) throw new ActionError(`No plan matching "${query}"`, 'not_found');
    const plan = hit.item;

    const last = await prisma.planWeek.findFirst({ where: { planId: plan.id }, orderBy: { weekNumber: 'desc' } });
    let startStr = args.startDate;
    if (startStr !== undefined && startStr !== null && startStr !== '' && !isValidDate(startStr)) throw new ActionError('That start date was not understood');
    if (!startStr) {
      if (last) startStr = addDays(fmt(last.endDate), 1);
      else if (plan.cadence === 'monthly') startStr = `${ctx.today.slice(0, 8)}01`;
      else {
        const dow = new Date(`${ctx.today}T00:00:00Z`).getUTCDay();
        startStr = addDays(ctx.today, -((dow + 6) % 7)); // Monday of this week
      }
    }
    const number = (last?.weekNumber || 0) + 1;
    const start = new Date(startStr);
    const end = periodEnd(start, plan.cadence);
    const goalText = clip(args.goal, 500);

    await prisma.$transaction(async (tx) => {
      const created = await tx.planWeek.create({
        data: { userId: ctx.userId, planId: plan.id, weekNumber: number, startDate: start, endDate: end, goalText },
      });
      await tx.planDay.createMany({ data: buildDays(plan, created, start, end) });
    });
    const label = plan.cadence === 'monthly' ? 'month' : 'week';
    return { summary: `Added ${label} ${number} to "${plan.name}"`, ui: [{ type: 'refresh', scope: 'plans' }] };
  },

  async navigate(args) {
    const to = PAGE_ROUTES[args.page];
    if (!to) throw new ActionError('That page does not exist');
    return { summary: `Opening ${args.page}`, ui: [{ type: 'navigate', to }] };
  },
};

function needsConfirm(call) {
  if (call.name === 'move_pending_to_today') return true;
  if (call.name === 'create_tasks' && Array.isArray(call.args?.items) && call.args.items.length > BULK_TASKS) return true;
  return false;
}

async function confirmSummary(call, ctx) {
  if (call.name === 'move_pending_to_today') {
    const { tasks, days } = await findPending(ctx);
    return `Move ${plural(tasks.length + days.length, 'pending task')} to today?`;
  }
  return `Add ${call.args.items.length} tasks?`;
}

async function execOne(call, ctx) {
  const handler = handlers[call.name];
  if (!handler) return { action: String(call.name), ok: false, summary: 'I cannot do that yet', errorKind: 'bad_request' };
  try {
    const out = await handler(call.args && typeof call.args === 'object' ? call.args : {}, ctx);
    return { action: call.name, ok: true, summary: out.summary, ui: out.ui || [] };
  } catch (err) {
    if (err instanceof ActionError) return { action: call.name, ok: false, summary: err.message, errorKind: err.errorKind, ui: [] };
    console.error(`assistant action ${call.name} failed:`, err.message);
    return { action: call.name, ok: false, summary: 'Something went wrong saving that', errorKind: 'bad_request', ui: [] };
  }
}

// Runs calls in order. Calls that need confirmation are skipped and returned in `held`.
async function runCalls(calls, ctx, { skipConfirm = false } = {}) {
  const list = (Array.isArray(calls) ? calls : []).filter((c) => c && c.name).slice(0, MAX_CALLS);
  const results = [];
  const ui = [];
  const held = [];
  for (const call of list) {
    if (!skipConfirm && needsConfirm(call)) { held.push(call); continue; }
    const r = await execOne(call, ctx);
    ui.push(...r.ui);
    results.push({ action: r.action, ok: r.ok, summary: r.summary, ...(r.errorKind && { errorKind: r.errorKind }) });
  }
  return { results, ui, held };
}

// ---- confirm tokens: in memory, 2 minutes, single use, bound to the user ----
const pendingConfirms = new Map();

function sweep() {
  const now = Date.now();
  for (const [token, v] of pendingConfirms) if (v.expires <= now) pendingConfirms.delete(token);
}

async function holdForConfirm(held, ctx) {
  sweep();
  const token = crypto.randomBytes(16).toString('hex');
  const summaries = [];
  for (const call of held) summaries.push(await confirmSummary(call, ctx));
  const summary = summaries.join(' ');
  pendingConfirms.set(token, {
    userId: ctx.userId, calls: held, today: ctx.today, privacyMode: ctx.privacyMode, expires: Date.now() + CONFIRM_TTL_MS,
  });
  return { token, summary };
}

function takeConfirm(token, userId) {
  sweep();
  const v = pendingConfirms.get(token);
  if (!v || v.userId !== userId) return null;
  pendingConfirms.delete(token); // single use
  return v;
}

module.exports = { runCalls, holdForConfirm, takeConfirm, serverToday };
