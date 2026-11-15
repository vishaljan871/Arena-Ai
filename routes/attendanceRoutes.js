const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/mark", attendanceController.markAttendance);
router.get("/monthly", attendanceController.monthlyAttendance);

module.exports = router;
