CREATE TABLE "DoctorOfflinePeriod" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorOfflinePeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorOfflinePeriod_doctorId_date_idx" ON "DoctorOfflinePeriod"("doctorId", "date");
CREATE INDEX "DoctorOfflinePeriod_doctorId_date_startTime_endTime_idx" ON "DoctorOfflinePeriod"("doctorId", "date", "startTime", "endTime");

ALTER TABLE "DoctorOfflinePeriod"
ADD CONSTRAINT "DoctorOfflinePeriod_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
