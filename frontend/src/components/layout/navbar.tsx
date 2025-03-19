"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Menu,
  X,
  LogOut,
  BarChart2,
  Home,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/use-auth-store";
import { useDemoAuth } from "@/hooks/use-demo-auth";
import { Typography } from "@/components/ui/typography";

// Navigation items
const navItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Trading", path: "/trading", icon: BarChart2 },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuthStore();
  const { logout } = useDemoAuth();

  // Handle scroll event to change navbar appearance
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle authentication redirects
  useEffect(() => {
    if (user) {
      // If logged in user tries to access login or register pages, redirect to profile
      if (pathname === "/login" || pathname === "/register") {
        router.push("/profile");
      }
    } else {
      // If not logged in user tries to access profile page, redirect to login
      if (pathname === "/profile") {
        router.push("/login");
        toast.info("Please log in", {
          description: "You need to be logged in to access your profile.",
        });
      }
    }
  }, [pathname, user, router]);

  // Handle logout
  const handleLogout = () => {
    logout();
    // toast.success("Logged out successfully", {
    //   description: "You have been logged out of your account.",
    // });
  };

  // Skip rendering on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Get user initials for avatar
  const getUserInitials = (name: string = "User") => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 w-full z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-background/90 backdrop-blur-lg border-primary/10 py-3"
          : "bg-transparent border-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl transition-all duration-300 relative overflow-hidden group-hover:shadow-lg group-hover:shadow-primary/20">
            CS
            <div className="absolute inset-0 bg-white/20 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
          </div>
          <Typography
            variant="h3"
            className="text-xl font-bold hidden sm:block gradient-primary"
          >
            CodeSquare
          </Typography>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary relative group",
                  isActive ? "text-primary" : "text-foreground/80"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.name}
                <span
                  className={cn(
                    "absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full",
                    isActive && "w-full"
                  )}
                />
              </Link>
            );
          })}
        </div>

        {/* Auth buttons or user menu */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              {/* Fixed trigger to ensure consistent rendering between server and client */}
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "relative h-9 w-9 rounded-full p-0 overflow-hidden"
                  )}
                >
                  <Avatar className="h-9 w-9 transition-all hover:scale-105 border-2 border-transparent hover:border-primary/50">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        user.username
                      )}`}
                      alt={user.username}
                    />
                    <AvatarFallback className="bg-primary/20 text-primary font-medium">
                      {getUserInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-64 p-0 mt-1 border border-primary/20 bg-background/95 backdrop-blur-md shadow-xl rounded-xl overflow-hidden"
              >
                {/* User profile header */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 pt-6 pb-4 px-4 border-b border-primary/10 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-white/10 shadow-lg">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          user.username
                        )}`}
                        alt={user.username}
                      />
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                        {getUserInitials(user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <p className="text-base font-medium leading-none">
                        {user.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-2">
                  <Link href="/profile">
                    <DropdownMenuItem className="cursor-pointer hover:bg-primary/5 py-2.5 rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium">My Profile</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/trading">
                    <DropdownMenuItem className="cursor-pointer hover:bg-primary/5 py-2.5 rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <BarChart2 className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium">Trading Dashboard</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator className="my-2 bg-primary/10" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer hover:bg-red-500/5 py-2.5 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mr-3">
                      <LogOut className="h-4 w-4 text-red-500" />
                    </div>
                    <span className="text-red-500 font-medium">Log out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {/* Fix for hydration error - use Link with button styles instead of Button with asChild */}
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "hover:bg-primary/10 transition-all duration-300"
                )}
              >
                Log In
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({}),
                  "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-md hover:shadow-primary/20 transition-all duration-300 group"
                )}
              >
                <span className="flex items-center">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-primary/10 bg-background/95 backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
          <div className="container px-4 py-4 flex flex-col space-y-3">
            {/* Navigation items */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 py-3 px-4 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-secondary/50 hover:text-foreground"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isActive ? "bg-primary/20" : "bg-secondary/80"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Auth section */}
            <div className="border-t border-primary/10 pt-4 mt-2">
              {user ? (
                <>
                  {/* User info */}
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 mb-4 rounded-xl border border-primary/10">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-white/10 shadow-lg">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            user.username
                          )}`}
                          alt={user.username}
                        />
                        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                          {getUserInitials(user.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-base font-medium leading-none">
                          {user.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* User menu options */}
                  <div className="space-y-2">
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full justify-start py-5 border-primary/20 hover:bg-primary/5 hover:border-primary/30"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">My Profile</span>
                    </Link>
                    <Link
                      href="/trading"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full justify-start py-5 border-primary/20 hover:bg-primary/5 hover:border-primary/30"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <BarChart2 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">Trading Dashboard</span>
                    </Link>
                    <Button
                      variant="outline"
                      className="w-full justify-start py-5 border-red-500/20 text-red-500 hover:bg-red-500/5 hover:border-red-500/30 hover:text-red-500"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mr-3">
                        <LogOut className="h-4 w-4 text-red-500" />
                      </div>
                      <span className="font-medium">Log out</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3 pt-2">
                  {/* Fix for hydration error in mobile menu */}
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full py-6 text-base border-primary/20 hover:bg-primary/5 hover:border-primary/30"
                    )}
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      buttonVariants({}),
                      "w-full py-6 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    )}
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// Add the following to the main content to fix layout with fixed navbar
export function NavbarSpacer() {
  return <div className="h-20" />;
}
