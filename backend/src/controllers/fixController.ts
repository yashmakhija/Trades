import { Request, Response } from "express";
import { FixService } from "../services/fix/fixService";
import { logger } from "../utils/logger";

export class FixController {
  constructor(private fixService: FixService) {}

  async getSessionStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.fixService.getSessionStatus();
      res.json(status);
    } catch (error) {
      logger.error("Error getting FIX session status:", error);
      res.status(500).json({ error: "Failed to get FIX session status" });
    }
  }

  async subscribeMarketData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        res.status(400).json({ error: "Symbol is required" });
        return;
      }

      await this.fixService.subscribeMarketData(symbol);
      res.json({ message: `Subscribed to market data for ${symbol}` });
    } catch (error) {
      logger.error("Error subscribing to market data:", error);
      res.status(500).json({ error: "Failed to subscribe to market data" });
    }
  }

  async unsubscribeMarketData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        res.status(400).json({ error: "Symbol is required" });
        return;
      }

      await this.fixService.unsubscribeMarketData(symbol);
      res.json({ message: `Unsubscribed from market data for ${symbol}` });
    } catch (error) {
      logger.error("Error unsubscribing from market data:", error);
      res.status(500).json({ error: "Failed to unsubscribe from market data" });
    }
  }

  async placeOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = req.body;
      const result = await this.fixService.placeOrder(order);
      res.json(result);
    } catch (error) {
      logger.error("Error placing order:", error);
      res.status(500).json({ error: "Failed to place order" });
    }
  }

  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, clientOrderId } = req.params;
      if (!orderId || !clientOrderId) {
        res
          .status(400)
          .json({ error: "Order ID and Client Order ID are required" });
        return;
      }

      await this.fixService.cancelOrder(orderId, clientOrderId);
      res.json({ message: `Order cancel requested for ${orderId}` });
    } catch (error) {
      logger.error("Error canceling order:", error);
      res.status(500).json({ error: "Failed to cancel order" });
    }
  }

  async getPosition(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        res.status(400).json({ error: "Symbol is required" });
        return;
      }

      const position = this.fixService.getPosition(symbol);
      if (!position) {
        res.status(404).json({ error: "Position not found" });
        return;
      }

      res.json(position);
    } catch (error) {
      logger.error("Error getting position:", error);
      res.status(500).json({ error: "Failed to get position" });
    }
  }

  async getAllPositions(req: Request, res: Response): Promise<void> {
    try {
      const positions = this.fixService.getAllPositions();
      res.json(positions);
    } catch (error) {
      logger.error("Error getting all positions:", error);
      res.status(500).json({ error: "Failed to get positions" });
    }
  }
}
