import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getHostSubdomain } from "../lib/tenantHost";

/**
 * Se o usuário autenticado abrir outro subdomínio de academia,
 * encerra a sessão para evitar vazamento de contexto entre tenants.
 */
export function useAcademyHostGuard() {
  const { tenant, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !tenant) return;

    const hostSub = getHostSubdomain();
    if (!hostSub) return;

    const matchesSlug = hostSub === tenant.slug;
    const matchesSubdomain =
      Boolean(tenant.subdomain) && hostSub === tenant.subdomain;

    if (!matchesSlug && !matchesSubdomain) {
      logout();
    }
  }, [isAuthenticated, tenant, logout]);
}
