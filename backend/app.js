import express from "express";
import multer from "multer";
import { MAX_IMAGE_SIZE_BYTES } from "./config.js";
import { sendError } from "./lib/http.js";
import apiRoutes from "./routes/apiRoutes.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRoutes);

  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: `Image too large. Max ${MAX_IMAGE_SIZE_BYTES} bytes.` });
      return;
    }

    sendError(res, err);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  return app;
}
