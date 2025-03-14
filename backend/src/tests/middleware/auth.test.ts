/**
 * Authentication Middleware Tests
 *
 * Tests for the authentication middleware functionality.
 */
import { describe, it, expect, mock } from "bun:test";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth";
import jwt from "jsonwebtoken";
import { config } from "../../config";

// Mock the Prisma client
mock.module("../../server", () => ({
  prisma: {
    user: {
      findUnique: mock.fn(),
    },
  },
}));

// Import the mocked modules
import { prisma } from "../../server";

describe("Authentication Middleware", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  };

  const mockToken = jwt.sign(
    { userId: mockUser.id, email: mockUser.email },
    config.jwtSecret as string,
    { expiresIn: config.jwtExpiresIn }
  );

  describe("authenticate", () => {
    it("should set req.user when valid token is provided", async () => {
      // Mock the Prisma findUnique to return a user
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      // Create mock request, response, and next function
      const req = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await authenticate(req as any, res as any, next);

      // Expect next to be called and req.user to be set
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user).toHaveProperty("userId", mockUser.id);
      expect(req.user).toHaveProperty("email", mockUser.email);
    });

    it("should return 401 when no token is provided", async () => {
      // Create mock request, response, and next function
      const req = {
        headers: {},
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await authenticate(req as any, res as any, next);

      // Expect response to be 401 and next not to be called
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when invalid token is provided", async () => {
      // Create mock request, response, and next function
      const req = {
        headers: {
          authorization: "Bearer invalid-token",
        },
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await authenticate(req as any, res as any, next);

      // Expect response to be 401 and next not to be called
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user does not exist", async () => {
      // Mock the Prisma findUnique to return null
      (prisma.user.findUnique as any).mockResolvedValue(null);

      // Create mock request, response, and next function
      const req = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await authenticate(req as any, res as any, next);

      // Expect response to be 401 and next not to be called
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuthenticate", () => {
    it("should set req.user when valid token is provided", async () => {
      // Mock the Prisma findUnique to return a user
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      // Create mock request, response, and next function
      const req = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await optionalAuthenticate(req as any, res as any, next);

      // Expect next to be called and req.user to be set
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user).toHaveProperty("userId", mockUser.id);
      expect(req.user).toHaveProperty("email", mockUser.email);
    });

    it("should call next without setting req.user when no token is provided", async () => {
      // Create mock request, response, and next function
      const req = {
        headers: {},
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await optionalAuthenticate(req as any, res as any, next);

      // Expect next to be called but req.user to be undefined
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("should call next without setting req.user when invalid token is provided", async () => {
      // Create mock request, response, and next function
      const req = {
        headers: {
          authorization: "Bearer invalid-token",
        },
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await optionalAuthenticate(req as any, res as any, next);

      // Expect next to be called but req.user to be undefined
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("should call next without setting req.user when user does not exist", async () => {
      // Mock the Prisma findUnique to return null
      (prisma.user.findUnique as any).mockResolvedValue(null);

      // Create mock request, response, and next function
      const req = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
        user: undefined,
      };
      const res = {
        status: mock.fn().mockReturnThis(),
        json: mock.fn(),
      };
      const next = mock.fn();

      // Call the middleware
      await optionalAuthenticate(req as any, res as any, next);

      // Expect next to be called but req.user to be undefined
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
