import { useAuthStore } from "@/store/use-auth-store";
import { API_BASE_URL } from "@/config";

const API_URL = `${API_BASE_URL}/api`;

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Add query parameters if provided
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // Get auth token from store or localStorage
  let token = useAuthStore.getState().token;

  // If token is not in store, try to get it from localStorage
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("auth_token");

    // If token is found in localStorage but not in store, update the store
    if (token) {
      useAuthStore.getState().setToken(token);
    }
  }

  // Set default headers
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  // Add auth token if available
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
    credentials: "include", // Include credentials for cross-origin requests
    mode: "cors", // Explicitly set mode to cors
  });

  // Handle non-2xx responses
  if (!response.ok) {
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      // Clear auth state
      useAuthStore.getState().logout();

      // Remove token from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }

      throw new Error("Your session has expired. Please log in again.");
    }

    try {
      const errorData = await response.json();
      const errorMessage =
        errorData.error ||
        errorData.message ||
        errorData.detail ||
        `Request failed with status ${response.status}`;

      console.error("API Error:", {
        status: response.status,
        endpoint,
        errorData,
      });

      throw new Error(errorMessage);
    } catch (jsonError) {
      // If JSON parsing fails, use status text
      console.error("API Error (non-JSON):", {
        status: response.status,
        statusText: response.statusText,
        endpoint,
      });

      throw new Error(
        `Request failed: ${response.statusText || response.status}`
      );
    }
  }

  // Parse JSON response
  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { method: "GET", ...options }),

  post: <T>(endpoint: string, data?: any, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  put: <T>(endpoint: string, data?: any, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { method: "DELETE", ...options }),
};
