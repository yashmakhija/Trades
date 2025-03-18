import { useBalanceStore } from "@/store/use-balance-store";
import { useCustomWebSocket } from "@/hooks/use-web-socket";
import { useEffect } from "react";

export function useBalanceWebSocket() {
  const { setBalance } = useBalanceStore();

  useCustomWebSocket({
    onMessage: (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "BALANCE_UPDATE":
            setBalance({
              ...message.data,
              updatedAt: new Date(message.data.updatedAt),
            });
            break;

          case "BALANCE_HISTORY":
            console.log("Balance history received:", message.data);
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
