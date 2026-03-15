import express, { type Express } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { init as initSocket } from "./services/socketService.js";
import router from "./routes/index.js";

const app: Express = express();
app.set("trust proxy", 1);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] },
});

initSocket(io);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", router);

export { httpServer };
export default app;
