import { useEffect } from "react";
import { useWebSocket } from "@/services/websocket";
import { useBalanceStore } from "@/store/use-balance-store";
import { useAuthStore } from "@/store/use-auth-store";

export function useBalanceWs() {
  const { isConnected, isAuthenticated, balance, orders } = useWebSocket();
  const { setBalance, updatePosition, removePosition } = useBalanceStore();
  const { isAuthenticated: isAuthStoreAuthenticated } = useAuthStore();

  // Update balance when it changes in WebSocket store
  useEffect(() => {
    if (
      !isConnected ||
      !isAuthenticated ||
      !isAuthStoreAuthenticated ||
      !balance
    )
      return;

    setBalance(balance);
  }, [
    isConnected,
    isAuthenticated,
    isAuthStoreAuthenticated,
    balance,
    setBalance,
  ]);

  // Update positions when orders change
  useEffect(() => {
    if (!isConnected || !isAuthenticated || !isAuthStoreAuthenticated) return;

    // Process orders to update positions
    Object.values(orders).forEach((order) => {
      if (order.status === "CANCELLED" || order.status === "REJECTED") {
        removePosition(order.orderId);
      } else if (order.status === "FILLED" || order.status === "PENDING") {
        updatePosition({
          symbol: order.symbol,
          quantity: order.quantity,
          averagePrice: order.price,
          currentPrice: order.price,
          orderId: order.orderId,
          pnl: 0,
          status: order.status as "CANCELLED" | "OPEN" | "CLOSED",
        });
      }
    });
  }, [
    isConnected,
    isAuthenticated,
    isAuthStoreAuthenticated,
    orders,
    updatePosition,
    removePosition,
  ]);

  return {
    balance,
    orders,
    isConnected,
    isAuthenticated,
  };
}
