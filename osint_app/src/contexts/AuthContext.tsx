'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/utils/storage';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { username: string; name?: string; email?: string; role?: string } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  checkAuth: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ username: string; name?: string; email?: string; role?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    
    const token = storage.getAuthToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
          setUser({ username: payload.username, name: payload.name, email: payload.email, role: payload.role });
          return true;
        } else {
          storage.removeAuthToken();
        }
      } catch (error) {
        storage.removeAuthToken();
      }
    }
    setIsAuthenticated(false);
    setUser(null);
    return false;
  }, []);

  useEffect(() => {
    checkAuth();
    setIsLoading(false);
    
    // Listen for storage changes (e.g., token set in another tab or by login/signup)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken') {
        checkAuth();
      }
    };
    
    // Also listen for custom event for same-tab updates
    const handleAuthChange = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authStateChanged', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
    };
  }, [checkAuth]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: include cookies
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined') {
          storage.setAuthToken(data.token);
        }
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        setIsAuthenticated(true);
        setUser({ username, name: payload.name, email: payload.email, role: payload.role });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      storage.removeAuthToken();
    }
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading, isAdmin, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}