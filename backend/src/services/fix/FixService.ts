import { FIXParser, Message, LicenseManager } from "fixparser";
import { FixConfig, FixMessage } from "../../types/fix/config";
import { FixLogger } from "./utils/FixLogger";
import net from "net";
import tls from "tls";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

export class FixService {
  private pricingSocket: net.Socket | null = null;
  private tradingSocket: tls.TLSSocket | null = null;
  private pricingParser: FIXParser | null = null;
  private tradingParser: FIXParser | null = null;
  private readonly config: FixConfig;
  private readonly logger: FixLogger;
  private readonly CONNECTION_TIMEOUT = 120000; // 120 seconds
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY = 10000; // 10 seconds
  private readonly FIX_VERSIONS = ["FIX.4.2", "FIX.4.3", "FIX.4.4", "FIX.5.0"];
  private isConnecting: { [key: string]: boolean } = {};
  private connectionAttempts: { [key: string]: number } = {};
  private reconnectTimer: { [key: string]: NodeJS.Timeout | null } = {};
  private messageHandlers: {
    [key: string]: ((message: FixMessage) => void)[];
  } = {
    PRICING: [],
    TRADING: [],
  };

  constructor(config: FixConfig) {
    this.config = config;
    this.logger = new FixLogger();
    this.logger.logInfo("FixService initialized");
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.logInfo("Initializing FIX connections...");
      this.logger.logInfo(
        `Pricing Server: ${this.config.pricing.host}:${this.config.pricing.port} (SSL: ${this.config.pricing.useSSL})`
      );
      this.logger.logInfo(
        `Trading Server: ${this.config.trading.host}:${this.config.trading.port} (SSL: ${this.config.trading.useSSL})`
      );

      // Set license key
      const licenseKey = process.env.FIXPARSER_LICENSE_KEY;
      if (!licenseKey) {
        throw new Error(
          "FIXPARSER_LICENSE_KEY environment variable is not set"
        );
      }
      await LicenseManager.setLicenseKey(licenseKey);

      // Perform DNS lookup to verify server
      await this.performDNSLookup(this.config.pricing.host);
      await this.performDNSLookup(this.config.trading.host);

      // Connect with retry logic
      await this.connectWithRetry("PRICING", () => this.connectPricing());
      await this.connectWithRetry("TRADING", () => this.connectTrading());
    } catch (error) {
      this.logger.logError(
        "Failed to initialize FIX connections",
        error as Error
      );
      throw error;
    }
  }

  private async performDNSLookup(host: string): Promise<void> {
    try {
      this.logger.logInfo(`Performing DNS lookup for ${host}...`);
      const result = await dnsLookup(host);
      this.logger.logInfo(`DNS lookup result for ${host}: ${result.address}`);
    } catch (error) {
      this.logger.logError(`DNS lookup failed for ${host}`, error as Error);
      throw error;
    }
  }

  private async connectWithRetry(
    service: "PRICING" | "TRADING",
    connectFn: () => Promise<void>
  ): Promise<void> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.MAX_RETRIES) {
      try {
        this.logger.logInfo(
          `Attempting to connect to ${service} service (attempt ${retries + 1}/${this.MAX_RETRIES})...`
        );
        await connectFn();
        this.logger.logInfo(`Successfully connected to ${service} service`);
        return;
      } catch (error) {
        lastError = error as Error;
        retries++;
        this.logger.logError(
          `Failed to connect to ${service} service (attempt ${retries}/${this.MAX_RETRIES})`,
          error as Error
        );

        if (retries < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * Math.pow(2, retries - 1); // Exponential backoff
          this.logger.logInfo(
            `Retrying ${service} connection in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to connect to ${service} service after ${this.MAX_RETRIES} attempts. Last error: ${lastError?.message}`
    );
  }

  private async connectPricing(): Promise<void> {
    try {
      this.logger.logInfo("Attempting to connect to pricing service...");
      this.pricingParser = new FIXParser();
      this.pricingSocket = new net.Socket();

      // Set socket options
      this.pricingSocket.setKeepAlive(true, 60000);
      this.pricingSocket.setTimeout(this.CONNECTION_TIMEOUT);
      this.pricingSocket.setNoDelay(true); // Disable Nagle's algorithm for lower latency

      this.pricingSocket.on("connect", () => {
        this.logger.logInfo("Pricing socket connected successfully");
        this.logger.logConnection("PRICING", "connected");
        this.sendLogon("PRICING");
      });

      this.pricingSocket.on("data", (data: Buffer) => {
        this.logger.logInfo(
          `Received data from pricing service: ${data.length} bytes`
        );
        const messages = this.pricingParser?.parse(data.toString());
        if (messages) {
          messages.forEach((message) => {
            this.logger.logMessage(
              "PRICING",
              "incoming",
              message.toFIXJSON() as FixMessage
            );
          });
        }
      });

      this.pricingSocket.on("error", (error: Error) => {
        this.logger.logError("Pricing connection error", error);
        this.logger.logInfo(`Error details: ${error.message}`);
        if (error.stack) {
          this.logger.logInfo(`Stack trace: ${error.stack}`);
        }
      });

      this.pricingSocket.on("close", () => {
        this.logger.logInfo("Pricing socket closed");
        this.logger.logConnection("PRICING", "disconnected");
      });

      this.pricingSocket.on("timeout", () => {
        this.logger.logError(
          "Pricing connection timeout",
          new Error("Connection timeout")
        );
      });

      this.pricingSocket.on("end", () => {
        this.logger.logInfo("Pricing socket ended");
      });

      this.logger.logInfo("Attempting to establish pricing connection...");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, this.CONNECTION_TIMEOUT);

        this.pricingSocket?.connect(
          this.config.pricing.port,
          this.config.pricing.host,
          () => {
            clearTimeout(timeout);
            resolve();
          }
        );
      });

      this.logger.logConnection("PRICING", "ready");
    } catch (error) {
      this.logger.logError(
        "Failed to connect to pricing service",
        error as Error
      );
      this.logger.logConnection("PRICING", "reconnecting");
      throw error;
    }
  }

  private async connectTrading(): Promise<void> {
    try {
      this.logger.logInfo("Attempting to connect to trading service...");
      this.tradingParser = new FIXParser();

      const socket = new net.Socket();
      socket.setKeepAlive(true, 60000);
      socket.setTimeout(this.CONNECTION_TIMEOUT);
      socket.setNoDelay(true); // Disable Nagle's algorithm for lower latency

      this.tradingSocket = new tls.TLSSocket(socket, {
        rejectUnauthorized: false,
        enableTrace: true,
        secureProtocol: "TLSv1_2_method",
        ciphers: "HIGH:!aNULL:!MD5",
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.2",
      });

      this.tradingSocket.on("connect", () => {
        this.logger.logInfo("Trading socket connected successfully");
        this.logger.logConnection("TRADING", "connected");
        this.sendLogon("TRADING");
      });

      this.tradingSocket.on("data", (data: Buffer) => {
        this.logger.logInfo(
          `Received data from trading service: ${data.length} bytes`
        );
        const messages = this.tradingParser?.parse(data.toString());
        if (messages) {
          messages.forEach((message) => {
            this.logger.logMessage(
              "TRADING",
              "incoming",
              message.toFIXJSON() as FixMessage
            );
          });
        }
      });

      this.tradingSocket.on("error", (error: Error) => {
        this.logger.logError("Trading connection error", error);
        this.logger.logInfo(`Error details: ${error.message}`);
        if (error.stack) {
          this.logger.logInfo(`Stack trace: ${error.stack}`);
        }
      });

      this.tradingSocket.on("close", () => {
        this.logger.logInfo("Trading socket closed");
        this.logger.logConnection("TRADING", "disconnected");
      });

      this.tradingSocket.on("timeout", () => {
        this.logger.logError(
          "Trading connection timeout",
          new Error("Connection timeout")
        );
      });

      this.tradingSocket.on("end", () => {
        this.logger.logInfo("Trading socket ended");
      });

      this.logger.logInfo("Attempting to establish trading connection...");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, this.CONNECTION_TIMEOUT);

        socket.connect(
          this.config.trading.port,
          this.config.trading.host,
          () => {
            clearTimeout(timeout);
            resolve();
          }
        );
      });

      this.logger.logConnection("TRADING", "ready");
    } catch (error) {
      this.logger.logError(
        "Failed to connect to trading service",
        error as Error
      );
      this.logger.logConnection("TRADING", "reconnecting");
      throw error;
    }
  }

  private async sendLogon(service: "PRICING" | "TRADING"): Promise<void> {
    const config =
      service === "PRICING" ? this.config.pricing : this.config.trading;
    const socket =
      service === "PRICING" ? this.pricingSocket : this.tradingSocket;
    const parser =
      service === "PRICING" ? this.pricingParser : this.tradingParser;

    if (!socket || !parser) return;

    const logonMessage = new Message();
    logonMessage.setField(8, config.fixVersion); // BeginString
    logonMessage.setField(9, "0"); // BodyLength (will be calculated)
    logonMessage.setField(35, "A"); // MsgType (Logon)
    logonMessage.setField(49, config.sender); // SenderCompID
    logonMessage.setField(56, config.target); // TargetCompID
    logonMessage.setField(34, "1"); // MsgSeqNum
    logonMessage.setField(52, new Date().toISOString().replace(/[-:TZ]/g, '')); // SendingTime
    logonMessage.setField(98, "0"); // EncryptMethod (None)
    logonMessage.setField(108, config.heartbeatInterval.toString()); // HeartBtInt
    logonMessage.setField(141, config.resetOnLogon ? "Y" : "N"); // ResetSeqNumFlag
    logonMessage.setField(553, config.username); // Username
    logonMessage.setField(554, config.password); // Password
    logonMessage.setField(10, "0"); // CheckSum (will be calculated)

    const message = logonMessage.toString();
    socket.write(message + "\n");
    this.logger.logMessage(
      service,
      "outgoing",
      logonMessage.toFIXJSON() as FixMessage
    );
  }

  public async sendMessage(
    service: "PRICING" | "TRADING",
    message: FixMessage
  ): Promise<void> {
    const socket =
      service === "PRICING" ? this.pricingSocket : this.tradingSocket;
    const parser =
      service === "PRICING" ? this.pricingParser : this.tradingParser;

    if (!socket || !parser) {
      throw new Error(`${service} session is not connected`);
    }

    try {
      const fixMessage = new Message();
      Object.entries(message).forEach(([tag, value]) => {
        if (typeof value === "string" || typeof value === "number") {
          fixMessage.setField(parseInt(tag, 10), value.toString());
        }
      });

      const encodedMessage = fixMessage.toString();
      socket.write(encodedMessage + "\n");
      this.logger.logMessage(service, "outgoing", message);
    } catch (error) {
      this.logger.logError(
        `Failed to send message through ${service}`,
        error as Error
      );
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.pricingSocket) {
        this.pricingSocket.end();
        this.pricingSocket = null;
      }
      if (this.tradingSocket) {
        this.tradingSocket.end();
        this.tradingSocket = null;
      }
      this.logger.logConnection("all", "disconnected");
    } catch (error) {
      this.logger.logError("Failed to disconnect FIX sessions", error as Error);
      throw error;
    }
  }

  public isConnected(service: "PRICING" | "TRADING"): boolean {
    const socket =
      service === "PRICING" ? this.pricingSocket : this.tradingSocket;
    return socket?.writable || false;
  }
}
