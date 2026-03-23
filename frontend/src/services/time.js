const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_INTERVAL_MINUTES = 15;

function padTimeSegment(value) {
  return String(value).padStart(2, "0");
}

export function formatTimeLabel(timeValue) {
  if (!timeValue) {
    return "";
  }

  const [rawHours, rawMinutes] = timeValue.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return timeValue;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${padTimeSegment(minutes)} ${period}`;
}

function createTimeOptions(intervalMinutes = DEFAULT_INTERVAL_MINUTES) {
  const options = [];

  for (let totalMinutes = 0; totalMinutes < MINUTES_PER_DAY; totalMinutes += intervalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${padTimeSegment(hours)}:${padTimeSegment(minutes)}`;

    options.push({
      value,
      label: formatTimeLabel(value),
    });
  }

  return options;
}

export const TIME_OPTIONS = createTimeOptions();
