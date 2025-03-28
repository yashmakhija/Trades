"use client";

import { User } from "@/store/use-auth-store";
import { api } from "./api";

interface LoginResponse {
  user: User;
  token: string;
}

interface RegisterResponse {
  user: User;
  token: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

interface VerifyResponse {
  valid: boolean;
  user?: {
    id: string;
  };
}

class AuthApi {
  // Login with email and password
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>("/auth/login", credentials);
    return response.data;
  }

  // Register a new user
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>(
      "/auth/register",
      userData
    );
    return response.data;
  }

  // Get the current user's profile
  async getProfile(): Promise<User> {
    const response = await api.get<User>("/auth/profile");
    return response.data;
  }

  // Verify authentication token
  async verifyToken(): Promise<VerifyResponse> {
    const response = await api.get<VerifyResponse>("/auth/verify");
    return response.data;
  }

  // Change password
  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      "/auth/change-password",
      {
        oldPassword,
        newPassword,
      }
    );
    return response.data;
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      "/auth/forgot-password",
      { email }
    );
    return response.data;
  }

  // Reset password with token
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      "/auth/reset-password",
      {
        token,
        newPassword,
      }
    );
    return response.data;
  }
}

export const authApi = new AuthApi();
