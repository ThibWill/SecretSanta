import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

/** Page d'accueil selon le rôle. */
export const homePath = (user) => (user?.isParticipant ? '/' : '/admin');

export function AuthProvider({ children }) {
  // undefined = vérification de session en cours ; null = non connecté.
  const [user, setUser] = useState(undefined);
  const [bootError, setBootError] = useState(null);

  const checkSession = useCallback(async () => {
    setBootError(null);
    try {
      const { user } = await api.me();
      setUser(user);
    } catch (err) {
      if (err.status === 401) setUser(null);
      else setBootError(err);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    checkSession();
    return () => setUnauthorizedHandler(null);
  }, [checkSession]);

  const login = useCallback(async (name, password) => {
    const { user } = await api.login(name, password);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, bootError, checkSession, login, logout }),
    [user, bootError, checkSession, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
