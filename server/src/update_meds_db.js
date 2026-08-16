const prisma = require('./db');

async function run() {
  try {
    console.log("Updating all existing MedSchedule entries to 30 days...");
    const result = await prisma.medSchedule.updateMany({
      data: {
        durationDays: 30
      }
    });
    console.log(`Successfully updated ${result.count} MedSchedule records to 30 days.`);
  } catch (error) {
    console.error("Error updating MedSchedule:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
