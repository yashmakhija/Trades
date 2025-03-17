import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useWebSocket } from "@/services/websocket";
import { useEffect } from "react";
import { API_BASE_URL } from "@/config";

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  orderId: string;
  pnl: number;
  status: "OPEN" | "CLOSED" | "CANCELLED";
}

export interface BalanceState {
  total: number;
  available: number;
  reserved: number;
  positions: Position[];
  totalValue: number;
  totalPnl: number;
  totalPositionValue: number;
  openOrdersCount: number;
  isLoading: boolean;
  error: string | null;
}

interface BalanceActions {
  setBalance: (balance: Partial<BalanceState>) => void;
  updatePosition: (position: Position) => void;
  removePosition: (orderId: string) => void;
  reset: () => void;
  fetchBalance: () => Promise<void>;
}

const initialState: BalanceState = {
  total: 0,
  available: 0,
  reserved: 0,
  positions: [],
  totalValue: 0,
  totalPnl: 0,
  totalPositionValue: 0,
  openOrdersCount: 0,
  isLoading: false,
  error: null,
};

export const useBalanceStore = create<BalanceState & BalanceActions>()(
  devtools((set) => ({
    ...initialState,

    setBalance: (balance) =>
      set((state) => ({
        ...state,
        ...balance,
      })),

    updatePosition: (position) =>
      set((state) => ({
        ...state,
        positions: [
          ...state.positions.filter((p) => p.orderId !== position.orderId),
          position,
        ],
      })),

    removePosition: (orderId) =>
      set((state) => ({
        ...state,
        positions: state.positions.filter((p) => p.orderId !== orderId),
      })),

    reset: () => set(initialState),

    fetchBalance: async () => {
      try {
        set({ isLoading: true, error: null });
        const response = await fetch(`${API_BASE_URL}/api/balance`);
        if (!response.ok) {
          throw new Error("Failed to fetch balance");
        }
        const data = await response.json();
        set({ ...data, isLoading: false });
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : "Failed to fetch balance",
          isLoading: false,
        });
      }
    },
  }))
);

// Hook to sync WebSocket balance updates with the store
export function useBalanceSync() {
  const { balance, orders, isAuthenticated } = useWebSocket();
  const setBalance = useBalanceStore((state) => state.setBalance);
  const updatePosition = useBalanceStore((state) => state.updatePosition);
  const removePosition = useBalanceStore((state) => state.removePosition);

  // Update balance when WebSocket balance changes
  useEffect(() => {
    if (balance && isAuthenticated) {
      setBalance(balance);
    }
  }, [balance, setBalance, isAuthenticated]);

  // Update positions based on order updates
  useEffect(() => {
    if (orders && isAuthenticated) {
      // Process orders to update positions
      Object.values(orders).forEach((order) => {
        if (order.status === "CANCELLED" || order.status === "REJECTED") {
          // Remove position for cancelled/rejected orders
          removePosition(order.orderId);
        } else if (order.status === "FILLED") {
          // Update position for filled orders
          updatePosition({
            symbol: order.symbol,
            quantity: order.quantity,
            averagePrice: order.averagePrice,
            currentPrice: order.price,
            orderId: order.orderId,
            pnl: 0, // Calculate PnL if needed
            status: "OPEN",
          });
        } else if (order.status === "PENDING") {
          // Handle pending orders if needed
        }
      });
    }
  }, [orders, updatePosition, removePosition, isAuthenticated]);
}
