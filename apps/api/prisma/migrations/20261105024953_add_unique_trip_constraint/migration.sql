/*
  Warnings:

  - A unique constraint covering the columns `[userId,destination,startDate,endDate]` on the table `Trip` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Trip_userId_destination_startDate_endDate_key" ON "Trip"("userId", "destination", "startDate", "endDate");
