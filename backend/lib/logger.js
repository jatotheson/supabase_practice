import crypto from "node:crypto";

const LEVEL_ORDER = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = String(process.env.LOG_LEVEL || "info").toLowerCase();
const minimumLevel = LEVEL_ORDER[configuredLevel] || LEVEL_ORDER.info;

function serializeMeta(meta) {
  if (!meta || typeof meta !== "object" || Object.keys(meta).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " {\"meta\":\"unserializable\"}";
  }
}

function shouldLog(level) {
  return (LEVEL_ORDER[level] || LEVEL_ORDER.info) >= minimumLevel;
}

function writeLog(level, scope, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${message}${serializeMeta(meta)}`;

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logDebug(scope, message, meta = {}) {
  writeLog("debug", scope, message, meta);
}

export function logInfo(scope, message, meta = {}) {
  writeLog("info", scope, message, meta);
}

export function logWarn(scope, message, meta = {}) {
  writeLog("warn", scope, message, meta);
}

export function logError(scope, message, meta = {}) {
  writeLog("error", scope, message, meta);
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID().slice(0, 8);
  req.requestId = requestId;

  const startedAt = process.hrtime.bigint();
  logInfo("http", "request:start", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: getClientIp(req),
  });

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    };

    if (res.statusCode >= 500) {
      logError("http", "request:end", meta);
      return;
    }
    if (res.statusCode >= 400) {
      logWarn("http", "request:end", meta);
      return;
    }
    logInfo("http", "request:end", meta);
  });

  next();
}
