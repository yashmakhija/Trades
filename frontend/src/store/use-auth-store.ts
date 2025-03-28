import { create } from "zustand";
import { authApi } from "@/lib/api/auth-api";

export interface User {
  id: string;
  username: string;
  email: string;
  usdcBalance: number;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  verifyAuth: () => Promise<boolean>;
}

// Initialize state from localStorage if available (client-side only)
const getInitialState = () => {
  if (typeof window === "undefined") {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: false,
    };
  }

  try {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("auth_user");

    if (token && userStr) {
      const user = JSON.parse(userStr) as User;
      return {
        user,
        token,
        isAuthenticated: true,
        isInitialized: false,
      };
    }
  } catch (error) {
    // If there's an error parsing the stored user, clear localStorage
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  }

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isInitialized: false,
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialState(),

  setUser: (user) => {
    if (user) {
      // Store user in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_user", JSON.stringify(user));
      }
    } else {
      // Remove user from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_user");
      }
    }

    set({
      user,
      isAuthenticated: !!user,
    });
  },

  setToken: (token) => {
    if (token) {
      // Store token in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", token);
      }
    } else {
      // Remove token from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }
    }

    set({ token });
  },

  login: (user, token) => {
    // Store in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("auth_token", token);
    }

    set({
      user,
      token,
      isAuthenticated: true,
      isInitialized: true,
    });
  },

  logout: () => {
    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  },

  verifyAuth: async () => {
    const { token } = get();

    if (!token) {
      set({ isInitialized: true });
      return false;
    }

    try {
      const response = await authApi.verifyToken();

      if (!response.valid) {
        get().logout();
        return false;
      }

      set({ isInitialized: true });
      return true;
    } catch (error) {
      get().logout();
      return false;
    }
  },
}));
