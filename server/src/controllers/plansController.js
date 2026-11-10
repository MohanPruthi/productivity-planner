const prisma = require('../db');

const CADENCES = ['weekly', 'monthly'];
const LAYOUTS = ['daily', 'split', 'single'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isWeekendDay = (date) => date.getDay() === 0 || date.getDay() === 6;

const periodsInclude = {
  periods: {
    orderBy: { weekNumber: 'asc' },
    include: { planDays: { orderBy: { date: 'asc' } } },
  },
};

// Last day of a period that starts on `start`
function periodEnd(start, cadence) {
  const end = new Date(start);
  if (cadence === 'monthly') {
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
  } else {
    end.setDate(end.getDate() + 6);
  }
  return end;
}

// First date on/after `from` (up to `to`) that matches the weekday/weekend test
function firstMatching(from, to, wantWeekend) {
  const d = new Date(from);
  while (d <= to) {
    if (isWeekendDay(d) === wantWeekend) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return new Date(from);
}

// Rows to create for one period, following the plan's layout
function buildDays(plan, period, start, end) {
  const base = { userId: plan.userId, planWeekId: period.id, topic: '', discussionNote: '', isDone: false };

  if (plan.layout === 'split') {
    // Labels match the old AI plan rows, which the dashboard uses to place them
    return [
      { ...base, date: firstMatching(start, end, true), dayLabel: 'Weekend Plan', isWeekend: true },
      { ...base, date: firstMatching(start, end, false), dayLabel: 'Weekday Plan', isWeekend: false },
    ];
  }

  if (plan.layout === 'single') {
    return [{ ...base, date: new Date(start), dayLabel: 'Plan', isWeekend: false }];
  }

  const days = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({ ...base, date: new Date(d), dayLabel: DAY_NAMES[d.getDay()], isWeekend: isWeekendDay(d) });
  }
  return days;
}

function cleanPlanInput(body) {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(body.color)) data.color = body.color;
  if (CADENCES.includes(body.cadence)) data.cadence = body.cadence;
  if (LAYOUTS.includes(body.layout)) data.layout = body.layout;
  for (const key of ['weekdayHours', 'weekendHours']) {
    if (body[key] !== undefined) {
      const n = parseInt(body[key], 10);
      data[key] = Number.isFinite(n) && n >= 0 ? n : null;
    }
  }
  if (body.isPersonal !== undefined) data.isPersonal = Boolean(body.isPersonal);
  return data;
}

async function getPlans(req, res) {
  try {
    const plans = await prisma.plan.findMany({
      where: { userId: req.user.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: periodsInclude,
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createPlan(req, res) {
  try {
    const data = cleanPlanInput(req.body);
    if (!data.name) {
      return res.status(400).json({ error: 'Plan name is required' });
    }
    const count = await prisma.plan.count({ where: { userId: req.user.id } });
    const plan = await prisma.plan.create({
      data: { ...data, userId: req.user.id, sortOrder: count },
      include: periodsInclude,
    });
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updatePlan(req, res) {
  try {
    const existing = await prisma.plan.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const data = cleanPlanInput(req.body);
    if (data.name === '') {
      return res.status(400).json({ error: 'Plan name is required' });
    }
    const plan = await prisma.plan.update({ where: { id: existing.id }, data, include: periodsInclude });
    res.json(plan);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deletePlan(req, res) {
  try {
    const existing = await prisma.plan.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    await prisma.plan.delete({ where: { id: existing.id } });
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createPeriod(req, res) {
  try {
    const plan = await prisma.plan.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { startDate, goalText } = req.body;
    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    const last = await prisma.planWeek.findFirst({ where: { planId: plan.id }, orderBy: { weekNumber: 'desc' } });
    const number = req.body.number ? parseInt(req.body.number, 10) : (last?.weekNumber || 0) + 1;
    const clash = await prisma.planWeek.findFirst({ where: { planId: plan.id, weekNumber: number } });
    if (clash) {
      return res.status(400).json({ error: `${plan.cadence === 'monthly' ? 'Month' : 'Week'} ${number} already exists` });
    }

    const start = new Date(startDate);
    const end = periodEnd(start, plan.cadence);

    const period = await prisma.$transaction(async (tx) => {
      const created = await tx.planWeek.create({
        data: {
          userId: req.user.id,
          planId: plan.id,
          weekNumber: number,
          startDate: start,
          endDate: end,
          goalText: goalText || '',
        },
      });
      await tx.planDay.createMany({ data: buildDays(plan, created, start, end) });
      return tx.planWeek.findUnique({
        where: { id: created.id },
        include: { planDays: { orderBy: { date: 'asc' } } },
      });
    });

    res.status(201).json(period);
  } catch (error) {
    console.error('Error creating plan period:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updatePeriod(req, res) {
  try {
    const period = await prisma.planWeek.findFirst({ where: { id: req.params.periodId, userId: req.user.id } });
    if (!period) {
      return res.status(404).json({ error: 'Period not found' });
    }
    const updated = await prisma.planWeek.update({
      where: { id: period.id },
      data: { ...(req.body.goalText !== undefined && { goalText: String(req.body.goalText) }) },
      include: { planDays: { orderBy: { date: 'asc' } } },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating plan period:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// The old AI and SD plans become regular plans. Safe to run on every start:
// only periods without a plan are touched.
const LEGACY_PLANS = {
  AI: { name: 'AI learning', description: 'LLM internals, evaluation and fine-tuning', color: '#3b82f6', cadence: 'weekly', layout: 'split', weekdayHours: 10, weekendHours: 10 },
  SD: { name: 'System design', description: 'Distributed systems and architecture, one topic a day', color: '#10b981', cadence: 'weekly', layout: 'daily' },
};

async function migrateLegacyPlans() {
  const orphans = await prisma.planWeek.groupBy({
    by: ['userId', 'track'],
    where: { planId: null, track: { not: null } },
  });

  for (const { userId, track } of orphans) {
    const legacy = LEGACY_PLANS[track];
    if (!legacy) continue;
    let plan = await prisma.plan.findFirst({ where: { userId, name: legacy.name } });
    if (!plan) {
      const count = await prisma.plan.count({ where: { userId } });
      plan = await prisma.plan.create({ data: { ...legacy, userId, sortOrder: track === 'AI' ? count : count + 1 } });
    }
    const moved = await prisma.planWeek.updateMany({ where: { userId, track, planId: null }, data: { planId: plan.id } });
    console.log(`Moved ${moved.count} ${track} weeks into plan "${plan.name}" for user ${userId}`);
  }
}

module.exports = {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  createPeriod,
  updatePeriod,
  migrateLegacyPlans,
  periodEnd,
  buildDays,
};
