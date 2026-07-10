import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AUTH_STORAGE_KEY } from "@/lib/constants";

const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: "", user: null };
  } catch {
    return { token: "", user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(readStoredAuth);

  const setAuth = useCallback((nextAuth) => {
    setAuthState(nextAuth);
    if (nextAuth?.token) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    setAuth({ token: "", user: null });
  }, [setAuth]);

  const value = useMemo(
    () => ({
      auth,
      setAuth,
      logout,
      isAuthenticated: Boolean(auth.token),
    }),
    [auth, setAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
