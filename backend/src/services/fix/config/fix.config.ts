import { FixConfig } from "../../../types/fix/config";

// Default configuration
const defaultConfig: FixConfig = {
  pricing: {
    host: process.env.FIX_PRICING_HOST || "cntuk.centroidsol.com",
    port: parseInt(process.env.FIX_PRICING_PORT || "43510", 10),
    senderCompID: process.env.FIX_PRICING_SENDER || "CLIENT",
    targetCompID: process.env.FIX_PRICING_TARGET || "SERVER",
    username: process.env.FIX_PRICING_USERNAME || "username",
    password: process.env.FIX_PRICING_PASSWORD || "password",
    useSSL: process.env.FIX_PRICING_USE_SSL === "true",
    resetOnLogon: process.env.FIX_PRICING_RESET_ON_LOGON === "true",
    sessionStartTime: process.env.FIX_PRICING_SESSION_START_TIME || "00:00:00",
    sessionEndTime: process.env.FIX_PRICING_SESSION_END_TIME || "23:59:59",
    heartbeatInterval: parseInt(
      process.env.FIX_PRICING_HEARTBEAT_INTERVAL || "30",
      10
    ),
    fixVersion: process.env.FIX_PRICING_VERSION || "FIX.4.2",
  },
  trading: {
    host: process.env.FIX_TRADING_HOST || "cntuk.centroidsol.com",
    port: parseInt(process.env.FIX_TRADING_PORT || "43511", 10),
    senderCompID: process.env.FIX_TRADING_SENDER || "CLIENT",
    targetCompID: process.env.FIX_TRADING_TARGET || "SERVER",
    username: process.env.FIX_TRADING_USERNAME || "username",
    password: process.env.FIX_TRADING_PASSWORD || "password",
    useSSL: process.env.FIX_TRADING_USE_SSL === "true",
    resetOnLogon: process.env.FIX_TRADING_RESET_ON_LOGON === "true",
    sessionStartTime: process.env.FIX_TRADING_SESSION_START_TIME || "00:00:00",
    sessionEndTime: process.env.FIX_TRADING_SESSION_END_TIME || "23:59:59",
    heartbeatInterval: parseInt(
      process.env.FIX_TRADING_HEARTBEAT_INTERVAL || "30",
      10
    ),
    fixVersion: process.env.FIX_TRADING_VERSION || "FIX.4.2",
  },
};

// LD4 (London) server configuration
const ld4Config: FixConfig = {
  pricing: {
    ...defaultConfig.pricing,
    host: process.env.FIX_LD4_PRICING_HOST || "ld4.centroidsol.com",
    port: parseInt(process.env.FIX_LD4_PRICING_PORT || "43510", 10),
    fixVersion: process.env.FIX_LD4_PRICING_VERSION || "FIX.4.2",
  },
  trading: {
    ...defaultConfig.trading,
    host: process.env.FIX_LD4_TRADING_HOST || "ld4.centroidsol.com",
    port: parseInt(process.env.FIX_LD4_TRADING_PORT || "43511", 10),
    fixVersion: process.env.FIX_LD4_TRADING_VERSION || "FIX.4.2",
  },
};

// NY4 (New York) server configuration
const ny4Config: FixConfig = {
  pricing: {
    ...defaultConfig.pricing,
    host: process.env.FIX_NY4_PRICING_HOST || "ny4.centroidsol.com",
    port: parseInt(process.env.FIX_NY4_PRICING_PORT || "43510", 10),
    fixVersion: process.env.FIX_NY4_PRICING_VERSION || "FIX.4.2",
  },
  trading: {
    ...defaultConfig.trading,
    host: process.env.FIX_NY4_TRADING_HOST || "ny4.centroidsol.com",
    port: parseInt(process.env.FIX_NY4_TRADING_PORT || "43511", 10),
    fixVersion: process.env.FIX_NY4_TRADING_VERSION || "FIX.4.2",
  },
};

// Select configuration based on environment variable
const serverLocation = process.env.FIX_SERVER_LOCATION || "default";
let selectedConfig: FixConfig;

switch (serverLocation.toLowerCase()) {
  case "ld4":
    selectedConfig = ld4Config;
    break;
  case "ny4":
    selectedConfig = ny4Config;
    break;
  default:
    selectedConfig = defaultConfig;
}

export const fixConfig: FixConfig = selectedConfig;
