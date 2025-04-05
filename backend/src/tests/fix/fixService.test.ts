import { FixService } from "../../services/fix/fixService";
import { fixConfig } from "../../config/fix.config";
import { FixClient } from "nodefix";
import { EventEmitter } from "events";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Define types for our mock data
interface FixOrder {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderType: "LIMIT" | "MARKET" | "STOP" | "STOP_LIMIT";
  type: "SPOT" | "MARGIN";
  timeInForce: string;
  clientOrderId: string;
}

// Create a mock FixClient class
class MockFixClient {
  createConnection = jest.fn();
  on = jest.fn();
  sendMsg = jest.fn();
  sendLogon = jest.fn();
  sendLogoff = jest.fn();
  destroyConnection = jest.fn();
  modifyBehavior = jest.fn();
  emit = jest.fn();
}

jest.mock("nodefix", () => ({
  FixClient: jest.fn().mockImplementation(() => new MockFixClient()),
}));

describe("FixService", () => {
  let fixService: FixService;
  let mockMarketDataClient: jest.Mocked<MockFixClient>;
  let mockTradingClient: jest.Mocked<MockFixClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    fixService = new FixService(fixConfig);
    mockMarketDataClient = (FixClient as jest.Mock).mock
      .instances[0] as jest.Mocked<MockFixClient>;
    mockTradingClient = (FixClient as jest.Mock).mock
      .instances[1] as jest.Mocked<MockFixClient>;
  });

  describe("Connection Management", () => {
    it("should connect to both sessions", async () => {
      await fixService.connect();
      expect(mockMarketDataClient.createConnection).toHaveBeenCalled();
      expect(mockTradingClient.createConnection).toHaveBeenCalled();
    });

    it("should disconnect from both sessions", async () => {
      await fixService.disconnect();
      expect(mockMarketDataClient.destroyConnection).toHaveBeenCalled();
      expect(mockTradingClient.destroyConnection).toHaveBeenCalled();
    });

    it("should handle connection errors", async () => {
      const error = new Error("Connection failed");
      mockMarketDataClient.createConnection.mockImplementation(
        (callback: any) => {
          callback(error);
        }
      );

      await expect(fixService.connect()).rejects.toThrow("Connection failed");
    });
  });

  describe("Market Data Operations", () => {
    beforeEach(async () => {
      await fixService.connect();
    });

    it("should subscribe to market data", async () => {
      const symbol = "EURUSD";
      await fixService.subscribeMarketData(symbol);

      expect(mockMarketDataClient.sendMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          MsgType: "V",
          Symbol: symbol,
        })
      );
    });

    it("should handle market data messages", (done) => {
      const marketData = {
        MsgType: "W",
        Symbol: "EURUSD",
        BidPx: "1.1000",
        AskPx: "1.1002",
        BidSize: "1000000",
        AskSize: "1000000",
      };

      fixService.on("marketData", (data) => {
        expect(data).toEqual(
          expect.objectContaining({
            symbol: "EURUSD",
            bid: 1.1,
            ask: 1.1002,
          })
        );
        done();
      });

      (mockMarketDataClient as any).emit("message", marketData);
    });
  });

  describe("Trading Operations", () => {
    beforeEach(async () => {
      await fixService.connect();
    });

    it("should place a new order", async () => {
      const order: FixOrder = {
        symbol: "EURUSD",
        side: "BUY",
        quantity: 100000,
        price: 1.1,
        orderType: "LIMIT",
        type: "SPOT",
        timeInForce: "DAY",
        clientOrderId: "TEST-123",
      };

      await fixService.placeOrder(order as any);

      expect(mockTradingClient.sendMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          MsgType: "D",
          Symbol: "EURUSD",
          Side: "1",
          OrderQty: "100000",
          Price: "1.1000",
          OrdType: "2",
        })
      );
    });

    it("should cancel an order", async () => {
      const orderId = "12345";
      const clientOrderId = "CLIENT-123";

      await fixService.cancelOrder(orderId, clientOrderId);

      expect(mockTradingClient.sendMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          MsgType: "F",
          OrigClOrdID: clientOrderId,
          ClOrdID: expect.any(String),
          OrderID: orderId,
        })
      );
    });

    it("should handle order status updates", (done) => {
      const orderUpdate = {
        MsgType: "8",
        OrderID: "12345",
        ClOrdID: "CLIENT-123",
        OrdStatus: "2",
        ExecType: "2",
        LeavesQty: "0",
        CumQty: "100000",
        AvgPx: "1.1000",
      };

      fixService.on("orderUpdate", (data) => {
        expect(data).toEqual(
          expect.objectContaining({
            orderId: "12345",
            clientOrderId: "CLIENT-123",
            status: "Filled",
            filledQuantity: 100000,
            averagePrice: 1.1,
          })
        );
        done();
      });

      (mockTradingClient as any).emit("message", orderUpdate);
    });
  });

  describe("Position Management", () => {
    beforeEach(async () => {
      await fixService.connect();
    });

    it("should handle position updates", (done) => {
      const positionUpdate = {
        MsgType: "AP",
        Symbol: "EURUSD",
        Position: "100000",
        AvgPx: "1.1000",
        MktPrice: "1.1002",
        UnrealizedPnL: "20",
      };

      fixService.on("positionUpdate", (data) => {
        expect(data).toEqual(
          expect.objectContaining({
            symbol: "EURUSD",
            quantity: 100000,
            averagePrice: 1.1,
            marketPrice: 1.1002,
            unrealizedPnL: 20,
          })
        );
        done();
      });

      (mockTradingClient as any).emit("message", positionUpdate);
    });
  });

  describe("Error Handling", () => {
    it("should handle market data connection errors", (done) => {
      const error = new Error("Market data connection error");

      fixService.on("error", (err) => {
        expect(err).toBe(error);
        done();
      });

      (mockMarketDataClient as any).emit("error", error);
    });

    it("should handle trading connection errors", (done) => {
      const error = new Error("Trading connection error");

      fixService.on("error", (err) => {
        expect(err).toBe(error);
        done();
      });

      (mockTradingClient as any).emit("error", error);
    });
  });
});
