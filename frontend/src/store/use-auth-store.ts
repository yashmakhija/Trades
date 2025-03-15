import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt?: string;
  usdcBalance: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

// Initialize state from localStorage if available (client-side only)
const getInitialState = () => {
  if (typeof window === "undefined") {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
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
  };
};

export const useAuthStore = create<AuthState>((set) => ({
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
    });
  },
}));
