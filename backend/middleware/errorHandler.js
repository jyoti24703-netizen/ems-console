const isOperationalStatus = (status) =>
  Number.isInteger(status) && status >= 400 && status <= 599;

export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    error: "Endpoint not found",
    method: req.method,
    path: req.originalUrl || req.url,
    requestId: req.requestId || null,
    suggestion: "Check /api/info for available endpoints"
  });
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode = isOperationalStatus(err?.statusCode)
    ? err.statusCode
    : isOperationalStatus(err?.status)
    ? err.status
    : 500;

  const isProd = process.env.NODE_ENV === "production";
  const message =
    statusCode >= 500 && isProd
      ? "Internal server error"
      : err?.message || "Internal server error";

  console.error(
    "[ERR]",
    JSON.stringify({
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      message: err?.message || "Unknown error",
      stack: err?.stack || null,
      at: new Date().toISOString()
    })
  );

  return res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.requestId || null,
    timestamp: new Date().toISOString(),
    ...(isProd ? {} : { stack: err?.stack || null })
  });
};

