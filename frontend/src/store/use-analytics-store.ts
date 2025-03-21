import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  TradeStats,
  SymbolStats,
  DailyPnL,
  Trade,
  fetchUserStats,
  fetchSymbolStats,
  fetchDailyPnL,
  fetchTradeHistory,
} from "@/services/analytics";

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface AnalyticsState {
  // Data
  userStats: TradeStats | null;
  symbolStats: SymbolStats[];
  dailyPnL: DailyPnL[];
  tradeHistory: Trade[];

  // Pagination
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    perPage: number;
  };

  // Filters
  dateRange: DateRange;
  selectedSymbolId: string | null;

  // UI state
  isLoading: {
    userStats: boolean;
    symbolStats: boolean;
    dailyPnL: boolean;
    tradeHistory: boolean;
  };
  error: string | null;
}

interface AnalyticsActions {
  // Data fetching
  fetchUserStats: () => Promise<void>;
  fetchSymbolStats: () => Promise<void>;
  fetchDailyPnL: () => Promise<void>;
  fetchTradeHistory: (
    page?: number | { silent: boolean },
    limit?: number
  ) => Promise<void>;
  fetchAllData: () => Promise<void>;

  // Filter actions
  setDateRange: (range: DateRange) => void;
  setSelectedSymbolId: (symbolId: string | null) => void;

  // Pagination
  setPage: (page: number) => void;

  // Reset
  reset: () => void;
}

const initialState: AnalyticsState = {
  userStats: null,
  symbolStats: [],
  dailyPnL: [],
  tradeHistory: [],
  pagination: {
    total: 0,
    pages: 0,
    currentPage: 1,
    perPage: 10,
  },
  dateRange: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
  },
  selectedSymbolId: null,
  isLoading: {
    userStats: false,
    symbolStats: false,
    dailyPnL: false,
    tradeHistory: false,
  },
  error: null,
};

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>()(
  devtools((set, get) => ({
    ...initialState,

    fetchUserStats: async () => {
      const { dateRange } = get();

      try {
        set((state) => ({
          ...state,
          isLoading: { ...state.isLoading, userStats: true },
          error: null,
        }));

        const stats = await fetchUserStats(
          dateRange.startDate || undefined,
          dateRange.endDate || undefined
        );

        set((state) => ({
          ...state,
          userStats: stats,
          isLoading: { ...state.isLoading, userStats: false },
        }));
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch user stats",
          isLoading: { ...state.isLoading, userStats: false },
        }));
      }
    },

    fetchSymbolStats: async () => {
      const { dateRange } = get();

      try {
        set((state) => ({
          ...state,
          isLoading: { ...state.isLoading, symbolStats: true },
          error: null,
        }));

        const stats = await fetchSymbolStats(
          dateRange.startDate || undefined,
          dateRange.endDate || undefined
        );

        set((state) => ({
          ...state,
          symbolStats: stats,
          isLoading: { ...state.isLoading, symbolStats: false },
        }));
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch symbol stats",
          isLoading: { ...state.isLoading, symbolStats: false },
        }));
      }
    },

    fetchDailyPnL: async () => {
      const { dateRange } = get();

      try {
        set((state) => ({
          ...state,
          isLoading: { ...state.isLoading, dailyPnL: true },
          error: null,
        }));

        const data = await fetchDailyPnL(
          dateRange.startDate || undefined,
          dateRange.endDate || undefined
        );

        set((state) => ({
          ...state,
          dailyPnL: data,
          isLoading: { ...state.isLoading, dailyPnL: false },
        }));
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch daily PnL",
          isLoading: { ...state.isLoading, dailyPnL: false },
        }));
      }
    },

    fetchTradeHistory: async (pageOrOptions = 1, limit = 10) => {
      const { dateRange, selectedSymbolId } = get();
      let page = 1;
      let silent = false;

      // Check if first argument is options object
      if (typeof pageOrOptions === "object") {
        silent = pageOrOptions.silent || false;
        // Keep default page
      } else {
        page = pageOrOptions;
      }

      try {
        // Only set loading state if not silent
        if (!silent) {
          set((state) => ({
            ...state,
            isLoading: { ...state.isLoading, tradeHistory: true },
            error: null,
          }));
        }

        const response = await fetchTradeHistory(
          page,
          limit,
          selectedSymbolId || undefined,
          dateRange.startDate || undefined,
          dateRange.endDate || undefined
        );

        set((state) => ({
          ...state,
          tradeHistory: response.trades,
          pagination: response.pagination,
          isLoading: {
            ...state.isLoading,
            tradeHistory: silent ? state.isLoading.tradeHistory : false,
          },
        }));
      } catch (error) {
        set((state) => ({
          ...state,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch trade history",
          isLoading: {
            ...state.isLoading,
            tradeHistory: silent ? state.isLoading.tradeHistory : false,
          },
        }));
      }
    },

    fetchAllData: async () => {
      // Fetch all data in parallel
      await Promise.all([
        get().fetchUserStats(),
        get().fetchSymbolStats(),
        get().fetchDailyPnL(),
        get().fetchTradeHistory(),
      ]);
    },

    setDateRange: (range) => {
      set((state) => ({
        ...state,
        dateRange: range,
      }));

      // Refetch data with new date range
      get().fetchAllData();
    },

    setSelectedSymbolId: (symbolId) => {
      set((state) => ({
        ...state,
        selectedSymbolId: symbolId,
      }));

      // Refetch trade history with new symbol filter
      get().fetchTradeHistory();
    },

    setPage: (page) => {
      set((state) => ({
        ...state,
        pagination: {
          ...state.pagination,
          currentPage: page,
        },
      }));

      // Fetch trade history for the new page
      get().fetchTradeHistory(page, get().pagination.perPage);
    },

    reset: () => set(initialState),
  }))
);
