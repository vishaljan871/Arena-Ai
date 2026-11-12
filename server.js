
require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
const SYSTEM_PROMPT = require("./stmPrompt");
const connectDB = require("./config/db")
const User = require("./models/User");
const Attendance = require("./models/Attendance");
const ChatMessage = require("./models/ChatMessage");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/downloads", express.static("downloads"));

// Home route
app.get("/", (req, res) => {
  res.render("home");
});
//--multiple--function--
function getChatExpiryDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    // 3 calendar days ke baad midnight IST
    const expiryUTC = Date.UTC(
        year,
        month - 1,
        day + 3
    ) - (5.5 * 60 * 60 * 1000);

    return new Date(expiryUTC);
}

function getThreeDayStartDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    const cutoffUTC = Date.UTC(
        year,
        month - 1,
        day - 2
    );

    return new Date(cutoffUTC).toISOString().slice(0, 10);
}
//--App--version--
const APP_VERSION = {
    latestVersion: "1.0.0",
    versionCode: 1,
    minimumVersionCode: 1,

    apkUrl: "https://yourdomain.com/downloads/ArenaAI-v1.0.0.apk",

    releaseNotes: [
        "Arena AI initial release",
        "Attendance management",
        "AI assistant"
    ]
};

//--download--app--page--
app.get("/", (req, res) => {
    res.render("index", {
        title: "Arena AI",
        description: "Smart Attendance Management Platform",
        appPath: "/downloads/ArenaAI-v1.0.0.apk"
    });
});

//--App--version--check--
app.get("/api/version/check", (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            ...APP_VERSION
        });

    } catch (error) {
        console.error("Version Check Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check app version"
        });
    }
});

//--time-zone--function--
function getIndiaDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const date = {};

    parts.forEach(part => {
        date[part.type] = part.value;
    });

    return `${date.year}-${date.month}-${date.day}`;
}

//--Auth--Middleware--
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = {
            userId: decoded.userId
        };

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });
    }
}



//-- AI Function --
async function askAI(messages) {
    const response = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: messages,
        max_tokens: 1500,
        response_format: {
            type: "json_object"
        }
    });

    const aiText = response.choices[0].message.content;

    try {
        const result = JSON.parse(aiText);

        return {
            reply: typeof result.reply === "string"
                ? result.reply
                : "Hello! Main aapki kya madad kar sakta hoon?"
        };

    } catch (error) {
        console.error("AI JSON Parse Error:", aiText);

        return {
            reply: "Sorry, mujhe response samajhne mein problem hui."
        };
    }
}


//--Auth--Me--
app.get("/auth/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("fullname username email role isActive");

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "User not found or account disabled."
            });
        }

        return res.status(200).json({
            success: true,
            message: "User authenticated successfully.",
            user: {
                id: user._id,
		fullname: user.fullname,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Auth Me Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch user details."
        });
    }
});

//--AI-Guest-Chat--

app.post("/guest/chat", async (req, res) => {
    try {
        const message = req.body?.message;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a message."
            });
        }

        // 1. Current India date
        const today = getIndiaDateKey();

        const [year, month, day] = today.split("-").map(Number);

        const currentDate = new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(
            new Date(Date.UTC(year, month - 1, day, 12))
        );

        // 2. AI request
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
            {
                role: "user",
                content: message.trim()
            }
        ]);

        // 3. AI reply
        const reply = result?.reply;

        if (typeof reply !== "string" || !reply.trim()) {
            throw new Error("Invalid AI reply received.");
        }

        // 4. Frontend response
        return res.json({
            success: true,
            reply,
            currentDate,
            dateKey: today
        });

    } catch (error) {
        console.error("Guest AI Error:", error);

        return res.status(500).json({
            success: false,
            message: "AI response nahi mil saka."
        });
    }
});


//--Check--Username--Availability--
app.get("/auth/check-username", async (req, res) => {
  try {
    const username = req.query.username?.trim().toLowerCase();

    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username must be at least 3 characters."
      });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Only letters, numbers and underscore are allowed."
      });
    }

    const existingUser = await User.findOne({ username });

    return res.json({
      success: true,
      available: !existingUser,
      message: existingUser
        ? "Username already taken."
        : "Username available."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      available: false,
      message: "Unable to check username."
    });
  }
});

//--Register--Routes--
app.post("/auth/register", async (req, res) => {
    try {
        // 1. Frontend se data receive
        let { fullname, username,  email, password } = req.body;

        // 2. Required fields validation
        if (!fullname || !username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        // 3. Normalize data
        fullname = fullname.trim();
        username = username.trim().toLowerCase();
        email = email.trim().toLowerCase();

        // 4. Username validation
        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({
                success: false,
                message: "Username must be 3-30 characters."
            });
        }

        if (!/^[a-z0-9_]+$/.test(username)) {
            return res.status(400).json({
                success: false,
                message: "Username can contain letters, numbers and underscore only."
            });
        }

        // 5. Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email."
            });
        }

        // 6. Password validation
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }

        // 7. Check existing user
        const existingUser = await User.findOne({
            $or: [
                { username },
                { email }
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: existingUser.username === username
                    ? "Username already taken."
                    : "Email already registered."
            });
        }

        // 8. Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // 9. Create user
        const newUser = await User.create({
            fullname,
            username,
            email,
            password: hashedPassword
        });

        // 10. Generate JWT token
        const token = jwt.sign(
            { userId: newUser._id },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "7d"
            }
        );

        // 11. Send response
        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token,
            user: {
                id: newUser._id,
		fullname: newUser.fullname,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error("Register Error:", error);

        // Duplicate key protection
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Username or email already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

//--Login--Routes--
app.post("/auth/login", async (req, res) => {
    try {
        // 1. Frontend se data receive
        let { username, password } = req.body;

        // 2. Validate fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        // 3. Normalize username
        username = username.trim().toLowerCase();

        // 4. Find user
        // select("+password") password field ko query mein include karega
        const user = await User.findOne({ username }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        // 5. Check account status
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is disabled."
            });
        }

        // 6. Verify password
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        // 7. Update last login
        user.lastLogin = new Date();
        await user.save();

        // 8. Generate JWT
        const token = jwt.sign(
            {
                userId: user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "7d"
            }
        );

        // 9. Success response
        return res.status(200).json({
            success: true,
            message: "Login successful!",

            token,

            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

//--Lpgged-in--User--

app.post("/my/chat", authMiddleware, async (req, res) => {
    try {
        const message = req.body?.message;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a message."
            });
        }

        // 1. Authenticated user find karo
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

	const [year, month, day] = today.split("-").map(Number);
	const currentDate = new Intl.DateTimeFormat("en-IN", {
    	   timeZone: "Asia/Kolkata",
           weekday: "long",
    	   day: "numeric",
    	   month: "long",
    	   year: "numeric"
	}).format(new Date(Date.UTC(year, month - 1, day, 12)));

        const expiryDate = getChatExpiryDate(today);
        const cutoffDate = getThreeDayStartDate(today);

        // 2. Previous 3 days ki conversation
        const previousMessages = await ChatMessage.find({
            userId,
            dateKey: {
                $gte: cutoffDate,
                $lte: today
            }
        })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

        previousMessages.reverse();

        // 3. Current user ka attendance data
        const attendanceRecords = await Attendance.find({
            userId
        })
	.select("dateKey shiftType status advance")
        .sort({ dateKey: -1 })
        .limit(100)
        .lean();

        // 4. Attendance summary calculate karo
        const presentDays = attendanceRecords.filter(
            record => record.status === "present"
        ).length;

        const absentDays = attendanceRecords.filter(
            record => record.status === "absent"
        ).length;

        const totalAdvance = attendanceRecords.reduce(
            (total, record) => total + (Number(record.advance) || 0),
            0
        );

        const attendanceSummary = {
            recordsProvided: attendanceRecords.length,
            presentDays,
            absentDays,
            totalAdvance
        };

        // 5. Current user context
        const userContext = {
            account: user,
            attendanceSummary,
            attendanceRecords
        };

        // 6. Current message MongoDB mein save karo
        await ChatMessage.create({
            userId,
            role: "user",
            content: message.trim(),
            dateKey: today,
            expiresAt: expiryDate
        });

        // 7. Conversation history
        const conversationHistory = previousMessages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // 8. AI request
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
- Attendance records provided are limited to the latest 100 records.
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

            {
                role: "user",
                content: message.trim()
            }
        ]);

        // 9. AI reply extract karo
        let reply;

        if (typeof result === "string") {
            try {
                const parsed = JSON.parse(result);
                reply = parsed.reply || result;
            } catch {
                reply = result;
            }
        } else {
            reply = result?.reply;
        }

        if (typeof reply !== "string" || !reply.trim()) {
            throw new Error("Invalid AI reply received.");
        }

        // 10. AI reply MongoDB mein save karo
        await ChatMessage.create({
            userId,
            role: "assistant",
            content: reply,
            dateKey: today,
            expiresAt: expiryDate
        });

        // 11. Frontend response
        return res.json({
            success: true,
            reply
        });

    } catch (error) {
        console.error("Authenticated AI Error:", error);

        return res.status(500).json({
            success: false,
            message: "AI response nahi mil saka."
        });
    }
});


//--Attendance--Mark-=

app.post("/attendance/mark", authMiddleware, async (req, res) => {
    try {
        const { status, shiftType, attendanceDate } = req.body;

        const isAdvanceEmpty =
            req.body.advance === undefined ||
            req.body.advance === null ||
            req.body.advance === "";

        const advance = isAdvanceEmpty ? 0 : Number(req.body.advance);

        // Validate status
        if (!["present", "absent"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Please select Present or Absent."
            });
        }

        // Validate shift
        if (!["day", "night"].includes(shiftType)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid shift."
            });
        }

        // Validate advance
        if (!Number.isFinite(advance) || advance < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid advance amount."
            });
        }

        // Get current India date
        const todayKey = getIndiaDateKey();

        // Calculate yesterday using calendar date
        const [year, month, day] = todayKey.split("-").map(Number);

        const yesterday = new Date(
            Date.UTC(year, month - 1, day - 1)
        );

        const yesterdayKey = [
            yesterday.getUTCFullYear(),
            String(yesterday.getUTCMonth() + 1).padStart(2, "0"),
            String(yesterday.getUTCDate()).padStart(2, "0")
        ].join("-");

        // Determine allowed attendance date
        const expectedDate =
            shiftType === "day" ? todayKey : yesterdayKey;

        // Verify frontend date
        if (attendanceDate !== expectedDate) {
            return res.status(400).json({
                success: false,
                message: "Invalid attendance date for selected shift."
            });
        }

        const userId = req.user.userId;
        const dateKey = expectedDate;

        // Check duplicate attendance
        const existingAttendance = await Attendance.findOne({
            userId,
            dateKey,
            shiftType
        });

        if (existingAttendance) {
            return res.status(409).json({
                success: false,
                marked: true,
                message: "Attendance for this shift has already been marked.",
                attendance: existingAttendance
            });
        }

console.log("Attendance Data:", {
    userId,
    dateKey,
    shiftType,
    status,
    advance
});

        // Create attendance
        const attendance = await Attendance.create({
            userId,
            dateKey,
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
});

//--Attendance--Today--
app.get("/attendance/monthly", authMiddleware, async (req, res) => {
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

        const endDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;

        // December handling
        const nextMonth = new Date(year, month, 1);

        const nextDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

        const attendance = await Attendance.find({
            userId,
            dateKey: {
                $gte: startDate,
                $lt: nextDate
            }
        })
        .select("dateKey status advance -_id")
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
});


/* =====================================
   CHANGE PASSWORD
===================================== */
app.post("/auth/change-password", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { newPassword } = req.body;

        // Validate password
        if (!newPassword || typeof newPassword !== "string") {
            return res.status(400).json({
                success: false,
                message: "New password is required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password in MongoDB
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    password: hashedPassword
                }
            },
            {
                new: false,
                runValidators: true
            }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Password changed successfully!"
        });

    } catch (error) {
        console.error("Change Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong while changing password"
        });
    }
});

//--All--User--Details
app.post("/all-user-details",(req, res) => {

});


// Unknown route handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

// Start server
connectDB().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(error => {
    console.error("Database connection failed:", error);
});
