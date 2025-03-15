import { API_BASE_URL, ORDER_POLLING_INTERVAL_MS } from "@/config";

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
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to create order: ${response.statusText}`
      );
    }

    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to cancel order: ${response.statusText}`
      );
    }

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
