import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  phone: string;
  full_name: string | null;
  is_admin: boolean;
  kyc_status: string;
  pin_hash: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('abanremit_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {
        localStorage.removeItem('abanremit_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });
      if (error) return { success: false, message: error.message };
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to send OTP' };
    }
  };

  const verifyOtp = async (phone: string, code: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, code },
      });
      if (error) return { success: false, message: error.message };
      if (data?.success && data?.user) {
        setUser(data.user);
        localStorage.setItem('abanremit_user', JSON.stringify(data.user));
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to verify OTP' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('abanremit_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyOtp, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
