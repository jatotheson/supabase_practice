import { Router } from "express";
import { requireUser } from "../lib/auth.js";
import { sendError } from "../lib/http.js";
import { createPost, deletePost, getPosts } from "../supabase.js";

const postRoutes = Router();

postRoutes.get("/posts", async (_req, res) => {
  const { data, error } = await getPosts();
  if (error) {
    sendError(res, error);
    return;
  }
  res.json({ data });
});

postRoutes.post("/posts", async (req, res) => {
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

postRoutes.delete("/posts/:id", async (req, res) => {
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

export default postRoutes;
