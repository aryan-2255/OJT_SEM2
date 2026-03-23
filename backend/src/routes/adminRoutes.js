const express = require("express");
const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/doctors", adminController.listDoctors);
router.post("/doctors", adminController.createDoctor);
router.put("/doctors/:id", adminController.updateDoctor);
router.delete("/doctors/:id", adminController.deleteDoctor);

module.exports = router;
