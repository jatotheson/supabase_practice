import { Router } from "express";
import multer from "multer";
import { MAX_IMAGE_SIZE_BYTES } from "../config.js";
import { requireUser } from "../lib/auth.js";
import { sendError } from "../lib/http.js";
import { logInfo } from "../lib/logger.js";
import { getPostById, listPublicImages, uploadPostImage } from "../supabase.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

const imageRoutes = Router();

imageRoutes.post("/images/upload", upload.single("image"), async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Image file is required." });
    return;
  }

  const postId = typeof req.body?.post_id === "string" ? req.body.post_id.trim() : "";
  if (!postId) {
    res.status(400).json({ error: "post_id is required." });
    return;
  }

  const { data: post, error: postError } = await getPostById(postId);
  if (!post) {
    const lowerMessage = String(postError?.message || "").toLowerCase();
    const isNotFound =
      !postError ||
      postError.code === "PGRST116" ||
      lowerMessage.includes("no rows") ||
      lowerMessage.includes("json object requested");

    if (isNotFound) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    sendError(res, postError, 500, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      postId,
      userId: user.id,
    });
    return;
  }

  if (post.user_id !== user.id) {
    res.status(403).json({ error: "You can only upload images for your own posts." });
    return;
  }

  const sortOrder = req.body?.sort_order ?? 0;
  const { data, error } = await uploadPostImage(req.file, postId, sortOrder);
  if (error) {
    sendError(res, error, 400, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      postId,
      sortOrder,
      filename: req.file.originalname,
      userId: user.id,
    });
    return;
  }

  logInfo("images", "upload_success", {
    requestId: req.requestId,
    postId,
    sortOrder: data?.sort_order ?? null,
    filename: req.file.originalname,
    path: data?.storage_path ?? null,
    userId: user.id,
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
