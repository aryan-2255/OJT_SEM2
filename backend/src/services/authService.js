const bcrypt = require("bcryptjs");
const { Role } = require("@prisma/client");
const prisma = require("../lib/prisma");
const httpError = require("../utils/httpError");
const { signToken } = require("../utils/jwt");
const { serializeAuthUser } = require("../utils/serializers");

function validateAuthPayload({ name, email, password }, requireName = false) {
  if (requireName && !name?.trim()) {
    throw httpError(400, "Name is required.");
  }

  if (!email?.trim()) {
    throw httpError(400, "Email is required.");
  }

  if (!password?.trim()) {
    throw httpError(400, "Password is required.");
  }

  if (password.trim().length < 6) {
    throw httpError(400, "Password must be at least 6 characters long.");
  }
}

async function signupPatient(payload) {
  validateAuthPayload(payload, true);

  const email = payload.email.trim().toLowerCase();
  const password = payload.password.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw httpError(409, "An account with this email already exists.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: payload.name.trim(),
      email,
      password: hashedPassword,
      role: Role.PATIENT,
    },
  });

  return {
    token: signToken(user),
    user: serializeAuthUser(user),
  };
}

async function login(payload) {
  validateAuthPayload(payload);

  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw httpError(401, "Invalid email or password.");
  }

  const isPasswordValid = await bcrypt.compare(payload.password.trim(), user.password);

  if (!isPasswordValid) {
    throw httpError(401, "Invalid email or password.");
  }

  return {
    token: signToken(user),
    user: serializeAuthUser(user),
  };
}

module.exports = {
  login,
  signupPatient,
};

