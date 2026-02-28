import { Router } from "express";
import { requireUser } from "../lib/auth.js";
import { sendError } from "../lib/http.js";
import { logInfo } from "../lib/logger.js";
import { ensureUserRow } from "../supabase.js";

const userRoutes = Router();

userRoutes.post("/users/sync", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const { data, error } = await ensureUserRow(user.id);
  if (error) {
    sendError(res, error, 500, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      userId: user.id,
    });
    return;
  }

  logInfo("users", "sync_success", {
    requestId: req.requestId,
    userId: user.id,
  });

  res.json({ data });
});

export default userRoutes;
