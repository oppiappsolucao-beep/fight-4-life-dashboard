import type { FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  subdomain?: string | null;
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

/** Slugs do tenant da plataforma (hub / painel OPPI Fit). */
export const PLATFORM_TENANT_SLUGS = ["oppifit", "oppi-tech"] as const;

export function platformTenantSlug(): string {
  return (
    process.env.PLATFORM_TENANT_SLUG ||
    process.env.DEFAULT_TENANT_SLUG ||
    "oppifit"
  );
}

export function isPlatformTenantSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const normalized = slug.trim().toLowerCase();
  return (
    normalized === platformTenantSlug().toLowerCase() ||
    (PLATFORM_TENANT_SLUGS as readonly string[]).includes(normalized)
  );
}

function appBaseDomains(): string[] {
  const raw = process.env.APP_BASE_DOMAIN || "oppifit.com.br";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(",")[0]?.trim();
}

/** Host efetivo (respeita proxy com X-Forwarded-Host). */
export function getRequestHost(request: FastifyRequest): string | undefined {
  return (
    firstHeaderValue(request.headers["x-forwarded-host"]) ||
    firstHeaderValue(request.headers.host)
  );
}

export function isLocalRequestHost(hostHeader: string | undefined): boolean {
  const host = hostHeader?.split(":")[0]?.toLowerCase().trim() ?? "";
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  );
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

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  subdomain: true,
} as const;

export async function resolveTenantFromHost(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const subdomain = extractSubdomainFromHost(getRequestHost(request));
  if (!subdomain) return null;

  return prisma.tenant.findFirst({
    where: {
      active: true,
      OR: [{ subdomain }, { slug: subdomain }],
    },
    select: tenantSelect,
  });
}

/**
 * Resolve academia para login dono/professor/aluno:
 * 1) Host / X-Forwarded-Host
 * 2) Header X-Tenant-Slug (quando não for hub/plataforma)
 */
export async function resolveAcademyTenant(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const fromHost = await resolveTenantFromHost(request);
  if (fromHost) return fromHost;

  const slug = (request.headers["x-tenant-slug"] as string | undefined)
    ?.trim()
    .toLowerCase();

  if (!slug || RESERVED_SUBDOMAINS.has(slug) || isPlatformTenantSlug(slug)) {
    return null;
  }

  return prisma.tenant.findFirst({
    where: {
      active: true,
      OR: [{ subdomain: slug }, { slug }],
    },
    select: tenantSelect,
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
    platformTenantSlug();

  return prisma.tenant.findUnique({
    where: { slug },
    select: tenantSelect,
  });
}

export function academyPublicUrl(slugOrSubdomain: string): string {
  const base = appBaseDomains()[0] || "oppifit.com.br";
  return `https://${slugOrSubdomain}.${base}`;
}
