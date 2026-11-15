const { isValidDateString } = require("./dateUtils");

function isValidUsername(username) {
  return typeof username === "string" && /^[a-z0-9_]{3,30}$/.test(username);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function isValidAttendanceStatus(status) {
  return ["present", "absent"].includes(status);
}

function isValidShiftType(shift) {
  return ["day", "night"].includes(shift);
}

function isValidAdvance(advance) {
  return Number.isFinite(advance) && advance >= 0;
}

module.exports = {
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isValidAttendanceStatus,
  isValidShiftType,
  isValidAdvance,
  isValidDateString
};
