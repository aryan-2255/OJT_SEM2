export const HOSPITAL_TIMEZONE =
  import.meta.env.VITE_HOSPITAL_TIMEZONE || "Asia/Kolkata";

function getHospitalDateParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOSPITAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
  };
}

export function getTodayDateValue() {
  const { year, month, day } = getHospitalDateParts(new Date());
  return `${year}-${month}-${day}`;
}

export function addDaysToDateValue(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}
