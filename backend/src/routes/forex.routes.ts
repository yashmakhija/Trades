import { Router } from "express";
import { ForexController } from "../controllers/forex.controller";

const router = Router();
const forexController = new ForexController();

// Get current exchange rate
router.get("/rate", forexController.getExchangeRate.bind(forexController));

// Get daily forex data
router.get("/daily", forexController.getDailyForexData.bind(forexController));

// Get intraday forex data
router.get(
  "/intraday",
  forexController.getIntradayForexData.bind(forexController)
);

export default router;
