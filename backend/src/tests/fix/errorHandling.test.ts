import { FixService } from "../../services/fix/fixService";
import { fixConfig } from "../../config/fix.config";
import { logger } from "../../utils/logger";
import { EventEmitter } from "events";

// Mock logger
jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock nodefix module
jest.mock("nodefix", () => {
  return {
    FixConnection: jest.fn().mockImplementation(() => {
      const emitter = new EventEmitter();
      return {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        on: emitter.on.bind(emitter),
        emit: emitter.emit.bind(emitter),
      };
    }),
  };
});

describe("FIX Error Handling", () => {
  let fixService: FixService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create new instance of FixService
    fixService = new FixService(fixConfig);
  });

  describe("Connection Errors", () => {
    it("should log connection errors", async () => {
      const error = new Error("Connection failed");

      try {
        await fixService.connect();
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "FIX connection error",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });

    it("should attempt reconnection on failure", async () => {
      const error = new Error("Connection failed");

      // Mock connect to fail first time, succeed second time
      const connectSpy = jest
        .spyOn(fixService as any, "connect")
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      await fixService.reconnect();

      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        "Attempting to reconnect to FIX session",
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Successfully reconnected to FIX session",
        expect.any(Object)
      );
    });

    it("should give up after max reconnection attempts", async () => {
      const error = new Error("Connection failed");

      // Mock connect to always fail
      jest.spyOn(fixService as any, "connect").mockRejectedValue(error);

      await fixService.reconnect();

      expect(logger.error).toHaveBeenCalledWith(
        "Max reconnection attempts reached",
        expect.any(Object)
      );
    });
  });

  describe("Message Errors", () => {
    it("should log invalid message format errors", async () => {
      const invalidMessage = { MsgType: "INVALID" };

      try {
        await fixService.handleMessage(invalidMessage);
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Invalid FIX message format",
          expect.objectContaining({
            message: invalidMessage,
            error: expect.any(String),
          })
        );
      }
    });

    it("should log message processing errors", async () => {
      const error = new Error("Failed to process message");

      try {
        await fixService.processMessage({ MsgType: "D" });
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Error processing FIX message",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });
  });

  describe("Order Errors", () => {
    it("should log order validation errors", async () => {
      const invalidOrder = {
        symbol: "EURUSD",
        side: "Invalid",
        quantity: -100000,
        price: 0,
        orderType: "Invalid",
      };

      try {
        await fixService.placeOrder(invalidOrder);
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Order validation failed",
          expect.objectContaining({
            order: invalidOrder,
            errors: expect.any(Array),
          })
        );
      }
    });

    it("should log order placement errors", async () => {
      const error = new Error("Failed to place order");

      try {
        await fixService.placeOrder({
          symbol: "EURUSD",
          side: "Buy",
          quantity: 100000,
          price: 1.1,
          orderType: "Limit",
        });
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to place order",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });
  });

  describe("Market Data Errors", () => {
    it("should log market data subscription errors", async () => {
      const error = new Error("Failed to subscribe to market data");

      try {
        await fixService.subscribeMarketData("EURUSD");
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to subscribe to market data",
          expect.objectContaining({
            symbol: "EURUSD",
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });

    it("should log market data processing errors", async () => {
      const error = new Error("Failed to process market data");

      try {
        await fixService.handleMarketData({
          symbol: "EURUSD",
          bid: "invalid",
          ask: "invalid",
          bidSize: "invalid",
          askSize: "invalid",
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to process market data",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });
  });

  describe("Position Errors", () => {
    it("should log position update errors", async () => {
      const error = new Error("Failed to update position");

      try {
        await fixService.handlePositionUpdate({
          symbol: "EURUSD",
          quantity: "invalid",
          averagePrice: "invalid",
        });
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to update position",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });

    it("should log position retrieval errors", async () => {
      const error = new Error("Failed to retrieve position");

      try {
        await fixService.getPosition("NONEXISTENT");
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to retrieve position",
          expect.objectContaining({
            symbol: "NONEXISTENT",
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });
  });

  describe("General Error Handling", () => {
    it("should log unhandled errors", async () => {
      const error = new Error("Unhandled error");

      try {
        await fixService.handleError(error);
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Unhandled error in FIX service",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
          })
        );
      }
    });

    it("should include context in error logs", async () => {
      const error = new Error("Error with context");
      const context = { symbol: "EURUSD", orderId: "12345" };

      try {
        await fixService.handleError(error, context);
      } catch (err) {
        expect(logger.error).toHaveBeenCalledWith(
          "Error with context",
          expect.objectContaining({
            error: error.message,
            stack: error.stack,
            context,
          })
        );
      }
    });
  });
});
