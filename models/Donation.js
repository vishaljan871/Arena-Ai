
const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  username: {
    type: String,
    default: "Anonymous Supporter"
  },

  isPublic: {
    type: Boolean,
    default: true
  },

  orderId: {
    type: String,
    required: true,
    unique: true
  },

  paymentId: {
    type: String,
    default: null
  },

  amount: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: "INR"
  },

  status: {
    type: String,
    enum: ["created", "authorized", "paid", "failed"],
    default: "created"
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  paidAt: {
    type: Date,
    default: null
  }
});

const Donation = mongoose.model("Donation", donationSchema);

module.exports = Donation;

