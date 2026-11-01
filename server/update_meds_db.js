const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Updating MedSchedule durationDays to 60...");
  const result = await prisma.medSchedule.updateMany({
    data: {
      durationDays: 60
    }
  });
  console.log(`Successfully updated ${result.count} MedSchedule record(s) to 60 days.`);
}

main()
  .catch((e) => {
    console.error("Error updating MedSchedule:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
