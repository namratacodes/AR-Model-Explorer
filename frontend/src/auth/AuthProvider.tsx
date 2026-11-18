import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_EXPIRED_EVENT, api, tokenStorage } from "../lib/api";
import type { User } from "../types";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // If a token is saved, we must check it with the server before showing anything.
  const [loading, setLoading] = useState<boolean>(() => tokenStorage.get() !== null);

  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // A 401 already cleared the token; a network error keeps it for the next try.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    tokenStorage.set(access_token);
    try {
      setUser(await api.me());
    } catch (err) {
      tokenStorage.clear();
      throw err;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await api.register(email, password);
      await login(email, password); // sign the new user straight in
    },
    [login],
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}