import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { FixService } from "../../services/fix/FixService";
import { fixConfig } from "../../services/fix/config/fix.config";
import { FixLogger } from "../../services/fix/utils/FixLogger";

const logger = new FixLogger();

describe("FIX Connection Tests", () => {
  let fixService: FixService;

  beforeAll(async () => {
    // Ensure license key is set
    if (!process.env.FIXPARSER_LICENSE_KEY) {
      throw new Error("FIXPARSER_LICENSE_KEY environment variable is not set");
    }

    logger.logInfo("Starting FIX connection tests");
    logger.logInfo(
      `Server Location: ${process.env.FIX_SERVER_LOCATION || "default"}`
    );
    logger.logInfo(
      `Pricing Server: ${fixConfig.pricing.host}:${fixConfig.pricing.port}`
    );
    logger.logInfo(
      `Trading Server: ${fixConfig.trading.host}:${fixConfig.trading.port}`
    );

    fixService = new FixService(fixConfig);
  }, 300000); // 5 minutes timeout

  afterAll(async () => {
    logger.logInfo("Cleaning up FIX connections");
    await fixService.disconnect();
  }, 300000);

  it("should connect to pricing service", async () => {
    try {
      await fixService.initialize();
      const isConnected = await fixService.isConnected("PRICING");
      expect(isConnected).toBe(true);
    } catch (error) {
      logger.logError("Pricing connection error:", error as Error);
      throw error;
    }
  }, 300000);

  it("should connect to trading service", async () => {
    try {
      const isConnected = await fixService.isConnected("TRADING");
      expect(isConnected).toBe(true);
    } catch (error) {
      logger.logError("Trading connection error:", error as Error);
      throw error;
    }
  }, 300000);

  it("should handle connection retry logic", async () => {
    try {
      // Force disconnect
      await fixService.disconnect("PRICING");

      // Attempt reconnect
      await fixService.initialize();
      const isConnected = await fixService.isConnected("PRICING");
      expect(isConnected).toBe(true);
    } catch (error) {
      logger.logError("Connection retry error:", error as Error);
      throw error;
    }
  }, 300000);
});
