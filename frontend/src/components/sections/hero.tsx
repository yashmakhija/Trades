import Link from "next/link";
import { ArrowRight, Zap, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Typography } from "@/components/ui/typography";

export function Hero() {
  return (
    <section className="relative w-full section-padding">
      {/* Improved background with subtle gradient */}
      <div className="absolute inset-0 blue-gradient z-0"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center z-0 opacity-5"></div>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 right-0 h-px blue-accent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-px blue-accent"></div>

      {/* Floating elements with improved gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float opacity-50 z-0"></div>
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float opacity-50 z-0"
        style={{ animationDelay: "2s" }}
      ></div>

      <div className="text-center relative z-10 max-w-4xl mx-auto">
        <Badge variant="default" className="mb-6 animate-fade-in glass">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live Trading Now Available
        </Badge>

        <Typography
          variant="h1"
          className="mb-6 gradient-primary glow-text animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          100x<span className="font-extrabold">Trading</span>
        </Typography>

        <Typography
          variant="p"
          className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          Experience the power of{" "}
          <span className="text-foreground font-semibold">100x leverage</span>{" "}
          on our advanced crypto trading platform with real-time market data.
        </Typography>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Button asChild size="lg" className="group button-hover glow-primary">
            <Link href="/register">
              Start Trading Now
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="glass">
            <Link href="/login">Login to Account</Link>
          </Button>
        </div>

        <div
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-lg mx-auto text-center text-sm text-muted-foreground animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="flex flex-col items-center group">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 mb-2 group-hover:bg-primary/10 transition-colors">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <Typography variant="span">Lightning Fast Execution</Typography>
          </div>
          <div className="flex flex-col items-center group">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 mb-2 group-hover:bg-primary/10 transition-colors">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <Typography variant="span">Bank-Grade Security</Typography>
          </div>
          <div className="flex flex-col items-center group">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 mb-2 group-hover:bg-primary/10 transition-colors">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <Typography variant="span">24/7 Global Trading</Typography>
          </div>
        </div>
      </div>
    </section>
  );
}
