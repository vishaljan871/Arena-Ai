const { APP_VERSION } = require("../config/constants");

function checkVersion(req, res) {
  try {
    return res.status(200).json({
      success: true,
      ...APP_VERSION
    });
  } catch (error) {
    console.error("Version Check Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to check app version"
    });
  }
}

module.exports = { checkVersion };
