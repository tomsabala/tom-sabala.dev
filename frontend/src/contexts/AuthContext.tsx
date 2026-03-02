/**
 * AuthContext - Global authentication state management
 * Provides authentication state and methods to all components
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import * as authRepository from '../repositories/authRepository';

interface User {
  id: number;
  username: string;
  email: string;
  profilePicture?: string;
  createdAt: string;
  lastLogin: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  googleLogin: (credential: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Persists across sessions — set on login, cleared on logout.
// Avoids the /api/auth/me network round-trip for visitors who have never logged in.
const HAS_SESSION_KEY = 'hasAdminSession';

function hadPreviousSession(): boolean {
  try {
    return localStorage.getItem(HAS_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    // Only show loading spinner if we actually need to check auth
    isLoading: hadPreviousSession(),
  });

  // Only check auth if this browser has seen a successful login before
  useEffect(() => {
    if (!hadPreviousSession()) return;

    checkAuth().catch(() => {
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    });
  }, []);

  /**
   * Check if user is authenticated
   */
  const checkAuth = async () => {
    try {
      const response = await authRepository.getMe();
      if (response.success && response.data?.user) {
        setAuthState({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  /**
   * Login user with Google OAuth
   */
  const googleLogin = async (credential: string) => {
    try {
      const response = await authRepository.googleLogin(credential);
      if (response.success && response.data?.user) {
        try { localStorage.setItem(HAS_SESSION_KEY, 'true'); } catch { /* ignore */ }
        setAuthState({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }
      return { success: false, error: response.error || 'Google login failed' };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Google login failed',
      };
    }
  };

  /**
   * Logout user and clear authentication state
   */
  const logout = async () => {
    try {
      await authRepository.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      try { localStorage.removeItem(HAS_SESSION_KEY); } catch { /* ignore */ }
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  /**
   * Refresh access token
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await authRepository.refreshToken();
      return response.success;
    } catch (error) {
      await logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        googleLogin,
        logout,
        checkAuth,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
