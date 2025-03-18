import { HeroSection } from "@/components/landing/hero-section";
import { MarketOverview } from "@/components/landing/market-overview";
import { FeatureSection } from "@/components/landing/feature-section";
import { TestimonialSection } from "@/components/landing/testimonial-section";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <HeroSection />

      {/* Market Overview */}
      <MarketOverview />

      {/* Feature Section */}
      <FeatureSection />

      {/* Testimonial Section */}
      <TestimonialSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
