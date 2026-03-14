import express, { type Express } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { createRequire } from "module";
import router from "./routes";

const require = createRequire(import.meta.url);

const app: Express = express();
app.set("trust proxy", 1);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] },
});

const socketService = require("./services/socketService");
socketService.init(io);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", router);

export { httpServer };
export default app;
