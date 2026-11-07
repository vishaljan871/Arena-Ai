
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Attendance = require("../models/Attendance");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);


// =====================================
// DATE VALIDATION
// =====================================

function isValidDate(date) {
  if (typeof date !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}


// =====================================
// GET MONTHLY ATTENDANCE
// GET /api/attendance?month=2026-11
// =====================================

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
      return res.status(400).json({
        success: false,
        message: "Invalid month format."
      });
    }

    const records = await Attendance.find({
      userId,
      date: {
        $gte: `${month}-01`,
        $lte: `${month}-31`
      }
    })
    .sort({ date: 1 })
    .lean();

    return res.json({
      success: true,
      records
    });

  } catch (error) {
    console.error("Attendance GET error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load attendance."
    });
  }
});


// =====================================
// CREATE ATTENDANCE
// POST /api/attendance
// =====================================

router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication."
      });
    }

    const {
      date,
      status,
      payment
    } = req.body;

    // Validate date
    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date."
      });
    }

    // Validate status
    const allowedStatuses = [
      "present",
      "absent",
      "leave",
      "late"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status."
      });
    }

    // Validate optional payment
    let paymentData = undefined;

    if (payment && payment.type) {
      if (!["given", "received"].includes(payment.type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment type."
        });
      }

      const amount = Number(payment.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid payment amount."
        });
      }

      paymentData = {
        type: payment.type,
        amount,
        description: String(payment.description || "").trim()
      };

      if (paymentData.description.length > 200) {
        return res.status(400).json({
          success: false,
          message: "Description is too long."
        });
      }
    } else if (payment && payment.amount) {
      return res.status(400).json({
        success: false,
        message: "Select a payment type."
      });
    }

    // Create only. No update or delete operation exists.
    const record = await Attendance.create({
      userId,
      date,
      status,
      payment: paymentData
    });

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully.",
      record
    });

  } catch (error) {

    // Duplicate date protection
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance is already marked for this date."
      });
    }

    console.error("Attendance POST error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save attendance."
    });
  }
});

module.exports = router;

