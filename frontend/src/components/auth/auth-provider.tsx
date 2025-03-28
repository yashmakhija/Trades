"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/use-auth-store";

const PROTECTED_PATHS = ["/dashboard", "/profile", "/settings", "/orders"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isInitialized, verifyAuth } = useAuthStore();

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const isProtectedPath = PROTECTED_PATHS.some((path) =>
      pathname.startsWith(path)
    );

    if (!isAuthenticated && isProtectedPath) {
      router.push("/login");
    } else if (isAuthenticated && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isInitialized, pathname, router]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
      </div>
    );
  }

  return children;
}
