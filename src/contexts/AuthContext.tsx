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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch app user', error);
      return null;
    }

    return data as AppUser | null;
  }, []);

  const ensureAppUser = useCallback(async (authUser: SupabaseUser) => {
    const existingUser = await fetchAppUser(authUser.id);
    if (existingUser) return existingUser;

    const fullName = typeof authUser.user_metadata?.full_name === 'string'
      ? authUser.user_metadata.full_name
      : null;

    const { data, error } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.id,
        email: authUser.email ?? null,
        full_name: fullName,
      })
      .select('*')
      .single();

    if (error) {
      const recoveredUser = await fetchAppUser(authUser.id);
      if (recoveredUser) return recoveredUser;

      console.error('Failed to create app user', error);
      return null;
    }

    return data as AppUser;
  }, [fetchAppUser]);

  const syncSessionUser = useCallback(async (sess: Session | null) => {
    setSession(sess);

    if (!sess?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const appUser = await ensureAppUser(sess.user);
      setUser(appUser);
    } catch (error) {
      console.error('Failed to sync authenticated user', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [ensureAppUser]);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      // Use setTimeout to avoid Supabase auth deadlock
      setTimeout(() => {
        void syncSessionUser(sess);
      }, 0);
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      void syncSessionUser(sess);
    });

    return () => subscription.unsubscribe();
  }, [syncSessionUser]);

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

      if (data.user && data.session) {
        const appUser = await ensureAppUser(data.user);
        if (!appUser) {
          return {
            success: false,
            message: 'Account created, but profile setup failed. Please try signing in again.',
          };
        }
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
      const appUser = await ensureAppUser(session.user);
      setUser(appUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
