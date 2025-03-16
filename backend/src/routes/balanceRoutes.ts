import { Router } from "express";
import { z } from "zod";
import { balanceService } from "../services/balanceService";
import { authenticateToken } from "../middlewares/auth";
import { validateRequest } from "../middlewares/validate";

const router = Router();

// Validation schemas
const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Get user balance
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const balance = await balanceService.getUserBalance(req.user!.id);
    res.json(balance);
  } catch (error) {
    next(error);
  }
});

// Get balance history
router.get(
  "/history",
  authenticateToken,
  validateRequest({ query: querySchema }),
  async (req, res, next) => {
    try {
      const { page, limit, startDate, endDate } = req.query;

      // Validate date range
      if (
        startDate &&
        endDate &&
        new Date(startDate as string) > new Date(endDate as string)
      ) {
        return res.status(400).json({
          error: {
            code: "validation_error",
            message: "Start date must be before or equal to end date",
          },
        });
      }

      const history = await balanceService.getBalanceHistory(
        req.user!.id,
        Number(page),
        Number(limit),
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(history);
    } catch (error) {
      next(error);
    }
  }
);

// Get reserved balance details
router.get("/reserved", authenticateToken, async (req, res, next) => {
  try {
    const reservedBalance = await balanceService.getReservedBalance(
      req.user!.id
    );
    res.json(reservedBalance);
  } catch (error) {
    next(error);
  }
});

export default router;
