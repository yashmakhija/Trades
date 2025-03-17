"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { useDemoAuth } from "@/hooks/use-demo-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, BarChart2, Settings, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useBalanceStore, useBalanceSync } from "@/store/use-balance-store";
import { formatCurrency } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// import { UserNav } from "@/components/user/user-nav";

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const { logout } = useDemoAuth();
  const { total, available, reserved, totalPnl, isLoading } = useBalanceStore();

  // Use the balance sync hook to keep balance updated via WebSocket
  useBalanceSync();

  // Add client-side only state to prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to true after component mounts on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Trading", href: "/trading" },
    { label: "Markets", href: "/markets" },
    { label: "Learn", href: "/learn" },
  ];

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.username) return "U";
    return user.username
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <Typography variant="h3" className="gradient-primary font-bold">
                100x Trading
              </Typography>
            </Link>

            <nav className="hidden md:flex gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Only render auth-dependent content after client-side hydration */}
          <div className="flex items-center gap-4">
            {isMounted ? (
              isAuthenticated && user ? (
                <>
                  {/* Simplified balance display */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent transition-colors">
                          <Wallet className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {isLoading ? (
                              <span className="animate-pulse">Loading...</span>
                            ) : (
                              formatCurrency(total)
                            )}
                          </span>
                          {totalPnl !== 0 && (
                            <span
                              className={`text-xs ${
                                totalPnl >= 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {totalPnl > 0 ? "+" : ""}
                              {formatCurrency(totalPnl)}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-xs text-muted-foreground">
                              Available:
                            </span>
                            <span className="text-xs font-medium">
                              {formatCurrency(available)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-xs text-muted-foreground">
                              Reserved:
                            </span>
                            <span className="text-xs font-medium">
                              {formatCurrency(reserved)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-xs text-muted-foreground">
                              P&L:
                            </span>
                            <span
                              className={`text-xs font-medium ${
                                totalPnl >= 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {formatCurrency(totalPnl)}
                            </span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-10 w-10 rounded-full"
                      >
                        <Avatar>
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              user.username
                            )}`}
                            alt={user.username}
                          />
                          <AvatarFallback>{getUserInitials()}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {user.username}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          <span>Profile</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/trading" className="cursor-pointer">
                          <BarChart2 className="mr-2 h-4 w-4" />
                          <span>Trading</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={logout}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/login">Login</Link>
                  </Button>

                  <Button size="sm" asChild>
                    <Link href="/register">Register</Link>
                  </Button>
                </>
              )
            ) : (
              // Skeleton loader while client is hydrating
              <div className="flex items-center gap-4">
                <div className="w-20 h-9 bg-muted rounded-md animate-pulse"></div>
                <div className="w-24 h-9 bg-muted rounded-md animate-pulse"></div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
