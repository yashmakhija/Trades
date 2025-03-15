import { NextRequest, NextResponse } from "next/server";

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json();

    // Validate required fields
    if (!orderData.symbol) {
      return NextResponse.json(
        { message: "Symbol is required" },
        { status: 400 }
      );
    }

    if (!orderData.quantity || orderData.quantity <= 0) {
      return NextResponse.json(
        { message: "Valid quantity is required" },
        { status: 400 }
      );
    }

    if (!orderData.price || orderData.price <= 0) {
      return NextResponse.json(
        { message: "Valid price is required" },
        { status: 400 }
      );
    }

    if (!orderData.type) {
      return NextResponse.json(
        { message: "Order type is required" },
        { status: 400 }
      );
    }

    // Get user from session (in a real app, you'd use NextAuth or similar)
    // For now, we'll use a mock user ID
    const userId = "user-123"; // Replace with actual user authentication

    // Prepare data for backend
    const backendOrderData = {
      userId,
      symbol: orderData.symbol.toLowerCase(),
      price: Math.round(orderData.price * 100), // Convert to cents/satoshis
      quantity: orderData.quantity,
      type: orderData.type,
      isShort: orderData.isShort || false,
      stopLoss: orderData.stopLoss
        ? Math.round(orderData.stopLoss * 100)
        : null,
      takeProfit: orderData.takeProfit
        ? Math.round(orderData.takeProfit * 100)
        : null,
    };

    // Send to backend API
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add authentication headers if needed
      },
      body: JSON.stringify(backendOrderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { message: errorData.message || "Failed to create order" },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from session (in a real app, you'd use NextAuth or similar)
    // For now, we'll use a mock user ID
    const userId = "user-123"; // Replace with actual user authentication

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build query string
    let queryString = `userId=${userId}`;
    if (status) {
      queryString += `&status=${status}`;
    }

    // Fetch orders from backend
    const response = await fetch(`${API_BASE_URL}/api/orders?${queryString}`, {
      headers: {
        // Add authentication headers if needed
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { message: errorData.message || "Failed to fetch orders" },
        { status: response.status }
      );
    }

    const orders = await response.json();

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
