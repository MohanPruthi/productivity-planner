import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api, ApiError, setApiToken, setUnauthorizedHandler } from './api';

export type User = { id: string; email: string; name: string };
type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const TOKEN_KEY = 'planner.token';
const USER_KEY = 'planner.user';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    setApiToken(null);
    setUser(null);
    setStatus('signedOut');
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(USER_KEY).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Restore the stored session right away, then confirm the token with /api/auth/me in the background
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, storedUser] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
        SecureStore.getItemAsync(USER_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      if (!token) {
        setStatus('signedOut');
        return;
      }
      setApiToken(token);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore a corrupt cached user; /me below refreshes it
        }
      }
      setStatus('signedIn');

      try {
        const me = await api<User>('/api/auth/me');
        if (cancelled) return;
        setUser(me);
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(me)).catch(() => {});
      } catch (err) {
        // 403 is handled by the unauthorized handler; 401 also means the session is unusable.
        // A 404 only means the server predates /api/auth/me, so keep the session, like
        // network errors do (the app still opens offline).
        if (err instanceof ApiError && err.status === 401) {
          signOut();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
      auth: false,
    });
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, data.token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user)),
    ]);
    setApiToken(data.token);
    setUser(data.user);
    setStatus('signedIn');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
