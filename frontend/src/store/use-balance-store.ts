import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useWebSocketStore } from "@/services/websocket";
import { useEffect } from "react";

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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance`);
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
  const wsStore = useWebSocketStore();
  const setBalance = useBalanceStore((state) => state.setBalance);

  useEffect(() => {
    if (wsStore.balance) {
      setBalance(wsStore.balance);
    }
  }, [wsStore.balance, setBalance]);
}
