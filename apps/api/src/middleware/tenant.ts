import type { FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantContext;
  }
}

/** Subdomínios de plataforma — não mapeiam academia. */
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
  const raw = process.env.APP_BASE_DOMAIN || "oppifit.com.br,oppitech.com.br";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/** Extrai o subdomínio do Host (ex.: dojotakeda.oppifit.com.br → dojotakeda). */
export function extractSubdomainFromHost(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;

  const host = hostHeader.split(":")[0]?.toLowerCase().trim();
  if (!host) return null;

  for (const base of appBaseDomains()) {
    if (host === base || host === `www.${base}`) {
      return null;
    }

    if (!host.endsWith(`.${base}`)) continue;

    const sub = host.slice(0, -(base.length + 1));
    if (!sub || sub.includes(".")) continue;
    if (RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  return null;
}

export async function resolveTenantFromHost(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const subdomain = extractSubdomainFromHost(request.headers.host);
  if (!subdomain) return null;

  return prisma.tenant.findFirst({
    where: {
      active: true,
      OR: [{ subdomain }, { slug: subdomain }],
    },
    select: { id: true, slug: true, name: true },
  });
}

export async function resolveTenant(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const fromHost = await resolveTenantFromHost(request);
  if (fromHost) return fromHost;

  const slug =
    (request.headers["x-tenant-slug"] as string | undefined) ??
    process.env.DEFAULT_TENANT_SLUG ??
    "oppi-tech";

  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
}

export function academyPublicUrl(slugOrSubdomain: string): string {
  const base = appBaseDomains()[0] || "oppifit.com.br";
  return `https://${slugOrSubdomain}.${base}`;
}
