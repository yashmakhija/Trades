import { useBalanceStore } from "@/store/use-balance-store";
import { useWebSocket } from "@/hooks/use-web-socket";
import { useEffect } from "react";

export function useBalanceWebSocket() {
  const { updateBalance, addHistoryEntry } = useBalanceStore();

  useWebSocket({
    onMessage: (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "BALANCE_UPDATE":
            updateBalance({
              ...message.data,
              updatedAt: new Date(message.data.updatedAt),
            });
            break;

          case "BALANCE_HISTORY":
            addHistoryEntry({
              ...message.data,
              createdAt: new Date(message.data.createdAt),
            });
            break;

          default:
            break;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    },
  });

  // Initial balance fetch
  useEffect(() => {
    useBalanceStore.getState().fetchBalance();
  }, []);
}
