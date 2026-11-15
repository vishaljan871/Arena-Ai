const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  isValidUsername,
  isValidEmail,
  isValidPassword
} = require("../utils/validators");

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

async function checkUsername(req, res) {
  try {
    const username = (req.query.username || "").trim().toLowerCase();

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username must be at least 3 characters."
      });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Only letters, numbers and underscore are allowed."
      });
    }

    const existing = await User.findOne({ username });

    return res.json({
      success: true,
      available: !existing,
      message: existing ? "Username already taken." : "Username available."
    });
  } catch (error) {
    console.error("Check Username Error:", error);
    return res.status(500).json({
      success: false,
      available: false,
      message: "Unable to check username."
    });
  }
}

async function register(req, res) {
  try {
    let { fullname, username, email, password } = req.body;

    if (!fullname || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    fullname = fullname.trim();
    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();

    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-30 characters (letters, numbers, underscore)."
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email."
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters."
      });
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          existing.username === username
            ? "Username already taken."
            : "Email already registered."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      fullname,
      username,
      email,
      password: hashedPassword
    });

    const token = signToken(newUser._id);

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
}

async function login(req, res) {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    username = username.trim().toLowerCase();

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is disabled."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        fullname: user.fullname,
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
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.userId).select(
      "fullname username email role isActive"
    );

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
}

async function changePassword(req, res) {
  try {
    const userId = req.user.userId;
    const { newPassword } = req.body;

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters."
      });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { password: hashed } },
      { new: false, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found."
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
      message: "Something went wrong while changing password."
    });
  }
}

module.exports = {
  checkUsername,
  register,
  login,
  me,
  changePassword
};
