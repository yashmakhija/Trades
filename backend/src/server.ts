import http from "http";
import { Express } from "express";
import { config } from "./config";
import { initWebSocketServer } from "./services/webSocketService";
import { startBinanceWebSocket } from "./services/binanceService";
import { prisma } from "./lib/prisma";

// Export prisma for use in other modules
export { prisma };

// Initialize and start the HTTP server
export function startServer(app: Express): http.Server {
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(
      `Swagger documentation available at http://localhost:${config.port}/api-docs`
    );
    console.log(
      `WebSocket client example available at http://localhost:${config.port}/websocket-client-example.html`
    );

    // Initialize WebSocket server
    initWebSocketServer(server);

    // Start Binance WebSocket connection
    startBinanceWebSocket();
  });

  // Handle graceful shutdown
  setupGracefulShutdown(server);

  return server;
}

function setupGracefulShutdown(server: http.Server): void {
  const shutdown = async () => {
    console.log("Shutting down server...");

    // Close server
    server.close(() => {
      console.log("HTTP server closed");
    });

    // Disconnect from database
    await prisma.$disconnect();
    console.log("Disconnected from database");

    process.exit(0);
  };

  // Handle termination signals
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
