import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchSymbols, SymbolData } from "@/services/marketData";
import { useWebSocketStore } from "@/services/websocket";

interface SymbolSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function SymbolSelector({
  value,
  onValueChange,
  className = "",
}: SymbolSelectorProps) {
  const [open, setOpen] = useState(false);
  const [symbols, setSymbols] = useState<SymbolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get ticker data from WebSocket store
  const { tickerData } = useWebSocketStore();

  // Load available symbols
  useEffect(() => {
    async function loadSymbols() {
      setIsLoading(true);

      try {
        const data = await fetchSymbols();

        if (data.length === 0) {
          // If no symbols from API, use default ones
          setSymbols([
            {
              id: "1",
              name: "btcusdt",
              description: "Bitcoin / USDT",
              currentPrice: null,
            },
            {
              id: "2",
              name: "ethusdt",
              description: "Ethereum / USDT",
              currentPrice: null,
            },
            {
              id: "3",
              name: "solusdt",
              description: "Solana / USDT",
              currentPrice: null,
            },
            {
              id: "4",
              name: "adausdt",
              description: "Cardano / USDT",
              currentPrice: null,
            },
          ]);
        } else {
          setSymbols(data);
        }
      } catch (error) {
        console.error("Error loading symbols:", error);

        // Fallback to default symbols
        setSymbols([
          {
            id: "1",
            name: "btcusdt",
            description: "Bitcoin / USDT",
            currentPrice: null,
          },
          {
            id: "2",
            name: "ethusdt",
            description: "Ethereum / USDT",
            currentPrice: null,
          },
          {
            id: "3",
            name: "solusdt",
            description: "Solana / USDT",
            currentPrice: null,
          },
          {
            id: "4",
            name: "adausdt",
            description: "Cardano / USDT",
            currentPrice: null,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    loadSymbols();
  }, []);

  // Format price with appropriate decimal places
  const formatPrice = (price: number | undefined | null): string => {
    if (price === undefined || price === null) return "";

    // Determine decimal places based on price magnitude
    const decimalPlaces =
      price >= 1000 ? 2 : price >= 100 ? 3 : price >= 10 ? 4 : 5;

    return price.toLocaleString("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  };

  // Get current symbol display name
  const currentSymbol = symbols.find(
    (s) => s.name.toLowerCase() === value.toLowerCase()
  );
  const displayName = currentSymbol
    ? currentSymbol.description
    : value.toUpperCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={isLoading}
        >
          {isLoading ? "Loading symbols..." : displayName}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search symbol..." className="h-9" />
          <CommandEmpty>No symbol found.</CommandEmpty>

          <CommandGroup className="max-h-[300px] overflow-auto">
            {symbols.map((symbol) => {
              // Get real-time price from WebSocket if available
              const tickerInfo = tickerData[symbol.name.toLowerCase()];
              const price = tickerInfo?.price || symbol.currentPrice;

              return (
                <CommandItem
                  key={symbol.id}
                  value={symbol.name}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.toLowerCase() === symbol.name.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />

                  <div className="flex flex-1 items-center justify-between">
                    <div>
                      <div className="font-medium">{symbol.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {symbol.name.toUpperCase()}
                      </div>
                    </div>

                    {price !== null && (
                      <div className="text-sm font-medium">
                        ${formatPrice(price)}
                      </div>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
