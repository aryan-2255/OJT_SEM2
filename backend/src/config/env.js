const dotenv = require("dotenv");

dotenv.config();

const requiredVariables = ["DATABASE_URL", "JWT_SECRET"];

requiredVariables.forEach((variableName) => {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
});

function parseClientUrls() {
  const rawValue =
    process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    "http://localhost:5173,http://127.0.0.1:5173";

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT) || 5001,
  jwtSecret: process.env.JWT_SECRET,
  clientUrls: parseClientUrls(),
  slotIntervalMinutes: Number(process.env.SLOT_INTERVAL_MINUTES) || 15,
  hospitalTimezone: process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata",
};
