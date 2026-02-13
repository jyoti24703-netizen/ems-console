const buckets = new Map();

const now = () => Date.now();

const getClientKey = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown-ip";
};

export const createRateLimiter = ({
  windowMs = 60_000,
  max = 30,
  keyPrefix = "global",
  message = "Too many requests. Please try again later."
} = {}) => {
  return (req, res, next) => {
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const current = buckets.get(key);
    const timestamp = now();

    if (!current || timestamp > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: timestamp + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - timestamp) / 1000));
      res.setHeader("retry-after", retryAfterSec);
      return res.status(429).json({
        success: false,
        error: message,
        requestId: req.requestId || null,
        retryAfterSec
      });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
};

