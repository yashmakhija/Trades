import express from "express";
import cors from "cors";
import path from "path";
import { initRoutes } from "./routes";
import { startServer } from "./server";

// Create Express application
export const app = express();

// Apply middleware with specific CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests from these origins
      const allowedOrigins = [
        "http://localhost:3000",
        "https://trade.classicoder.com",
        "https://www.codesquarelabs.com",
        "https://codesquarelabs.com"
      ];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize routes
initRoutes(app);

// Start server
startServer(app);
