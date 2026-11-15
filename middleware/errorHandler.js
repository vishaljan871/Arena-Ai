function errorHandler(err, req, res, next) {
  console.error("Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry found."
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error."
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
}

module.exports = { errorHandler, notFoundHandler };
