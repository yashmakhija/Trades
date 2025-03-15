import { ORDER_POLLING_INTERVAL_MS } from "@/config/index";
import { apiClient } from "@/lib/api/api-client";

// Order types
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "open" | "filled" | "cancelled" | "rejected";

// Order interface
export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number | null;
  quantity: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

// Order creation parameters
export interface CreateOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
}

/**
 * Fetch all orders for the current user
 */
export async function fetchOrders(): Promise<Order[]> {
  try {
    return await apiClient.get<Order[]>("/orders");
  } catch (error) {
    console.error("Error fetching orders:", error);
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
    return await apiClient.post<Order>("/orders", params);
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
