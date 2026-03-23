const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

function addDaysToDateOnly(value, days) {
  const nextValue = new Date(value);
  nextValue.setUTCDate(nextValue.getUTCDate() + days);
  return nextValue;
}

function formatDateOnly(value) {
  return value.toISOString().split("T")[0];
}

function formatLocalDateOnly(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function timesOverlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
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

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return slots.filter((slot) => timeToMinutes(slot) > currentMinutes);
}

module.exports = {
  addDaysToDateOnly,
  ensureStartBeforeEnd,
  formatDateOnly,
  formatDisplayTime,
  formatLocalDateOnly,
  filterPastSlotsForDate,
  generateSlots,
  isValidDateString,
  isValidTimeString,
  minutesToTime,
  timeToMinutes,
  timesOverlap,
  toDateOnly,
};
