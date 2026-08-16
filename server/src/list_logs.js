const prisma = require('./db');

async function run() {
  try {
    console.log("Listing all daily study logs in the DB:");
    const logs = await prisma.dailyStudyLog.findMany();
    for (const log of logs) {
      console.log(`ID: ${log.id}, User: ${log.userId}, Date: ${log.date.toISOString()}, Duration: ${log.duration} minutes`);
    }
  } catch (error) {
    console.error("Error listing logs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
