import Link from "next/link";
import { Typography } from "@/components/ui/typography";
import { Github, Twitter, Linkedin, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative bg-card/50 border-t border-border overflow-hidden">
      <div className="absolute inset-0 grid-lines"></div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <div className="flex flex-col space-y-6">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  CS
                </div>
                <Typography variant="h3" className="text-2xl font-bold">
                  CodeSquare
                </Typography>
              </div>

              <Typography className="text-muted-foreground">
                Advanced trading solutions with professional-grade tools and
                security.
              </Typography>

              <div className="flex space-x-4">
                <SocialLink
                  href="https://twitter.com/codesquare"
                  icon={<Twitter size={18} />}
                />
                <SocialLink
                  href="https://github.com/codesquare"
                  icon={<Github size={18} />}
                />
                <SocialLink
                  href="https://linkedin.com/company/codesquare"
                  icon={<Linkedin size={18} />}
                />
                <SocialLink
                  href="https://instagram.com/codesquare"
                  icon={<Instagram size={18} />}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            <FooterColumn title="Platform">
              <FooterLink href="/trading">Trading Dashboard</FooterLink>
              <FooterLink href="/markets">Markets</FooterLink>
              <FooterLink href="/pricing">Pricing</FooterLink>
              <FooterLink href="/api">API</FooterLink>
              <FooterLink href="/integrations">Integrations</FooterLink>
            </FooterColumn>

            <FooterColumn title="Resources">
              <FooterLink href="/docs">Documentation</FooterLink>
              <FooterLink href="/tutorials">Tutorials</FooterLink>
              <FooterLink href="/blog">Blog</FooterLink>
              <FooterLink href="/status">System Status</FooterLink>
              <FooterLink href="/support">Support</FooterLink>
            </FooterColumn>

            <FooterColumn title="Company">
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/careers">Careers</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center text-muted-foreground">
          <Typography className="text-sm mb-4 sm:mb-0">
            © {new Date().getFullYear()} CodeSquare. All rights reserved.
          </Typography>

          <div className="flex space-x-6">
            <FooterLink href="/privacy" className="text-sm">
              Privacy
            </FooterLink>
            <FooterLink href="/terms" className="text-sm">
              Terms
            </FooterLink>
            <FooterLink href="/cookies" className="text-sm">
              Cookies
            </FooterLink>
            <FooterLink href="/licenses" className="text-sm">
              Licenses
            </FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  children: React.ReactNode;
}

function FooterColumn({ title, children }: FooterColumnProps) {
  return (
    <div className="space-y-4">
      <Typography className="font-semibold">{title}</Typography>
      <nav className="flex flex-col space-y-2">{children}</nav>
    </div>
  );
}

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

function FooterLink({ href, children, className = "" }: FooterLinkProps) {
  return (
    <Link
      href={href}
      className={`text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}

interface SocialLinkProps {
  href: string;
  icon: React.ReactNode;
}

function SocialLink({ href, icon }: SocialLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
    >
      {icon}
    </Link>
  );
}
