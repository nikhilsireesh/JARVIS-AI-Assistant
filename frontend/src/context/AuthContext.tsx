'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, ApiError } from '../utils/api';

export interface UserPreferences {
  theme: string;
  model: string;
  notifications: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  preferences: UserPreferences;
  isGoogleConnected: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isLoggedIn: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const profile = await api.get<UserProfile>('/auth/me');
      setUser(profile);
      
      // Store preferences local theme
      if (profile.preferences?.theme) {
        document.documentElement.classList.add('dark'); // Dark mode only is requested by user, keep it dark!
      }
    } catch (err) {
      // If unauthorized, user remains null
      if (err instanceof ApiError && err.statusCode === 401) {
        setUser(null);
      } else {
        console.error('Failed to load profile:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ url: string }>('/auth/google');
      if (res.url) {
        window.location.href = res.url;
      } else {
        throw new Error('OAuth URL not returned from backend');
      }
    } catch (err) {
      console.error('Failed to trigger Google login:', err);
      alert('Authentication failed to initialize: ' + (err as Error).message);
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await api.post('/auth/logout');
      localStorage.removeItem('jarvis_token');
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        loginWithGoogle,
        logout,
        refreshProfile: fetchProfile
      }}
    >
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
