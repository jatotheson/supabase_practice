import { Router } from "express";
import multer from "multer";
import { MAX_IMAGE_SIZE_BYTES } from "../config.js";
import { sendError } from "../lib/http.js";
import { logInfo } from "../lib/logger.js";
import { listPublicImages, uploadPublicImage } from "../supabase.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

const imageRoutes = Router();

imageRoutes.post("/images/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Image file is required." });
    return;
  }

  const folder = typeof req.body?.folder === "string" ? req.body.folder : "uploads";
  const { data, error } = await uploadPublicImage(req.file, folder);
  if (error) {
    sendError(res, error, 400, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      folder,
      filename: req.file.originalname,
    });
    return;
  }

  logInfo("images", "upload_success", {
    requestId: req.requestId,
    folder,
    filename: req.file.originalname,
    path: data?.path ?? null,
  });
  res.status(201).json({ data });
});

imageRoutes.get("/images", async (req, res) => {
  const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
  const { data, error } = await listPublicImages(prefix);
  if (error) {
    sendError(res, error, 500, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      prefix,
    });
    return;
  }

  logInfo("images", "list_success", {
    requestId: req.requestId,
    prefix,
    count: Array.isArray(data) ? data.length : 0,
  });
  res.json({ data });
});

export default imageRoutes;
