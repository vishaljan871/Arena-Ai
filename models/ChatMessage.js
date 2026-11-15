const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    content: { type: String, required: true },
    dateKey: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

chatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
chatMessageSchema.index({ userId: 1, dateKey: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
