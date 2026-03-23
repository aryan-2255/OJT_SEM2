const { AvailabilityMode, Weekday } = require("@prisma/client");
const httpError = require("./httpError");
const { formatDateOnly, timeToMinutes } = require("./time");

const WEEKDAY_ORDER = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

function getWeekdayForDate(value) {
  const weekdayIndex = value.getUTCDay();

  switch (weekdayIndex) {
    case 0:
      return Weekday.SUNDAY;
    case 1:
      return Weekday.MONDAY;
    case 2:
      return Weekday.TUESDAY;
    case 3:
      return Weekday.WEDNESDAY;
    case 4:
      return Weekday.THURSDAY;
    case 5:
      return Weekday.FRIDAY;
    case 6:
      return Weekday.SATURDAY;
    default:
      return null;
  }
}

function getActiveAvailabilityMode(rows) {
  if (rows.some((row) => row.mode === AvailabilityMode.DAILY)) {
    return AvailabilityMode.DAILY;
  }

  if (rows.some((row) => row.mode === AvailabilityMode.WEEKLY)) {
    return AvailabilityMode.WEEKLY;
  }

  return null;
}

function getAvailabilityRowsForDate(rows, dateValue) {
  const mode = getActiveAvailabilityMode(rows);

  if (!mode) {
    return [];
  }

  if (mode === AvailabilityMode.DAILY) {
    return rows
      .filter((row) => row.mode === AvailabilityMode.DAILY)
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
  }

  const weekday = getWeekdayForDate(dateValue);

  return rows
    .filter((row) => row.mode === AvailabilityMode.WEEKLY && row.dayOfWeek === weekday)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function normalizeWeekdays(weekdays) {
  if (!Array.isArray(weekdays)) {
    throw httpError(400, "Weekdays must be provided as an array.");
  }

  const cleanedWeekdays = Array.from(
    new Set(
      weekdays
        .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
        .filter(Boolean)
    )
  );

  if (cleanedWeekdays.length === 0) {
    throw httpError(400, "Select at least one weekday for weekly availability.");
  }

  const invalidWeekday = cleanedWeekdays.find((value) => !WEEKDAY_ORDER.includes(value));

  if (invalidWeekday) {
    throw httpError(400, "Invalid weekday selected.");
  }

  return WEEKDAY_ORDER.filter((weekday) => cleanedWeekdays.includes(weekday));
}

function buildAvailabilityRows(doctorId, mode, scheduleBlocks, weekdays = []) {
  if (mode === AvailabilityMode.DAILY) {
    return scheduleBlocks.map((block) => ({
      doctorId,
      mode,
      dayOfWeek: null,
      startTime: block.startTime,
      endTime: block.endTime,
    }));
  }

  return weekdays.flatMap((weekday) =>
    scheduleBlocks.map((block) => ({
      doctorId,
      mode,
      dayOfWeek: weekday,
      startTime: block.startTime,
      endTime: block.endTime,
    }))
  );
}

function buildDayOffDateSet(dayOffs) {
  return new Set(dayOffs.map((dayOff) => formatDateOnly(dayOff.date)));
}

function isTimeInsideAvailabilityRow(time, row) {
  const appointmentMinutes = timeToMinutes(time);
  return appointmentMinutes >= timeToMinutes(row.startTime) && appointmentMinutes < timeToMinutes(row.endTime);
}

function isAppointmentCoveredByAvailability(appointment, availabilityRows, dayOffDateSet) {
  const appointmentDateKey = formatDateOnly(appointment.date);

  if (dayOffDateSet.has(appointmentDateKey)) {
    return false;
  }

  return getAvailabilityRowsForDate(availabilityRows, appointment.date).some((row) =>
    isTimeInsideAvailabilityRow(appointment.time, row)
  );
}

module.exports = {
  WEEKDAY_ORDER,
  buildAvailabilityRows,
  buildDayOffDateSet,
  getActiveAvailabilityMode,
  getAvailabilityRowsForDate,
  getWeekdayForDate,
  isAppointmentCoveredByAvailability,
  normalizeWeekdays,
};
