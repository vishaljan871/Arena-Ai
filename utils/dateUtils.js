// Get current date in India (YYYY-MM-DD)
function getIndiaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const date = {};
  parts.forEach(part => {
    date[part.type] = part.value;
  });

  return `${date.year}-${date.month}-${date.day}`;
}

// Get human-readable current date
function getIndiaReadableDate(dateKey = getIndiaDateKey()) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

// Get yesterday dateKey (calendar-based)
function getYesterdayKey(todayKey = getIndiaDateKey()) {
  const [year, month, day] = todayKey.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1));

  return [
    yesterday.getUTCFullYear(),
    String(yesterday.getUTCMonth() + 1).padStart(2, "0"),
    String(yesterday.getUTCDate()).padStart(2, "0")
  ].join("-");
}

// Chat expiry date (3 calendar days later, midnight IST)
function getChatExpiryDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const expiryUTC = Date.UTC(year, month - 1, day + 3) - (5.5 * 60 * 60 * 1000);
  return new Date(expiryUTC);
}

// 3-day start cutoff for chat history
function getThreeDayStartDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const cutoffUTC = Date.UTC(year, month - 1, day - 2);
  return new Date(cutoffUTC).toISOString().slice(0, 10);
}

// Validate YYYY-MM-DD
function isValidDateString(date) {
  if (typeof date !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

module.exports = {
  getIndiaDateKey,
  getIndiaReadableDate,
  getYesterdayKey,
  getChatExpiryDate,
  getThreeDayStartDate,
  isValidDateString
};
