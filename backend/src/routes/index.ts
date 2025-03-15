import { Express, Request, Response } from "express";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec, swaggerUiSetup } from "../config/swagger";
import symbolRoutes from "./symbolRoutes";
import authRoutes from "./authRoutes";
import orderRoutes from "./orderRoutes";
import candleRoutes from "./candleRoutes";
import { orderManager } from "../services/orderManager";

export function initRoutes(app: Express): void {
  // Serve Swagger UI
  app.use("/api-docs", swaggerUi.serve, swaggerUiSetup);

  // Serve Swagger JSON
  app.get("/api-docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Serve Swagger YAML
  app.get("/swagger.yaml", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../config/swagger.yaml"));
  });

  // API Routes
  app.use("/api/symbols", symbolRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/candles", candleRoutes);

  // Health Check
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      orderManagerStats: orderManager.getStats(),
    });
  });

  // Root route - redirect to API documentation
  app.get("/", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../public/swagger-test.html"));
  });
}
