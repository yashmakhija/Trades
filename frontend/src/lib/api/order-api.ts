"use client";

import { Order, Balance } from "@/store/use-order-store";
import { api } from "./api";

interface PlaceOrderRequest {
  symbolId: string;
  type: "BUY" | "SELL";
  price: number;
  quantity: number;
  isShort: boolean;
  stopLoss?: number;
  takeProfit?: number;
}

interface PortfolioResponse {
  balance: Balance;
  openOrders: Order[];
}

class OrderApi {
  // Get all orders
  async getOrders(): Promise<Order[]> {
    const response = await api.get<Order[]>("/orders");
    return response.data;
  }

  // Get portfolio (balance and open orders)
  async getPortfolio(): Promise<PortfolioResponse> {
    const response = await api.get<PortfolioResponse>("/portfolio");
    return response.data;
  }

  // Place a new order
  async placeOrder(orderData: PlaceOrderRequest): Promise<Order> {
    const response = await api.post<Order>("/orders", orderData);
    return response.data;
  }

  // Cancel an order
  async cancelOrder(orderId: string): Promise<void> {
    await api.delete(`/orders/${orderId}`);
  }

  // Get order by ID
  async getOrder(orderId: string): Promise<Order> {
    const response = await api.get<Order>(`/orders/${orderId}`);
    return response.data;
  }

  // Get order history for a specific symbol
  async getOrderHistory(symbolId: string): Promise<Order[]> {
    const response = await api.get<Order[]>(`/orders/history/${symbolId}`);
    return response.data;
  }
}

export const orderApi = new OrderApi();
