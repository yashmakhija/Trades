import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { fetchSymbols as apiFetchSymbols } from "@/services/symbols";

export interface TradingSymbol {
  id: string;
  name: string;
  description: string;
  currentPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SymbolState {
  symbols: TradingSymbol[];
  lastFetched: number | null;
  isLoading: boolean;
  fetchSymbols: () => Promise<TradingSymbol[]>;
  setSymbols: (symbols: TradingSymbol[]) => void;
  reset: () => void;
}

const initialState = {
  symbols: [],
  lastFetched: null,
  isLoading: false,
};

// Cache validity duration - 1 hour in milliseconds
const CACHE_DURATION = 60 * 60 * 1000;

export const useSymbolStore = create<SymbolState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        fetchSymbols: async () => {
          const { symbols, lastFetched } = get();
          const now = Date.now();

          // If we have cached symbols and they're still fresh, return them
          if (
            symbols.length > 0 &&
            lastFetched &&
            now - lastFetched < CACHE_DURATION
          ) {
            console.log("Using cached symbols data", {
              cachedSymbols: symbols.length,
              cacheAge: `${Math.round(
                (now - lastFetched) / 1000 / 60
              )} minutes`,
            });
            return symbols;
          }

          // Otherwise fetch fresh data
          try {
            set({ isLoading: true });
            console.log("Fetching fresh symbols data");
            const fetchedSymbols = await apiFetchSymbols();
            set({
              symbols: fetchedSymbols,
              lastFetched: now,
              isLoading: false,
            });
            return fetchedSymbols;
          } catch (error) {
            console.error("Error fetching symbols:", error);
            set({ isLoading: false });
            return symbols; // Return cached symbols on error
          }
        },
        setSymbols: (symbols) => set({ symbols, lastFetched: Date.now() }),
        reset: () => set(initialState),
      }),
      {
        name: "symbol-storage",
        partialize: (state) => ({
          symbols: state.symbols,
          lastFetched: state.lastFetched,
        }),
      }
    )
  )
);
