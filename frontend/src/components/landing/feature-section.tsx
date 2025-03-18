import React from "react";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3,
  Clock,
  Shield,
  Globe,
  Cpu,
  Lightbulb,
  Phone,
  BadgeCheck,
  Wallet,
  BarChart2,
  Zap,
  Smartphone,
  LineChart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const features: Feature[] = [
  {
    title: "Advanced Charting",
    description:
      "Access professional-grade charts with over 100+ indicators and multiple timeframes for detailed analysis.",
    icon: <BarChart3 className="h-6 w-6" />,
  },
  {
    title: "Ultra-Low Latency",
    description:
      "Execute trades with millisecond precision through our high-performance matching engine and infrastructure.",
    icon: <Clock className="h-6 w-6" />,
  },
  {
    title: "Enterprise Security",
    description:
      "Benefit from institutional-grade security with multi-factor authentication and cold storage protection.",
    icon: <Shield className="h-6 w-6" />,
  },
  {
    title: "Global Accessibility",
    description:
      "Trade from anywhere in the world with our platform that supports multiple languages and currencies.",
    icon: <Globe className="h-6 w-6" />,
  },
  {
    title: "API Integration",
    description:
      "Connect your custom trading strategies and algorithms with our robust and documented API endpoints.",
    icon: <Cpu className="h-6 w-6" />,
  },
  {
    title: "Market Insights",
    description:
      "Stay informed with real-time market analysis, news feeds, and professional trading signals.",
    icon: <Lightbulb className="h-6 w-6" />,
  },
  {
    title: "Mobile Trading",
    description:
      "Manage your portfolio on the go with our feature-rich mobile application for iOS and Android.",
    icon: <Phone className="h-6 w-6" />,
  },
  {
    title: "Transparent Fees",
    description:
      "Enjoy competitive trading fees with volume-based discounts for active traders and institutions.",
    icon: <Wallet className="h-6 w-6" />,
  },
  {
    title: "Premium Support",
    description:
      "Access 24/7 dedicated customer support from trading experts who understand your needs.",
    icon: <BadgeCheck className="h-6 w-6" />,
  },
];

export function FeatureSection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background gradients and decorative elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent top-0"></div>
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent bottom-0"></div>
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 grid-lines"></div>

      {/* Floating elements */}
      <div className="absolute top-40 -left-10 w-64 h-64 bg-primary/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-20 -right-10 w-72 h-72 bg-primary/5 rounded-full blur-[100px]"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-16 text-center">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 border-primary/20 text-primary"
          >
            Professional Trading Tools
          </Badge>

          <Typography
            variant="h2"
            className="text-4xl md:text-5xl font-bold mb-6 gradient-glow"
          >
            Trading Features
          </Typography>

          <Typography className="text-muted-foreground text-lg max-w-2xl">
            Experience the difference with our professional trading platform
            designed for traders of all levels.
          </Typography>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<BarChart2 size={24} />}
            title="Advanced Charts"
            description="Professional-grade charting with multiple timeframes and over 100 indicators for technical analysis."
            delay="fade-in"
          />

          <FeatureCard
            icon={<Zap size={24} />}
            title="Lightning Fast Execution"
            description="Execute trades in milliseconds with our high-performance matching engine and low-latency infrastructure."
            delay="fade-in-delay-1"
          />

          <FeatureCard
            icon={<Shield size={24} />}
            title="Enterprise Security"
            description="Your funds are protected with military-grade encryption, cold storage, and 24/7 security monitoring."
            delay="fade-in-delay-2"
          />

          <FeatureCard
            icon={<LineChart size={24} />}
            title="Real-Time Analytics"
            description="Get instant insights with real-time market data, customizable dashboards, and performance metrics."
            delay="fade-in-delay-1"
          />

          <FeatureCard
            icon={<Smartphone size={24} />}
            title="Mobile Trading"
            description="Trade on the go with our powerful mobile app featuring full platform functionality and push notifications."
            delay="fade-in-delay-2"
          />

          <FeatureCard
            icon={<Globe size={24} />}
            title="Global Markets"
            description="Access global markets with 24/7 trading across major cryptocurrencies, forex pairs, and more."
            delay="fade-in-delay-3"
          />
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  return (
    <div className={`feature-card ${delay} card-hover`}>
      <div className="feature-icon blue-glow-sm">{icon}</div>

      <Typography variant="h3" className="text-xl font-bold mb-3">
        {title}
      </Typography>

      <Typography className="text-muted-foreground">{description}</Typography>
    </div>
  );
}
