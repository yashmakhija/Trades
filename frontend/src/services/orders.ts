import { ORDER_POLLING_INTERVAL_MS } from "@/config/index";
import { apiClient } from "@/lib/api/api-client";

// Order types
export type OrderSide = "BUY" | "SELL";
export type OrderType = "market" | "limit";
export type OrderStatus =
  | "OPEN"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED"
  | "CLOSED";

// Order interface
export interface Order {
  id: string;
  symbolId: string;
  type: OrderSide;
  price: number;
  quantity: number;
  status: OrderStatus;
  isShort: boolean;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

// Order creation parameters
export interface CreateOrderParams {
  symbolId: string;
  type: OrderSide;
  price: number;
  quantity: number;
  isShort: boolean;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * Fetch all orders for the current user
 */
export async function fetchOrders(): Promise<Order[]> {
  try {
    const response = await apiClient.get<{
      openOrders: unknown[];
      closedOrders: unknown[];
      balance: unknown;
    }>("/orders");

    if (
      typeof response !== "object" ||
      response === null ||
      !("openOrders" in response) ||
      !("closedOrders" in response)
    ) {
      console.error(
        "Expected object with openOrders and closedOrders but got:",
        response
      );
      return [];
    }

    const allOrders = [...response.openOrders, ...response.closedOrders];

    const validOrders = allOrders.filter((order): order is Order => {
      const isValid =
        typeof order === "object" &&
        order !== null &&
        "id" in order &&
        "symbolId" in order &&
        "type" in order &&
        "status" in order;

      if (!isValid) {
        console.warn("Received invalid order object:", order);
      }

      return isValid;
    });

    console.log("Received orders from backend:", validOrders);

    return validOrders;
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export async function fetchOpenOrders(): Promise<Order[]> {
  try {
    const response = await apiClient.get<{
      openOrders: unknown[];
      closedOrders: unknown[];
      balance: unknown;
    }>("/orders");

    if (
      typeof response !== "object" ||
      response === null ||
      !("openOrders" in response)
    ) {
      console.error("Expected object with openOrders but got:", response);
      return [];
    }

    const openOrders = response.openOrders;

    const validOrders = openOrders.filter((order): order is Order => {
      const isValid =
        typeof order === "object" &&
        order !== null &&
        "id" in order &&
        "symbolId" in order &&
        "type" in order &&
        "status" in order;

      if (!isValid) {
        console.warn("Received invalid order object:", order);
      }

      return isValid;
    });

    return validOrders;
  } catch (error) {
    console.error("Error fetching open orders:", error);
    return [];
  }
}

/**
 * Create a new order
 */
export async function createOrder(
  params: CreateOrderParams
): Promise<Order | null> {
  try {
    console.log("Creating order with params (before conversion):", params);

    const convertedParams = {
      ...params,
      price: Math.round(Number(params.price) * 100),
      stopLoss:
        params.stopLoss !== undefined
          ? Math.round(Number(params.stopLoss) * 100)
          : undefined,
      takeProfit:
        params.takeProfit !== undefined
          ? Math.round(Number(params.takeProfit) * 100)
          : undefined,
    };

    console.log("Params for backend (converted to cents):", convertedParams);

    const endpoint = "/orders";
    console.log(`Sending order to API endpoint: ${endpoint}`);

    try {
      const response = await apiClient.post<Order>(endpoint, convertedParams);
      console.log("Order created successfully:", response);
      return response;
    } catch (apiError: unknown) {
      console.error("API error details:", apiError);

      console.log("API configuration:", {
        apiEndpoint: endpoint,
        symbolId: params.symbolId,
      });

      console.error("Possible causes of 404 error:");
      console.error(
        "1. Backend API route not found - verify the endpoint path"
      );
      console.error("2. Backend server not running or unreachable");
      console.error(
        "3. CORS issues preventing the request from reaching the server"
      );
      console.error("4. Environment configuration issue (API_BASE_URL)");

      throw apiError;
    }
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
}

/**
 * Cancel an existing order
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
  try {
    await apiClient.delete<void>(`/api/orders/${orderId}`);
    return true;
  } catch (error) {
    console.error(`Error cancelling order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Manually exit an order at a specified price
 */
export async function exitOrder(
  orderId: string,
  exitPrice: number
): Promise<boolean> {
  try {
    console.log(`Exiting order ${orderId} at price ${exitPrice}`);

    await apiClient.post<void>(`/api/orders/${orderId}/exit`, {
      exitPrice,
    });

    return true;
  } catch (error) {
    console.error(`Error exiting order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Setup polling for orders
 * @param callback Function to call when orders are updated
 * @returns Cleanup function to stop polling
 */
export function setupOrderPolling(
  callback: (orders: Order[]) => void
): () => void {
  let isActive = true;

  const pollOrders = async () => {
    if (!isActive) return;

    try {
      const orders = await fetchOrders();
      callback(orders);
    } catch (error) {
      console.error("Error polling orders:", error);
    } finally {
      if (isActive) {
        setTimeout(pollOrders, ORDER_POLLING_INTERVAL_MS);
      }
    }
  };

  // Start polling
  pollOrders();

  // Return cleanup function
  return () => {
    isActive = false;
  };
}
