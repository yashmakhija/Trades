import { EventEmitter } from "events";
import { FixMessage } from "../../../types/fix/config";
import { logger } from "../../../utils/logger";

export interface Order {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filledQuantity: number;
  averagePrice: number;
  timestamp: Date;
}

export type OrderStatus =
  | "NEW"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "REJECTED"
  | "EXPIRED";

export class TradingHandler extends EventEmitter {
  private orders: Map<string, Order> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on("message", this.handleMessage.bind(this));
  }

  public handleMessage(message: FixMessage): void {
    try {
      switch (message.msgType) {
        case "8": // Execution Report
          this.handleExecutionReport(message);
          break;
        case "9": // Order Cancel Reject
          this.handleOrderCancelReject(message);
          break;
        case "3": // Reject
          this.handleReject(message);
          break;
        default:
          logger.warn(`Unhandled message type: ${message.msgType}`);
      }
    } catch (error) {
      logger.error("Error handling trading message:", error);
    }
  }

  private handleExecutionReport(message: FixMessage): void {
    const orderId = message.parsedMessage.OrderID;
    const clientOrderId = message.parsedMessage.ClOrdID;
    const execType = message.parsedMessage.ExecType;
    const orderStatus = message.parsedMessage.OrdStatus;

    let order = this.orders.get(orderId);

    if (!order) {
      order = {
        orderId,
        clientOrderId,
        symbol: message.parsedMessage.Symbol,
        side: message.parsedMessage.Side === "1" ? "BUY" : "SELL",
        type: this.mapOrderType(message.parsedMessage.OrdType),
        quantity: parseFloat(message.parsedMessage.OrderQty),
        price: parseFloat(message.parsedMessage.Price),
        stopPrice: parseFloat(message.parsedMessage.StopPx),
        status: this.mapOrderStatus(orderStatus),
        filledQuantity: parseFloat(message.parsedMessage.CumQty),
        averagePrice: parseFloat(message.parsedMessage.AvgPx),
        timestamp: new Date(message.parsedMessage.TransactTime),
      };
    } else {
      order.status = this.mapOrderStatus(orderStatus);
      order.filledQuantity = parseFloat(message.parsedMessage.CumQty);
      order.averagePrice = parseFloat(message.parsedMessage.AvgPx);
    }

    this.orders.set(orderId, order);
    this.emit("orderUpdate", order);

    if (execType === "2" || execType === "3") {
      // Trade or Filled
      this.emit("orderFilled", order);
    }
  }

  private handleOrderCancelReject(message: FixMessage): void {
    const orderId = message.parsedMessage.OrderID;
    const order = this.orders.get(orderId);

    if (order) {
      order.status = "CANCELED";
      this.orders.set(orderId, order);
      this.emit("orderCanceled", order);
    }
  }

  private handleReject(message: FixMessage): void {
    const orderId = message.parsedMessage.OrderID;
    const order = this.orders.get(orderId);

    if (order) {
      order.status = "REJECTED";
      this.orders.set(orderId, order);
      this.emit("orderRejected", order);
    }
  }

  private mapOrderType(fixOrderType: string): Order["type"] {
    switch (fixOrderType) {
      case "1":
        return "MARKET";
      case "2":
        return "LIMIT";
      case "3":
        return "STOP";
      case "4":
        return "STOP_LIMIT";
      default:
        throw new Error(`Unknown order type: ${fixOrderType}`);
    }
  }

  private mapOrderStatus(fixOrderStatus: string): OrderStatus {
    switch (fixOrderStatus) {
      case "0":
        return "NEW";
      case "1":
        return "PARTIALLY_FILLED";
      case "2":
        return "FILLED";
      case "4":
        return "CANCELED";
      case "8":
        return "REJECTED";
      case "C":
        return "EXPIRED";
      default:
        throw new Error(`Unknown order status: ${fixOrderStatus}`);
    }
  }

  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  public getOrdersByStatus(status: OrderStatus): Order[] {
    return this.getAllOrders().filter((order) => order.status === status);
  }
}
