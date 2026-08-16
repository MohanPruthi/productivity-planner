const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find the first user in the database (since this is personal use)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found in database. Please register/signup first!');
      return;
    }

    console.log(`Seeding past week study logs for user: ${user.name} (${user.email})`);

    const logsData = [
      { date: new Date('2026-07-17T00:00:00Z'), duration: 1.8 * 60 }, // 1.8 hrs (90%, Blue)
      { date: new Date('2026-07-18T00:00:00Z'), duration: 6.2 * 60 }, // 6.2 hrs (103%, Emerald)
      { date: new Date('2026-07-19T00:00:00Z'), duration: 4.5 * 60 }, // 4.5 hrs (75%, Blue)
      { date: new Date('2026-07-20T00:00:00Z'), duration: 0.5 * 60 }, // 0.5 hrs (25%, Gray)
      { date: new Date('2026-07-21T00:00:00Z'), duration: 2.5 * 60 }, // 2.5 hrs (125%, Emerald)
      { date: new Date('2026-07-22T00:00:00Z'), duration: 1.2 * 60 }, // 1.2 hrs (60%, Orange)
      { date: new Date('2026-07-23T00:00:00Z'), duration: 2.0 * 60 }, // 2.0 hrs (100%, Emerald)
    ];

    for (const data of logsData) {
      await prisma.dailyStudyLog.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: data.date,
          },
        },
        update: {
          duration: data.duration,
        },
        create: {
          userId: user.id,
          date: data.date,
          duration: data.duration,
        },
      });
    }

    console.log('Successfully seeded past week study logs!');
  } catch (error) {
    console.error('Error seeding study logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
