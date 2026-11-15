const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

// Guest (no auth)
router.post("/guest/chat", chatController.guestChat);

// Authenticated
router.post("/my/chat", authMiddleware, chatController.userChat);

module.exports = router;
