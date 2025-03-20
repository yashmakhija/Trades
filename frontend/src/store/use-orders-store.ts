import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  Order,
  fetchOpenOrders,
  cancelOrder,
  exitOrder,
} from "@/services/orders";

interface OrdersState {
  // Data
  openOrders: Order[];

  // UI state
  isLoading: boolean;
  isExiting: boolean;
  isCancelling: boolean;
  error: string | null;
}

interface OrdersActions {
  // Data fetching
  fetchOpenOrders: () => Promise<void>;

  // Order management
  cancelOrder: (orderId: string) => Promise<boolean>;
  exitOrder: (orderId: string, exitPrice: number) => Promise<boolean>;

  // Reset
  reset: () => void;
}

const initialState: OrdersState = {
  openOrders: [],
  isLoading: false,
  isExiting: false,
  isCancelling: false,
  error: null,
};

export const useOrdersStore = create<OrdersState & OrdersActions>()(
  devtools((set) => ({
    ...initialState,

    fetchOpenOrders: async () => {
      try {
        set((state) => ({
          ...state,
          isLoading: true,
          error: null,
        }));

        const orders = await fetchOpenOrders();

        set((state) => ({
          ...state,
          openOrders: orders,
          isLoading: false,
        }));
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch open orders",
          isLoading: false,
        }));
      }
    },

    cancelOrder: async (orderId: string) => {
      try {
        set((state) => ({
          ...state,
          isCancelling: true,
          error: null,
        }));

        const success = await cancelOrder(orderId);

        // Refresh orders list if successful
        if (success) {
          const orders = await fetchOpenOrders();
          set((state) => ({
            ...state,
            openOrders: orders,
          }));
        }

        set((state) => ({
          ...state,
          isCancelling: false,
        }));

        return success;
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error ? error.message : "Failed to cancel order",
          isCancelling: false,
        }));
        return false;
      }
    },

    exitOrder: async (orderId: string, exitPrice: number) => {
      try {
        set((state) => ({
          ...state,
          isExiting: true,
          error: null,
        }));

        const success = await exitOrder(orderId, exitPrice);

        // Refresh orders list if successful
        if (success) {
          const orders = await fetchOpenOrders();
          set((state) => ({
            ...state,
            openOrders: orders,
          }));
        }

        set((state) => ({
          ...state,
          isExiting: false,
        }));

        return success;
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error ? error.message : "Failed to exit order",
          isExiting: false,
        }));
        return false;
      }
    },

    reset: () => {
      set(initialState);
    },
  }))
);
