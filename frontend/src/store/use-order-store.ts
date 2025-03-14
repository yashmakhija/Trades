import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface Balance {
  total: number;
  available: number;
  reserved: number;
}

export interface Order {
  id: string;
  userId: string;
  symbolId: string;
  type: "BUY" | "SELL";
  status: "OPEN" | "FILLED" | "CANCELLED" | "CLOSED";
  price: number;
  quantity: number;
  filledQuantity?: number;
  isShort: boolean;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

interface OrderState {
  orders: Order[];
  openOrders: Order[];
  balance: Balance;
  setOrders: (orders: Order[]) => void;
  setOpenOrders: (openOrders: Order[]) => void;
  setBalance: (balance: Balance) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  removeOrder: (orderId: string) => void;
  reset: () => void;
}

const initialState = {
  orders: [],
  openOrders: [],
  balance: {
    total: 0,
    available: 0,
    reserved: 0,
  },
};

export const useOrderStore = create<OrderState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setOrders: (orders) => set({ orders }),

        setOpenOrders: (openOrders) => set({ openOrders }),

        setBalance: (balance) => set({ balance }),

        addOrder: (order) =>
          set((state) => ({
            orders: [order, ...state.orders],
            openOrders:
              order.status === "OPEN"
                ? [order, ...state.openOrders]
                : state.openOrders,
          })),

        updateOrder: (updatedOrder) =>
          set((state) => {
            // Update in orders array
            const updatedOrders = state.orders.map((order) =>
              order.id === updatedOrder.id ? updatedOrder : order
            );

            // Update in openOrders array if status is still OPEN
            let updatedOpenOrders = state.openOrders;

            if (updatedOrder.status === "OPEN") {
              // If order is still open, update it in openOrders
              updatedOpenOrders = state.openOrders.map((order) =>
                order.id === updatedOrder.id ? updatedOrder : order
              );
            } else {
              // If order is no longer open, remove it from openOrders
              updatedOpenOrders = state.openOrders.filter(
                (order) => order.id !== updatedOrder.id
              );
            }

            return {
              orders: updatedOrders,
              openOrders: updatedOpenOrders,
            };
          }),

        removeOrder: (orderId) =>
          set((state) => ({
            orders: state.orders.filter((order) => order.id !== orderId),
            openOrders: state.openOrders.filter(
              (order) => order.id !== orderId
            ),
          })),

        reset: () => set(initialState),
      }),
      {
        name: "order-storage",
        partialize: (state) => ({
          orders: state.orders,
          openOrders: state.openOrders,
          balance: state.balance,
        }),
      }
    )
  )
);
