import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";

const cryptocurrencies = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    price: "$45,234.56",
    change: "+2.34%",
    volume: "$1.2B",
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    price: "$3,234.56",
    change: "+1.23%",
    volume: "$856M",
  },
  {
    name: "Solana",
    symbol: "SOL",
    price: "$123.45",
    change: "+5.67%",
    volume: "$234M",
  },
  {
    name: "Cardano",
    symbol: "ADA",
    price: "$0.89",
    change: "-0.45%",
    volume: "$123M",
  },
];

const marketStats = [
  {
    label: "24h Volume",
    value: "$4.5B",
    change: "+12.3%",
  },
  {
    label: "Active Traders",
    value: "12.5K",
    change: "+5.6%",
  },
  {
    label: "Avg. Trade Size",
    value: "$2.3K",
    change: "+8.9%",
  },
];

export function MarketOverview() {
  return (
    <section className="relative w-full section-padding">
      {/* Improved background with subtle gradient */}
      <div className="absolute inset-0 blue-gradient z-0"></div>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 right-0 h-px blue-accent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-px blue-accent"></div>

      <div className="container relative z-10 mx-auto">
        <div className="text-center mb-16">
          <Typography
            variant="h2"
            className="mb-4 gradient-primary glow-text animate-fade-in-up"
          >
            Market Overview
          </Typography>
          <Typography
            variant="p"
            className="text-muted-foreground max-w-2xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            Real-time market data and trading statistics to help you make
            informed decisions.
          </Typography>
        </div>

        <Tabs
          defaultValue="spot"
          className="w-full max-w-6xl mx-auto animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <TabsList className="grid w-full grid-cols-3 mb-8 glass">
            <TabsTrigger value="spot">Spot</TabsTrigger>
            <TabsTrigger value="futures">Futures</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
          </TabsList>

          <TabsContent value="spot" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card
                className="glass card-hover animate-fade-in-up"
                style={{ animationDelay: "0.3s" }}
              >
                <CardHeader>
                  <CardTitle>Top Cryptocurrencies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cryptocurrencies.map((crypto, index) => (
                      <div
                        key={crypto.symbol}
                        className="flex items-center justify-between group"
                        style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <Typography
                              variant="span"
                              className="text-sm font-medium"
                            >
                              {crypto.symbol[0]}
                            </Typography>
                          </div>
                          <div>
                            <Typography variant="span" className="font-medium">
                              {crypto.name}
                            </Typography>
                            <Typography
                              variant="span"
                              className="text-sm text-muted-foreground block"
                            >
                              {crypto.symbol}
                            </Typography>
                          </div>
                        </div>
                        <div className="text-right">
                          <Typography variant="span" className="font-medium">
                            {crypto.price}
                          </Typography>
                          <Typography
                            variant="span"
                            className={`text-sm block ${
                              crypto.change.startsWith("+")
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {crypto.change}
                          </Typography>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card
                className="glass card-hover animate-fade-in-up"
                style={{ animationDelay: "0.4s" }}
              >
                <CardHeader>
                  <CardTitle>Trading Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {marketStats.map((stat, index) => (
                      <div
                        key={stat.label}
                        className="flex items-center justify-between group"
                        style={{ animationDelay: `${0.5 + index * 0.05}s` }}
                      >
                        <Typography
                          variant="span"
                          className="text-muted-foreground"
                        >
                          {stat.label}
                        </Typography>
                        <div className="text-right">
                          <Typography variant="span" className="font-medium">
                            {stat.value}
                          </Typography>
                          <Typography
                            variant="span"
                            className={`text-sm block ${
                              stat.change.startsWith("+")
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {stat.change}
                          </Typography>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="futures"
            className="text-center py-12 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Typography variant="h3" className="mb-4 glow-text">
              Futures Trading Coming Soon
            </Typography>
            <Typography variant="p" className="text-muted-foreground">
              Trade crypto futures with up to 100x leverage. Stay tuned for
              updates!
            </Typography>
          </TabsContent>

          <TabsContent
            value="options"
            className="text-center py-12 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Typography variant="h3" className="mb-4 glow-text">
              Options Trading Coming Soon
            </Typography>
            <Typography variant="p" className="text-muted-foreground">
              Trade crypto options with advanced strategies. Stay tuned for
              updates!
            </Typography>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
