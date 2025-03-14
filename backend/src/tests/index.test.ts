/**
 * Main Test File
 *
 * This file imports and runs all tests in the project.
 * It ensures that all tests are executed when running the test command.
 */

// Import all test files
import "./auth.test";
import "./order.test";
import "./symbol.test";
import "./middleware/auth.test";
import "./services/orderManager.test";
import "./services/balanceManager.test";
import "./integration/trading-workflow.test";

// Add a simple test to verify the test runner is working
import { describe, it, expect } from "bun:test";

describe("Test Runner", () => {
  it("should run all tests", () => {
    expect(true).toBe(true);
  });
});
