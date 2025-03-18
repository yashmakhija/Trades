import Link from "next/link";
import { Typography } from "@/components/ui/typography";
import { ArrowRight, BarChart2, Shield, Zap } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 relative overflow-hidden cta-section">
      <div className="cta-content container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col lg:pr-6 fade-in">
              <Typography
                variant="h2"
                className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 gradient-glow"
              >
                Ready to Transform Your Trading Experience?
              </Typography>

              <Typography className="text-lg mb-8 text-muted-foreground">
                Join thousands of professional traders who have already made the
                switch to our advanced trading platform.
              </Typography>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  href="/signup"
                  className="button-primary flex items-center justify-center gap-2"
                >
                  Create Free Account
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <Link
                  href="/login"
                  className="button-outline flex items-center justify-center"
                >
                  Login your account
                </Link>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Shield className="w-4 h-4" />
                <span>Enterprise-grade security. No credit card required.</span>
              </div>
            </div>

            <div className="relative lg:pl-6">
              <div className="absolute top-0 left-0 w-full h-full bg-primary/5 rounded-2xl blur-[50px]"></div>

              <div className="glass rounded-2xl p-8 border border-primary/20 relative blue-glow-sm fade-in-delay-1">
                <div className="absolute -top-6 -right-6 w-16 h-16 rounded-xl bg-primary/10 backdrop-blur-xl flex items-center justify-center border border-primary/20">
                  <BarChart2 className="w-8 h-8 text-primary" />
                </div>

                <Typography variant="h3" className="text-xl font-bold mb-6">
                  Platform Benefits:
                </Typography>

                <ul className="space-y-4">
                  <BenefitItem
                    icon={<Zap className="w-5 h-5 text-primary" />}
                    title="Ultra-Fast Trading"
                    description="Execute orders in milliseconds with our advanced matching engine"
                  />

                  <BenefitItem
                    icon={<BarChart2 className="w-5 h-5 text-primary" />}
                    title="Pro-Grade Analytics"
                    description="Access 100+ technical indicators and custom chart layouts"
                  />

                  <BenefitItem
                    icon={<Shield className="w-5 h-5 text-primary" />}
                    title="Institutional Security"
                    description="Multi-layer protection with advanced encryption and MFA"
                  />
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface BenefitItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function BenefitItem({ icon, title, description }: BenefitItemProps) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <Typography className="font-semibold">{title}</Typography>
        <Typography className="text-sm text-muted-foreground">
          {description}
        </Typography>
      </div>
    </li>
  );
}
