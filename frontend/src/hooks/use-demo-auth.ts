"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  registerDemoAccount,
  loginDemoAccount,
  createQuickDemoAccount,
  getDemoAccountDetails,
  DemoAccount,
  ApiUser,
} from "@/services/auth";
import { useAuthStore, User } from "@/store/use-auth-store";

export function useDemoAuth() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);

  const { user, login: storeLogin, logout } = useAuthStore();

  // Map API user to store user format
  const mapApiUserToUser = (apiUser: ApiUser): User => {
    return {
      id: apiUser.id,
      username: apiUser.name, // Map name to username
      email: apiUser.email,
      usdcBalance: apiUser.usdcBalance || 0, // Default to 0 if not provided
      createdAt: new Date().toISOString(), // Use current date as fallback
    };
  };

  // Register a new demo account
  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await registerDemoAccount(name, email, password);

      // Store user and token in auth store using the login method
      const mappedUser = mapApiUserToUser(response.user);
      storeLogin(mappedUser, response.token);

      toast.success("Demo account created successfully", {
        description: "You can now start trading with virtual funds",
      });

      router.push("/trading");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);
      toast.error("Registration failed", {
        description: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login to an existing demo account
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await loginDemoAccount(email, password);

      // Store user and token in auth store using the login method
      const mappedUser = mapApiUserToUser(response.user);
      storeLogin(mappedUser, response.token);

      toast.success("Logged in successfully", {
        description: "Welcome back to your demo account",
      });

      router.push("/trading");
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      toast.error("Login failed", {
        description: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Create a quick demo account without registration
  const createQuickDemo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await createQuickDemoAccount();

      // Store user and token in auth store using the login method
      const mappedUser = mapApiUserToUser(response.user);
      storeLogin(mappedUser, response.token);

      toast.success("Demo account created", {
        description: "You can now start trading with virtual funds",
      });

      router.push("/trading");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create demo account";
      setError(errorMessage);
      toast.error("Failed to create demo account", {
        description: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch demo account details
  const fetchDemoAccount = async () => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const account = await getDemoAccountDetails();
      setDemoAccount(account);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch account details";
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout(); // This now handles clearing localStorage
    setDemoAccount(null);

    router.push("/login");
    toast.info("Logged out", {
      description: "You have been logged out of your demo account",
    });
  };

  return {
    user,
    demoAccount,
    isLoading,
    error,
    register,
    login,
    createQuickDemo,
    fetchDemoAccount,
    logout: handleLogout,
  };
}
