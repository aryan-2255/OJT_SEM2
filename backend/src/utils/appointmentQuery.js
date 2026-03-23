const { AppointmentStatus } = require("@prisma/client");
const httpError = require("./httpError");
const { formatLocalDateOnly, toDateOnly } = require("./time");

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;

function parsePositiveInteger(value, fallbackValue) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw httpError(400, "Pagination values must be positive integers.");
  }

  return parsedValue;
}

function parseStatus(value) {
  if (!value || value === "ALL") {
    return null;
  }

  if (!Object.values(AppointmentStatus).includes(value)) {
    throw httpError(400, "Invalid appointment status filter.");
  }

  return value;
}

function parseView(value) {
  const allowedViews = ["today", "upcoming", "history", "all"];

  if (!value) {
    return "all";
  }

  if (!allowedViews.includes(value)) {
    throw httpError(400, "Invalid appointment view filter.");
  }

  return value;
}

function parseDateFilter(value, label) {
  if (!value) {
    return null;
  }

  const parsedDate = toDateOnly(value);

  if (!parsedDate) {
    throw httpError(400, `${label} must be in YYYY-MM-DD format.`);
  }

  return parsedDate;
}

function buildAppointmentFilters(baseWhere, query = {}) {
  const page = parsePositiveInteger(query.page, 1);
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const view = parseView(query.view);
  const status = parseStatus(query.status);
  const fromDate = parseDateFilter(query.fromDate, "fromDate");
  const toDate = parseDateFilter(query.toDate, "toDate");
  const today = toDateOnly(formatLocalDateOnly(new Date()));
  const conditions = [baseWhere];

  if (fromDate && toDate && fromDate > toDate) {
    throw httpError(400, "fromDate cannot be after toDate.");
  }

  if (view === "today") {
    conditions.push({
      date: today,
      status: AppointmentStatus.BOOKED,
    });
  }

  if (view === "upcoming") {
    conditions.push({
      date: {
        gt: today,
      },
      status: AppointmentStatus.BOOKED,
    });
  }

  if (view === "history") {
    conditions.push({
      OR: [
        {
          status: {
            not: AppointmentStatus.BOOKED,
          },
        },
        {
          date: {
            lt: today,
          },
        },
      ],
    });
  }

  if (status) {
    conditions.push({ status });
  }

  if (fromDate) {
    conditions.push({
      date: {
        gte: fromDate,
      },
    });
  }

  if (toDate) {
    conditions.push({
      date: {
        lte: toDate,
      },
    });
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    where: conditions.length === 1 ? conditions[0] : { AND: conditions },
    orderBy:
      view === "history"
        ? [{ date: "desc" }, { time: "desc" }]
        : [{ date: "asc" }, { time: "asc" }],
  };
}

function buildPaginationMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

module.exports = {
  buildAppointmentFilters,
  buildPaginationMeta,
};

