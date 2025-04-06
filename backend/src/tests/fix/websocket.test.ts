import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { io as Client } from "socket.io-client";
import { FixService } from "../../services/fix/fixService";
import { fixConfig } from "../../config/fix.config";
import { AddressInfo } from "net";
import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";

interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
}

interface OrderUpdate {
  orderId: string;
  clientOrderId: string;
  status: string;
  filledQuantity: number;
  remainingQuantity: number;
  averagePrice: number;
}

interface PositionUpdate {
  symbol: string;
  quantity: number;
  averagePrice: number;
}

describe("WebSocket Integration", () => {
  let ioServer: Server;
  let serverSocket: Socket;
  let clientSocket: ReturnType<typeof Client>;
  let httpServer: any;
  let fixService: jest.Mocked<FixService>;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;
      clientSocket = Client(`http://localhost:${port}`);
      ioServer.on("connection", (socket) => {
        serverSocket = socket;
      });
      clientSocket.on("connect", done);
    });
  });

  beforeEach(() => {
    // Initialize FixService
    fixService = new FixService(fixConfig) as jest.Mocked<FixService>;
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
    httpServer.close();
  });

  describe("Market Data Updates", () => {
    it("should emit market data updates to connected clients", (done) => {
      const marketData: MarketData = {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.2,
        timestamp: new Date().toISOString(),
      };

      clientSocket.on("marketData", (data: MarketData) => {
        expect(data).toEqual(marketData);
        done();
      });

      fixService.emit("marketData", marketData);
    });
  });

  describe("Order Updates", () => {
    it("should emit order status updates to connected clients", (done) => {
      const orderUpdate: OrderUpdate = {
        orderId: "12345",
        clientOrderId: "CLIENT-123",
        status: "FILLED",
        filledQuantity: 100000,
        remainingQuantity: 0,
        averagePrice: 1.1,
      };

      clientSocket.on("orderUpdate", (data: OrderUpdate) => {
        expect(data).toEqual(orderUpdate);
        done();
      });

      fixService.emit("orderUpdate", orderUpdate);
    });
  });

  describe("Position Updates", () => {
    it("should emit position updates to connected clients", (done) => {
      const positionUpdate: PositionUpdate = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
      };

      clientSocket.on("positionUpdate", (data: PositionUpdate) => {
        expect(data).toEqual(positionUpdate);
        done();
      });

      fixService.emit("positionUpdate", positionUpdate);
    });
  });

  describe("Connection Management", () => {
    it("should handle client disconnection", (done) => {
      clientSocket.disconnect();
      setTimeout(() => {
        expect(serverSocket.connected).toBe(false);
        done();
      }, 100);
    });

    it("should handle client reconnection", (done) => {
      clientSocket.connect();
      setTimeout(() => {
        expect(serverSocket.connected).toBe(true);
        done();
      }, 100);
    });
  });

  describe("Error Handling", () => {
    it("should emit errors to connected clients", (done) => {
      const error = new Error("FIX service error");

      clientSocket.on("error", (data: { message: string }) => {
        expect(data).toEqual({ message: "FIX service error" });
        done();
      });

      fixService.emit("error", error);
    });
  });
});
