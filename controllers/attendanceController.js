const Attendance = require("../models/Attendance");
const {
  getIndiaDateKey,
  getYesterdayKey
} = require("../utils/dateUtils");
const {
  isValidAttendanceStatus,
  isValidShiftType,
  isValidAdvance
} = require("../utils/validators");

async function markAttendance(req, res) {
  try {
    const { status, shiftType, attendanceDate } = req.body;

    const isAdvanceEmpty =
      req.body.advance === undefined ||
      req.body.advance === null ||
      req.body.advance === "";

    const advance = isAdvanceEmpty ? 0 : Number(req.body.advance);

    if (!isValidAttendanceStatus(status)) {
      return res.status(400).json({
        success: false,
        message: "Please select Present or Absent."
      });
    }

    if (!isValidShiftType(shiftType)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid shift."
      });
    }

    if (!isValidAdvance(advance)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance amount."
      });
    }

    const todayKey = getIndiaDateKey();
    const yesterdayKey = getYesterdayKey(todayKey);
    const expectedDate = shiftType === "day" ? todayKey : yesterdayKey;

    if (attendanceDate !== expectedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date for selected shift."
      });
    }

    const userId = req.user.userId;

    const existing = await Attendance.findOne({
      userId,
      dateKey: expectedDate,
      shiftType
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        marked: true,
        message: "Attendance for this shift has already been marked.",
        attendance: existing
      });
    }

    const attendance = await Attendance.create({
      userId,
      dateKey: expectedDate,
      shiftType,
      status,
      advance
    });

    return res.status(201).json({
      success: true,
      marked: true,
      message: "Attendance marked successfully!",
      attendance: {
        id: attendance._id,
        date: attendance.dateKey,
        shiftType: attendance.shiftType,
        status: attendance.status,
        advance: attendance.advance
      }
    });
  } catch (error) {
    console.error("Attendance Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        marked: true,
        message: "Attendance for this shift has already been marked."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to mark attendance."
    });
  }
}

async function monthlyAttendance(req, res) {
  try {
    const userId = req.user.userId;
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(year) || year < 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid month or year."
      });
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

    const nextMonth = new Date(year, month, 1);
    const nextDate = `${nextMonth.getFullYear()}-${String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const attendance = await Attendance.find({
      userId,
      dateKey: { $gte: startDate, $lt: nextDate }
    })
      .select("dateKey shiftType status advance -_id")
      .sort({ dateKey: 1 });

    return res.status(200).json({
      success: true,
      attendance
    });
  } catch (error) {
    console.error("Monthly Attendance Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch attendance."
    });
  }
}

module.exports = { markAttendance, monthlyAttendance };
