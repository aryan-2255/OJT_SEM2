const { AppointmentStatus, AvailabilityMode } = require("@prisma/client");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const { syncCompletedAppointments } = require("./appointmentStatusService");
const { buildAppointmentFilters, buildPaginationMeta } = require("../utils/appointmentQuery");
const httpError = require("../utils/httpError");
const {
  buildAvailabilityRows,
  buildDayOffDateSet,
  getActiveAvailabilityMode,
  isAppointmentCoveredByAvailability,
  normalizeWeekday,
  normalizeWeekdays,
} = require("../utils/availability");
const {
  serializeDayOff,
  serializeDoctorAppointment,
  serializeSchedule,
} = require("../utils/serializers");
const {
  ensureStartBeforeEnd,
  formatDateOnly,
  formatDisplayTime,
  formatLocalDateOnly,
  generateSlots,
  isValidDateString,
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

function parseTimeWindow(payload) {
  if (!isValidTimeString(payload.startTime) || !isValidTimeString(payload.endTime)) {
    throw httpError(400, "Invalid schedule time selected.");
  }

  if (!ensureStartBeforeEnd(payload.startTime, payload.endTime)) {
    throw httpError(400, "Schedule end time must be after start time.");
  }

  if (
    generateSlots(payload.startTime, payload.endTime, env.slotIntervalMinutes).length === 0
  ) {
    throw httpError(400, `Schedule must allow at least one ${env.slotIntervalMinutes}-minute slot.`);
  }

  return buildScheduleBlocks(payload);
}

function parseWeeklySchedules(payload) {
  if (Array.isArray(payload.weeklyDays)) {
    const enabledEntries = payload.weeklyDays.filter((entry) => entry?.enabled);

    if (enabledEntries.length === 0) {
      throw httpError(400, "Select at least one weekday for weekly availability.");
    }

    const seenWeekdays = new Set();

    return enabledEntries.map((entry) => {
      const dayOfWeek = normalizeWeekday(entry.dayOfWeek);

      if (!dayOfWeek) {
        throw httpError(400, "Invalid weekday selected.");
      }

      if (seenWeekdays.has(dayOfWeek)) {
        throw httpError(400, "Duplicate weekday selected.");
      }

      seenWeekdays.add(dayOfWeek);

      return {
        dayOfWeek,
        scheduleBlocks: parseTimeWindow(entry),
      };
    });
  }

  const weekdays = normalizeWeekdays(payload.weekdays);
  const scheduleBlocks = parseTimeWindow(payload);

  return weekdays.map((dayOfWeek) => ({
    dayOfWeek,
    scheduleBlocks,
  }));
}

function parseSchedulePayload(payload) {
  const mode = typeof payload.mode === "string" ? payload.mode.trim().toUpperCase() : "";

  if (!Object.values(AvailabilityMode).includes(mode)) {
    throw httpError(400, "Select a valid availability mode.");
  }

  return {
    mode,
    scheduleBlocks: mode === AvailabilityMode.DAILY ? parseTimeWindow(payload) : [],
    weeklySchedules: mode === AvailabilityMode.WEEKLY ? parseWeeklySchedules(payload) : [],
  };
}

function getTodayDateOnly() {
  return toDateOnly(formatLocalDateOnly(new Date()));
}

async function loadAvailabilityRows(client, doctorId) {
  return client.doctorAvailability.findMany({
    where: {
      doctorId,
    },
    orderBy: [
      { mode: "asc" },
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
  });
}

async function loadDayOffRows(client, doctorId, fromDate = null) {
  return client.doctorDayOff.findMany({
    where: {
      doctorId,
      ...(fromDate
        ? {
            date: {
              gte: fromDate,
            },
          }
        : {}),
    },
    orderBy: {
      date: "asc",
    },
  });
}

async function ensureAvailabilityPreservesBookedAppointments(
  doctorId,
  availabilityRows,
  dayOffDateSet,
  client = prisma
) {
  await syncCompletedAppointments();

  const activeAppointments = await client.appointment.findMany({
    where: {
      doctorId,
      date: {
        gte: getTodayDateOnly(),
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
    (appointment) =>
      !isAppointmentCoveredByAvailability(appointment, availabilityRows, dayOffDateSet)
  );

  if (conflictingAppointment) {
    throw httpError(
      409,
      `Cannot update availability because ${formatDateOnly(conflictingAppointment.date)} at ${formatDisplayTime(conflictingAppointment.time)} is already booked.`
    );
  }
}

async function listSchedules(userId) {
  const doctor = await resolveDoctor(userId);
  const schedules = await loadAvailabilityRows(prisma, doctor.id);

  return {
    scheduleMode: getActiveAvailabilityMode(schedules),
    schedules: schedules.map(serializeSchedule),
  };
}

async function createSchedule(userId, payload) {
  const doctor = await resolveDoctor(userId);
  const { mode, scheduleBlocks, weeklySchedules } = parseSchedulePayload(payload);
  const currentDayOffs = await loadDayOffRows(prisma, doctor.id, getTodayDateOnly());

  const rowsToCreate = buildAvailabilityRows(doctor.id, mode, scheduleBlocks, weeklySchedules);

  await ensureAvailabilityPreservesBookedAppointments(
    doctor.id,
    rowsToCreate,
    buildDayOffDateSet(currentDayOffs)
  );

  await prisma.$transaction([
    prisma.doctorAvailability.deleteMany({
      where: {
        doctorId: doctor.id,
      },
    }),
    prisma.doctorAvailability.createMany({
      data: rowsToCreate,
    }),
  ]);

  const schedules = await loadAvailabilityRows(prisma, doctor.id);

  return {
    scheduleMode: getActiveAvailabilityMode(schedules),
    schedules: schedules.map(serializeSchedule),
  };
}

async function deleteSchedule(userId, scheduleId) {
  const parsedScheduleId = Number(scheduleId);

  if (Number.isNaN(parsedScheduleId)) {
    throw httpError(400, "Schedule id must be a number.");
  }

  const doctor = await resolveDoctor(userId);
  const [schedule, currentRows, currentDayOffs] = await Promise.all([
    prisma.doctorAvailability.findFirst({
      where: {
        id: parsedScheduleId,
        doctorId: doctor.id,
      },
    }),
    loadAvailabilityRows(prisma, doctor.id),
    loadDayOffRows(prisma, doctor.id, getTodayDateOnly()),
  ]);

  if (!schedule) {
    throw httpError(404, "Schedule not found.");
  }

  const nextRows = currentRows.filter((row) => row.id !== parsedScheduleId);

  await ensureAvailabilityPreservesBookedAppointments(
    doctor.id,
    nextRows,
    buildDayOffDateSet(currentDayOffs)
  );

  await prisma.doctorAvailability.delete({
    where: {
      id: parsedScheduleId,
    },
  });

  return {
    schedule: serializeSchedule(schedule),
    scheduleMode: getActiveAvailabilityMode(nextRows),
  };
}

async function listDayOffs(userId) {
  const doctor = await resolveDoctor(userId);
  const dayOffs = await loadDayOffRows(prisma, doctor.id, getTodayDateOnly());

  return {
    dayOffs: dayOffs.map(serializeDayOff),
  };
}

async function createDayOff(userId, payload) {
  if (!isValidDateString(payload.date)) {
    throw httpError(400, "Date must be in YYYY-MM-DD format.");
  }

  const date = toDateOnly(payload.date);
  const today = getTodayDateOnly();

  if (date < today) {
    throw httpError(400, "Day off can only be added for today or a future date.");
  }

  const doctor = await resolveDoctor(userId);

  await syncCompletedAppointments();

  const activeAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      date,
      status: AppointmentStatus.BOOKED,
    },
    orderBy: {
      time: "asc",
    },
  });

  if (activeAppointment) {
    throw httpError(
      409,
      `Cannot mark ${payload.date} as a day off because ${formatDisplayTime(activeAppointment.time)} is already booked.`
    );
  }

  try {
    const dayOff = await prisma.doctorDayOff.create({
      data: {
        doctorId: doctor.id,
        date,
      },
    });

    return serializeDayOff(dayOff);
  } catch (error) {
    if (error?.code === "P2002") {
      throw httpError(409, "A day off already exists for this date.");
    }

    throw error;
  }
}

async function deleteDayOff(userId, dayOffId) {
  const parsedDayOffId = Number(dayOffId);

  if (Number.isNaN(parsedDayOffId)) {
    throw httpError(400, "Day off id must be a number.");
  }

  const doctor = await resolveDoctor(userId);

  const dayOff = await prisma.doctorDayOff.findFirst({
    where: {
      id: parsedDayOffId,
      doctorId: doctor.id,
    },
  });

  if (!dayOff) {
    throw httpError(404, "Day off not found.");
  }

  await prisma.doctorDayOff.delete({
    where: {
      id: parsedDayOffId,
    },
  });

  return serializeDayOff(dayOff);
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
  createDayOff,
  createSchedule,
  deleteDayOff,
  deleteSchedule,
  listAppointments,
  listDayOffs,
  listSchedules,
};
