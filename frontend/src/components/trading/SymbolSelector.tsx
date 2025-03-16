import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchSymbols, SymbolData } from "@/services/marketData";
import websocketService from "@/services/websocket";
import { DEFAULT_SYMBOLS } from "@/config";
import { Loader2 } from "lucide-react";

interface SymbolSelectorProps {
  className?: string;
}

export function SymbolSelector({ className = "" }: SymbolSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [symbols, setSymbols] = useState<SymbolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get current symbol from URL query parameter
  const currentSymbol = searchParams.get("symbol") || DEFAULT_SYMBOLS[0];

  // Fetch available symbols
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        setIsLoading(true);
        console.log("SymbolSelector: Fetching available symbols");
        const data = await fetchSymbols();

        if (data.length === 0) {
          console.log(
            "SymbolSelector: No symbols returned from API, using defaults"
          );
          // If no symbols returned from API, use default symbols
          setSymbols(
            DEFAULT_SYMBOLS.map((symbol) => ({
              id: symbol,
              name: symbol.toUpperCase(),
              description: `${symbol.slice(0, -4).toUpperCase()}/${symbol
                .slice(-4)
                .toUpperCase()}`,
              currentPrice: null,
            }))
          );
        } else {
          console.log("SymbolSelector: Loaded symbols from API:", data);
          setSymbols(data);
        }
      } catch (error) {
        console.error("SymbolSelector: Error loading symbols:", error);
        // Fallback to default symbols on error
        setSymbols(
          DEFAULT_SYMBOLS.map((symbol) => ({
            id: symbol,
            name: symbol.toUpperCase(),
            description: `${symbol.slice(0, -4).toUpperCase()}/${symbol
              .slice(-4)
              .toUpperCase()}`,
            currentPrice: null,
          }))
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSymbols();
  }, []);

  // Set active symbol when component mounts or currentSymbol changes
  useEffect(() => {
    const normalizedSymbol = currentSymbol.toLowerCase();
    console.log(`SymbolSelector: Setting active symbol to ${normalizedSymbol}`);

    // Set as active symbol for optimized updates
    websocketService.setActiveSymbol(normalizedSymbol);
  }, [currentSymbol]);

  // Handle symbol change
  const handleSymbolChange = (value: string) => {
    const normalizedSymbol = value.toLowerCase();
    console.log(`SymbolSelector: Changing symbol to ${normalizedSymbol}`);

    // Set as active symbol immediately for better responsiveness
    websocketService.setActiveSymbol(normalizedSymbol);

    // Create new URL with updated symbol parameter
    const params = new URLSearchParams(searchParams);
    params.set("symbol", normalizedSymbol);

    // Navigate to the new URL
    router.push(`${pathname}?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading symbols...</span>
      </div>
    );
  }

  return (
    <Select value={currentSymbol} onValueChange={handleSymbolChange}>
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue placeholder="Select symbol" />
      </SelectTrigger>
      <SelectContent>
        {symbols.map((symbol) => (
          <SelectItem key={symbol.id} value={symbol.id}>
            {symbol.description || symbol.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
