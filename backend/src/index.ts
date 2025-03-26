import express from "express";
import cors from "cors";
import path from "path";
import { initRoutes } from "./routes";
import { startServer } from "./server";
import { PrismaClient } from "@prisma/client";

// Create Express application
const app = express();
const prisma = new PrismaClient();

// Apply middleware with specific CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests from these origins
      const allowedOrigins = [
        "http://localhost:3000",
        "https://trade.classicoder.com",
        "https://www.codesquarelabs.com",
        "https://codesquarelabs.com",
        "https://trade.codesquarelabs.com",
        "https://www.trade.codesquarelabs.com",
        "https://www.codesquarelabs.com",
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
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Methods",
      "Access-Control-Allow-Credentials",
    ],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Add additional CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
  }
  next();
});

app.options("*", cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

initRoutes(app);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

startServer(app);
