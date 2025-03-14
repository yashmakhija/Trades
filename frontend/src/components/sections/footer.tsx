import { Typography } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import Link from "next/link";

const footerLinks = {
  products: [
    { name: "Spot Trading", href: "/trading/spot" },
    { name: "Futures Trading", href: "/trading/futures" },
    { name: "Options Trading", href: "/trading/options" },
    { name: "API Access", href: "/api" },
  ],
  resources: [
    { name: "Documentation", href: "/docs" },
    { name: "Trading Guide", href: "/guide" },
    { name: "Market Analysis", href: "/analysis" },
    { name: "Blog", href: "/blog" },
  ],
  company: [
    { name: "About Us", href: "/about" },
    { name: "Careers", href: "/careers" },
    { name: "Contact", href: "/contact" },
    { name: "Support", href: "/support" },
  ],
};

const socialLinks = [
  { name: "Facebook", icon: Facebook, href: "https://facebook.com" },
  { name: "Twitter", icon: Twitter, href: "https://twitter.com" },
  { name: "Instagram", icon: Instagram, href: "https://instagram.com" },
  { name: "LinkedIn", icon: Linkedin, href: "https://linkedin.com" },
];

export function Footer() {
  return (
    <footer className="relative w-full section-padding">
      {/* Improved background with subtle gradient */}
      <div className="absolute inset-0 blue-gradient z-0"></div>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 right-0 h-px blue-accent"></div>

      <div className="container relative z-10 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12 max-w-6xl mx-auto">
          <div className="space-y-4 animate-fade-in-up">
            <Typography variant="h3" className="gradient-primary glow-text">
              100x Trading
            </Typography>
            <Typography variant="p" className="text-muted-foreground">
              The most advanced crypto trading platform with up to 100x
              leverage.
            </Typography>
          </div>

          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            <Typography variant="h4" className="mb-4">
              Products
            </Typography>
            <ul className="space-y-2">
              {footerLinks.products.map((link, index) => (
                <li
                  key={link.name}
                  style={{ animationDelay: `${0.15 + index * 0.05}s` }}
                >
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Typography variant="h4" className="mb-4">
              Resources
            </Typography>
            <ul className="space-y-2">
              {footerLinks.resources.map((link, index) => (
                <li
                  key={link.name}
                  style={{ animationDelay: `${0.25 + index * 0.05}s` }}
                >
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Typography variant="h4" className="mb-4">
              Company
            </Typography>
            <ul className="space-y-2">
              {footerLinks.company.map((link, index) => (
                <li
                  key={link.name}
                  style={{ animationDelay: `${0.35 + index * 0.05}s` }}
                >
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8 max-w-6xl mx-auto" />

        <div
          className="flex flex-col md:flex-row justify-between items-center gap-4 max-w-6xl mx-auto animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          <Typography variant="p" className="text-muted-foreground">
            © {new Date().getFullYear()} 100x Trading. All rights reserved.
          </Typography>

          <div className="flex items-center space-x-4">
            {socialLinks.map((social, index) => (
              <Link
                key={social.name}
                href={social.href}
                className="text-muted-foreground hover:text-primary transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                style={{ animationDelay: `${0.45 + index * 0.05}s` }}
              >
                <span className="sr-only">{social.name}</span>
                <social.icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
