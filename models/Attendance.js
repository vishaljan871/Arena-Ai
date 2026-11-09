
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        dateKey: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["present", "absent"],
            required: true
        },

        advance: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

// Ek user ki ek date par sirf ek attendance
attendanceSchema.index(
    { userId: 1, dateKey: 1 },
    { unique: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);

