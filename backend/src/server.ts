import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { fixConfig } from "./config/fix.config";
import { FixService } from "./services/fix/fixService";
import fixRoutes from "./routes/fixRoutes";
import { logger } from "./utils/logger";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// Initialize FIX Service
const fixService = new FixService(fixConfig);

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

// Routes
app.use("/api/fix", fixRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// WebSocket Setup
io.on("connection", (socket: Socket) => {
  logger.info("Client connected to WebSocket");

  // Subscribe to FIX market data events
  fixService.on("marketData", (data) => {
    socket.emit("marketData", data);
  });

  // Subscribe to FIX order updates
  fixService.on("orderUpdate", (data) => {
    socket.emit("orderUpdate", data);
  });

  // Subscribe to FIX position updates
  fixService.on("positionUpdate", (data) => {
    socket.emit("positionUpdate", data);
  });

  socket.on("disconnect", () => {
    logger.info("Client disconnected from WebSocket");
  });
});

// Start Server
const PORT = process.env.PORT || 3002;

export async function startServer() {
  try {
    // Connect to FIX sessions
    await fixService.connect();
    logger.info("FIX sessions connected successfully");

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown() {
  try {
    // Disconnect FIX sessions
    await fixService.disconnect();
    logger.info("FIX sessions disconnected successfully");

    // Close HTTP server
    httpServer.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app };
