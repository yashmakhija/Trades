import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { balanceManager } from "../services/balanceManager";
import { prisma } from "../server";

const router = Router();

// Validation schemas
const querySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "Start date must be before or equal to end date",
    }
  );

// Get user balance with real-time asset values
router.get("/", authenticate, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: "unauthorized",
          message: "User not authenticated",
        },
      });
    }

    const balance = await balanceManager.getUserBalance(req.user.id);
    if (!balance) {
      return res.status(404).json({
        error: {
          code: "not_found",
          message: "Balance not found",
        },
      });
    }

    res.json(balance);
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({
      error: {
        code: "internal_error",
        message: "Failed to fetch balance",
      },
    });
  }
});

// Get balance history
router.get("/history", authenticate, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: "unauthorized",
          message: "User not authenticated",
        },
      });
    }

    const query = querySchema.parse(req.query);

    const history = await prisma.balanceHistory.findMany({
      where: {
        userId: req.user.id,
        ...(query.startDate && query.endDate
          ? {
              createdAt: {
                gte: query.startDate,
                lte: query.endDate,
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        order: {
          include: {
            symbol: true,
          },
        },
      },
    });

    const total = await prisma.balanceHistory.count({
      where: {
        userId: req.user.id,
        ...(query.startDate && query.endDate
          ? {
              createdAt: {
                gte: query.startDate,
                lte: query.endDate,
              },
            }
          : {}),
      },
    });

    // Enrich history with current position data
    const balance = await balanceManager.getUserBalance(req.user.id);
    const positions = balance?.positions || [];
    const positionsMap = new Map(positions.map((p) => [p.orderId, p]));

    const enrichedHistory = history.map((entry) => {
      const position = entry.orderId ? positionsMap.get(entry.orderId) : null;
      return {
        id: entry.id,
        amount: entry.amount,
        type: entry.type,
        description: entry.description,
        createdAt: entry.createdAt,
        orderId: entry.orderId,
        symbol: entry.order?.symbol.name,
        currentPrice:
          position?.currentPrice ?? entry.order?.symbol.currentPrice ?? null,
        orderType: entry.order?.type,
        orderStatus: entry.order?.status,
        quantity: entry.order?.quantity,
        price: entry.order?.price,
        pnl: position?.pnl ?? null,
      };
    });

    res.json({
      history: enrichedHistory,
      pagination: {
        total,
        pages: Math.ceil(total / query.limit),
        currentPage: query.page,
        perPage: query.limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: "validation_error",
          message: "Invalid query parameters",
          details: error.errors,
        },
      });
    }

    console.error("Error fetching balance history:", error);
    res.status(500).json({
      error: {
        code: "internal_error",
        message: "Failed to fetch balance history",
      },
    });
  }
});

// Get reserved balance details with real-time values
router.get("/reserved", authenticate, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: "unauthorized",
          message: "User not authenticated",
        },
      });
    }

    const balance = await balanceManager.getUserBalance(req.user.id);
    if (!balance) {
      return res.status(404).json({
        error: {
          code: "not_found",
          message: "Balance not found",
        },
      });
    }

    const { positions } = balance;
    const totalReserved = balance.reserved;
    const totalCurrentValue = positions.reduce(
      (sum, pos) => sum + pos.quantity * pos.currentPrice,
      0
    );
    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);

    res.json({
      totalReserved,
      totalCurrentValue,
      totalPnl,
      positions,
    });
  } catch (error) {
    console.error("Error fetching reserved balance:", error);
    res.status(500).json({
      error: {
        code: "internal_error",
        message: "Failed to fetch reserved balance",
      },
    });
  }
});

export default router;
