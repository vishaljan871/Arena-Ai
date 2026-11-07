
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {

    // Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required."
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Validate user ID
    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload."
      });
    }

    // Attach authenticated user
    req.user = {
      id: decoded.id
    };

    next();

  } catch (error) {

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again."
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token."
    });

  }
}

module.exports = authMiddleware;

