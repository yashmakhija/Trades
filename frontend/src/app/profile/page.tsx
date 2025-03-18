"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Typography } from "@/components/ui/typography";
import { useProfile } from "@/hooks/use-profile";
import {
  Loader2,
  RefreshCw,
  ArrowUpDown,
  LineChart,
  Coins,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    profileData,
    fetchProfileData,
    formatDate,
    getUserInitials,
  } = useProfile();

  // Handle redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push("/login");
      toast.error("Authentication required", {
        description: "Please log in to view your profile",
      });
    }
  }, [isAuthenticated, isLoading, router]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <Typography className="text-muted-foreground">
          Loading your profile...
        </Typography>
      </div>
    );
  }

  // Handle not authenticated state
  if (!isAuthenticated || !user) {
    return null; // Redirect will happen via useEffect
  }

  const handleRefresh = () => {
    fetchProfileData();
    toast.success("Profile refreshed", {
      description: "Your data has been updated",
    });
  };

  return (
    <>
      <div className="bg-black relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl"></div>

        <div className="container py-6 px-4 mx-auto relative z-10">
          <div className="max-w-6xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-gray-900 shadow-xl bg-gradient-to-br from-blue-500 to-purple-600">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        user.username
                      )}`}
                      alt={user.username}
                    />
                    <AvatarFallback className="text-2xl font-bold text-white">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-gray-700">
                    <BadgeCheck className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                    {user.username}
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 ml-2">
                      Demo Account
                    </Badge>
                  </h1>
                  <p className="text-gray-400 mt-1 flex items-center gap-2">
                    {user.email} • Member since{" "}
                    {formatDate(user.createdAt || "")}
                  </p>
                </div>
              </div>
              <Button
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg flex items-center gap-2"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Update Data</span>
              </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Account summary */}
              <div className="md:col-span-4 space-y-6">
                <Card className="border-0 overflow-hidden shadow-xl bg-gradient-to-br from-gray-900 to-gray-950 text-white">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <Typography variant="h4" className="font-bold text-white">
                        Account Balance
                      </Typography>
                      <Coins className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-4xl font-bold text-white">
                        $
                        {profileData?.balance.toLocaleString() ||
                          user.usdcBalance.toLocaleString()}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Available for trading
                      </div>
                    </div>

                    <div className="mt-8">
                      <Button
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                        onClick={() => router.push("/trading")}
                      >
                        Go to Trading Dashboard
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Security section */}
                <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-900 to-gray-950 text-white">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-blue-400" />
                      <CardTitle className="text-xl text-white">
                        Security Center
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
                      <div>
                        <Typography
                          variant="small"
                          className="font-medium text-white"
                        >
                          Password 
                        </Typography>
                        <br />
                        <Typography variant="small" className="text-gray-400">
                          Last changed: Never
                        </Typography>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-700 hover:bg-gray-800 h-8"
                        disabled
                      >
                        Update
                      </Button>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
                      <div>
                        <Typography
                          variant="small"
                          className="font-medium text-white"
                        >
                          Two-Factor Authentication
                        </Typography>
                        <Typography variant="small" className="text-gray-400">
                          <br/> Not enabled
                        </Typography>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-700 hover:bg-gray-800 h-8"
                        disabled
                      >
                        Enable
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-gray-800 pt-4">
                    <Typography variant="small" className="text-gray-400">
                      This is a demo account. Security features are simulated.
                    </Typography>
                  </CardFooter>
                </Card>
              </div>

              {/* Main content */}
              <div className="md:col-span-8 space-y-6">
                {/* Trading stats */}
                <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-900 to-gray-950 text-white">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-400" />
                        <CardTitle className="text-xl text-white">
                          Trading Statistics
                        </CardTitle>
                      </div>
                    </div>
                    <CardDescription className="text-gray-400">
                      Your trading performance metrics
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <MetricCard
                        title="Total Trades"
                        value={
                          profileData?.metrics.totalTrades.toString() || "0"
                        }
                        icon={<ArrowUpDown className="h-5 w-5 text-blue-400" />}
                        trend={null}
                      />
                      <MetricCard
                        title="Open Positions"
                        value={
                          profileData?.metrics.openPositions.toString() || "0"
                        }
                        icon={<LineChart className="h-5 w-5 text-blue-400" />}
                        trend={null}
                      />
                      <MetricCard
                        title="Profit & Loss"
                        value={`$${
                          profileData?.metrics.pnl.toLocaleString() || "0.00"
                        }`}
                        icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
                        trend={
                          profileData?.metrics.pnl &&
                          profileData.metrics.pnl > 0
                            ? "up"
                            : profileData?.metrics.pnl &&
                              profileData.metrics.pnl < 0
                            ? "down"
                            : null
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Recent activity */}
                <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-900 to-gray-950 text-white">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl text-white">
                        Recent Activity
                      </CardTitle>
                    </div>
                    <CardDescription className="text-gray-400">
                      Your latest trading activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {profileData?.recentTrades &&
                    profileData.recentTrades.length > 0 ? (
                      <div className="space-y-3">
                        {profileData.recentTrades.map((trade) => (
                          <div
                            key={trade.id}
                            className="p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  trade.side === "buy"
                                    ? "bg-emerald-500/20"
                                    : "bg-red-500/20"
                                }`}
                              >
                                <ArrowUpDown
                                  className={`h-5 w-5 ${
                                    trade.side === "buy"
                                      ? "text-emerald-400"
                                      : "text-red-400"
                                  }`}
                                />
                              </div>
                              <div>
                                <div className="font-medium text-white">
                                  {trade.side === "buy" ? "Bought" : "Sold"}{" "}
                                  {trade.symbol}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {formatDate(trade.createdAt)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-white">
                                ${trade.amount.toLocaleString()} @ $
                                {trade.price.toLocaleString()}
                              </div>
                              {trade.pnl !== undefined && (
                                <div
                                  className={`text-sm ${
                                    trade.pnl > 0
                                      ? "text-emerald-400"
                                      : trade.pnl < 0
                                      ? "text-red-400"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {trade.pnl > 0 ? "+" : ""}
                                  {trade.pnl.toLocaleString()} USDC
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-20 h-20 rounded-full bg-gray-800/80 flex items-center justify-center mb-4">
                          <LineChart className="h-10 w-10 text-blue-400" />
                        </div>
                        <Typography variant="h4" className="text-gray-300 mb-2">
                          No trading activity yet
                        </Typography>
                        <Typography
                          variant="small"
                          className="text-gray-400 max-w-md mb-6"
                        >
                          Start trading to see your activity here. All your
                          trades will be recorded and analyzed to help improve
                          your strategy.
                        </Typography>
                        <Button
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                          onClick={() => router.push("/trading")}
                        >
                          Start Trading
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper component for displaying metrics
function MetricCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: "up" | "down" | null;
}) {
  return (
    <div className="p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800/70 transition-colors border border-gray-800/50 hover:border-gray-700/50">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <Typography variant="small" className="text-gray-400">
          {title}
        </Typography>
      </div>
      <div className="flex items-end justify-between">
        <Typography
          variant="h3"
          className={`font-bold text-white ${
            trend === "up"
              ? "text-emerald-400"
              : trend === "down"
              ? "text-red-400"
              : ""
          }`}
        >
          {value}
        </Typography>

        {trend && (
          <div
            className={`text-xs font-medium rounded-full px-2 py-1 ${
              trend === "up"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {trend === "up" ? "↑ Up" : "↓ Down"}
          </div>
        )}
      </div>
    </div>
  );
}
