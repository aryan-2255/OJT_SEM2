const express = require("express");
const doctorController = require("../controllers/doctorController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate, authorize("DOCTOR"));

router.get("/schedules", doctorController.listSchedules);
router.post("/schedules", doctorController.createSchedule);
router.delete("/schedules/:id", doctorController.deleteSchedule);
router.get("/day-offs", doctorController.listDayOffs);
router.post("/day-offs", doctorController.createDayOff);
router.delete("/day-offs/:id", doctorController.deleteDayOff);
router.get("/appointments", doctorController.listAppointments);

module.exports = router;
