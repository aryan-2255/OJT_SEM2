const bcrypt = require("bcryptjs");
const { Role } = require("@prisma/client");
const prisma = require("../lib/prisma");
const httpError = require("../utils/httpError");
const { serializeDoctor } = require("../utils/serializers");

function parseDoctorId(doctorId) {
  const parsedDoctorId = Number(doctorId);

  if (Number.isNaN(parsedDoctorId)) {
    throw httpError(400, "Doctor id must be a number.");
  }

  return parsedDoctorId;
}

function validateDoctorPayload({ name, email, password }) {
  if (!name?.trim()) {
    throw httpError(400, "Doctor name is required.");
  }

  if (!email?.trim()) {
    throw httpError(400, "Doctor email is required.");
  }

  if (!password?.trim()) {
    throw httpError(400, "Doctor password is required.");
  }

  if (password.trim().length < 6) {
    throw httpError(400, "Doctor password must be at least 6 characters long.");
  }
}

function validateDoctorUpdatePayload({ name, email, password }) {
  if (!name?.trim()) {
    throw httpError(400, "Doctor name is required.");
  }

  if (!email?.trim()) {
    throw httpError(400, "Doctor email is required.");
  }

  if (password?.trim() && password.trim().length < 6) {
    throw httpError(400, "Doctor password must be at least 6 characters long.");
  }
}

async function findDoctorByIdOrThrow(doctorId, transaction = prisma) {
  const doctor = await transaction.doctor.findUnique({
    where: {
      id: doctorId,
    },
    include: {
      user: {
        select: {
          id: true,
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

async function createDoctor(payload) {
  validateDoctorPayload(payload);

  const email = payload.email.trim().toLowerCase();
  const password = payload.password.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw httpError(409, "An account with this email already exists.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const doctor = await prisma.doctor.create({
    data: {
      specialization: payload.specialization?.trim() || null,
      user: {
        create: {
          name: payload.name.trim(),
          email,
          password: hashedPassword,
          role: Role.DOCTOR,
        },
      },
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

  return serializeDoctor(doctor);
}

async function updateDoctor(doctorId, payload) {
  const parsedDoctorId = parseDoctorId(doctorId);

  validateDoctorUpdatePayload(payload);

  const email = payload.email.trim().toLowerCase();
  const password = payload.password?.trim();

  const doctor = await findDoctorByIdOrThrow(parsedDoctorId);

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser && existingUser.id !== doctor.userId) {
    throw httpError(409, "An account with this email already exists.");
  }

  const userData = {
    name: payload.name.trim(),
    email,
  };

  if (password) {
    userData.password = await bcrypt.hash(password, 10);
  }

  const updatedDoctor = await prisma.doctor.update({
    where: {
      id: parsedDoctorId,
    },
    data: {
      specialization: payload.specialization?.trim() || null,
      user: {
        update: userData,
      },
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

  return serializeDoctor(updatedDoctor);
}

async function deleteDoctor(doctorId) {
  const parsedDoctorId = parseDoctorId(doctorId);

  const doctor = await findDoctorByIdOrThrow(parsedDoctorId);

  await prisma.user.delete({
    where: {
      id: doctor.userId,
    },
  });

  return serializeDoctor(doctor);
}

module.exports = {
  createDoctor,
  deleteDoctor,
  listDoctors,
  updateDoctor,
};
