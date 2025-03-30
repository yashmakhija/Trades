import { Router } from "express";
import {
  getCandles,
  storeCandle,
  aggregateCandles,
  getLatestCandle,
  getCandlesCount,
} from "../controllers/candleController";

const router = Router();

// Get historical candle data
router.get("/", getCandles);

// Store a new candle
router.post("/", storeCandle);

// Aggregate candles to a larger timeframe
router.get("/aggregate", aggregateCandles);

// Get the latest candle
router.get("/latest", getLatestCandle);

// Get count of available candles for pagination
router.get("/count", getCandlesCount);

export default router;
