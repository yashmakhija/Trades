"use client";

import { useEffect } from "react";
import { useBalanceStore, useBalanceSync } from "@/store/use-balance-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

export function BalanceDisplay() {
  const { total, available, reserved, totalPnl, isLoading, error } =
    useBalanceStore();
  useBalanceSync();

  useEffect(() => {
    useBalanceStore.getState().fetchBalance();
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
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

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Balance</span>
            <span className="font-medium">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="font-medium">{formatCurrency(available)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Reserved</span>
            <span className="font-medium">{formatCurrency(reserved)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total P&L</span>
            <span
              className={`font-medium ${
                totalPnl >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatCurrency(totalPnl)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
