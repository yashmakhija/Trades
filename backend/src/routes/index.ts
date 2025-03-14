import { Express, Request, Response } from "express";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../config/swagger";
import symbolRoutes from "./symbolRoutes";
import authRoutes from "./authRoutes";
import orderRoutes from "./orderRoutes";
import { orderManager } from "../services/orderManager";

export function initRoutes(app: Express): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get("/api-docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  app.get("/openapi.yaml", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../../openapi.yaml"));
  });

  app.use("/api/symbols", symbolRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/orders", orderRoutes);

  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      orderManagerStats: orderManager.getStats(),
    });
  });
}
