import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background to-background/80"></div>
          <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-radial from-primary/20 via-background/0 to-background/0"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-background to-transparent"></div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-24 h-24 rounded-full bg-primary/10 blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-32 h-32 rounded-full bg-primary/20 blur-xl animate-float-delayed"></div>
        <div className="absolute bottom-20 left-1/4 w-40 h-40 rounded-full bg-primary/10 blur-xl animate-float-slow"></div>

        <div className="container relative z-10 mx-auto px-4 py-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center px-3 py-1 mb-6 text-sm rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live Trading Now Available
          </div>

          <Typography
            variant="h1"
            className="text-4xl md:text-6xl font-bold mb-6 gradient-primary"
          >
            100x Trading
          </Typography>

          <Typography className="text-xl md:text-2xl text-muted-foreground max-w-3xl mb-10">
            Experience lightning-fast execution with up to 100x leverage on our
            secure, professional-grade trading platform.
          </Typography>

          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Button size="lg" asChild className="group">
              <Link href="/trading">
                Start Trading Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Login to Account</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
            <div className="flex flex-col items-center p-6 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <Typography variant="h3" className="text-lg font-medium mb-2">
                Lightning Fast Execution
              </Typography>
              <Typography className="text-sm text-muted-foreground text-center">
                Execute trades in milliseconds with our high-performance
                matching engine.
              </Typography>
            </div>

            <div className="flex flex-col items-center p-6 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <Typography variant="h3" className="text-lg font-medium mb-2">
                Bank-Grade Security
              </Typography>
              <Typography className="text-sm text-muted-foreground text-center">
                Your assets are protected with multi-layer security and cold
                storage.
              </Typography>
            </div>

            <div className="flex flex-col items-center p-6 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <Typography variant="h3" className="text-lg font-medium mb-2">
                24/7 Global Trading
              </Typography>
              <Typography className="text-sm text-muted-foreground text-center">
                Trade anytime, anywhere with our reliable platform that never
                sleeps.
              </Typography>
            </div>
          </div>
        </div>
      </section>

      {/* Market Overview Section */}
      <section className="py-16 bg-secondary/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Typography variant="h2" className="text-3xl font-bold mb-4">
              Popular Markets
            </Typography>
            <Typography className="text-muted-foreground max-w-2xl mx-auto">
              Trade the world&apos;s most popular cryptocurrencies with up to 100x
              leverage
            </Typography>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {["Bitcoin", "Ethereum", "Solana", "Cardano"].map(
              (crypto, index) => (
                <Link
                  key={index}
                  href={`/trading?symbol=${crypto.toLowerCase()}usdt`}
                  className="block p-6 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-all hover:shadow-md"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <span className="text-primary font-bold">
                          {crypto.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <Typography className="font-medium">
                          {crypto}
                        </Typography>
                        <Typography className="text-xs text-muted-foreground">
                          {crypto.toUpperCase().slice(0, 3)}USDT
                        </Typography>
                      </div>
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        index % 2 === 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {index % 2 === 0 ? "+" : "-"}
                      {(Math.random() * 5 + 1).toFixed(2)}%
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Trade Now
                  </Button>
                </Link>
              )
            )}
          </div>

          <div className="text-center mt-10">
            <Button variant="outline" asChild>
              <Link href="/markets">
                View All Markets
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Typography variant="h2" className="text-3xl font-bold mb-4">
              Why Choose 100x Trading
            </Typography>
            <Typography className="text-muted-foreground max-w-2xl mx-auto">
              Our platform is designed to provide the best trading experience
              for both beginners and professionals
            </Typography>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Advanced Trading Tools",
                description:
                  "Access professional-grade charts, indicators, and order types to execute your strategy with precision.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                ),
              },
              {
                title: "Competitive Fees",
                description:
                  "Enjoy some of the lowest trading fees in the industry, with further discounts for high-volume traders.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                    <path d="M12 18V6" />
                  </svg>
                ),
              },
              {
                title: "Powerful API",
                description:
                  "Integrate with our robust API for automated trading strategies and custom applications.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
                    <path d="m6 17 3.13-5.78c.53-.97.43-2.22-.26-3.07A2.97 2.97 0 0 1 8.5 3.5c1.83-.29 3.5 1.08 3.5 2.84 0 .35-.09.7-.29 1.21" />
                    <path d="M12.4 5.5c-.19.51-.29.86-.29 1.21 0 1.76 1.67 3.13 3.5 2.84a2.97 2.97 0 0 1-.37 4.65c-.69.85-.79 2.1-.26 3.07L18.1 23" />
                  </svg>
                ),
              },
              {
                title: "Institutional-Grade Security",
                description:
                  "Rest easy knowing your funds are protected by industry-leading security measures and insurance.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  </svg>
                ),
              },
              {
                title: "24/7 Support",
                description:
                  "Get help whenever you need it with our round-the-clock customer support team.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                ),
              },
              {
                title: "Educational Resources",
                description:
                  "Learn to trade like a pro with our comprehensive guides, tutorials, and market analysis.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                ),
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex flex-col p-6 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  {feature.icon}
                </div>
                <Typography variant="h3" className="text-lg font-medium mb-2">
                  {feature.title}
                </Typography>
                <Typography className="text-sm text-muted-foreground">
                  {feature.description}
                </Typography>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/20 to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <Typography
            variant="h2"
            className="text-3xl md:text-4xl font-bold mb-6"
          >
            Ready to Start Trading?
          </Typography>
          <Typography className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Join thousands of traders who have already discovered the power of
            100x Trading
          </Typography>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="group">
              <Link href="/trading">
                Start Trading Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
