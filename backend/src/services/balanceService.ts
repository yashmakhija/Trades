import { PrismaClient, BalanceType } from "@prisma/client";
import { WebSocketServer } from "ws";
import { broadcastBalanceUpdate } from "./webSocketService";

const prisma = new PrismaClient();

// Conversion helpers
const toDisplayAmount = (amount: number) => amount / 100;
const toStorageAmount = (amount: number) => Math.round(amount * 100);

export interface Balance {
  total: number;
  available: number;
  reserved: number;
  updatedAt: Date;
}

export interface BalanceHistory {
  id: string;
  userId: string;
  amount: number;
  type: BalanceType;
  description: string;
  orderId?: string;
  createdAt: Date;
}

export interface BalanceReservation {
  orderId: string;
  symbol: string;
  amount: number;
  type: "BUY" | "SELL";
  createdAt: Date;
}

export interface PaginatedBalanceHistory {
  history: BalanceHistory[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    perPage: number;
  };
}

class BalanceService {
  private wss: WebSocketServer | null = null;

  setWebSocketServer(wss: WebSocketServer) {
    this.wss = wss;
  }

  async getUserBalance(userId: string): Promise<Balance> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: { status: "OPEN" },
          select: { reservedAmount: true },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const reservedAmount = user.orders.reduce(
      (sum, order) => sum + (order.reservedAmount || 0),
      0
    );

    return {
      total: toDisplayAmount(user.usdcBalance),
      available: toDisplayAmount(user.usdcBalance - reservedAmount),
      reserved: toDisplayAmount(reservedAmount),
      updatedAt: user.updatedAt,
    };
  }

  async getBalanceHistory(
    userId: string,
    page: number = 1,
    limit: number = 50,
    startDate?: Date,
    endDate?: Date
  ): Promise<PaginatedBalanceHistory> {
    const where = {
      userId,
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {}),
    };

    const [history, total] = await Promise.all([
      prisma.balanceHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.balanceHistory.count({ where }),
    ]);

    const pages = Math.ceil(total / limit);

    return {
      history: history.map((h) => ({
        ...h,
        amount: toDisplayAmount(h.amount),
        orderId: h.orderId || undefined,
      })),
      pagination: {
        total,
        pages,
        currentPage: page,
        perPage: limit,
      },
    };
  }

  async getReservedBalance(userId: string): Promise<{
    totalReserved: number;
    reservations: BalanceReservation[];
  }> {
    const openOrders = await prisma.order.findMany({
      where: {
        userId,
        status: "OPEN",
      },
      select: {
        id: true,
        symbol: true,
        reservedAmount: true,
        type: true,
        createdAt: true,
      },
    });

    const reservations = openOrders.map((order) => ({
      orderId: order.id,
      symbol: order.symbol,
      amount: order.reservedAmount ? toDisplayAmount(order.reservedAmount) : 0,
      type: order.type,
      createdAt: order.createdAt,
    }));

    const totalReserved = reservations.reduce(
      (sum, res) => sum + res.amount,
      0
    );

    return {
      totalReserved,
      reservations: reservations as unknown as BalanceReservation[],
    };
  }

  async updateBalance(
    userId: string,
    amount: number,
    type: BalanceType,
    description: string,
    orderId?: string
  ): Promise<Balance> {
    const storageAmount = toStorageAmount(amount);

    const result = await prisma.$transaction(async (tx) => {
      // Update user balance
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          usdcBalance: {
            increment: storageAmount,
          },
        },
      });

      // Create balance history entry
      await tx.balanceHistory.create({
        data: {
          userId,
          amount: storageAmount,
          type,
          description,
          orderId,
        },
      });

      return user;
    });

    const balance = await this.getUserBalance(userId);

    // Broadcast balance update
    if (this.wss) {
      broadcastBalanceUpdate(userId, balance);
    }

    return balance;
  }

  async reserveBalance(
    userId: string,
    amount: number,
    orderId: string,
    description: string
  ): Promise<void> {
    const storageAmount = toStorageAmount(amount);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.usdcBalance < storageAmount) {
      throw new Error("Insufficient balance");
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        reservedAmount: storageAmount,
      },
    });

    // Create balance history entry for reservation
    await this.updateBalance(
      userId,
      -amount,
      BalanceType.TRADE_OPEN,
      description,
      orderId
    );
  }

  async releaseReservedBalance(
    userId: string,
    orderId: string,
    description: string
  ): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { reservedAmount: true },
    });

    if (order?.reservedAmount) {
      // Create balance history entry for release
      await this.updateBalance(
        userId,
        toDisplayAmount(order.reservedAmount),
        BalanceType.TRADE_CANCEL,
        description,
        orderId
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        reservedAmount: 0,
      },
    });
  }
}

export const balanceService = new BalanceService();
