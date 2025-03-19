import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Order, fetchOpenOrders } from "@/services/orders";

interface OrdersState {
  // Data
  openOrders: Order[];

  // UI state
  isLoading: boolean;
  error: string | null;
}

interface OrdersActions {
  // Data fetching
  fetchOpenOrders: () => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState: OrdersState = {
  openOrders: [],
  isLoading: false,
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

    reset: () => {
      set(initialState);
    },
  }))
);
