import { apiClient } from "@/lib/api/api-client";

// Updated User interface to match API response
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  usdcBalance: number;
}

// Demo account interface
export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: string;
}

// Auth response interfaces
export interface AuthResponse {
  user: ApiUser;
  token: string;
  message?: string;
}

/**
 * Register a new demo account
 */
export async function registerDemoAccount(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const data = await apiClient.post<AuthResponse>("/auth/register", {
      name,
      email,
      password,
    });

    return data;
  } catch (error) {
    console.error("Error registering demo account:", error);
    throw error;
  }
}

/**
 * Login to a demo account
 */
export async function loginDemoAccount(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const data = await apiClient.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    return data;
  } catch (error) {
    console.error("Error logging in to demo account:", error);
    throw error;
  }
}

/**
 * Create a quick demo account without registration
 */
export async function createQuickDemoAccount(): Promise<AuthResponse> {
  try {
    const data = await apiClient.post<AuthResponse>("/auth/demo/quick");

    return data;
  } catch (error) {
    console.error("Error creating quick demo account:", error);
    throw error;
  }
}

/**
 * Get demo account details
 */
export async function getDemoAccountDetails(): Promise<DemoAccount> {
  try {
    return await apiClient.get<DemoAccount>("/auth/demo/account");
  } catch (error) {
    console.error("Error fetching demo account details:", error);
    throw error;
  }
}
