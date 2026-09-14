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
  "usemint",
  "oppifit",
]);

function appBaseDomains(): string[] {
  const raw = (import.meta.env.VITE_APP_BASE_DOMAIN || "oppifit.com.br").trim();
  const domains = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return domains.length > 0 ? domains : ["oppifit.com.br"];
}

/** Domínio base principal para URLs exibidas no painel (ex.: oppifit.com.br). */
export function primaryAppBaseDomain(): string {
  return appBaseDomains()[0] || "oppifit.com.br";
}

export function platformHubHost(): string {
  return `academia.${primaryAppBaseDomain()}`;
}

function normalizeAcademySlug(value: string): string | null {
  const slug = value.trim().toLowerCase();
  if (!slug || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

/**
 * URL pública da academia no host que já tem SSL (academia.oppifit.com.br),
 * evitando o aviso “conexão não é particular” em subdomínios novos.
 */
export function academyPublicUrl(slugOrSubdomain: string): string {
  const slug = normalizeAcademySlug(slugOrSubdomain) ?? slugOrSubdomain.trim().toLowerCase();
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return `${window.location.origin}/a/${slug}`;
    }
  }
  return `https://${platformHubHost()}/a/${slug}`;
}

/** /a/fourarbjj → fourarbjj (null no hub da plataforma). */
export function getPathAcademySlug(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/a\/([a-z0-9-]+)(?=\/|$)/i);
  if (!match?.[1]) return null;
  return normalizeAcademySlug(match[1]);
}

export function routerBasename(): string {
  const slug = getPathAcademySlug();
  return slug ? `/a/${slug}` : "";
}

/** Slug da academia pelo subdomínio ou pelo caminho /a/{slug}. */
export function getAcademyAccessSlug(): string | null {
  return getHostSubdomain() ?? getPathAcademySlug();
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
 * No boot: subdomínio da academia OU caminho /a/{slug} no hub com SSL válido.
 */
export function bootstrapTenantFromHost(): {
  mode: "platform" | "tenant";
  subdomain: string | null;
} {
  const subdomain = getAcademyAccessSlug();

  if (!subdomain) {
    return { mode: "platform", subdomain: null };
  }

  if (getTenantSlug() !== subdomain) {
    setTenantSlug(subdomain);
  }

  return { mode: "tenant", subdomain };
}
