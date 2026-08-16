const prisma = require('./db');

async function run() {
  try {
    console.log("Updating study log for August 13, 2026 (stored as 2026-08-12T18:30:00.000Z)...");
    
    const targetDate = new Date('2026-08-12T18:30:00.000Z');

    const logs = await prisma.dailyStudyLog.findMany({
      where: {
        date: targetDate
      }
    });

    console.log(`Found ${logs.length} logs for target date.`);
    for (const log of logs) {
      console.log(`Log ID: ${log.id}, User ID: ${log.userId}, Current Duration: ${log.duration} minutes`);
      
      // Update duration to 1.9 hours = 114 minutes
      const updatedLog = await prisma.dailyStudyLog.update({
        where: { id: log.id },
        data: { duration: 114 }
      });
      
      console.log(`Updated Log ID: ${updatedLog.id} to duration: ${updatedLog.duration} minutes (1.9 hours).`);
    }
  } catch (error) {
    console.error("Error updating study log:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
