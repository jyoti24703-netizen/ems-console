export const STATUS_ENUMS = {
  task: ["assigned", "accepted", "in_progress", "completed", "verified", "failed", "reopened", "withdrawn", "declined_by_employee"],
  meeting: ["scheduled", "in_progress", "completed", "cancelled", "expired"],
  notice: ["draft", "scheduled", "sent", "expired", "cancelled", "deleted"],
  request: ["pending", "approved", "rejected", "expired", "executed", "counter_proposed"]
};

export const successPayload = ({ req, data = {}, meta = {}, message } = {}) => ({
  success: true,
  requestId: req?.requestId || null,
  ...(message ? { message } : {}),
  data,
  meta
});

export const errorPayload = ({ req, error = "Server error", code = "INTERNAL_ERROR", details } = {}) => ({
  success: false,
  requestId: req?.requestId || null,
  error,
  code,
  ...(details ? { details } : {})
});

