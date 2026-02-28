import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { logInfo } from "../lib/logger.js";
import openapi from "../openapi.js";

const metaRoutes = Router();

metaRoutes.get("/openapi.json", (req, res) => {
  logInfo("meta", "openapi_served", { requestId: req.requestId });
  res.json(openapi);
});

metaRoutes.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

metaRoutes.get("/health", (req, res) => {
  logInfo("meta", "health_check", { requestId: req.requestId });
  res.json({ data: { ok: true } });
});

export default metaRoutes;
