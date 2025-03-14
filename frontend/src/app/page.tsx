import Link from "next/link";
import {
  ArrowRight,
  BarChart4,
  Zap,
  Shield,
  TrendingUp,
  LineChart,
  Globe,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section with animated gradient background */}
      <section className="relative flex flex-col items-center justify-center px-4 py-28 md:py-36 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/30 z-0"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center z-0 opacity-20"></div>

        {/* Floating elements */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float opacity-70 z-0"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-float opacity-70 z-0"
          style={{ animationDelay: "2s" }}
        ></div>

        <Container className="text-center relative z-10">
          <Badge variant="default" className="mb-6">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live Trading Now Available
          </Badge>

          <Typography
            variant="h1"
            className="mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent"
          >
            100x<span className="font-extrabold">Trading</span>
          </Typography>

          <Typography
            variant="p"
            className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            Experience the power of{" "}
            <span className="text-foreground font-semibold">100x leverage</span>{" "}
            on our advanced crypto trading platform with real-time market data.
          </Typography>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/register">
                Start Trading Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Login to Account</Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto text-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <Typography variant="span">Lightning Fast Execution</Typography>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <Typography variant="span">Bank-Grade Security</Typography>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <Typography variant="span">24/7 Global Trading</Typography>
            </div>
          </div>
        </Container>
      </section>

      {/* Features Section with cards */}
      <section className="py-20 px-4 bg-background relative">
        <Container>
          <div className="text-center mb-16">
            <Typography variant="h2" className="mb-4">
              Advanced Trading Features
            </Typography>
            <Typography
              variant="p"
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Our platform is designed for both beginners and professional
              traders with powerful tools to maximize your trading potential.
            </Typography>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="group hover:shadow-md transition-all hover:border-primary/50 hover:translate-y-[-5px]">
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Real-time Trading</CardTitle>
                <CardDescription>
                  Experience lightning-fast execution with our WebSocket-powered
                  real-time trading platform. See market movements as they
                  happen.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t border-border">
                <Typography
                  variant="span"
                  className="text-sm text-primary font-medium"
                >
                  Zero latency execution
                </Typography>
              </CardFooter>
            </Card>

            {/* Feature 2 */}
            <Card className="group hover:shadow-md transition-all hover:border-primary/50 hover:translate-y-[-5px]">
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <BarChart4 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>100x Leverage</CardTitle>
                <CardDescription>
                  Maximize your trading potential with up to 100x leverage on
                  all major cryptocurrencies. Trade more with less capital.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t border-border">
                <Typography
                  variant="span"
                  className="text-sm text-primary font-medium"
                >
                  Amplify your trading power
                </Typography>
              </CardFooter>
            </Card>

            {/* Feature 3 */}
            <Card className="group hover:shadow-md transition-all hover:border-primary/50 hover:translate-y-[-5px]">
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Advanced Charts</CardTitle>
                <CardDescription>
                  Access professional-grade charting tools with multiple
                  timeframes, technical indicators, and drawing tools to analyze
                  the markets.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t border-border">
                <Typography
                  variant="span"
                  className="text-sm text-primary font-medium"
                >
                  Make informed decisions
                </Typography>
              </CardFooter>
            </Card>
          </div>
        </Container>
      </section>

      {/* Market Overview Section */}
      <section className="py-20 px-4 bg-secondary/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center z-0 opacity-10"></div>
        <Container className="relative z-10">
          <div className="text-center mb-16">
            <Typography variant="h2" className="mb-4">
              Market Overview
            </Typography>
            <Typography
              variant="p"
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Trade the world&apos;s top cryptocurrencies with real-time market
              data and advanced order types.
            </Typography>
          </div>

          <Tabs defaultValue="spot" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="spot">Spot Trading</TabsTrigger>
              <TabsTrigger value="futures">Futures</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>
            <TabsContent value="spot">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Cryptocurrencies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        {
                          name: "Bitcoin",
                          symbol: "BTC",
                          price: "$61,245.32",
                          change: "+2.4%",
                        },
                        {
                          name: "Ethereum",
                          symbol: "ETH",
                          price: "$3,421.67",
                          change: "+1.8%",
                        },
                        {
                          name: "Solana",
                          symbol: "SOL",
                          price: "$142.89",
                          change: "+5.2%",
                        },
                        {
                          name: "Cardano",
                          symbol: "ADA",
                          price: "$0.58",
                          change: "-0.7%",
                        },
                      ].map((crypto, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                                <Typography
                                  variant="span"
                                  className="font-semibold text-xs text-primary"
                                >
                                  {crypto.symbol.substring(0, 1)}
                                </Typography>
                              </div>
                              <div>
                                <Typography variant="p" className="font-medium">
                                  {crypto.name}
                                </Typography>
                                <Typography
                                  variant="span"
                                  className="text-xs text-muted-foreground"
                                >
                                  {crypto.symbol}
                                </Typography>
                              </div>
                            </div>
                            <div className="text-right">
                              <Typography variant="p" className="font-medium">
                                {crypto.price}
                              </Typography>
                              <Typography
                                variant="span"
                                className={
                                  crypto.change.startsWith("+")
                                    ? "text-xs price-up"
                                    : "text-xs price-down"
                                }
                              >
                                {crypto.change}
                              </Typography>
                            </div>
                          </div>
                          {index < 3 && <Separator className="my-2" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Trading Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-card rounded-lg overflow-hidden chart-container">
                      <div className="w-full h-full bg-gradient-to-r from-primary/5 to-accent/5 flex items-center justify-center">
                        <Typography
                          variant="p"
                          className="text-muted-foreground"
                        >
                          Chart visualization will appear here
                        </Typography>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <Typography
                          variant="span"
                          className="text-xs text-muted-foreground"
                        >
                          24h Volume
                        </Typography>
                        <Typography variant="p" className="font-semibold">
                          $4.2B
                        </Typography>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <Typography
                          variant="span"
                          className="text-xs text-muted-foreground"
                        >
                          Active Traders
                        </Typography>
                        <Typography variant="p" className="font-semibold">
                          12,450+
                        </Typography>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <Typography
                          variant="span"
                          className="text-xs text-muted-foreground"
                        >
                          Avg. Trade Size
                        </Typography>
                        <Typography variant="p" className="font-semibold">
                          $2,340
                        </Typography>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="futures">
              <Card>
                <CardHeader>
                  <CardTitle>Futures Trading</CardTitle>
                  <CardDescription>Coming soon...</CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
            <TabsContent value="options">
              <Card>
                <CardHeader>
                  <CardTitle>Options Trading</CardTitle>
                  <CardDescription>Coming soon...</CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
        </Container>
      </section>

      {/* CTA Section with gradient background */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center z-0 opacity-10"></div>
        <Container className="text-center relative z-10">
          <Typography variant="h2" className="mb-6">
            Ready to start trading?
          </Typography>
          <Typography
            variant="p"
            className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            Join thousands of traders who have already discovered the power of
            100xTrading. Create your account in minutes and start trading today.
          </Typography>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/register">
                Create an Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/demo">Try Demo Account</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border mt-auto bg-background">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Typography variant="h3" className="mb-4">
                100xTrading
              </Typography>
              <Typography
                variant="p"
                className="text-sm text-muted-foreground mb-4"
              >
                The next generation cryptocurrency trading platform with
                advanced features and 100x leverage.
              </Typography>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <Typography variant="h3" className="mb-4">
                Products
              </Typography>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Spot Trading
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Margin Trading
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Futures
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Options
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <Typography variant="h3" className="mb-4">
                Resources
              </Typography>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Trading Guide
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    API Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Market Data
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <Typography variant="h3" className="mb-4">
                Company
              </Typography>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Careers
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Press
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <Separator className="my-8" />
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Typography
              variant="p"
              className="text-sm text-muted-foreground mb-4 md:mb-0"
            >
              © {new Date().getFullYear()} 100xTrading. All rights reserved.
            </Typography>
            <div className="flex space-x-6">
              <a
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cookie Policy
              </a>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}
