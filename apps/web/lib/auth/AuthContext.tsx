'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LoginRequest, RegisterApplicantRequest, UserPublic } from '@invision/stand-client';
import { api } from '../stand/client';
import { ApiError } from '../stand/error';
import { whenApiReady } from '../stand/ready';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserPublic | null;
  accessExpiresAt: string | null;
  register: (payload: RegisterApplicantRequest) => Promise<void>;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserPublic | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // In mock mode the worker must be intercepting before the first request,
      // otherwise this call hits the real network and resolves as a failure.
      await whenApiReady();

      try {
        const profile = await api.auth.me();
        if (!cancelled) {
          setUser(profile);
          setStatus('authenticated');
        }
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          if (!cancelled) setStatus('unauthenticated');
          return;
        }
      }

      // Access cookie missing or expired: attempt one silent refresh before
      // giving up, matching the 15-minute access / 7-day refresh contract.
      try {
        await api.auth.refresh();
        const profile = await api.auth.me();
        if (!cancelled) {
          setUser(profile);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (payload: RegisterApplicantRequest) => {
    const session = await api.auth.register(payload);
    setUser(session.user);
    setAccessExpiresAt(session.accessExpiresAt);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const session = await api.auth.login(payload);
    setUser(session.user);
    setAccessExpiresAt(session.accessExpiresAt);
    setStatus('authenticated');
  }, []);

  /**
   * Logout clears local state only when the server actually ended the session.
   *
   * A failed CSRF check means the server refused and the session is still live,
   * so showing the applicant as signed out would be a lie — the error is raised
   * instead, and they can refresh and try again. A network failure is different:
   * we cannot confirm either way, and someone who asked to leave this device
   * should not be left looking signed in, so local state is cleared and the
   * server session expires on its own.
   */
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CSRF_VALIDATION_FAILED') throw error;
    }

    setUser(null);
    setAccessExpiresAt(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, accessExpiresAt, register, login, logout }),
    [status, user, accessExpiresAt, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
