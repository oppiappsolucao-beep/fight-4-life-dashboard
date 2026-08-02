import { getTenantSlug, setTenantSlug } from "./api";

const RESERVED_SUBDOMAINS = new Set([
  "academia",
  "www",
  "api",
  "app",
  "admin",
  "cdn",
  "mail",
  "dev",
  "static",
]);

function appBaseDomains(): string[] {
  const raw = import.meta.env.VITE_APP_BASE_DOMAIN || "oppifit.com.br,oppitech.com.br";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/** Domínio base principal para URLs exibidas no painel (ex.: oppifit.com.br). */
export function primaryAppBaseDomain(): string {
  return appBaseDomains()[0] || "oppifit.com.br";
}

export function academyPublicUrl(slugOrSubdomain: string): string {
  return `https://${slugOrSubdomain}.${primaryAppBaseDomain()}`;
}

/** Lê o subdomínio do host atual (null = hub plataforma, ex. academia.oppifit.com.br). */
export function getHostSubdomain(): string | null {
  if (typeof window === "undefined") return null;

  const host = window.location.hostname.toLowerCase();

  for (const base of appBaseDomains()) {
    if (host === base || host === `www.${base}`) return null;
    if (!host.endsWith(`.${base}`)) continue;

    const sub = host.slice(0, -(base.length + 1));
    if (!sub || sub.includes(".")) continue;
    if (RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  return null;
}

/**
 * No boot do app: se estiver em academia.oppifit.com.br, usa o subdomínio como tenant.
 * Em academia.oppifit.com.br (hub), não força tenant.
 */
export function bootstrapTenantFromHost(): {
  mode: "platform" | "tenant";
  subdomain: string | null;
} {
  const subdomain = getHostSubdomain();

  if (!subdomain) {
    return { mode: "platform", subdomain: null };
  }

  if (getTenantSlug() !== subdomain) {
    setTenantSlug(subdomain);
  }

  return { mode: "tenant", subdomain };
}
