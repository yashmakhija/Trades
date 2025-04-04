import { Request, Response } from "express";
import { AlphaVantageService } from "../services/alpha-vantage/AlphaVantageService";
import { alphaVantageConfig } from "../config/alpha-vantage.config";
import { logger } from "../utils/logger";

const alphaVantageService = new AlphaVantageService(alphaVantageConfig);

export class ForexController {
  public async getExchangeRate(req: Request, res: Response): Promise<void> {
    try {
      const { fromCurrency, toCurrency } = req.query;

      if (!fromCurrency || !toCurrency) {
        res.status(400).json({
          error: "Missing required parameters: fromCurrency and toCurrency",
        });
        return;
      }

      const rate = await alphaVantageService.getExchangeRate(
        fromCurrency as string,
        toCurrency as string
      );

      res.json(rate);
    } catch (error) {
      logger.error("Error in getExchangeRate:", error);
      res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  }

  public async getDailyForexData(req: Request, res: Response): Promise<void> {
    try {
      const { fromCurrency, toCurrency } = req.query;

      if (!fromCurrency || !toCurrency) {
        res.status(400).json({
          error: "Missing required parameters: fromCurrency and toCurrency",
        });
        return;
      }

      const data = await alphaVantageService.getDailyForexData(
        fromCurrency as string,
        toCurrency as string
      );

      res.json(data);
    } catch (error) {
      logger.error("Error in getDailyForexData:", error);
      res.status(500).json({ error: "Failed to fetch daily forex data" });
    }
  }

  public async getIntradayForexData(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fromCurrency, toCurrency, interval } = req.query;

      if (!fromCurrency || !toCurrency) {
        res.status(400).json({
          error: "Missing required parameters: fromCurrency and toCurrency",
        });
        return;
      }

      const data = await alphaVantageService.getIntradayForexData(
        fromCurrency as string,
        toCurrency as string,
        (interval as "1min" | "5min" | "15min" | "30min" | "60min") || "5min"
      );

      res.json(data);
    } catch (error) {
      logger.error("Error in getIntradayForexData:", error);
      res.status(500).json({ error: "Failed to fetch intraday forex data" });
    }
  }
}
