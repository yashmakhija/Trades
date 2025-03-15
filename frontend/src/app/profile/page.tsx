"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Typography } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { useDemoAuth } from "@/hooks/use-demo-auth";
import { useAuthStore } from "@/store/use-auth-store";
import {
  Loader2,
  RefreshCw,
  ArrowUpDown,
  Clock,
  DollarSign,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { demoAccount, fetchDemoAccount, isLoading } = useDemoAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else {
      fetchDemoAccount();
    }
  }, [isAuthenticated, router, fetchDemoAccount]);

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile sidebar */}
          <div className="w-full md:w-1/3">
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        user.name
                      )}`}
                      alt={user.name}
                    />
                    <AvatarFallback className="text-2xl">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle className="text-xl">{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Member since
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Account type
                    </span>
                    <span className="text-sm font-medium">Demo</span>
                  </div>
                  <Separator />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push("/trading")}
                  >
                    Go to Trading
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="w-full md:w-2/3 space-y-6">
            {/* Demo account details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Demo Account</CardTitle>
                <CardDescription>
                  Your virtual trading account details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : demoAccount ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col space-y-1">
                        <Typography
                          variant="small"
                          className="text-muted-foreground"
                        >
                          Balance
                        </Typography>
                        <div className="flex items-center">
                          <DollarSign className="h-5 w-5 mr-1 text-primary" />
                          <Typography variant="h3" className="font-bold">
                            {demoAccount.balance.toLocaleString()}
                          </Typography>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <Typography
                          variant="small"
                          className="text-muted-foreground"
                        >
                          Created
                        </Typography>
                        <div className="flex items-center">
                          <Clock className="h-5 w-5 mr-1 text-muted-foreground" />
                          <Typography variant="h4">
                            {formatDate(demoAccount.createdAt)}
                          </Typography>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Typography variant="h4">Account Activity</Typography>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-muted/40">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">
                                  Total Trades
                                </span>
                                <span className="text-2xl font-bold">0</span>
                              </div>
                              <ArrowUpDown className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/40">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">
                                  Open Positions
                                </span>
                                <span className="text-2xl font-bold">0</span>
                              </div>
                              <RefreshCw className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/40">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">
                                  P&L
                                </span>
                                <span className="text-2xl font-bold">
                                  $0.00
                                </span>
                              </div>
                              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 space-y-4">
                    <Typography variant="h4" className="text-muted-foreground">
                      No demo account found
                    </Typography>
                    <Button onClick={fetchDemoAccount}>
                      Refresh Account Data
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trading history - placeholder for now */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Trading History</CardTitle>
                <CardDescription>Your recent trading activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Typography variant="h4" className="text-muted-foreground">
                    No trading history yet
                  </Typography>
                  <Typography
                    variant="small"
                    className="text-muted-foreground max-w-md mt-2"
                  >
                    Start trading to see your history here. All your trades will
                    be recorded and analyzed.
                  </Typography>
                  <Button
                    className="mt-4"
                    onClick={() => router.push("/trading")}
                  >
                    Start Trading
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
