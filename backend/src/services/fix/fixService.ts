import { EventEmitter } from "events";
import { FixClient } from "../../fix/FixClient";

interface FixServiceConfig {
  marketData: {
    host: string;
    port: number;
    senderCompID: string;
    targetCompID: string;
    username: string;
    password: string;
    ssl: boolean;
    resetOnLogon: boolean;
  };
  trading: {
    host: string;
    port: number;
    senderCompID: string;
    targetCompID: string;
    username: string;
    password: string;
    ssl: boolean;
    resetOnLogon: boolean;
  };
}

export class FixService extends EventEmitter {
  private marketDataClient: FixClient;
  private tradingClient: FixClient;
  private marketDataConnected: boolean = false;
  private tradingConnected: boolean = false;

  constructor(config: FixServiceConfig) {
    super();
    this.marketDataClient = new FixClient(config.marketData);
    this.tradingClient = new FixClient(config.trading);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Market Data Client Events
    this.marketDataClient.on("logon", () => {
      console.log("Market Data session logged on");
      this.marketDataConnected = true;
      this.emit("marketDataConnected");
    });

    this.marketDataClient.on("disconnected", () => {
      console.log("Market Data session disconnected");
      this.marketDataConnected = false;
      this.emit("marketDataDisconnected");
    });

    this.marketDataClient.on("error", (error: Error) => {
      console.error("Market Data session error:", error);
      this.emit("marketDataError", error);
    });

    this.marketDataClient.on("message", (fields: Map<string, string>) => {
      const msgType = fields.get("35");
      if (msgType === "W") {
        // Market Data Snapshot Full Refresh
        this.handleMarketData(fields);
      }
    });

    // Trading Client Events
    this.tradingClient.on("logon", () => {
      console.log("Trading session logged on");
      this.tradingConnected = true;
      this.emit("tradingConnected");
    });

    this.tradingClient.on("disconnected", () => {
      console.log("Trading session disconnected");
      this.tradingConnected = false;
      this.emit("tradingDisconnected");
    });

    this.tradingClient.on("error", (error: Error) => {
      console.error("Trading session error:", error);
      this.emit("tradingError", error);
    });

    this.tradingClient.on("message", (fields: Map<string, string>) => {
      const msgType = fields.get("35");
      if (msgType === "8") {
        // Execution Report
        this.handleExecutionReport(fields);
      }
    });
  }

  private handleMarketData(fields: Map<string, string>): void {
    const symbol = fields.get("55");
    const bid = fields.get("132");
    const ask = fields.get("133");
    const bidSize = fields.get("134");
    const askSize = fields.get("135");
    const lastPrice = fields.get("31");
    const lastSize = fields.get("32");

    if (symbol && bid && ask) {
      this.emit("marketData", {
        symbol,
        bid: parseFloat(bid),
        ask: parseFloat(ask),
        bidSize: bidSize ? parseFloat(bidSize) : undefined,
        askSize: askSize ? parseFloat(askSize) : undefined,
        lastPrice: lastPrice ? parseFloat(lastPrice) : undefined,
        lastSize: lastSize ? parseFloat(lastSize) : undefined,
        timestamp: new Date(),
      });
    }
  }

  private handleExecutionReport(fields: Map<string, string>): void {
    const orderId = fields.get("37");
    const execId = fields.get("17");
    const execType = fields.get("150");
    const ordStatus = fields.get("39");
    const symbol = fields.get("55");
    const side = fields.get("54");
    const leavesQty = fields.get("151");
    const cumQty = fields.get("14");
    const avgPx = fields.get("6");

    if (orderId && execType && ordStatus) {
      this.emit("executionReport", {
        orderId,
        execId,
        execType,
        ordStatus,
        symbol,
        side,
        leavesQty: leavesQty ? parseFloat(leavesQty) : undefined,
        cumQty: cumQty ? parseFloat(cumQty) : undefined,
        avgPx: avgPx ? parseFloat(avgPx) : undefined,
        timestamp: new Date(),
      });
    }
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.marketDataClient.connect(),
        this.tradingClient.connect(),
      ]);
    } catch (error) {
      console.error("Failed to connect to FIX servers:", error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this.marketDataClient.disconnect();
    this.tradingClient.disconnect();
  }

  public subscribeMarketData(symbol: string): void {
    if (!this.marketDataConnected) {
      throw new Error("Market Data session not connected");
    }

    const fields = [
      ["8", "FIX.4.4"],
      ["9", "0"],
      ["35", "V"], // Market Data Request
      ["34", "1"],
      ["49", this.marketDataClient["config"].senderCompID],
      ["56", this.marketDataClient["config"].targetCompID],
      ["52", new Date().toISOString().replace(/[-:]/g, "").split(".")[0]],
      ["262", "1"], // MDReqID
      ["263", "1"], // SubscriptionRequestType (Snapshot + Updates)
      ["264", "1"], // MarketDepth
      ["265", "1"], // MDUpdateType (Full refresh)
      ["267", "1"], // NoMDEntryTypes
      ["269", "0"], // MDEntryType (Bid)
      ["267", "1"], // NoMDEntryTypes
      ["269", "1"], // MDEntryType (Offer)
      ["146", "1"], // NoRelatedSym
      ["55", symbol], // Symbol
      ["10", "0"],
    ];

    this.marketDataClient.sendMessage(this.formatFixMessage(fields));
  }

  public sendOrder(params: {
    symbol: string;
    side: "1" | "2"; // 1=Buy, 2=Sell
    quantity: number;
    price?: number;
    orderType: "1" | "2" | "3" | "4" | "5"; // 1=Market, 2=Limit, 3=Stop, 4=Stop Limit, 5=Market On Close
    timeInForce: "0" | "1" | "2" | "3" | "4" | "5" | "6"; // 0=Day, 1=GTC, 2=IOC, 3=FOK, 4=GTD, 5=At Open, 6=At Close
  }): void {
    if (!this.tradingConnected) {
      throw new Error("Trading session not connected");
    }

    const fields = [
      ["8", "FIX.4.4"],
      ["9", "0"],
      ["35", "D"], // New Order Single
      ["34", "1"],
      ["49", this.tradingClient["config"].senderCompID],
      ["56", this.tradingClient["config"].targetCompID],
      ["52", new Date().toISOString().replace(/[-:]/g, "").split(".")[0]],
      ["11", Date.now().toString()], // ClOrdID
      ["21", "1"], // HandlInst (Automated)
      ["55", params.symbol], // Symbol
      ["54", params.side], // Side
      ["60", new Date().toISOString().replace(/[-:]/g, "").split(".")[0]], // TransactTime
      ["40", params.orderType], // OrdType
      ["59", params.timeInForce], // TimeInForce
      ["38", params.quantity.toString()], // OrderQty
    ];

    if (params.price) {
      fields.push(["44", params.price.toString()]); // Price
    }

    fields.push(["10", "0"]); // Checksum placeholder

    this.tradingClient.sendMessage(this.formatFixMessage(fields));
  }

  private formatFixMessage(fields: string[][]): string {
    let message = "";
    let bodyLength = 0;
    const SOH = "\x01";

    // Add all fields except body length and checksum
    for (let i = 0; i < fields.length; i++) {
      if (fields[i][0] !== "9" && fields[i][0] !== "10") {
        message += `${fields[i][0]}=${fields[i][1]}${SOH}`;
        bodyLength += message.length;
      }
    }

    // Calculate and insert body length
    const bodyLengthField = `9=${bodyLength}${SOH}`;
    message = message.replace("9=0", bodyLengthField);

    // Calculate and insert checksum
    const checksum = this.calculateChecksum(message);
    message += `10=${checksum}${SOH}`;

    return message;
  }

  private calculateChecksum(message: string): string {
    let sum = 0;
    for (let i = 0; i < message.length; i++) {
      sum += message.charCodeAt(i);
    }
    return (sum % 256).toString().padStart(3, "0");
  }

  public getSessionStatus(): { marketData: boolean; trading: boolean } {
    return {
      marketData: this.marketDataConnected,
      trading: this.tradingConnected,
    };
  }
}
