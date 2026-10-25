import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";
import { UserRole } from "../shared/types";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  collegeId?:
    | {
        _id: string;
        name: string;
        code: string;
        status: string;
      }
    | string
    | null;
  departmentId?:
    | {
        _id: string;
        name: string;
        code: string;
      }
    | string
    | null;
  studentId?: string;
  employeeId?: string;
  avatar?: string;
  phone?: string;
  walletAddress?: string;
  wallet?: {
    address: string;
    provider: "pera";
    network: "algorand";
    verified: boolean;
    linkedAt?: string;
    lastUsedAt?: string;
  } | null;
  wallets?: Array<{
    address: string;
    walletType: string;
    network: string;
    verified: boolean;
    linkedAt: string;
    lastUsedAt?: string;
  }>;
  authProviders?: string[];
  plan?: "free" | "pro" | "enterprise";
  freeAttempts?: {
    total: number;
    used: number;
  };
  paidAttempts?: {
    total: number;
    used: number;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStatus: "initializing" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<UserProfile>;
  loginWithToken: (token: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("evalora_token"),
  );
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem("evalora_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const storedToken = localStorage.getItem("evalora_token");
    const storedUser = localStorage.getItem("evalora_user");
    // Only loading if we have a token that needs validation and no cached user
    return Boolean(storedToken && !storedUser);
  });
  const [authStatus, setAuthStatus] = useState<
    "initializing" | "authenticated" | "unauthenticated"
  >(() => {
    const storedToken = localStorage.getItem("evalora_token");
    const storedUser = localStorage.getItem("evalora_user");
    if (storedToken && storedUser) return "authenticated";
    if (storedToken) return "initializing";
    return "unauthenticated";
  });

  const refreshProfile = async () => {
    const storedToken = localStorage.getItem("evalora_token");
    if (!storedToken) {
      localStorage.removeItem("evalora_user");
      setUser(null);
      setToken(null);
      setAuthStatus("unauthenticated");
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get("/auth/me");
      if (res.data?.success && res.data?.user) {
        localStorage.setItem("evalora_user", JSON.stringify(res.data.user));
        setUser(res.data.user);
        setToken(storedToken);
        setAuthStatus("authenticated");
      } else {
        localStorage.removeItem("evalora_token");
        localStorage.removeItem("evalora_user");
        setUser(null);
        setToken(null);
        setAuthStatus("unauthenticated");
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("evalora_token");
        localStorage.removeItem("evalora_user");
        setToken(null);
        setUser(null);
        setAuthStatus("unauthenticated");
      } else {
        // Network or transient error: preserve cached user if present
        const cached = localStorage.getItem("evalora_user");
        if (cached) {
          try {
            setUser(JSON.parse(cached));
            setAuthStatus("authenticated");
          } catch {
            setAuthStatus("unauthenticated");
          }
        } else {
          setAuthStatus("unauthenticated");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
    const handleUnauthorized = () => {
      localStorage.removeItem("evalora_token");
      localStorage.removeItem("evalora_user");
      setToken(null);
      setUser(null);
      setAuthStatus("unauthenticated");
    };
    window.addEventListener("evalora:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("evalora:unauthorized", handleUnauthorized);
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<UserProfile> => {
    const res = await api.post("/auth/login", { email, password });
    if (res.data.success) {
      const { token: receivedToken, user: loggedUser } = res.data;
      localStorage.setItem("evalora_token", receivedToken);
      localStorage.setItem("evalora_user", JSON.stringify(loggedUser));
      setToken(receivedToken);
      setUser(loggedUser);
      setAuthStatus("authenticated");
      return loggedUser;
    }
    throw new Error(res.data.message || "Login failed");
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("evalora_token");
    localStorage.removeItem("evalora_user");
    setToken(null);
    setUser(null);
    setAuthStatus("unauthenticated");
  };

  const loginWithToken = async (
    receivedToken: string,
  ): Promise<UserProfile> => {
    localStorage.setItem("evalora_token", receivedToken);
    setToken(receivedToken);

    const res = await api.get("/auth/me");
    if (res.data.success && res.data.user) {
      localStorage.setItem("evalora_user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setAuthStatus("authenticated");
      return res.data.user;
    }

    localStorage.removeItem("evalora_token");
    localStorage.removeItem("evalora_user");
    setToken(null);
    setUser(null);
    setAuthStatus("unauthenticated");
    throw new Error("Unable to load profile");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        authStatus,
        login,
        loginWithToken,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
