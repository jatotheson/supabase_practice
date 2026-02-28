import { Router } from "express";
import imageRoutes from "./imageRoutes.js";
import metaRoutes from "./metaRoutes.js";
import postRoutes from "./postRoutes.js";
import userRoutes from "./userRoutes.js";

const apiRoutes = Router();

apiRoutes.use(metaRoutes);
apiRoutes.use(postRoutes);
apiRoutes.use(imageRoutes);
apiRoutes.use(userRoutes);

export default apiRoutes;
