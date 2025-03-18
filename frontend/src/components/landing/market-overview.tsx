import { Typography } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon } from "lucide-react";

// Sample market data (this would be fetched from API in a real application)
const marketData = [
  {
    symbol: "BTC/USD",
    name: "Bitcoin",
    price: 67843.21,
    change: 2.34,
    volume: "3.2B",
  },
  {
    symbol: "ETH/USD",
    name: "Ethereum",
    price: 3267.89,
    change: 1.67,
    volume: "1.8B",
  },
  {
    symbol: "XRP/USD",
    name: "Ripple",
    price: 0.5724,
    change: -0.83,
    volume: "642M",
  },
  {
    symbol: "SOL/USD",
    name: "Solana",
    price: 128.57,
    change: 4.21,
    volume: "984M",
  },
  {
    symbol: "ADA/USD",
    name: "Cardano",
    price: 0.4892,
    change: -1.25,
    volume: "378M",
  },
  {
    symbol: "DOT/USD",
    name: "Polkadot",
    price: 6.37,
    change: 0.62,
    volume: "245M",
  },
];

export function MarketOverview() {
  return (
    <section className="py-16 relative overflow-hidden grid-lines">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center justify-center mb-12">
          <Badge
            variant="outline"
            className="mb-2 px-3 py-1 border-primary/20 text-primary"
          >
            <TrendingUpIcon className="w-3.5 h-3.5 mr-1.5" /> Real-time Updates
          </Badge>

          <Typography
            variant="h2"
            className="text-3xl md:text-4xl font-bold mb-4 text-center gradient-glow"
          >
            Market Overview
          </Typography>

          <Typography className="text-muted-foreground text-lg max-w-2xl text-center">
            Track real-time prices and trading volumes across major markets with
            our professional trading platform.
          </Typography>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
          {marketData.map((asset) => (
            <MarketCard
              key={asset.symbol}
              symbol={asset.symbol}
              name={asset.name}
              price={asset.price}
              change={asset.change}
              volume={asset.volume}
            />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href="/markets"
            className="button-outline flex items-center gap-2 hover:gap-3 transition-all"
          >
            View All Markets
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

interface MarketCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
}

function MarketCard({ symbol, name, price, change, volume }: MarketCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="market-card p-6 fade-in">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Typography className="text-xl font-semibold">{name}</Typography>
          <Typography className="text-sm text-muted-foreground">
            {symbol}
          </Typography>
        </div>

        <Badge
          className={`${
            isPositive
              ? "bg-green-500/10 text-green-500 border-green-500/30"
              : "bg-red-500/10 text-red-500 border-red-500/30"
          }`}
          variant="outline"
        >
          {isPositive ? (
            <ArrowUpIcon className="w-3 h-3 mr-1" />
          ) : (
            <ArrowDownIcon className="w-3 h-3 mr-1" />
          )}
          {Math.abs(change)}%
        </Badge>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <Typography className="text-2xl font-bold">
            $
            {price < 1
              ? price.toFixed(4)
              : price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </Typography>

          <Typography
            className={`text-sm ${
              isPositive ? "positive-value" : "negative-value"
            }`}
          >
            {isPositive ? "+" : ""}
            {change}%
          </Typography>
        </div>

        <div className="mt-4 bg-primary/5 h-12 rounded-md relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary/10"
            style={{ width: `${Math.min(Math.abs(change) * 10, 100)}%` }}
          ></div>

          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-between px-3">
            <Typography className="text-xs text-muted-foreground z-10">
              24h Volume
            </Typography>
            <Typography className="text-xs font-medium z-10">
              {volume}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  );
}
