import { Router } from "express";
import {
  register,
  login,
  getProfile,
  verifyToken,
} from "../controllers/authController";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.post("/register", register);

router.post("/login", login);

router.get("/verify", authenticate, verifyToken);

router.get("/profile", authenticate, getProfile);

export default router;
