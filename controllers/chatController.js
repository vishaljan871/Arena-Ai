const User = require("../models/User");
const Attendance = require("../models/Attendance");
const ChatMessage = require("../models/ChatMessage");
const { askAI, SYSTEM_PROMPT, AIError } = require("../services/aiService");
const {
  getIndiaDateKey,
  getIndiaReadableDate,
  getChatExpiryDate,
  getThreeDayStartDate
} = require("../utils/dateUtils");
const {
  CHAT_HISTORY_LIMIT,
  ATTENDANCE_HISTORY_LIMIT
} = require("../config/constants");

async function guestChat(req, res) {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message."
      });
    }

    const today = getIndiaDateKey();
    const currentDate = getIndiaReadableDate(today);

    const result = await askAI([
      {
        role: "system",
        content: `${SYSTEM_PROMPT}

CURRENT DATE AND TIME:
Date: ${currentDate}
Date Key: ${today}
Timezone: Asia/Kolkata (IST, UTC+05:30)

CURRENT USER CONTEXT:
Authentication status: GUEST
Currently logged in: NO
Existing account status: UNKNOWN

IMPORTANT RULES:
- The user is not currently logged in.
- Never assume the user is unregistered.
- For a first greeting, suggest both registration and login.
- Do not claim access to private account or attendance data.
- If the user asks about their personal account information,
  explain that they need to login first.
- Today's date is ${currentDate}.
- Never guess today's date.
- You only generate conversational replies.
- Never generate or execute frontend actions.
- Never return action names or action instructions.

Return only this JSON structure:
{
    "reply": "Your natural language response"
}
`
      },
      { role: "user", content: message.trim() }
    ]);

    const reply = result?.reply;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Invalid AI reply received.");
    }

    return res.json({
      success: true,
      reply,
      currentDate,
      dateKey: today
    });
  } catch (error) {
    console.error("Guest AI Error:", error);

    if (error instanceof AIError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        rateLimited: error.statusCode === 429
      });
    }

    return res.status(500).json({
      success: false,
      message: "AI response nahi mil saka."
    });
  }
}

async function userChat(req, res) {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message."
      });
    }

    const user = await User.findById(req.user.userId)
      .select("fullname username email isActive createdAt")
      .lean();

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account not found or disabled."
      });
    }

    const userId = user._id;
    const today = getIndiaDateKey();
    const currentDate = getIndiaReadableDate(today);
    const expiryDate = getChatExpiryDate(today);
    const cutoffDate = getThreeDayStartDate(today);

    const previousMessages = await ChatMessage.find({
      userId,
      dateKey: { $gte: cutoffDate, $lte: today }
    })
      .sort({ createdAt: -1 })
      .limit(CHAT_HISTORY_LIMIT)
      .lean();

    previousMessages.reverse();

    const attendanceRecords = await Attendance.find({ userId })
      .select("dateKey shiftType status advance")
      .sort({ dateKey: -1 })
      .limit(ATTENDANCE_HISTORY_LIMIT)
      .lean();

    const presentDays = attendanceRecords.filter(r => r.status === "present").length;
    const absentDays = attendanceRecords.filter(r => r.status === "absent").length;
    const totalAdvance = attendanceRecords.reduce(
      (t, r) => t + (Number(r.advance) || 0),
      0
    );

    const userContext = {
      account: user,
      attendanceSummary: {
        recordsProvided: attendanceRecords.length,
        presentDays,
        absentDays,
        totalAdvance
      },
      attendanceRecords
    };

    await ChatMessage.create({
      userId,
      role: "user",
      content: message.trim(),
      dateKey: today,
      expiresAt: expiryDate
    });

    const conversationHistory = previousMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const result = await askAI([
      {
        role: "system",
        content: `${SYSTEM_PROMPT}

CURRENT DATE AND TIME:
Date: ${currentDate}
Date Key: ${today}
Timezone: Asia/Kolkata (IST, UTC+05:30)

CURRENT USER DATA:
${JSON.stringify(userContext)}

IMPORTANT RULES:
- The user is authenticated.
- Answer questions using only the supplied user data.
- Never invent account details or attendance records.
- Never reveal passwords, password hashes or tokens.
- Attendance records provided are limited to the latest ${ATTENDANCE_HISTORY_LIMIT} records.
- Do not assume unmarked days are absent.
- Calculate totals only from the supplied records.
- If requested information is unavailable, clearly say so.
- Today's date is ${currentDate}.
- Never guess today's date.
- You only generate conversational replies.
- Never generate or execute frontend actions.
- Never return action names or action instructions.

Return only this JSON structure:
{
    "reply": "Your natural language response"
}
`
      },
      ...conversationHistory,
      { role: "user", content: message.trim() }
    ]);

    let reply;
    if (typeof result === "string") {
      try {
        reply = JSON.parse(result).reply || result;
      } catch {
        reply = result;
      }
    } else {
      reply = result?.reply;
    }

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Invalid AI reply received.");
    }

    await ChatMessage.create({
      userId,
      role: "assistant",
      content: reply,
      dateKey: today,
      expiresAt: expiryDate
    });

    return res.json({ success: true, reply });
  } catch (error) {
    console.error("Authenticated AI Error:", error);

    if (error instanceof AIError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        rateLimited: error.statusCode === 429
      });
    }

    return res.status(500).json({
      success: false,
      message: "AI response nahi mil saka."
    });
  }
}

module.exports = { guestChat, userChat };
