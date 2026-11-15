const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const attendanceRoutes = require("./attendanceRoutes");
const chatRoutes = require("./chatRoutes");
const donationRoutes = require("./donationRoutes");
const versionRoutes = require("./versionRoutes");

router.use("/auth", authRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/api/version", versionRoutes);

// Chat (guest + user under different prefixes)
router.use("/", chatRoutes);

// Donations
router.use("/donations", donationRoutes);

module.exports = router;
