import { getUserFromAccessToken } from "../supabase.js";
import { logInfo, logWarn } from "./logger.js";

export function getAccessTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

export async function requireUser(req, res) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    logWarn("auth", "missing_access_token", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
    });
    res.status(401).json({ error: "Missing access token." });
    return null;
  }

  const { data: user, error } = await getUserFromAccessToken(accessToken);
  if (error || !user) {
    logWarn("auth", "invalid_access_token", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      message: error?.message || "Unknown auth error.",
    });
    res.status(401).json({ error: "Invalid or expired access token." });
    return null;
  }

  logInfo("auth", "authenticated_request", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: user.id,
  });

  return user;
}
