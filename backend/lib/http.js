import { logError } from "./logger.js";

export function toStatus(error, fallback = 500) {
  if (typeof error?.statusCode === "number") {
    return error.statusCode;
  }
  if (typeof error?.status === "number") {
    return error.status;
  }
  return fallback;
}

export function sendError(res, error, fallback = 500, context = {}) {
  const status = toStatus(error, fallback);
  const message = error?.message || "Unexpected server error.";

  logError("api", "response:error", {
    status,
    message,
    ...context,
  });

  res.status(status).json({
    error: error?.message || "Unexpected server error.",
  });
}
