import "dotenv/config";
import express from "express";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import {
  createPost,
  deletePost,
  getPosts,
  getUserFromAccessToken,
  listPublicImages,
  uploadPublicImage,
} from "./supabase.js";
import openapi from "./openapi.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const maxImageSizeBytes = Number(process.env.MAX_IMAGE_SIZE_BYTES || 5 * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageSizeBytes },
});

app.use(express.json({ limit: "1mb" }));
app.get("/api/openapi.json", (_req, res) => {
  res.json(openapi);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

function toStatus(error, fallback = 500) {
  if (typeof error?.statusCode === "number") {
    return error.statusCode;
  }
  if (typeof error?.status === "number") {
    return error.status;
  }
  return fallback;
}

function sendError(res, error, fallback = 500) {
  res.status(toStatus(error, fallback)).json({
    error: error?.message || "Unexpected server error.",
  });
}

function getAccessTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

async function requireUser(req, res) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    res.status(401).json({ error: "Missing access token." });
    return null;
  }

  const { data: user, error } = await getUserFromAccessToken(accessToken);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired access token." });
    return null;
  }

  return user;
}

app.get("/api/health", (_req, res) => {
  res.json({ data: { ok: true } });
});

app.get("/api/posts", async (_req, res) => {
  const { data, error } = await getPosts();
  if (error) {
    sendError(res, error);
    return;
  }
  res.json({ data });
});

app.post("/api/posts", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";

  if (!title || !body) {
    res.status(400).json({ error: "Title and body are required." });
    return;
  }

  const { data, error } = await createPost(title, body, user.id);
  if (error) {
    sendError(res, error);
    return;
  }

  res.status(201).json({ data });
});

app.delete("/api/posts/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Post id is required." });
    return;
  }

  const { error } = await deletePost(id, user.id);
  if (error) {
    sendError(res, error);
    return;
  }

  res.json({ data: { success: true } });
});

app.post("/api/images/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Image file is required." });
    return;
  }

  const folder = typeof req.body?.folder === "string" ? req.body.folder : "uploads";
  const { data, error } = await uploadPublicImage(req.file, folder);
  if (error) {
    sendError(res, error, 400);
    return;
  }

  res.status(201).json({ data });
});

app.get("/api/images", async (req, res) => {
  const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
  const { data, error } = await listPublicImages(prefix);
  if (error) {
    sendError(res, error);
    return;
  }

  res.json({ data });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: `Image too large. Max ${maxImageSizeBytes} bytes.` });
    return;
  }

  sendError(res, err);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
