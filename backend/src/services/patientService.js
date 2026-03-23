const { AppointmentStatus, Prisma } = require("@prisma/client");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const { syncCompletedAppointments } = require("./appointmentStatusService");
const { buildAppointmentFilters, buildPaginationMeta } = require("../utils/appointmentQuery");
const httpError = require("../utils/httpError");
const {
  getAvailabilityRowsForDate,
} = require("../utils/availability");
const {
  serializeDoctor,
  serializePatientAppointment,
} = require("../utils/serializers");
const {
  filterPastSlotsForDate,
  formatDateOnly,
  formatDisplayTime,
  formatLocalDateOnly,
  generateSlots,
  isValidDateString,
  isValidTimeString,
  toDateOnly,
} = require("../utils/time");

function parseDoctorId(doctorId) {
  const parsedDoctorId = Number(doctorId);

  if (Number.isNaN(parsedDoctorId)) {
    throw httpError(400, "Doctor id must be a number.");
  }

  return parsedDoctorId;
}

async function findDoctorOrThrow(doctorId) {
  const doctor = await prisma.doctor.findUnique({
    where: {
      id: doctorId,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!doctor) {
    throw httpError(404, "Doctor not found.");
  }

  return doctor;
}

async function loadAvailabilityBlocks(client, doctorId, dateOnly) {
  const [dayOff, recurringRows] = await Promise.all([
    client.doctorDayOff.findUnique({
      where: {
        doctorId_date: {
          doctorId,
          date: dateOnly,
        },
      },
    }),
    client.doctorAvailability.findMany({
      where: {
        doctorId,
      },
      orderBy: [
        { mode: "asc" },
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
    }),
  ]);

  if (dayOff) {
    return [];
  }

  return getAvailabilityRowsForDate(recurringRows, dateOnly);
}

function buildOpenSlots(blocks, date, bookedTimes) {
  const slots = [];

  blocks.forEach((block) => {
    const generatedSlots = filterPastSlotsForDate(
      date,
      generateSlots(block.startTime, block.endTime, env.slotIntervalMinutes)
    );

    generatedSlots.forEach((slot) => {
      if (!bookedTimes.has(slot)) {
        slots.push(slot);
      }
    });
  });

  return Array.from(new Set(slots));
}

async function listDoctors() {
  const doctors = await prisma.doctor.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  return doctors.map(serializeDoctor);
}

async function getAvailableSlots(doctorId, date) {
  const parsedDoctorId = parseDoctorId(doctorId);

  if (!isValidDateString(date)) {
    throw httpError(400, "Date must be in YYYY-MM-DD format.");
  }

  const doctor = await findDoctorOrThrow(parsedDoctorId);
  const dateOnly = toDateOnly(date);

  if (dateOnly < toDateOnly(formatLocalDateOnly(new Date()))) {
    throw httpError(400, "Cannot view slots for a past date.");
  }

  const [blocks, appointments] = await Promise.all([
    loadAvailabilityBlocks(prisma, parsedDoctorId, dateOnly),
    prisma.appointment.findMany({
      where: {
        doctorId: parsedDoctorId,
        date: dateOnly,
        status: {
          in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED],
        },
      },
      select: {
        time: true,
      },
    }),
  ]);

  const bookedTimes = new Set(appointments.map((appointment) => appointment.time));
  const slots = buildOpenSlots(blocks, date, bookedTimes);

  return {
    doctor: serializeDoctor(doctor),
    date,
    slots,
  };
}

async function listAppointments(userId, query) {
  await syncCompletedAppointments();

  const filters = buildAppointmentFilters(
    {
      patientId: userId,
    },
    query
  );

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: filters.where,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
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
    appointments: appointments.map(serializePatientAppointment),
    pagination: buildPaginationMeta(total, filters.page, filters.pageSize),
  };
}

async function bookAppointment(userId, payload) {
  const parsedDoctorId = parseDoctorId(payload.doctorId);

  if (!isValidDateString(payload.date)) {
    throw httpError(400, "Date must be in YYYY-MM-DD format.");
  }

  if (!isValidTimeString(payload.time)) {
    throw httpError(400, "Invalid appointment time selected.");
  }

  const dateOnly = toDateOnly(payload.date);

  if (dateOnly < toDateOnly(formatLocalDateOnly(new Date()))) {
    throw httpError(400, "Appointments can only be booked for today or a future date.");
  }

  const appointment = await prisma.$transaction(
    async (transaction) => {
      const existingBookedAppointment = await transaction.appointment.findFirst({
        where: {
          patientId: userId,
          date: dateOnly,
          status: {
            in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED],
          },
        },
        include: {
          doctor: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (existingBookedAppointment) {
        throw httpError(
          409,
          `Only one appointment per day is allowed. You already have an appointment with ${existingBookedAppointment.doctor.user.name} on ${formatDateOnly(existingBookedAppointment.date)} at ${formatDisplayTime(existingBookedAppointment.time)}.`
        );
      }

      const doctor = await transaction.doctor.findUnique({
        where: {
          id: parsedDoctorId,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!doctor) {
        throw httpError(404, "Doctor not found.");
      }

      const blocks = await loadAvailabilityBlocks(transaction, parsedDoctorId, dateOnly);
      const availableSlots = new Set(buildOpenSlots(blocks, payload.date, new Set()));

      if (!availableSlots.has(payload.time)) {
        throw httpError(
          400,
          "Selected time is no longer available or is not part of the doctor's active schedule."
        );
      }

      const existingAppointment = await transaction.appointment.findFirst({
        where: {
          doctorId: parsedDoctorId,
          date: dateOnly,
          time: payload.time,
          status: {
            in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED],
          },
        },
      });

      if (existingAppointment) {
        throw httpError(409, "This slot has already been booked.");
      }

      return transaction.appointment.create({
        data: {
          patientId: userId,
          doctorId: parsedDoctorId,
          date: dateOnly,
          time: payload.time,
          status: AppointmentStatus.BOOKED,
        },
        include: {
          doctor: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );

  return serializePatientAppointment(appointment);
}

async function cancelAppointment(userId, appointmentId) {
  const parsedAppointmentId = Number(appointmentId);

  if (Number.isNaN(parsedAppointmentId)) {
    throw httpError(400, "Appointment id must be a number.");
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: parsedAppointmentId,
      patientId: userId,
    },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!appointment) {
    throw httpError(404, "Appointment not found.");
  }

  if (appointment.status !== AppointmentStatus.BOOKED) {
    throw httpError(400, "Only booked appointments can be cancelled.");
  }

  const updatedAppointment = await prisma.appointment.update({
    where: {
      id: parsedAppointmentId,
    },
    data: {
      status: AppointmentStatus.CANCELLED,
    },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return serializePatientAppointment(updatedAppointment);
}

module.exports = {
  bookAppointment,
  cancelAppointment,
  getAvailableSlots,
  listAppointments,
  listDoctors,
};
