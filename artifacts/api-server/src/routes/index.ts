import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import sensorRoutes from "./sensorRoutes.js";
import authRoutes from "./authRoutes.js";
import ticketRoutes from "./ticketRoutes.js";
import userRoutes from "./userRoutes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/", sensorRoutes);
router.use("/auth", authRoutes);
router.use("/tickets", ticketRoutes);
router.use("/users", userRoutes);

export default router;
