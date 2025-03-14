import { TrendingUp, BarChart4, LineChart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";

const features = [
  {
    icon: TrendingUp,
    title: "Real-time Trading",
    description:
      "Execute trades instantly with our WebSocket-powered trading engine.",
    tag: "Ultra Low Latency",
  },
  {
    icon: BarChart4,
    title: "100x Leverage",
    description:
      "Maximize your trading potential with up to 100x leverage on select pairs.",
    tag: "High Leverage",
  },
  {
    icon: LineChart,
    title: "Advanced Charts",
    description:
      "Professional-grade charting tools with multiple timeframes and indicators.",
    tag: "Pro Tools",
  },
];

export function Features() {
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
            Powerful Trading Features
          </Typography>
          <Typography
            variant="p"
            className="text-muted-foreground max-w-2xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            Everything you need to trade crypto with confidence, from advanced
            charting to lightning-fast execution.
          </Typography>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="group relative overflow-hidden glass hover:shadow-xl transition-all duration-300 card-hover animate-fade-in-up"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              <div className="absolute inset-0 gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              <CardHeader className="relative z-10">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 mb-4 group-hover:bg-primary/10 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>

              <CardFooter className="relative z-10">
                <span className="text-sm font-medium text-primary">
                  {feature.tag}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
