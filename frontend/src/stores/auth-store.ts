import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: number;
  email: string;
  full_name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  fetchUser: () => Promise<void>;
  
  // API Actions
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setToken: (token) => {
        if (token) {
          localStorage.setItem("access_token", token);
        } else {
          localStorage.removeItem("access_token");
        }
        set({ token });
      },
      
      setTokens: (accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken);
        set({ 
          token: accessToken, 
          refreshToken,
          isAuthenticated: true,
        });
      },
      
      fetchUser: async () => {
        try {
          const user = await api.auth.me();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to fetch user:", error);
          // Clear tokens if user fetch fails
          localStorage.removeItem("access_token");
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      login: (user, token) => {
        localStorage.setItem("access_token", token);
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),
      
      // Login with email and password
      loginWithCredentials: async (email: string, password: string) => {
        const tokenResponse = await api.auth.login(email, password);
        localStorage.setItem("access_token", tokenResponse.access_token);
        
        const user = await api.auth.me();
        set({
          user,
          token: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      
      // Register new user
      register: async (email: string, password: string, fullName?: string) => {
        const newUser = await api.auth.register(email, password, fullName);
        // After registration, log the user in automatically
        const tokenResponse = await api.auth.login(email, password);
        localStorage.setItem("access_token", tokenResponse.access_token);
        
        set({
          user: {
            id: newUser.id,
            email: newUser.email,
            full_name: newUser.full_name,
          },
          token: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      
      // Login with Google - redirect to Google OAuth
      loginWithGoogle: async () => {
        try {
          const { url } = await api.auth.getGoogleAuthUrl();
          window.location.href = url;
        } catch (error) {
          console.error("Failed to get Google OAuth URL:", error);
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

