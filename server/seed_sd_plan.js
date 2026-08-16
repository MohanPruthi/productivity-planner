const prisma = require('./src/db');

// Helper to get day name
function getDayLabel(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// Helper to check if weekend
function checkIfWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'mohanpruthi33@gmail.com' }
  });
  if (!user) {
    console.log("User not found");
    return;
  }
  
  console.log(`Seeding SD plans for user: ${user.email}...`);

  // Delete existing SD weeks
  await prisma.planWeek.deleteMany({
    where: {
      userId: user.id,
      track: 'SD'
    }
  });

  const sdWeeks = [
    {
      weekNumber: 1,
      goalText: "LLD Foundations (this is scored heavily at your experience level)",
      topics: [
        "OOP fundamentals + all 4 pillars, revisit with interview lens",
        "SOLID principles (this is asked constantly)",
        "Design patterns: Singleton, Factory, Builder",
        "Design patterns: Strategy, Observer, Decorator",
        "LLD problem #1: Parking Lot (classic, do it fully — classes, relationships)",
        "LLD problem #2: Splitwise / Expense Sharing (very common, tests state + calculation logic)",
        "LLD problem #3: Elevator System or Library Management"
      ]
    },
    {
      weekNumber: 2,
      goalText: "HLD Foundations",
      topics: [
        "Client-server basics, DNS, load balancers, horizontal vs vertical scaling",
        "Caching: strategies, invalidation, CDN, Redis patterns (you know Redis practically — connect it to theory)",
        "Database scaling: replication, sharding, indexing, SQL vs NoSQL tradeoffs",
        "Message queues (Kafka/RabbitMQ basics), async processing, pub-sub",
        "API design: REST best practices, rate limiting, pagination, idempotency; CAP theorem (conceptual)",
        "HLD problem #1: URL Shortener (the standard starter — do it end to end)",
        "HLD problem #2: Rate Limiter (ties back to your CDD system experience — good talking point)"
      ]
    },
    {
      weekNumber: 3,
      goalText: "Practice, Mocks, Weak-Area Repair",
      topics: [
        "HLD problem #3: Notification System (relevant to your OfficeSampark experience — you can speak from real work)",
        "HLD problem #4: Chat Application (simplified — WebSocket knowledge from Mira gives you a real edge here)",
        "Revisit weakest LLD problem from Week 1, redo from scratch without notes",
        "Revisit weakest HLD problem from Week 2, redo from scratch",
        "Full mock interview #1 with roommate (45 min, LLD)",
        "Full mock interview #2 (45 min, HLD) + feedback review",
        "Buffer day — whatever topic felt shakiest across the 3 weeks"
      ]
    }
  ];

  // Start Date: 27th July 2026
  let startDate = new Date('2026-07-27T00:00:00.000Z');

  for (const weekData of sdWeeks) {
    const end = new Date(startDate);
    end.setDate(startDate.getDate() + 6);

    const week = await prisma.planWeek.create({
      data: {
        userId: user.id,
        track: 'SD',
        weekNumber: weekData.weekNumber,
        startDate,
        endDate: end,
        goalText: weekData.goalText
      }
    });

    const daysData = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      daysData.push({
        userId: user.id,
        planWeekId: week.id,
        track: 'SD',
        date: currentDate,
        dayLabel: getDayLabel(currentDate),
        isWeekend: checkIfWeekend(currentDate),
        topic: weekData.topics[i],
        discussionNote: '',
        isDone: false
      });
    }

    await prisma.planDay.createMany({
      data: daysData
    });

    console.log(`Created Week ${weekData.weekNumber} for track SD`);

    // Next week starts after this week ends
    startDate = new Date(end);
    startDate.setDate(end.getDate() + 1);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
