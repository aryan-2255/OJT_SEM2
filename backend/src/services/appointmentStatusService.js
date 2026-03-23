const { AppointmentStatus } = require("@prisma/client");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const {
  formatLocalDateOnly,
  getCurrentHospitalMinutes,
  minutesToTime,
  toDateOnly,
} = require("../utils/time");

async function syncCompletedAppointments(now = new Date()) {
  const today = toDateOnly(formatLocalDateOnly(now));
  const currentMinutes = getCurrentHospitalMinutes(now);
  const completedCutoffMinutes = currentMinutes - env.slotIntervalMinutes;

  if (!today) {
    return;
  }

  await prisma.appointment.updateMany({
    where: {
      status: AppointmentStatus.BOOKED,
      OR: [
        {
          date: {
            lt: today,
          },
        },
        ...(completedCutoffMinutes >= 0
          ? [
              {
                date: today,
                time: {
                  lte: minutesToTime(completedCutoffMinutes),
                },
              },
            ]
          : []),
      ],
    },
    data: {
      status: AppointmentStatus.COMPLETED,
    },
  });
}

module.exports = {
  syncCompletedAppointments,
};
