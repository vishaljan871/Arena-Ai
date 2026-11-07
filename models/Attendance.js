
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },

    status: {
      type: String,
      enum: ["present", "absent", "leave", "late"],
      required: true
    },

    payment: {
      type: {
        type: String,
        enum: ["given", "received"]
      },

      amount: {
        type: Number,
        min: 0
      },

      description: {
        type: String,
        trim: true,
        maxlength: 200
      }
    }
  },
  {
    timestamps: true
  }
);

// Ek user ek date par sirf ek attendance mark kar sakta hai.
attendanceSchema.index(
  { userId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "Attendance",
  attendanceSchema
);

