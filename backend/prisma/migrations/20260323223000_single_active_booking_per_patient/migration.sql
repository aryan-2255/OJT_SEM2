WITH ranked_booked_appointments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "patientId", "date"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS booking_rank
  FROM "Appointment"
  WHERE "status" = 'BOOKED'
)
UPDATE "Appointment"
SET "status" = 'CANCELLED'
WHERE "id" IN (
  SELECT "id"
  FROM ranked_booked_appointments
  WHERE booking_rank > 1
);

-- CreateIndex
CREATE INDEX "Appointment_patientId_date_status_idx" ON "Appointment"("patientId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_patientId_date_single_booked_key"
ON "Appointment"("patientId", "date")
WHERE "status" = 'BOOKED';
