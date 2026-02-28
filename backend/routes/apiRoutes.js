import { Router } from "express";
import imageRoutes from "./imageRoutes.js";
import metaRoutes from "./metaRoutes.js";
import postRoutes from "./postRoutes.js";

const apiRoutes = Router();

apiRoutes.use(metaRoutes);
apiRoutes.use(postRoutes);
apiRoutes.use(imageRoutes);

export default apiRoutes;
