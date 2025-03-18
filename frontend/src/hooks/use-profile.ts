"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUserProfile, UserProfile } from "@/services/auth";
import { useAuthStore } from "@/store/use-auth-store";

export function useProfile() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);

  // Fetch profile data
  const fetchProfileData = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/login");
      toast.error("Authentication required", {
        description: "Please log in to view your profile",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await getUserProfile();
      setProfileData(profile);
      return profile;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch profile data";
      setError(errorMessage);
      toast.error("Error loading profile", {
        description: errorMessage,
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, router]);

  // Fetch profile data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfileData();
    }
  }, [isAuthenticated, fetchProfileData]);

  // Format date helper
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";

    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get user initials for avatar fallback
  const getUserInitials = (name: string = user?.username || "User") => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    profileData,
    fetchProfileData,
    formatDate,
    getUserInitials,
  };
}
