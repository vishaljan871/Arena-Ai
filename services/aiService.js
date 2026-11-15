const OpenAI = require("openai");
const SYSTEM_PROMPT = require("../stmPrompt");
const { AI_MODEL } = require("../config/constants");

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// Custom error class
class AIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AIError";
    this.statusCode = statusCode;
  }
}

async function askAI(messages) {
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL, // "openrouter/free"
      messages,
      max_tokens: 800,
      response_format: { type: "json_object" }
    });

    const aiText = response.choices[0].message.content;

    try {
      const result = JSON.parse(aiText);
      return {
        reply:
          typeof result.reply === "string"
            ? result.reply
            : "Hello! Main aapki kya madad kar sakta hoon?"
      };
    } catch (parseError) {
      console.error("AI JSON Parse Error:", aiText);
      throw new AIError("AI response format invalid.", 502);
    }
  } catch (error) {
    // OpenRouter ki error handle karo
    if (error.status === 429) {
      throw new AIError(
        "Aapne aaj ki free request limit khatam kar di hai. Kal wapas try karein ya credits add karein.",
        429
      );
    }

    if (error.status === 402) {
      throw new AIError(
        "AI credits khatam ho gaye hain. Please credits add karein.",
        402
      );
    }

    if (error instanceof AIError) {
      throw error;
    }

    console.error("AI Service Error:", error);
    throw new AIError("AI service se connect nahi ho paya.", 500);
  }
}

module.exports = { askAI, SYSTEM_PROMPT, AIError };
