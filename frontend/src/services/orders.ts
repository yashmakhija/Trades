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
 * Response format from the backend order creation endpoint
 */
interface OrderCreateResponse {
  message?: string;
  order?: Order;
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

    // Verify symbol ID exists and is in the correct format
    if (
      !params.symbolId ||
      typeof params.symbolId !== "string" ||
      params.symbolId.length < 10
    ) {
      console.error("Invalid symbol ID provided:", params.symbolId);
      throw new Error("Invalid symbol ID. Please refresh and try again.");
    }

    // The backend expects prices in cents without decimal points
    // Convert the full price (e.g. 87580.24) to cents (8758024)
    const convertedParams = {
      ...params,
      // Multiply by 100 to convert to cents (removing decimal point)
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

    // Use the correct API endpoint with /api prefix
    const endpoint = "/orders";
    console.log(`Sending order to API endpoint: ${endpoint}`);

    try {
      // Make the API request with credentials
      const response = await apiClient.post<OrderCreateResponse>(
        endpoint,
        convertedParams,
        {
          credentials: "include", // Include cookies in the request
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check for empty response
      if (!response) {
        console.error("Received empty response from server");
        throw new Error("Server returned an empty response");
      }

      // Check for response structure
      if (!response.order && !response.message) {
        console.warn("Unexpected response format:", response);
      }

      // Extract the order from the response
      const order = response.order || (response as unknown as Order);
      console.log("Order created successfully:", order);

      return order;
    } catch (apiError: unknown) {
      console.error("API error details:", apiError);

      // Enhanced error handling for CORS and network issues
      if (
        apiError instanceof TypeError &&
        apiError.message === "Failed to fetch"
      ) {
        console.error("Network error - possible CORS issue");
        throw new Error(
          "Unable to connect to the trading server. Please check your connection and try again."
        );
      }

      // Get more information about the API base URL
      console.log("API configuration:", {
        apiEndpoint: endpoint,
        symbolId: params.symbolId,
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      });

      // Log the most likely causes of 404 errors
      console.error("Possible causes of error:");
      console.error(
        "1. Backend API route not found - verify the endpoint path"
      );
      console.error("2. Backend server not running or unreachable");
      console.error(
        "3. CORS issues preventing the request from reaching the server"
      );
      console.error("4. Environment configuration issue (API_BASE_URL)");
      console.error("5. Authentication token missing or invalid");

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
