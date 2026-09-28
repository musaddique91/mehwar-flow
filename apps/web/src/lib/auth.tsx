'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, LoginInput, UserDto } from '@mehwar/shared';
import { api, refreshSession, setAccessToken } from './api';

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: {
    email: string;
    password: string;
    name: string;
    timezone: string;
  }): Promise<void>;
  logout(): Promise<void>;
  setUser(user: UserDto): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const accept = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setUser,
      login: async (input) =>
        accept(await api<AuthResponse>('/auth/login', { method: 'POST', json: input })),
      register: async (input) =>
        accept(await api<AuthResponse>('/auth/register', { method: 'POST', json: input })),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, loading, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
