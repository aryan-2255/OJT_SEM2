const { AppointmentStatus } = require("@prisma/client");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const { syncCompletedAppointments } = require("./appointmentStatusService");
const { buildAppointmentFilters, buildPaginationMeta } = require("../utils/appointmentQuery");
const httpError = require("../utils/httpError");
const {
  serializeDoctorAppointment,
  serializeSchedule,
} = require("../utils/serializers");
const {
  ensureStartBeforeEnd,
  formatDateOnly,
  formatDisplayTime,
  formatLocalDateOnly,
  generateSlots,
  isValidTimeString,
  timeToMinutes,
  toDateOnly,
} = require("../utils/time");

async function resolveDoctor(userId) {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId,
    },
  });

  if (!doctor) {
    throw httpError(404, "Doctor profile not found.");
  }

  return doctor;
}

function validateSchedulePayload({ startTime, endTime }) {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    throw httpError(400, "Invalid schedule time selected.");
  }

  if (!ensureStartBeforeEnd(startTime, endTime)) {
    throw httpError(400, "Schedule end time must be after start time.");
  }

  if (generateSlots(startTime, endTime, env.slotIntervalMinutes).length === 0) {
    throw httpError(400, `Schedule must allow at least one ${env.slotIntervalMinutes}-minute slot.`);
  }
}

function buildScheduleBlocks({ startTime, endTime, breakStartTime, breakEndTime }) {
  const normalizedBreakStart = breakStartTime?.trim() || "";
  const normalizedBreakEnd = breakEndTime?.trim() || "";

  if (!normalizedBreakStart && !normalizedBreakEnd) {
    return [{ startTime, endTime }];
  }

  if (!normalizedBreakStart || !normalizedBreakEnd) {
    throw httpError(400, "Break start and break end are both required when adding a break.");
  }

  if (!isValidTimeString(normalizedBreakStart) || !isValidTimeString(normalizedBreakEnd)) {
    throw httpError(400, "Invalid break time selected.");
  }

  if (
    timeToMinutes(normalizedBreakStart) <= timeToMinutes(startTime) ||
    timeToMinutes(normalizedBreakEnd) >= timeToMinutes(endTime) ||
    timeToMinutes(normalizedBreakStart) >= timeToMinutes(normalizedBreakEnd)
  ) {
    throw httpError(400, "Break must be fully inside the availability window.");
  }

  const scheduleBlocks = [
    {
      startTime,
      endTime: normalizedBreakStart,
    },
    {
      startTime: normalizedBreakEnd,
      endTime,
    },
  ];

  const hasEmptyBlock = scheduleBlocks.some(
    (block) => generateSlots(block.startTime, block.endTime, env.slotIntervalMinutes).length === 0
  );

  if (hasEmptyBlock) {
    throw httpError(
      400,
      `Break must leave at least one ${env.slotIntervalMinutes}-minute slot before and after it.`
    );
  }

  return scheduleBlocks;
}

function isTimeInsideBlock(time, block) {
  const appointmentMinutes = timeToMinutes(time);
  return (
    appointmentMinutes >= timeToMinutes(block.startTime) &&
    appointmentMinutes < timeToMinutes(block.endTime)
  );
}

async function ensureScheduleChangePreservesBookedAppointments(doctorId, scheduleBlocks) {
  await syncCompletedAppointments();

  const today = toDateOnly(formatLocalDateOnly(new Date()));
  const activeAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      date: {
        gte: today,
      },
      status: AppointmentStatus.BOOKED,
    },
    select: {
      date: true,
      time: true,
    },
    orderBy: [
      { date: "asc" },
      { time: "asc" },
    ],
  });

  const conflictingAppointment = activeAppointments.find(
    (appointment) => !scheduleBlocks.some((block) => isTimeInsideBlock(appointment.time, block))
  );

  if (conflictingAppointment) {
    throw httpError(
      409,
      `Cannot update daily availability because ${formatDateOnly(conflictingAppointment.date)} at ${formatDisplayTime(conflictingAppointment.time)} is already booked.`
    );
  }
}

async function listSchedules(userId) {
  const doctor = await resolveDoctor(userId);

  const schedules = await prisma.doctorAvailability.findMany({
    where: {
      doctorId: doctor.id,
    },
    orderBy: {
      startTime: "asc",
    },
  });

  return schedules.map(serializeSchedule);
}

async function createSchedule(userId, payload) {
  validateSchedulePayload(payload);

  const doctor = await resolveDoctor(userId);
  const scheduleBlocks = buildScheduleBlocks(payload);

  await ensureScheduleChangePreservesBookedAppointments(doctor.id, scheduleBlocks);

  const schedules = await prisma.$transaction(async (transaction) => {
    await transaction.doctorAvailability.deleteMany({
      where: {
        doctorId: doctor.id,
      },
    });

    await transaction.doctorAvailability.createMany({
      data: scheduleBlocks.map((block) => ({
        doctorId: doctor.id,
        startTime: block.startTime,
        endTime: block.endTime,
      })),
    });

    return transaction.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id,
      },
      orderBy: {
        startTime: "asc",
      },
    });
  });

  return schedules.map(serializeSchedule);
}

async function deleteSchedule(userId, scheduleId) {
  const parsedScheduleId = Number(scheduleId);

  if (Number.isNaN(parsedScheduleId)) {
    throw httpError(400, "Schedule id must be a number.");
  }

  const doctor = await resolveDoctor(userId);

  const schedule = await prisma.doctorAvailability.findFirst({
    where: {
      id: parsedScheduleId,
      doctorId: doctor.id,
    },
  });

  if (!schedule) {
    throw httpError(404, "Schedule not found.");
  }

  await syncCompletedAppointments();

  const activeAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      date: {
        gte: toDateOnly(formatLocalDateOnly(new Date())),
      },
      time: {
        gte: schedule.startTime,
        lt: schedule.endTime,
      },
      status: AppointmentStatus.BOOKED,
    },
    orderBy: [
      { date: "asc" },
      { time: "asc" },
    ],
  });

  if (activeAppointment) {
    throw httpError(
      409,
      "Cannot delete an availability block that still has active booked appointments."
    );
  }

  await prisma.doctorAvailability.delete({
    where: {
      id: parsedScheduleId,
    },
  });

  return serializeSchedule(schedule);
}

async function listAppointments(userId, query) {
  await syncCompletedAppointments();

  const doctor = await resolveDoctor(userId);

  const filters = buildAppointmentFilters(
    {
      doctorId: doctor.id,
    },
    query
  );

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: filters.where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: filters.orderBy,
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.appointment.count({
      where: filters.where,
    }),
  ]);

  return {
    appointments: appointments.map(serializeDoctorAppointment),
    pagination: buildPaginationMeta(total, filters.page, filters.pageSize),
  };
}

module.exports = {
  createSchedule,
  deleteSchedule,
  listAppointments,
  listSchedules,
};
