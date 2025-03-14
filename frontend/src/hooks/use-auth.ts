"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth-api";
import { useAuthStore } from "@/store/use-auth-store";

export function useAuth() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, token, isAuthenticated, setUser, setToken, logout } =
    useAuthStore();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login({ email, password });
      setUser(response.user);
      setToken(response.token);
      router.push("/dashboard");
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to login");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.register({ name, email, password });
      setUser(response.user);
      setToken(response.token);
      router.push("/dashboard");
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to register");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!token) return false;

    setIsLoading(true);
    setError(null);

    try {
      const user = await authApi.getProfile();
      setUser(user);
      return true;
    } catch (err: any) {
      if (err.message === "Unauthorized") {
        handleLogout();
      }
      setError(err.message || "Failed to fetch profile");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    fetchProfile,
    logout: handleLogout,
  };
}
