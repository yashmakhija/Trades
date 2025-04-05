import { FixService } from "../../services/fix/fixService";
import { fixConfig } from "../../config/fix.config";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { createServer } from "http";
import { Server } from "socket.io";
import { Client } from "socket.io-client";
import { AddressInfo } from "net";
import { logger } from "../../utils/logger";

// Mock external dependencies
jest.mock("@prisma/client");
jest.mock("ioredis");
jest.mock("../../utils/logger");

describe("FIX Protocol Integration", () => {
  let fixService: FixService;
  let prisma: jest.Mocked<PrismaClient>;
  let redis: jest.Mocked<Redis>;
  let io: Server;
  let clientSocket: Client;
  let httpServer: any;

  beforeAll((done) => {
    // Create HTTP server
    httpServer = createServer();

    // Initialize Socket.IO server
    io = new Server(httpServer);

    // Initialize services
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    redis = new Redis() as jest.Mocked<Redis>;
    fixService = new FixService(fixConfig);

    // Set up WebSocket event handlers
    io.on("connection", (socket) => {
      // Subscribe to FIX events
      fixService.on("marketData", (data) => {
        socket.emit("marketData", data);
      });

      fixService.on("orderUpdate", (data) => {
        socket.emit("orderUpdate", data);
      });

      fixService.on("positionUpdate", (data) => {
        socket.emit("positionUpdate", data);
      });
    });

    // Start server
    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;

      // Connect client
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  describe("Complete Trading Flow", () => {
    it("should handle a complete trading flow", async () => {
      // 1. Connect to FIX sessions
      await fixService.connect();

      // 2. Subscribe to market data
      const symbol = "EURUSD";
      await fixService.subscribeMarketData(symbol);

      // 3. Receive market data
      const marketData = {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        bidSize: 1000000,
        askSize: 1000000,
        timestamp: new Date().toISOString(),
      };

      // Simulate market data message
      fixService.emit("marketData", marketData);

      // 4. Place an order
      const order = {
        symbol: "EURUSD",
        side: "Buy",
        quantity: 100000,
        price: 1.1,
        orderType: "Limit",
      };

      const orderResult = await fixService.placeOrder(order);

      // 5. Receive order confirmation
      const orderUpdate = {
        orderId: orderResult.orderId,
        clientOrderId: orderResult.clientOrderId,
        symbol: "EURUSD",
        status: "Filled",
        side: "Buy",
        quantity: 100000,
        filledQuantity: 100000,
        averagePrice: 1.1,
        timestamp: new Date().toISOString(),
      };

      // Simulate order update message
      fixService.emit("orderUpdate", orderUpdate);

      // 6. Receive position update
      const positionUpdate = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
        marketPrice: 1.1002,
        unrealizedPnL: 20,
        timestamp: new Date().toISOString(),
      };

      // Simulate position update message
      fixService.emit("positionUpdate", positionUpdate);

      // 7. Verify database updates
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          symbol: "EURUSD",
          side: "Buy",
          quantity: 100000,
          price: 1.1,
          orderType: "Limit",
          status: "New",
        }),
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderResult.orderId },
        data: {
          status: "Filled",
          filledQuantity: 100000,
          averagePrice: 1.1,
        },
      });

      expect(prisma.position.upsert).toHaveBeenCalledWith({
        where: { symbol: "EURUSD" },
        update: {
          quantity: 100000,
          averagePrice: 1.1,
        },
        create: {
          symbol: "EURUSD",
          quantity: 100000,
          averagePrice: 1.1,
        },
      });

      // 8. Verify Redis caching
      expect(redis.set).toHaveBeenCalledWith(
        `market:data:${symbol}`,
        JSON.stringify(marketData),
        "EX",
        300
      );

      expect(redis.set).toHaveBeenCalledWith(
        `order:${orderResult.orderId}`,
        JSON.stringify(orderUpdate),
        "EX",
        3600
      );

      expect(redis.set).toHaveBeenCalledWith(
        `position:${symbol}`,
        JSON.stringify(positionUpdate),
        "EX",
        3600
      );

      // 9. Verify WebSocket events
      clientSocket.on("marketData", (data) => {
        expect(data).toEqual(marketData);
      });

      clientSocket.on("orderUpdate", (data) => {
        expect(data).toEqual(orderUpdate);
      });

      clientSocket.on("positionUpdate", (data) => {
        expect(data).toEqual(positionUpdate);
      });
    });
  });

  describe("Error Recovery Flow", () => {
    it("should handle connection failures and recovery", async () => {
      // 1. Simulate connection failure
      const error = new Error("Connection failed");
      fixService.emit("error", error);

      // 2. Attempt reconnection
      await fixService.reconnect();

      // 3. Verify reconnection success
      expect(logger.info).toHaveBeenCalledWith(
        "Successfully reconnected to FIX session",
        expect.any(Object)
      );

      // 4. Verify market data subscription is restored
      const symbol = "EURUSD";
      await fixService.subscribeMarketData(symbol);

      // 5. Verify order placement after recovery
      const order = {
        symbol: "EURUSD",
        side: "Buy",
        quantity: 100000,
        price: 1.1,
        orderType: "Limit",
      };

      const orderResult = await fixService.placeOrder(order);

      expect(orderResult).toEqual({
        orderId: expect.any(String),
        clientOrderId: expect.any(String),
      });
    });
  });

  describe("Data Consistency", () => {
    it("should maintain data consistency across services", async () => {
      // 1. Place an order
      const order = {
        symbol: "EURUSD",
        side: "Buy",
        quantity: 100000,
        price: 1.1,
        orderType: "Limit",
      };

      const orderResult = await fixService.placeOrder(order);

      // 2. Verify order in database
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderResult.orderId },
      });

      expect(dbOrder).toEqual(
        expect.objectContaining({
          symbol: "EURUSD",
          side: "Buy",
          quantity: 100000,
          price: 1.1,
          orderType: "Limit",
        })
      );

      // 3. Verify order in Redis cache
      const cachedOrder = await redis.get(`order:${orderResult.orderId}`);

      expect(JSON.parse(cachedOrder)).toEqual(
        expect.objectContaining({
          orderId: orderResult.orderId,
          clientOrderId: orderResult.clientOrderId,
          symbol: "EURUSD",
          side: "Buy",
          quantity: 100000,
          price: 1.1,
          orderType: "Limit",
        })
      );

      // 4. Update order status
      const orderUpdate = {
        orderId: orderResult.orderId,
        clientOrderId: orderResult.clientOrderId,
        status: "Filled",
        filledQuantity: 100000,
        averagePrice: 1.1,
      };

      await fixService.handleOrderUpdate(orderUpdate);

      // 5. Verify updated order in database
      const updatedDbOrder = await prisma.order.findUnique({
        where: { id: orderResult.orderId },
      });

      expect(updatedDbOrder).toEqual(
        expect.objectContaining({
          status: "Filled",
          filledQuantity: 100000,
          averagePrice: 1.1,
        })
      );

      // 6. Verify updated order in Redis cache
      const updatedCachedOrder = await redis.get(
        `order:${orderResult.orderId}`
      );

      expect(JSON.parse(updatedCachedOrder)).toEqual(
        expect.objectContaining({
          status: "Filled",
          filledQuantity: 100000,
          averagePrice: 1.1,
        })
      );
    });
  });
});
