import { useBalanceStore } from "@/store/use-balance-store";
import { useBalanceWebSocket } from "@/lib/ws/balance-ws";
import { formatCurrency } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceDisplay() {
  const { balance, isLoading } = useBalanceStore();

  // Setup WebSocket connection
  useBalanceWebSocket();

  if (isLoading) {
    return <Skeleton className="h-6 w-24" />;
  }

  if (!balance) {
    return null;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm font-medium">
            {formatCurrency(balance.available)}
          </span>
          <span className="text-xs text-muted-foreground">USDC</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Balance Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Total Balance</div>
              <div className="text-right">{formatCurrency(balance.total)}</div>
              <div className="text-muted-foreground">Available</div>
              <div className="text-right">
                {formatCurrency(balance.available)}
              </div>
              <div className="text-muted-foreground">Reserved</div>
              <div className="text-right">
                {formatCurrency(balance.reserved)}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Last updated: {balance.updatedAt.toLocaleString()}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
