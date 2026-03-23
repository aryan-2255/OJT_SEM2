const env = require("../config/env");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getHospitalDateTimeParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.hospitalTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(value).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }

    return accumulator;
  }, {});

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === "24" ? "00" : parts.hour,
    minute: parts.minute,
  };
}

function isValidDateString(value) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function isValidTimeString(value) {
  return TIME_PATTERN.test(value);
}

function toDateOnly(value) {
  if (!isValidDateString(value)) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value) {
  return value.toISOString().split("T")[0];
}

function formatLocalDateOnly(value) {
  const { year, month, day } = getHospitalDateTimeParts(value);
  return `${year}-${month}-${day}`;
}

function getCurrentHospitalMinutes(value = new Date()) {
  const { hour, minute } = getHospitalDateTimeParts(value);
  return Number(hour) * 60 + Number(minute);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function formatDisplayTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function ensureStartBeforeEnd(startTime, endTime) {
  return timeToMinutes(startTime) < timeToMinutes(endTime);
}

function generateSlots(startTime, endTime, intervalMinutes) {
  const slots = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  while (current + intervalMinutes <= end) {
    slots.push(minutesToTime(current));
    current += intervalMinutes;
  }

  return slots;
}

function filterPastSlotsForDate(date, slots, now = new Date()) {
  if (date !== formatLocalDateOnly(now)) {
    return slots;
  }

  const currentMinutes = getCurrentHospitalMinutes(now);

  return slots.filter((slot) => timeToMinutes(slot) > currentMinutes);
}

module.exports = {
  ensureStartBeforeEnd,
  formatDateOnly,
  formatDisplayTime,
  formatLocalDateOnly,
  filterPastSlotsForDate,
  getCurrentHospitalMinutes,
  generateSlots,
  isValidDateString,
  isValidTimeString,
  minutesToTime,
  timeToMinutes,
  toDateOnly,
};
