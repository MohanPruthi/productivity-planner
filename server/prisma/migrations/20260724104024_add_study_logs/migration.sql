-- CreateTable
CREATE TABLE "DailyStudyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStudyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyStudyLog_userId_date_key" ON "DailyStudyLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyStudyLog" ADD CONSTRAINT "DailyStudyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
