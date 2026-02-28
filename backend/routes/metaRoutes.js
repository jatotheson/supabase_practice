import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import openapi from "../openapi.js";

const metaRoutes = Router();

metaRoutes.get("/openapi.json", (_req, res) => {
  res.json(openapi);
});

metaRoutes.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

metaRoutes.get("/health", (_req, res) => {
  res.json({ data: { ok: true } });
});

export default metaRoutes;
