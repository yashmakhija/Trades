import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  getAllTickerData,
  getLatestTickerData,
} from "../services/binanceService";

export async function getAllSymbols(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const symbols = await prisma.symbol.findMany({
      orderBy: { name: "asc" },
    });

    const formattedSymbols = symbols.map((symbol) => ({
      ...symbol,
      currentPrice: symbol.currentPrice ? symbol.currentPrice / 100 : null,
    }));

    res.status(200).json(formattedSymbols);
  } catch (error) {
    console.error("Error fetching symbols:", error);
    res.status(500).json({ error: "Failed to fetch symbols" });
  }
}

export async function getSymbolByName(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name } = req.params;

    const symbol = await prisma.symbol.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!symbol) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    const latestData = getLatestTickerData(name);

    const response = {
      ...symbol,
      currentPrice: symbol.currentPrice ? symbol.currentPrice / 100 : null,
      latestData: latestData
        ? {
            ...latestData,
            price: latestData.price / 100,
          }
        : null,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(`Error fetching symbol ${req.params.name}:`, error);
    res.status(500).json({ error: "Failed to fetch symbol" });
  }
}

export function getLatestPrices(req: Request, res: Response): void {
  try {
    const tickerData = getAllTickerData();

    const formattedData = Object.entries(tickerData).reduce(
      (acc, [symbol, data]) => {
        acc[symbol] = {
          ...data,
          price: data.price / 100,
        };
        return acc;
      },
      {} as Record<string, any>
    );

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching latest prices:", error);
    res.status(500).json({ error: "Failed to fetch latest prices" });
  }
}
