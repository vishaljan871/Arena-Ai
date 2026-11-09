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

        content: {
            type: String,
            required: true
        },

        // Indian calendar date: YYYY-MM-DD
        dateKey: {
            type: String,
            required: true
        },

        // Message automatically expires at midnight IST
        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Automatically delete expired messages
chatMessageSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

// Retrieve a user's messages in chronological order
chatMessageSchema.index({
    userId: 1,
    dateKey: 1,
    createdAt: 1
});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
