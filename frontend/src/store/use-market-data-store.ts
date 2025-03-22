import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { SPREAD_FEE_PERCENTAGE } from "@/config";

export interface MarketSymbol {
  id: string;
  name: string;
  price: number;
  bidPrice: number;
  askPrice: number;
  priceChangePercent: number;
  volume: number;
  high: number | null;
  low: number | null;
  timestamp: number;
}

interface MarketDataState {
  symbols: MarketSymbol[];
  favoriteSymbols: string[];

  isLoading: boolean;
  error: string | null;

  updateSymbol: (symbol: Partial<MarketSymbol> & { name: string }) => void;
  updateSymbols: (symbols: Partial<MarketSymbol> & { name: string }[]) => void;
  addToFavorites: (symbolName: string) => void;
  removeFromFavorites: (symbolName: string) => void;
  reorderFavorites: (newOrder: string[]) => void;
  reset: () => void;
}

const initialState: MarketDataState = {
  symbols: [],
  favoriteSymbols: [],
  isLoading: false,
  error: null,
  updateSymbol: () => {},
  updateSymbols: () => {},
  addToFavorites: () => {},
  removeFromFavorites: () => {},
  reorderFavorites: () => {},
  reset: () => {},
};

export const useMarketDataStore = create<MarketDataState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Update a single symbol's data
        updateSymbol: (symbolData) => {
          set((state) => {
            const symbols = [...state.symbols];
            const index = symbols.findIndex((s) => s.name === symbolData.name);

            // Calculate bid and ask prices based on current price and spread
            const price = symbolData.price ?? symbols[index]?.price ?? 0;
            const spreadAmount = price * SPREAD_FEE_PERCENTAGE;
            const bidPrice = price - spreadAmount;
            const askPrice = price + spreadAmount;

            const updatedSymbolData = {
              ...symbolData,
              bidPrice,
              askPrice,
              timestamp: Date.now(),
            };

            if (index >= 0) {
              // Update existing symbol
              symbols[index] = {
                ...symbols[index],
                ...updatedSymbolData,
              };
            } else {
              // Add new symbol
              symbols.push({
                id: symbolData.id || symbolData.name,
                name: symbolData.name,
                price: price || 0,
                bidPrice,
                askPrice,
                priceChangePercent: symbolData.priceChangePercent || 0,
                volume: symbolData.volume || 0,
                high: symbolData.high || null,
                low: symbolData.low || null,
                timestamp: Date.now(),
              });
            }

            return { symbols };
          });
        },

        updateSymbols: (symbolsData) => {
          symbolsData.forEach((symbolData) => {
            get().updateSymbol(symbolData);
          });
        },

        addToFavorites: (symbolName) => {
          set((state) => {
            if (state.favoriteSymbols.includes(symbolName)) {
              return state;
            }
            return {
              favoriteSymbols: [...state.favoriteSymbols, symbolName],
            };
          });
        },

        removeFromFavorites: (symbolName) => {
          set((state) => ({
            favoriteSymbols: state.favoriteSymbols.filter(
              (s) => s !== symbolName
            ),
          }));
        },

        reorderFavorites: (newOrder) => {
          set({ favoriteSymbols: newOrder });
        },

        reset: () => set(initialState),
      }),
      {
        name: "market-data-storage",
        partialize: (state) => ({ favoriteSymbols: state.favoriteSymbols }),
      }
    )
  )
);

// Helper hook to calculate bid/ask with spread
export function useSymbolPrices(symbolName: string) {
  const symbol = useMarketDataStore((state) =>
    state.symbols.find((s) => s.name.toLowerCase() === symbolName.toLowerCase())
  );

  if (!symbol) {
    return {
      price: 0,
      bidPrice: 0,
      askPrice: 0,
      hasData: false,
    };
  }

  return {
    price: symbol.price || 0,
    bidPrice: symbol.bidPrice || 0,
    askPrice: symbol.askPrice || 0,
    hasData: true,
  };
}
