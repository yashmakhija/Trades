import { Router } from "express";
import {
  placeOrder,
  cancelOrder,
  getUserOrders,
  getUserPortfolio,
} from "../controllers/orderController";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.use(authenticate);

router.post("/", placeOrder);

router.delete("/:orderId", cancelOrder);

router.get("/", getUserOrders);

router.get("/portfolio", getUserPortfolio);

export default router;
