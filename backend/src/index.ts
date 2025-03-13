import express from "express";
import cors from "cors";
import { config } from "./config";
import { startBinanceWebSocket } from "./services/binanceService";
import { PrismaClient } from "@prisma/client";
import symbolRoutes from "./routes/symbolRoutes";
import http from "http";
import path from "path";
import { initWebSocketServer } from "./services/webSocketService";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

export const prisma = new PrismaClient();

const app = express();

const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Trading App API",
      version: "1.0.0",
      description: "API documentation for the Trading App",
      contact: {
        name: "API Support",
        email: "support@tradingapp.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: "Development server",
      },
    ],
    components: {
      schemas: {
        Symbol: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Symbol unique identifier",
            },
            name: {
              type: "string",
              description: "Symbol name (e.g., btcusdt)",
            },
            description: {
              type: "string",
              description: "Symbol description",
            },
            currentPrice: {
              type: "number",
              description: "Current price in USD",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/types/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/openapi.yaml", (req, res) => {
  res.sendFile(path.join(__dirname, "../openapi.yaml"));
});

app.use("/api/symbols", symbolRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(
    `Swagger documentation available at http://localhost:${config.port}/api-docs`
  );
  console.log(
    `WebSocket client example available at http://localhost:${config.port}/websocket-client-example.html`
  );

  initWebSocketServer(server);

  startBinanceWebSocket();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Disconnected from database");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  console.log("Disconnected from database");
  process.exit(0);
});
