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

    // Check if response has the expected structure
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

    // Combine open and closed orders
    const allOrders = [...response.openOrders, ...response.closedOrders];

    // Validate each order in the array
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

    // We're already receiving full prices for exitPrice
    // No need to modify prices for our UI
    return validOrders;
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

/**
 * Fetch only open orders for the current user
 */
export async function fetchOpenOrders(): Promise<Order[]> {
  try {
    const response = await apiClient.get<{
      openOrders: unknown[];
      closedOrders: unknown[];
      balance: unknown;
    }>("/orders");

    // Check if response has the expected structure
    if (
      typeof response !== "object" ||
      response === null ||
      !("openOrders" in response)
    ) {
      console.error("Expected object with openOrders but got:", response);
      return [];
    }

    // Get just the open orders
    const openOrders = response.openOrders;

    // Validate each order in the array
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

    // Return orders as is - no conversion needed
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

    // The backend divides full BTC prices by 10000 (85865 → 8.59)
    // Send the raw prices without any conversion
    const convertedParams = {
      ...params,
      // Don't modify the price values at all - send as is
      price: Number(params.price),
      stopLoss:
        params.stopLoss !== undefined ? Number(params.stopLoss) : undefined,
      takeProfit:
        params.takeProfit !== undefined ? Number(params.takeProfit) : undefined,
    };

    console.log("Params for backend (unmodified prices):", convertedParams);

    const response = await apiClient.post<Order>("/orders", convertedParams);

    console.log("Response from backend (original):", response);

    // The backend returns prices divided by 10000
    // We don't need to modify the response since our UI expects full BTC prices
    return response;
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
    await apiClient.delete<void>(`/orders/${orderId}`);
    return true;
  } catch (error) {
    console.error(`Error cancelling order ${orderId}:`, error);
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
