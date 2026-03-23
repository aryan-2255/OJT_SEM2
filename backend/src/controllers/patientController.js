const asyncHandler = require("../utils/asyncHandler");
const patientService = require("../services/patientService");

const listDoctors = asyncHandler(async (req, res) => {
  const doctors = await patientService.listDoctors();
  res.status(200).json({ doctors });
});

const getAvailableSlots = asyncHandler(async (req, res) => {
  const result = await patientService.getAvailableSlots(req.params.doctorId, req.query.date);
  res.status(200).json(result);
});

const listAppointments = asyncHandler(async (req, res) => {
  const result = await patientService.listAppointments(req.user.id, req.query);
  res.status(200).json(result);
});

const bookAppointment = asyncHandler(async (req, res) => {
  const appointment = await patientService.bookAppointment(req.user.id, req.body);
  res.status(201).json({ appointment });
});

const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await patientService.cancelAppointment(req.user.id, req.params.id);
  res.status(200).json({ appointment });
});

module.exports = {
  bookAppointment,
  cancelAppointment,
  getAvailableSlots,
  listAppointments,
  listDoctors,
};
