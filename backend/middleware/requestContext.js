import crypto from "crypto";

const safeJson = (value) => {
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return "\"<unserializable>\"";
  }
};

export const attachRequestContext = (req, res, next) => {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim()
      ? incomingId.trim()
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};

export const requestLogger = (req, res, next) => {
  const startedAt = Date.now();
  const logLevel = String(process.env.REQUEST_LOG_LEVEL || "completed").toLowerCase();
  const shouldLogStarted = logLevel === "all" || logLevel === "started";
  const shouldLogCompleted = logLevel === "all" || logLevel === "completed";

  if (logLevel === "off") {
    next();
    return;
  }

  const base = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip
  };

  if (shouldLogStarted) {
    console.log(
      `[REQ] ${safeJson({
        ...base,
        userId: req.user?.id || null,
        role: req.user?.role || null,
        event: "started",
        at: new Date().toISOString()
      })}`
    );
  }

  res.on("finish", () => {
    if (!shouldLogCompleted) return;
    const durationMs = Date.now() - startedAt;
    console.log(
      `[REQ] ${safeJson({
        ...base,
        userId: req.user?.id || null,
        role: req.user?.role || null,
        event: "completed",
        statusCode: res.statusCode,
        durationMs,
        at: new Date().toISOString()
      })}`
    );
  });

  next();
};
