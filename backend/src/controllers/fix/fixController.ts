import { Request, Response } from "express";
import { FixService } from "../../services/fix/fixService";

export class FixController {
  constructor(private readonly fixService: FixService) {}

  async connect(req: Request, res: Response): Promise<void> {
    try {
      await this.fixService.connect();
      res.json({ message: "Connected to FIX sessions" });
    } catch (error) {
      res.status(500).json({ error: "Failed to connect to FIX sessions" });
    }
  }

  async disconnect(req: Request, res: Response): Promise<void> {
    try {
      await this.fixService.disconnect();
      res.json({ message: "Disconnected from FIX sessions" });
    } catch (error) {
      res.status(500).json({ error: "Failed to disconnect from FIX sessions" });
    }
  }

  async subscribeMarketData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.body;
      await this.fixService.subscribeMarketData(symbol);
      res.json({ message: `Subscribed to market data for ${symbol}` });
    } catch (error) {
      res.status(500).json({ error: "Failed to subscribe to market data" });
    }
  }

  async placeOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = req.body;
      const result = await this.fixService.placeOrder(order);
      res.json({
        message: "Order placed successfully",
        orderId: result.orderId,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to place order" });
    }
  }

  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, clientOrderId } = req.body;
      await this.fixService.cancelOrder(orderId, clientOrderId);
      res.json({ message: "Order cancelled successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel order" });
    }
  }
}
