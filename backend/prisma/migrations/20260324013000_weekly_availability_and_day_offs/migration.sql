-- CreateEnum
CREATE TYPE "AvailabilityMode" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "DoctorAvailability"
ADD COLUMN "mode" "AvailabilityMode" NOT NULL DEFAULT 'DAILY',
ADD COLUMN "dayOfWeek" "Weekday";

-- DropIndex
DROP INDEX "DoctorAvailability_doctorId_idx";

-- DropIndex
DROP INDEX "DoctorAvailability_doctorId_startTime_idx";

-- CreateTable
CREATE TABLE "DoctorDayOff" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorDayOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorAvailability_doctorId_mode_idx" ON "DoctorAvailability"("doctorId", "mode");

-- CreateIndex
CREATE INDEX "DoctorAvailability_doctorId_mode_dayOfWeek_startTime_idx" ON "DoctorAvailability"("doctorId", "mode", "dayOfWeek", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorDayOff_doctorId_date_key" ON "DoctorDayOff"("doctorId", "date");

-- CreateIndex
CREATE INDEX "DoctorDayOff_doctorId_date_idx" ON "DoctorDayOff"("doctorId", "date");

-- AddForeignKey
ALTER TABLE "DoctorDayOff" ADD CONSTRAINT "DoctorDayOff_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- DropTable
DROP TABLE "Schedule";
