import { Router } from "express";
import {
  getAllSymbols,
  getSymbolByName,
  getLatestPrices,
} from "../controllers/symbolController";

const router = Router();

router.get("/", getAllSymbols);

router.get("/prices", getLatestPrices);

router.get("/:name", getSymbolByName);

export default router;
