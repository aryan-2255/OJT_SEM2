const express = require("express");
const patientController = require("../controllers/patientController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate, authorize("PATIENT"));

router.get("/doctors", patientController.listDoctors);
router.get("/doctors/:doctorId/slots", patientController.getAvailableSlots);
router.get("/appointments", patientController.listAppointments);
router.post("/appointments", patientController.bookAppointment);
router.patch("/appointments/:id/cancel", patientController.cancelAppointment);

module.exports = router;

