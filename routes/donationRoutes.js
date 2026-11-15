const express = require("express");
const router = express.Router();
const donationController = require("../controllers/donationController");
const authMiddleware = require("../middleware/authMiddleware");

// Leaderboard is public
router.get("/leaderboard", donationController.leaderboard);

// Payment routes kept for future use (currently not invoked from frontend)
router.post("/create-order", authMiddleware, donationController.createOrder);
router.post("/verify-payment", authMiddleware, donationController.verifyPayment);

module.exports = router;
