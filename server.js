
require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = require("./stmPrompt");

const attendanceRoutes = require("./routes/attendanceRoutes");

app.use(express.json());

app.use("/api/attendance", attendanceRoutes);

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});
// Middleware
app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "ExpenseWeb server is running!"
  });
});

// AI Chat route
app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    // Validate message
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

const response = await openai.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: SYSTEM_PROMPT 
    },
    {
      role: "user",
      content: message.trim()
    }
  ],
  max_tokens: 300
});

res.json({
  reply: response.choices[0].message.content
});


  } catch (error) {
    console.error("OpenAI API error:", error.message);

    res.status(500).json({
      error: "AI response nahi mil saka. Dobara try karo."
    });
  }
});

// Unknown route handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

// Start server
app.listen(PORT,"0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

