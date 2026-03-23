const asyncHandler = require("../utils/asyncHandler");
const doctorService = require("../services/doctorService");

const listSchedules = asyncHandler(async (req, res) => {
  const result = await doctorService.listSchedules(req.user.id);
  res.status(200).json(result);
});

const createSchedule = asyncHandler(async (req, res) => {
  const result = await doctorService.createSchedule(req.user.id, req.body);
  res.status(201).json(result);
});

const deleteSchedule = asyncHandler(async (req, res) => {
  const result = await doctorService.deleteSchedule(req.user.id, req.params.id);
  res.status(200).json(result);
});

const listDayOffs = asyncHandler(async (req, res) => {
  const result = await doctorService.listDayOffs(req.user.id);
  res.status(200).json(result);
});

const createDayOff = asyncHandler(async (req, res) => {
  const dayOff = await doctorService.createDayOff(req.user.id, req.body);
  res.status(201).json({ dayOff });
});

const deleteDayOff = asyncHandler(async (req, res) => {
  const dayOff = await doctorService.deleteDayOff(req.user.id, req.params.id);
  res.status(200).json({ dayOff });
});

const listAppointments = asyncHandler(async (req, res) => {
  const result = await doctorService.listAppointments(req.user.id, req.query);
  res.status(200).json(result);
});

module.exports = {
  createDayOff,
  createSchedule,
  deleteDayOff,
  deleteSchedule,
  listAppointments,
  listDayOffs,
  listSchedules,
};
