import { NextRequest, NextResponse } from "next/server";

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const requestData = await request.json();
    const { exitPrice } = requestData;

    if (!orderId) {
      return NextResponse.json(
        { message: "Order ID is required" },
        { status: 400 }
      );
    }

    if (exitPrice === undefined || exitPrice <= 0) {
      return NextResponse.json(
        { message: "Valid exit price is required" },
        { status: 400 }
      );
    }

    // Get authorization token (in a real app, this would come from auth session)
    const token = request.headers.get("authorization")?.split(" ")[1] || "";

    // Send to backend API
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/exit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        exitPrice,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { message: errorData.message || "Failed to exit order" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error exiting order:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
