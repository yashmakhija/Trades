import { FixMessage } from "../../../types/fix/config";

interface MarketDataFields {
  msgType: string;
  senderCompID: string;
  targetCompID: string;
  msgSeqNum: string;
  sendingTime: string;
  MDReqID: string;
  SubscriptionRequestType: string;
  MarketDepth: string;
  MDUpdateType: string;
  NoMDEntryTypes: string;
  MDEntryType: string;
  Symbol: string;
  SecurityType: string;
  SecurityExchange: string;
  rawMessage: string;
  parsedMessage: Record<string, string>;
}

interface OrderFields {
  msgType: string;
  senderCompID: string;
  targetCompID: string;
  msgSeqNum: string;
  sendingTime: string;
  ClOrdID: string;
  Symbol: string;
  Side: string;
  TransactTime: string;
  OrdType: string;
  OrderQty: string;
  TimeInForce: string;
  Price?: string;
  StopPx?: string;
  rawMessage: string;
  parsedMessage: Record<string, string>;
}

export class FixMessageUtils {
  private static readonly SOH = "\x01";
  private static readonly REQUIRED_FIELDS = [
    "8",
    "9",
    "35",
    "49",
    "56",
    "34",
    "52",
  ];

  static formatMessage(message: FixMessage): string {
    const fields = new Map<string, string>();

    // Convert message to fields
    Object.entries(message).forEach(([key, value]) => {
      if (typeof value === "string" || typeof value === "number") {
        fields.set(key, value.toString());
      }
    });

    // Ensure required fields
    this.REQUIRED_FIELDS.forEach((field) => {
      if (!fields.has(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    });

    // Build message string
    const messageStr = Array.from(fields.entries())
      .map(([tag, value]) => `${tag}=${value}`)
      .join(this.SOH);

    // Calculate and append checksum
    const checksum = this.calculateChecksum(messageStr);
    return `${messageStr}${this.SOH}10=${checksum}${this.SOH}`;
  }

  static parseMessage(rawMessage: string): FixMessage {
    const fields = rawMessage.split(this.SOH);
    const parsedFields: Record<string, string> = {};

    fields.forEach((field) => {
      const [tag, value] = field.split("=");
      if (tag && value) {
        parsedFields[tag] = value;
      }
    });

    return {
      msgType: parsedFields["35"] || "",
      senderCompID: parsedFields["49"] || "",
      targetCompID: parsedFields["56"] || "",
      msgSeqNum: parseInt(parsedFields["34"] || "0", 10),
      sendingTime: parsedFields["52"] || "",
      rawMessage,
      parsedMessage: parsedFields,
      ...parsedFields,
    };
  }

  private static calculateChecksum(message: string): string {
    const sum = message
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (sum % 256).toString().padStart(3, "0");
  }

  public static createMarketDataRequest(symbol: string): string {
    const fields: MarketDataFields = {
      msgType: "V",
      senderCompID: "MD_FX_Squad",
      targetCompID: "CENTROID_SOL",
      msgSeqNum: "1",
      sendingTime: new Date().toISOString(),
      MDReqID: `MD_${Date.now()}`,
      SubscriptionRequestType: "1",
      MarketDepth: "0",
      MDUpdateType: "0",
      NoMDEntryTypes: "2",
      MDEntryType: "0",
      Symbol: symbol,
      SecurityType: "CURRENCY",
      SecurityExchange: "FX",
      rawMessage: "",
      parsedMessage: {},
    };

    const formattedMessage = this.formatMessage(
      fields as unknown as FixMessage
    );
    fields.rawMessage = formattedMessage;
    fields.parsedMessage = this.parseMessage(formattedMessage).parsedMessage;
    return formattedMessage;
  }

  public static createNewOrderSingle(order: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
    quantity: number;
    price?: number;
    stopPrice?: number;
  }): string {
    const fields: OrderFields = {
      msgType: "D",
      senderCompID: "TD_FX_Squad",
      targetCompID: "CENTROID_SOL",
      msgSeqNum: "1",
      sendingTime: new Date().toISOString(),
      ClOrdID: `ORDER_${Date.now()}`,
      Symbol: order.symbol,
      Side: order.side === "BUY" ? "1" : "2",
      TransactTime: new Date().toISOString(),
      OrdType: this.mapOrderType(order.type),
      OrderQty: order.quantity.toString(),
      TimeInForce: "1", // GTC
      rawMessage: "",
      parsedMessage: {},
    };

    if (order.price) {
      fields.Price = order.price.toString();
    }

    if (order.stopPrice) {
      fields.StopPx = order.stopPrice.toString();
    }

    const formattedMessage = this.formatMessage(
      fields as unknown as FixMessage
    );
    fields.rawMessage = formattedMessage;
    fields.parsedMessage = this.parseMessage(formattedMessage).parsedMessage;
    return formattedMessage;
  }

  private static mapOrderType(type: string): string {
    switch (type) {
      case "MARKET":
        return "1";
      case "LIMIT":
        return "2";
      case "STOP":
        return "3";
      case "STOP_LIMIT":
        return "4";
      default:
        throw new Error(`Unknown order type: ${type}`);
    }
  }
}
