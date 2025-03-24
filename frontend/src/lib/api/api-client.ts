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
  // Make sure the endpoint starts with / and strip any extra slashes
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = new URL(`${API_URL}${normalizedEndpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // Get auth token from store or localStorage
  let token = useAuthStore.getState().token;

  console.log(
    `API Request to ${endpoint} - Initial token from store:`,
    token ? "Present" : "Not present"
  );

  // If token is not in store, try to get it from localStorage
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("auth_token");
    console.log(`Token from localStorage:`, token ? "Found" : "Not found");

    // If token is found in localStorage but not in store, update the store
    if (token) {
      useAuthStore.getState().setToken(token);
      console.log(`Updated auth store with token from localStorage`);
    }
  }

  // Set default headers
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  // Add auth token if available
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    console.log(`Added Authorization header with Bearer token`);
  } else {
    console.warn(
      `No authentication token available for request to ${endpoint}`
    );
  }

  const apiUrl = url.toString();
  console.log(`Sending ${options.method || "GET"} request to ${apiUrl}`);
  console.log("Request headers:", Object.fromEntries(headers.entries()));

  try {
    const response = await fetch(apiUrl, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include credentials for cross-origin requests
      mode: "cors", // Explicitly set mode to cors
    });

    console.log(
      `Response status for ${endpoint}: ${response.status} ${response.statusText}`
    );

    // Handle non-2xx responses
    if (!response.ok) {
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        console.warn(`Authentication failed (401) for ${endpoint}`);
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
        console.error(`API Error response body:`, errorData);

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
    try {
      const data = await response.json();
      console.log(`Successfully received response from ${endpoint}`);
      return data;
    } catch (jsonError) {
      console.error(`Error parsing JSON response from ${endpoint}:`, jsonError);
      throw new Error("Invalid JSON response");
    }
  } catch (fetchError) {
    console.error(`Network error for ${endpoint}:`, fetchError);
    throw fetchError;
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { method: "GET", ...options }),

  post: <T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: FetchOptions
  ) =>
    fetchApi<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  put: <T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: FetchOptions
  ) =>
    fetchApi<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { method: "DELETE", ...options }),
};
