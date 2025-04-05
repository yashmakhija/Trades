"use client";

import { useEffect, useState } from "react";
import { useBalanceStore, useBalanceSync } from "@/store/use-balance-store";
import { useAuthStore } from "@/store/use-auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, Wallet, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function LiveBalanceDisplay() {
  const { total, available, isLoading, error } = useBalanceStore();
  const { isAuthenticated } = useAuthStore();
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  const [isIncreasing, setIsIncreasing] = useState<boolean | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Enable balance synchronization
  useBalanceSync();

  // Track balance changes for animation
  useEffect(() => {
    if (prevTotal !== null && total !== prevTotal) {
      setIsIncreasing(total > prevTotal);
      setShowAnimation(true);
      setLastUpdated(new Date());
      setTimeout(() => setShowAnimation(false), 2000);
    }
    setPrevTotal(total);
  }, [total, prevTotal]);

  if (isLoading && isAuthenticated) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive">
        <CardContent className="p-4">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Please log in to view your balance
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Live Balance
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-medium transition-all duration-300",
                  showAnimation && isIncreasing && "text-green-500",
                  showAnimation && !isIncreasing && "text-red-500"
                )}
              >
                {formatCurrency(total)}
              </span>
              {showAnimation &&
                (isIncreasing ? (
                  <ArrowUpIcon className="h-4 w-4 text-green-500 animate-bounce" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 text-red-500 animate-bounce" />
                ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="font-medium">{formatCurrency(available)}</span>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    <span>
                      Last updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Balance updates in real-time</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge variant="outline" className="text-xs">
              Live
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
