import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, clearTenantSlug, setTenantSlug } from "../lib/api";
import type { AuthUser, LoginResponse, Tenant } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  ownerLogin: (email: string, password: string) => Promise<void>;
  professorLogin: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistSession(data: LoginResponse) {
  localStorage.setItem("token", data.token);
  setTenantSlug(data.tenant.slug);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    clearTenantSlug();
    setUser(null);
    setTenant(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    persistSession(data);
    setUser(data.user);
    setTenant(data.tenant);
  }, []);

  const ownerLogin = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<LoginResponse>("/auth/owner-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    persistSession(data);
    setUser(data.user);
    setTenant(data.tenant);
  }, []);

  const professorLogin = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<LoginResponse>("/auth/professor-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    persistSession(data);
    setUser(data.user);
    setTenant(data.tenant);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<{ user: AuthUser; tenant: Tenant }>("/auth/me")
      .then((data) => {
        setUser(data.user);
        setTenant(data.tenant);
        setTenantSlug(data.tenant.slug);
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      tenant,
      loading,
      login,
      ownerLogin,
      professorLogin,
      logout,
      isAuthenticated: Boolean(user),
    }),
    [user, tenant, loading, login, ownerLogin, professorLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
