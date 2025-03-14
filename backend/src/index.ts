import express from "express";
import cors from "cors";
import path from "path";
import { initRoutes } from "./routes";
import { startServer } from "./server";

// Create Express application
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize routes
initRoutes(app);

// Start server
startServer(app);
