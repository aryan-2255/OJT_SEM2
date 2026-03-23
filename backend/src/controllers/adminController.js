const asyncHandler = require("../utils/asyncHandler");
const adminService = require("../services/adminService");

const listDoctors = asyncHandler(async (req, res) => {
  const doctors = await adminService.listDoctors();
  res.status(200).json({ doctors });
});

const createDoctor = asyncHandler(async (req, res) => {
  const doctor = await adminService.createDoctor(req.body);
  res.status(201).json({ doctor });
});

const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await adminService.updateDoctor(req.params.id, req.body);
  res.status(200).json({ doctor });
});

const deleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await adminService.deleteDoctor(req.params.id);
  res.status(200).json({ doctor });
});

module.exports = {
  createDoctor,
  deleteDoctor,
  listDoctors,
  updateDoctor,
};
