import express from "express";
import multer from "multer";
import { MAX_IMAGE_SIZE_BYTES } from "./config.js";
import { sendError } from "./lib/http.js";
import { logError, logWarn, requestLogger } from "./lib/logger.js";
import apiRoutes from "./routes/apiRoutes.js";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRoutes);

  app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      logWarn("upload", "file_too_large", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        maxBytes: MAX_IMAGE_SIZE_BYTES,
      });
      res.status(400).json({ error: `Image too large. Max ${MAX_IMAGE_SIZE_BYTES} bytes.` });
      return;
    }

    logError("app", "unhandled_error", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      message: err?.message || "Unknown error.",
    });
    sendError(res, err, 500, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  return app;
}
