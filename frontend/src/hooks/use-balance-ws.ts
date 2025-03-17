import { useEffect } from "react";
import { useWebSocket } from "./use-web-socket";
import { useBalanceStore } from "@/store/use-balance-store";
import { useAuthStore } from "@/store/use-auth-store";

export function useBalanceWs() {
  const { isConnected, lastMessage } = useWebSocket();
  const { setBalance, updatePosition, removePosition } = useBalanceStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isConnected || !isAuthenticated || !lastMessage) return;

    try {
      const message = JSON.parse(lastMessage);

      switch (message.type) {
        case "BALANCE_UPDATE":
          setBalance({
            total: message.data.total,
            available: message.data.available,
            reserved: message.data.reserved,
            positions: message.data.positions,
            totalValue: message.data.totalValue,
            totalPnl: message.data.totalPnl,
            totalPositionValue: message.data.totalPositionValue,
            openOrdersCount: message.data.openOrdersCount,
          });
          break;

        case "ORDER_UPDATE":
          if (
            message.data.status === "CLOSED" ||
            message.data.status === "CANCELLED"
          ) {
            removePosition(message.data.id);
          } else if (message.data.status === "OPEN") {
            updatePosition({
              symbol: message.data.symbolName,
              quantity: message.data.quantity,
              averagePrice: message.data.price,
              currentPrice: message.data.price,
              orderId: message.data.id,
              pnl: 0,
              status: message.data.status,
            });
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }, [
    lastMessage,
    isConnected,
    isAuthenticated,
    setBalance,
    updatePosition,
    removePosition,
  ]);
}
