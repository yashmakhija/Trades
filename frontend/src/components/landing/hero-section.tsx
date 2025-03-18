import Link from "next/link";
import { ArrowRight, LineChart, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";

export function HeroSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-background/80"></div>
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-radial from-blue-500/20 via-background/0 to-background/0"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-background to-transparent"></div>
      </div>

      {/* Animated Elements */}
      <div className="absolute top-20 left-10 w-24 h-24 rounded-full bg-blue-500/10 blur-xl animate-float"></div>
      <div className="absolute top-40 right-20 w-32 h-32 rounded-full bg-blue-500/20 blur-xl animate-float-delayed"></div>
      <div className="absolute bottom-20 left-1/4 w-40 h-40 rounded-full bg-blue-500/10 blur-xl animate-float-slow"></div>

      {/* Geometric shapes */}
      <div className="absolute top-1/4 right-1/3 w-16 h-16 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-lg rotate-12 animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg -rotate-12 animate-pulse-slow delay-700"></div>

      <div className="container relative z-10 mx-auto px-4 py-12 flex flex-col items-center text-center">
        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-6 group">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl transition-all duration-300 relative overflow-hidden group-hover:blue-glow">
            CS
            <div className="absolute inset-0 bg-white/20 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
          </div>
          <Typography
            variant="h1"
            className="text-4xl font-bold gradient-glow group-hover:scale-105 transition-all duration-300"
          >
            CodeSquare
          </Typography>
        </div>

        <Badge
          variant="outline"
          className="mb-6 px-4 py-1.5 text-sm bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-2"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Professional Trading Platform Now Live
        </Badge>

        <Typography
          variant="h2"
          className="text-2xl md:text-3xl font-medium text-foreground/90 mb-4"
        >
          Advanced Trading Solutions
        </Typography>

        <Typography className="text-xl text-muted-foreground max-w-3xl mb-10">
          Experience high-speed execution with professional-grade tools,
          real-time data, and seamless performance on our secure trading
          platform.
        </Typography>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Button
            size="lg"
            asChild
            className="group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 relative overflow-hidden"
          >
            <Link href="/trading">
              <span className="relative z-10 flex items-center">
                Start Trading Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="absolute inset-0 bg-white/10 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="border-blue-500/20 hover:bg-blue-500/10 transition-all duration-300 hover:border-blue-500/40"
          >
            <Link href="/login">Log In to Your Account</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
          <FeatureCard
            icon={<LineChart className="h-6 w-6" />}
            title="Real-Time Analytics"
            description="Track market movements with precision and make informed decisions with advanced analytics."
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="High-Speed Execution"
            description="Execute trades in milliseconds with our high-performance matching engine."
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Enterprise Security"
            description="Your assets are protected with multi-layer security and advanced encryption."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-blue-500/10 hover:border-blue-500/30 transition-all hover:shadow-md group">
      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500 transform group-hover:scale-110 transition-all duration-300 group-hover:blue-glow-sm">
        {icon}
      </div>
      <Typography
        variant="h3"
        className="text-lg font-medium mb-2 group-hover:text-blue-400 transition-colors"
      >
        {title}
      </Typography>
      <Typography className="text-sm text-muted-foreground text-center">
        {description}
      </Typography>
    </div>
  );
}
