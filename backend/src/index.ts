import express from "express";
import cors from "cors";
import { config } from "./config";
import { startBinanceWebSocket } from "./services/binanceService";
import { PrismaClient } from "@prisma/client";
import symbolRoutes from "./routes/symbolRoutes";

export const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/symbols", symbolRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);

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
