const crypto = require("crypto");
const User = require("../models/User");
const Donation = require("../models/Donation");
const { getRazorpay } = require("../services/razorpayService");

// Note: Payment feature is intentionally disabled for now.
// Controller kept for future use.

async function leaderboard(req, res) {
  try {
    const donations = await Donation.find({
      status: "paid",
      isPublic: true,
      userId: { $ne: null }
    })
      .select("username amount status createdAt")
      .sort({ amount: -1, createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, donations });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load leaderboard."
    });
  }
}

async function createOrder(req, res) {
  try {
    const user = await User.findById(req.user.userId).select(
      "username isActive"
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or account disabled."
      });
    }

    const amount = Number(req.body.amount);

    if (!Number.isSafeInteger(amount) || amount < 19 || amount > 100000) {
      return res.status(400).json({
        success: false,
        message: "Donation must be between ₹19 and ₹100000."
      });
    }

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `don_${crypto.randomUUID()}`,
      notes: {
        purpose: "Voluntary Development Donation",
        userId: user._id.toString()
      }
    });

    await Donation.create({
      userId: user._id,
      username: user.username,
      isPublic: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: "created"
    });

    return res.status(201).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create payment order."
    });
  }
}

async function verifyPayment(req, res) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details."
      });
    }

    const donation = await Donation.findOne({
      orderId: razorpay_order_id,
      userId: req.user.userId
    });

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation order not found."
      });
    }

    if (donation.status === "paid") {
      return res.json({
        success: true,
        message: "Payment already verified."
      });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const received = Buffer.from(razorpay_signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");

    if (
      received.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(received, expectedBuf)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature."
      });
    }

    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== donation.amount ||
      payment.currency !== donation.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details do not match."
      });
    }

    if (payment.status !== "captured") {
      if (payment.status === "authorized") {
        donation.status = "authorized";
        donation.paymentId = razorpay_payment_id;
        await donation.save();
      }

      return res.status(202).json({
        success: false,
        pending: true,
        message: "Payment is not captured yet."
      });
    }

    donation.status = "paid";
    donation.paymentId = razorpay_payment_id;
    donation.paidAt = new Date();
    await donation.save();

    res.json({ success: true, message: "Payment verified successfully." });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed. Please check again."
    });
  }
}

async function webhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    const received = Buffer.from(signature || "", "hex");
    const expectedBuf = Buffer.from(expected, "hex");

    if (
      !received.length ||
      received.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(received, expectedBuf)
    ) {
      return res.status(400).send("Invalid webhook signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;

      await Donation.findOneAndUpdate(
        {
          orderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: { $ne: "paid" }
        },
        {
          $set: {
            status: "paid",
            paymentId: payment.id,
            paidAt: new Date()
          }
        }
      );
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook processing failed");
  }
}

module.exports = { leaderboard, createOrder, verifyPayment, webhook };
