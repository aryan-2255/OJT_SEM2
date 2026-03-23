const asyncHandler = require("../utils/asyncHandler");
const doctorService = require("../services/doctorService");

const listSchedules = asyncHandler(async (req, res) => {
  const schedules = await doctorService.listSchedules(req.user.id);
  res.status(200).json({ schedules });
});

const createSchedule = asyncHandler(async (req, res) => {
  const schedules = await doctorService.createSchedule(req.user.id, req.body);
  res.status(201).json({ schedules });
});

const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await doctorService.deleteSchedule(req.user.id, req.params.id);
  res.status(200).json({ schedule });
});

const listAppointments = asyncHandler(async (req, res) => {
  const result = await doctorService.listAppointments(req.user.id, req.query);
  res.status(200).json(result);
});

module.exports = {
  createSchedule,
  deleteSchedule,
  listAppointments,
  listSchedules,
};
