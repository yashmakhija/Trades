import { ReactNode } from "react";
import { Navbar } from "./navbar";

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  return (
    <div
      className={`flex min-h-screen flex-col bg-background ${className}`}
      suppressHydrationWarning
    >
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
