import { HeroSection } from "@/components/landing/hero-section";
import { MarketOverview } from "@/components/landing/market-overview";
import { FeatureSection } from "@/components/landing/feature-section";
import { TestimonialSection } from "@/components/landing/testimonial-section";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full mx-auto overflow-x-hidden">
      <main className="flex-1 w-full">
        <HeroSection />
        <MarketOverview />
        <FeatureSection />
        <TestimonialSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
