import { describe, it, expect, beforeEach, mock } from "bun:test";
import { PrismaClient, OrderStatus, OrderType } from "@prisma/client";
import { prisma } from "../../lib/prisma";

interface Order {
  id: string;
  symbolId: string;
  userId: string;
  stopLoss?: number;
  takeProfit?: number;
  price: number;
  quantity: number;
  exitPrice?: number;
  pnl?: number;
  status: OrderStatus;
  type: OrderType;
  isShort: boolean;
  parentOrderId?: string;
  reservedAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

// Mock PrismaClient
const mockTransaction = mock(() => Promise.resolve());

const mockPrismaClient = {
  order: {
    create: mock((data: any) =>
      Promise.resolve({
        id: "12345",
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    update: mock((data: any) =>
      Promise.resolve({
        id: "12345",
        ...data.data,
        updatedAt: new Date(),
      })
    ),
    findUnique: mock((data: any) =>
      Promise.resolve({
        id: "12345",
        symbolId: "sym-1",
        userId: "user-1",
        stopLoss: null,
        takeProfit: null,
        price: 110000,
        quantity: 100000,
        exitPrice: null,
        pnl: null,
        status: OrderStatus.PENDING,
        type: OrderType.BUY,
        isShort: false,
        parentOrderId: null,
        reservedAmount: 110000000,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      })
    ),
    findMany: mock(() =>
      Promise.resolve([
        {
          id: "12345",
          symbolId: "sym-1",
          userId: "user-1",
          stopLoss: null,
          takeProfit: null,
          price: 110000,
          quantity: 100000,
          exitPrice: null,
          pnl: null,
          status: OrderStatus.PENDING,
          type: OrderType.BUY,
          isShort: false,
          parentOrderId: null,
          reservedAmount: 110000000,
          createdAt: new Date(),
          updatedAt: new Date(),
          closedAt: null,
        },
      ])
    ),
  },
  $transaction: mockTransaction,
};

// Mock the PrismaClient constructor
mock.module("@prisma/client", () => ({
  PrismaClient: mock(() => mockPrismaClient),
}));

describe("Database Operations", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("Order Management", () => {
    it("should create a new order", async () => {
      const orderData = {
        symbolId: "sym-1",
        userId: "user-1",
        price: 110000,
        quantity: 100000,
        type: OrderType.BUY,
        status: OrderStatus.PENDING,
        isShort: false,
        reservedAmount: 110000000,
      };

      const order = await prisma.order.create({
        data: orderData,
      });

      expect(order).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          ...orderData,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should update an order", async () => {
      const orderId = "12345";
      const updateData = {
        status: OrderStatus.FILLED,
        exitPrice: 115000,
        pnl: 500000,
        closedAt: new Date(),
      };

      const order = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      expect(order).toEqual(
        expect.objectContaining({
          id: orderId,
          ...updateData,
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should find an order by ID", async () => {
      const orderId = "12345";

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(order).toEqual(
        expect.objectContaining({
          id: orderId,
          symbolId: "sym-1",
          userId: "user-1",
          price: 110000,
          quantity: 100000,
          type: OrderType.BUY,
          status: OrderStatus.PENDING,
          isShort: false,
          reservedAmount: 110000000,
        })
      );
    });

    it("should find all orders", async () => {
      const orders = await prisma.order.findMany();

      expect(orders).toHaveLength(1);
      expect(orders[0]).toEqual(
        expect.objectContaining({
          id: "12345",
          symbolId: "sym-1",
          userId: "user-1",
          price: 110000,
          quantity: 100000,
          type: OrderType.BUY,
          status: OrderStatus.PENDING,
          isShort: false,
          reservedAmount: 110000000,
        })
      );
    });
  });

  describe("Transaction Management", () => {
    it("should handle transactions", async () => {
      const result = await prisma.$transaction([
        prisma.order.create({
          data: {
            symbolId: "sym-1",
            userId: "user-1",
            price: 110000,
            quantity: 100000,
            type: OrderType.BUY,
            status: OrderStatus.PENDING,
            isShort: false,
            reservedAmount: 110000000,
          },
        }),
        prisma.order.update({
          where: { id: "12345" },
          data: {
            status: OrderStatus.FILLED,
            exitPrice: 115000,
            pnl: 500000,
            closedAt: new Date(),
          },
        }),
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          symbolId: "sym-1",
          userId: "user-1",
          type: OrderType.BUY,
        })
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          status: OrderStatus.FILLED,
          exitPrice: 115000,
          pnl: 500000,
        })
      );
    });
  });
});
