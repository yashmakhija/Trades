import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSymbolStore } from "@/store/use-symbol-store";
import { DEFAULT_SYMBOLS } from "@/config";
import { Loader2 } from "lucide-react";

interface SymbolSelectorProps {
  className?: string;
}

export function SymbolSelector({ className = "" }: SymbolSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { symbols, isLoading, fetchSymbols, setSelectedSymbol } =
    useSymbolStore();

  // Get current symbol from URL query parameter (could be ID or name)
  const currentSymbolParam = searchParams.get("symbol") || DEFAULT_SYMBOLS[0];

  // Determine if the current symbol param is an ID or a name
  const isSymbolId = currentSymbolParam.includes("-");

  // Track the current symbol name and ID
  const [currentSymbolName, setCurrentSymbolName] = useState<string>(
    isSymbolId ? "" : currentSymbolParam.toLowerCase()
  );
  const [currentSymbolId, setCurrentSymbolId] = useState<string>(
    isSymbolId ? currentSymbolParam : ""
  );

  // Fetch available symbols
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        console.log("SymbolSelector: Fetching available symbols");
        const data = await fetchSymbols();

        if (data.length === 0) {
          console.log(
            "SymbolSelector: No symbols returned from API, using defaults"
          );
          // If no symbols returned from API, use default symbols
          const defaultSymbolsData = DEFAULT_SYMBOLS.map((symbol) => ({
            id: symbol, // Use symbol name as ID for defaults
            name: symbol.toLowerCase(),
            description: `${symbol.slice(0, -4).toUpperCase()}/${symbol
              .slice(-4)
              .toUpperCase()}`,
            currentPrice: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          // Set the default symbols in the store
          useSymbolStore.getState().setSymbols(defaultSymbolsData);

          // If we have a symbol ID but no name yet, find the name
          if (isSymbolId && currentSymbolId && !currentSymbolName) {
            const symbol = defaultSymbolsData.find(
              (s) => s.id === currentSymbolId
            );
            if (symbol) {
              setCurrentSymbolName(symbol.name);
            } else {
              // If we can't find the symbol by ID, use the first default
              setCurrentSymbolName(DEFAULT_SYMBOLS[0].toLowerCase());
              setCurrentSymbolId(DEFAULT_SYMBOLS[0]);
            }
          }
        } else {
          console.log("SymbolSelector: Loaded symbols from API:", data);

          // If we have a symbol ID but no name yet, find the name
          if (isSymbolId && currentSymbolId && !currentSymbolName) {
            const symbol = data.find((s) => s.id === currentSymbolId);
            if (symbol) {
              setCurrentSymbolName(symbol.name);
            } else {
              // If we can't find the symbol by ID, use the first available
              if (data.length > 0) {
                setCurrentSymbolName(data[0].name);
                setCurrentSymbolId(data[0].id);
              }
            }
          } else if (!isSymbolId && currentSymbolName) {
            // If we have a name but no ID, find the ID
            const symbol = data.find(
              (s) => s.name.toLowerCase() === currentSymbolName.toLowerCase()
            );
            if (symbol) {
              setCurrentSymbolId(symbol.id);
            }
          }
        }
      } catch (error) {
        console.error("SymbolSelector: Error loading symbols:", error);
        // Fallback to default symbols on error
        const defaultSymbolsData = DEFAULT_SYMBOLS.map((symbol) => ({
          id: symbol, // Use symbol name as ID for defaults
          name: symbol.toLowerCase(),
          description: `${symbol.slice(0, -4).toUpperCase()}/${symbol
            .slice(-4)
            .toUpperCase()}`,
          currentPrice: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        // Set the default symbols in the store
        useSymbolStore.getState().setSymbols(defaultSymbolsData);

        // Use the first default symbol if we can't find the current one
        setCurrentSymbolName(DEFAULT_SYMBOLS[0].toLowerCase());
        setCurrentSymbolId(DEFAULT_SYMBOLS[0]);
      }
    };

    loadSymbols();
  }, [currentSymbolId, currentSymbolName, isSymbolId, fetchSymbols]);

  // Set active symbol when component mounts or currentSymbol changes
  useEffect(() => {
    if (!currentSymbolName) return;

    console.log(
      `SymbolSelector: Setting active symbol to ${currentSymbolName}`
    );

    const symbol = symbols.find(
      (s) => s.name.toLowerCase() === currentSymbolName.toLowerCase()
    );

    if (symbol) {
      setSelectedSymbol(symbol);
    }
  }, [currentSymbolName, symbols, setSelectedSymbol]);

  // Handle symbol change
  const handleSymbolChange = (value: string) => {
    // Value is the symbol ID
    const symbolId = value;
    const symbol = symbols.find((s) => s.id === symbolId);

    if (!symbol) {
      console.error(`SymbolSelector: Symbol with ID ${symbolId} not found`);
      return;
    }

    const symbolName = symbol.name.toLowerCase();
    console.log(
      `SymbolSelector: Changing symbol to ${symbolName} (ID: ${symbolId})`
    );

    // Update local state
    setCurrentSymbolName(symbolName);
    setCurrentSymbolId(symbolId);

    // Create new URL with updated symbol parameter (using ID)
    const params = new URLSearchParams(searchParams);
    params.set("symbol", symbolId);

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
    <Select value={currentSymbolId} onValueChange={handleSymbolChange}>
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue placeholder="Select symbol" />
      </SelectTrigger>
      <SelectContent>
        {symbols.map((symbol) => (
          <SelectItem key={symbol.id} value={symbol.id}>
            {symbol.description || symbol.name.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
