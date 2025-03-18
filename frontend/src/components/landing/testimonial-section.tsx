import { Typography } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { StarIcon } from "lucide-react";

const testimonials = [
  {
    name: "Alex Johnson",
    role: "Professional Trader",
    image:
      "https://i.ibb.co/ZpvLpgf8/Whats-App-Image-2024-12-08-at-01-17-05.jpg",
    content:
      "After trying multiple platforms, CodeSquare has become my go-to for day trading. The execution speed is unmatched, and the advanced charts give me all the tools I need for technical analysis.",
    rating: 5,
  },
  {
    name: "Sarah Williams",
    role: "Portfolio Manager",
    image:
      "https://i.ibb.co/ZpvLpgf8/Whats-App-Image-2024-12-08-at-01-17-05.jpg",
    content:
      "The analytics tools on CodeSquare have completely transformed my portfolio management approach. I can easily track performance across multiple assets and make data-driven decisions.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Institutional Investor",
    image:
      "https://i.ibb.co/ZpvLpgf8/Whats-App-Image-2024-12-08-at-01-17-05.jpg",
    content:
      "Security was our primary concern when selecting a trading platform. CodeSquare's enterprise-grade security features and commitment to compliance made it the clear choice for our firm.",
    rating: 5,
  },
];

export function TestimonialSection() {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-full h-full bg-gradient-to-b from-background via-background/70 to-background"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-16 text-center">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 border-primary/20 text-primary"
          >
            Trusted by Traders
          </Badge>

          <Typography
            variant="h2"
            className="text-4xl md:text-5xl font-bold mb-6 gradient-glow"
          >
            What Our Users Say
          </Typography>

          <Typography className="text-muted-foreground text-lg max-w-2xl">
            Join thousands of traders who have made CodeSquare their platform of
            choice
          </Typography>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              testimonial={testimonial}
              delay={`fade-in-delay-${index}`}
            />
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <div className="glass px-8 py-5 rounded-2xl flex items-center gap-6 blue-glow-sm">
            <div className="flex -space-x-4">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="w-12 h-12 rounded-full border-2 border-background overflow-hidden"
                >
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                    {testimonial.name.charAt(0)}
                  </div>
                </div>
              ))}
              <div className="w-12 h-12 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-primary font-bold">
                <span>+</span>
              </div>
            </div>

            <div>
              <Typography className="font-medium">
                Join 5,000+ traders using our platform
              </Typography>
              <Typography className="text-sm text-muted-foreground">
                Start trading today with professional tools
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TestimonialProps {
  testimonial: {
    name: string;
    role: string;
    image: string;
    content: string;
    rating: number;
  };
  delay: string;
}

function TestimonialCard({ testimonial, delay }: TestimonialProps) {
  return (
    <div className={`testimonial-card ${delay}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-primary/20 overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-medium">
            {testimonial.name.charAt(0)}
          </div>

          <div>
            <Typography className="font-semibold">
              {testimonial.name}
            </Typography>
            <Typography className="text-sm text-muted-foreground">
              {testimonial.role}
            </Typography>
          </div>
        </div>

        <div className="flex">
          {Array.from({ length: testimonial.rating }).map((_, i) => (
            <StarIcon
              key={i}
              className="w-5 h-5 text-yellow-500 fill-yellow-500"
            />
          ))}
        </div>
      </div>

      <Typography className="text-muted-foreground italic">
        &quot;{testimonial.content}&quot;
      </Typography>
    </div>
  );
}
