import { apiClient } from "@/lib/api/api-client";
import { TradingSymbol } from "@/store/use-symbol-store";

/**
 * Fetch all available trading symbols
 */
export async function fetchSymbols(): Promise<TradingSymbol[]> {
  try {
    console.log("Fetching symbols from API...");
    const response = await apiClient.get<TradingSymbol[]>("/symbols");
    console.log("Symbols fetched successfully:", response);
    return response;
  } catch (error) {
    console.error("Error fetching symbols:", error);
    return [];
  }
}
