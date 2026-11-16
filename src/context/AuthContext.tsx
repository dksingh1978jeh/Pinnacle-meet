import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setSession: (token: string, user: UserProfile) => void;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pm_session_token');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = sessionStorage.getItem('pm_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      sessionStorage.setItem('pm_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setSession = useCallback((nextToken: string, nextUser: UserProfile) => {
    setToken(nextToken);
    setUser(nextUser);
    try {
      sessionStorage.setItem('pm_session_token', nextToken);
    } catch {
      // ignore
    }
  }, []);

  const fetchMe = useCallback(async (activeToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    if (!res.ok) {
      throw new Error('Session invalid');
    }
    const data = (await res.json()) as { user: UserProfile };
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const idToken = await fbUser.getIdToken();
          if (!mounted) return;
          setToken(idToken);
          await fetchMe(idToken);
        } else {
          const storedToken = sessionStorage.getItem('pm_session_token');
          if (storedToken) {
            await fetchMe(storedToken);
          } else {
            setUser(null);
            setToken(null);
          }
        }
      } catch {
        setUser(null);
        setToken(null);
        try {
          sessionStorage.removeItem('pm_session_token');
        } catch {
          // ignore
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [fetchMe]);

  const refreshProfile = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (fbUser) {
      const idToken = await fbUser.getIdToken(true);
      setToken(idToken);
      await fetchMe(idToken);
    } else if (token) {
      await fetchMe(token);
    }
  }, [fetchMe, token]);

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setToken(idToken);
    const syncedUser = await fetchMe(idToken);
    return syncedUser;
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore if not firebase user
    }
    try {
      sessionStorage.removeItem('pm_session_token');
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      let activeToken = token;
      if (auth.currentUser) {
        activeToken = await auth.currentUser.getIdToken();
        setToken(activeToken);
      }
      const headers = new Headers(init?.headers || {});
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      return fetch(url, { ...init, headers });
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        theme,
        toggleTheme,
        setSession,
        refreshProfile,
        signInWithGoogle,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
