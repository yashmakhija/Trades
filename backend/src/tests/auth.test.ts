/**
 * Authentication Routes Tests
 *
 * Tests for user registration, login, and profile retrieval.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { app } from "../index";
import { prisma } from "../server";
import supertest from "supertest";

const request = supertest(app);

describe("Authentication API", () => {
  let authToken: string;
  let userId: string;

  // Clean up test data after all tests
  afterAll(async () => {
    // Delete test user if it exists
    await prisma.user.deleteMany({
      where: {
        email: "test@example.com",
      },
    });
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const response = await request.post("/api/auth/register").send({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email", "test@example.com");
      expect(response.body.user).toHaveProperty("name", "Test User");
      expect(response.body.user).toHaveProperty("usdcBalance");

      // Save token and userId for later tests
      authToken = response.body.token;
      userId = response.body.user.id;
    });

    it("should return 400 if email is missing", async () => {
      const response = await request.post("/api/auth/register").send({
        password: "Password123!",
        name: "Test User",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 if password is missing", async () => {
      const response = await request.post("/api/auth/register").send({
        email: "test2@example.com",
        name: "Test User",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 if user already exists", async () => {
      const response = await request.post("/api/auth/register").send({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "User already exists");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login an existing user", async () => {
      const response = await request.post("/api/auth/login").send({
        email: "test@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email", "test@example.com");

      // Update token for later tests
      authToken = response.body.token;
    });

    it("should return 400 if email is missing", async () => {
      const response = await request.post("/api/auth/login").send({
        password: "Password123!",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 if password is missing", async () => {
      const response = await request.post("/api/auth/login").send({
        email: "test@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 if credentials are invalid", async () => {
      const response = await request.post("/api/auth/login").send({
        email: "test@example.com",
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid credentials");
    });

    it("should return 401 if user does not exist", async () => {
      const response = await request.post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid credentials");
    });
  });

  describe("GET /api/auth/profile", () => {
    it("should return user profile when authenticated", async () => {
      const response = await request
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id", userId);
      expect(response.body.user).toHaveProperty("email", "test@example.com");
      expect(response.body.user).toHaveProperty("name", "Test User");
      expect(response.body.user).toHaveProperty("usdcBalance");
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request.get("/api/auth/profile");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });
});
