import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { apiClient } from "@/lib/api/api-client";

export interface Balance {
  total: number;
  available: number;
  reserved: number;
  updatedAt: Date;
}

export interface BalanceHistory {
  id: string;
  amount: number;
  type: string;
  description: string;
  orderId?: string;
  createdAt: Date;
}

interface BalanceState {
  balance: Balance | null;
  history: BalanceHistory[];
  isLoading: boolean;
  error: string | null;
  // Actions
  fetchBalance: () => Promise<void>;
  fetchHistory: (page?: number, limit?: number) => Promise<void>;
  updateBalance: (balance: Balance) => void;
  addHistoryEntry: (entry: BalanceHistory) => void;
  reset: () => void;
}

const initialState = {
  balance: null,
  history: [],
  isLoading: false,
  error: null,
};

export const useBalanceStore = create<BalanceState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        fetchBalance: async () => {
          try {
            set({ isLoading: true, error: null });
            const response = await apiClient.get<Balance>("/balance");
            set({
              balance: {
                ...response.data,
                updatedAt: new Date(response.data.updatedAt),
              },
              isLoading: false,
            });
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch balance",
              isLoading: false,
            });
          }
        },

        fetchHistory: async (page = 1, limit = 10) => {
          try {
            set({ isLoading: true, error: null });
            const response = await apiClient.get<{ history: BalanceHistory[] }>(
              `/balance/history?page=${page}&limit=${limit}`
            );
            set({
              history: response.data.history.map((entry) => ({
                ...entry,
                createdAt: new Date(entry.createdAt),
              })),
              isLoading: false,
            });
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch history",
              isLoading: false,
            });
          }
        },

        updateBalance: (balance: Balance) => {
          set({ balance });
        },

        addHistoryEntry: (entry: BalanceHistory) => {
          set((state) => ({
            history: [entry, ...state.history].slice(0, 50), // Keep last 50 entries
          }));
        },

        reset: () => {
          set(initialState);
        },
      }),
      {
        name: "balance-storage",
      }
    )
  )
);
