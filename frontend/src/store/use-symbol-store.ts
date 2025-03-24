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
  fetchSymbolsForce: () => Promise<TradingSymbol[]>;
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

            // Quick data validation on cached symbols
            if (symbols.some((s) => !s.id || !s.name)) {
              console.warn("Invalid symbol data in cache, forcing refresh");
              return get().fetchSymbolsForce();
            }

            return symbols;
          }

          // If we're already loading symbols, wait for that request to complete
          if (get().isLoading) {
            console.log("Symbol fetch already in progress, waiting...");
            // Wait for current fetch to complete (max 5 seconds)
            for (let i = 0; i < 50; i++) {
              await new Promise((r) => setTimeout(r, 100));
              if (!get().isLoading) {
                console.log("Ongoing symbol fetch completed");
                return get().symbols;
              }
            }
            console.warn("Timed out waiting for symbol fetch");
          }

          return get().fetchSymbolsForce();
        },
        fetchSymbolsForce: async () => {
          // Check if we're already loading
          if (get().isLoading) {
            console.log(
              "Symbol fetch already in progress, waiting for completion"
            );
            // Wait a bit and then return current symbols
            await new Promise((r) => setTimeout(r, 1000));
            return get().symbols;
          }

          // Force fetch fresh data regardless of cache
          try {
            set({ isLoading: true });
            console.log("Fetching fresh symbols data (forced)");
            const fetchedSymbols = await apiFetchSymbols();

            if (!fetchedSymbols || fetchedSymbols.length === 0) {
              console.error(
                "No symbols returned from API, using cached data as fallback"
              );
              set({ isLoading: false });
              return get().symbols;
            }

            console.log(
              "Symbols fetched successfully:",
              fetchedSymbols.map((s) => `${s.name} (${s.id})`).join(", ")
            );

            // Data validation before setting
            const validSymbols = fetchedSymbols.filter((s) => s.id && s.name);
            if (validSymbols.length !== fetchedSymbols.length) {
              console.warn(
                "Some fetched symbols had invalid data and were filtered out"
              );
            }

            set({
              symbols: validSymbols,
              lastFetched: Date.now(),
              isLoading: false,
            });
            return validSymbols;
          } catch (error) {
            console.error("Error fetching symbols:", error);
            set({ isLoading: false });
            return get().symbols; // Return cached symbols on error
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
