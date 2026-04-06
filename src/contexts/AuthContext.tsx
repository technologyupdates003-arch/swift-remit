import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface AppUser {
  id: string;
  auth_user_id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
  kyc_status: string;
  pin_hash: string | null;
  created_at: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; message: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  setUser: (user: AppUser | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = useCallback(async (authUserId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    return data as AppUser | null;
  }, []);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(async () => {
          const appUser = await fetchAppUser(sess.user.id);
          setUser(appUser);
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) {
        fetchAppUser(sess.user.id).then(appUser => {
          setUser(appUser);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAppUser]);

  const signUp = async (email: string, password: string, fullName: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });

      if (error) return { success: false, message: error.message };

      if (data.user) {
        // Create app user profile
        await supabase.from('users').insert({
          auth_user_id: data.user.id,
          email,
          full_name: fullName,
        });
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return { success: true, message: 'Please check your email to verify your account.' };
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Signup failed' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Logged in!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Login failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const refreshUser = async () => {
    if (session?.user) {
      const appUser = await fetchAppUser(session.user.id);
      setUser(appUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
