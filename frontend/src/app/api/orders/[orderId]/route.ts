import { NextRequest, NextResponse } from "next/server";

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required" },
        { status: 400 }
      );
    }

    // Get user from session (in a real app, you'd use NextAuth or similar)
    // For now, we'll use a mock user ID
    const userId = "user-123"; // Replace with actual user authentication

    // Send to backend API
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        // Add authentication headers if needed
        "X-User-ID": userId, // This is a simplified approach; use proper auth in production
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { message: errorData.message || "Failed to cancel order" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required" },
        { status: 400 }
      );
    }

    // Get user from session (in a real app, you'd use NextAuth or similar)
    // For now, we'll use a mock user ID
    const userId = "user-123"; // Replace with actual user authentication

    // Fetch order from backend
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
      headers: {
        // Add authentication headers if needed
        "X-User-ID": userId, // This is a simplified approach; use proper auth in production
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { message: errorData.message || "Failed to fetch order" },
        { status: response.status }
      );
    }

    const order = await response.json();

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
