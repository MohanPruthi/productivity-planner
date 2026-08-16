const prisma = require('./src/db');

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'mohanpruthi33@gmail.com' }
  });
  if (!user) {
    console.log("User not found");
    return;
  }
  const weeks = await prisma.planWeek.findMany({
    where: { userId: user.id, track: 'AI' },
    include: { planDays: { orderBy: { date: 'asc' } } }
  });

  for (const week of weeks) {
    console.log(`Week ${week.weekNumber}:`);
    for (const day of week.planDays) {
      console.log(`  ${day.dayLabel} (${day.isWeekend ? 'Weekend' : 'Weekday'}): ${day.topic.substring(0, 60)}...`);
    }
  }
}

main().finally(() => prisma.$disconnect());
