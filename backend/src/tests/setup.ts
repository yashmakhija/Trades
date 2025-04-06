import { beforeAll, afterAll } from "bun:test";

// Global test setup
beforeAll(() => {
  // Set up any global test configuration here
  process.env.NODE_ENV = "test";
});

// Global test cleanup
afterAll(() => {
  // Clean up any global test resources here
});
