const APP_VERSION = {
  latestVersion: "1.0.0",
  versionCode: 1,
  minimumVersionCode: 1,
  apkUrl: "https://yourdomain.com/downloads/ArenaAI-v1.0.0.apk",
  releaseNotes: [
    "Arena AI initial release",
    "Attendance management",
    "AI assistant"
  ]
};

const AI_MODEL = "openrouter/free";
const CHAT_HISTORY_LIMIT = 30;
const ATTENDANCE_HISTORY_LIMIT = 100;
const CHAT_EXPIRY_DAYS = 3;

module.exports = {
  APP_VERSION,
  AI_MODEL,
  CHAT_HISTORY_LIMIT,
  ATTENDANCE_HISTORY_LIMIT,
  CHAT_EXPIRY_DAYS
};
