import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const router: IRouter = Router();

router.use(healthRouter);

const sensorRoutes = require("./sensorRoutes");
const authRoutes = require("./authRoutes");
const ticketRoutes = require("./ticketRoutes");
const userRoutes = require("./userRoutes");

router.use("/", sensorRoutes);
router.use("/auth", authRoutes);
router.use("/tickets", ticketRoutes);
router.use("/users", userRoutes);

export default router;
