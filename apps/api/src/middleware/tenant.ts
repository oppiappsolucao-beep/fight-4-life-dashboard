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

/** Host efetivo (respeita proxy EasyPanel/Traefik). */
export function getRequestHost(request: FastifyRequest): string | undefined {
  const forwarded = firstHeaderValue(request.headers.forwarded);
  const forwardedHost = forwarded
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("host="))
    ?.slice(5)
    ?.replace(/^"|"$/g, "");

  return (
    firstHeaderValue(request.headers["x-forwarded-host"]) ||
    firstHeaderValue(request.headers["x-original-host"]) ||
    forwardedHost ||
    // Com trustProxy, Fastify expõe o host público aqui
    (typeof request.hostname === "string" && request.hostname
      ? request.hostname
      : undefined) ||
    firstHeaderValue(request.headers.host)
  );
}

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  subdomain: true,
} as const;

export async function findAcademyTenantByKey(
  key: string | null | undefined,
): Promise<TenantContext | null> {
  const normalized = key?.trim().toLowerCase();
  if (!normalized || RESERVED_SUBDOMAINS.has(normalized) || isPlatformTenantSlug(normalized)) {
    return null;
  }

  return prisma.tenant.findFirst({
    where: {
      active: true,
      OR: [{ subdomain: normalized }, { slug: normalized }],
    },
    select: tenantSelect,
  });
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
 * 2) Header X-Tenant-Slug
 * 3) slug explícito (body/query) — fallback quando o proxy não envia Host
 */
export async function resolveAcademyTenant(
  request: FastifyRequest,
  explicitSlug?: string | null,
): Promise<TenantContext | null> {
  const fromHost = await resolveTenantFromHost(request);
  if (fromHost) return fromHost;

  const headerSlug = (request.headers["x-tenant-slug"] as string | undefined)
    ?.trim()
    .toLowerCase();
  const fromHeader = await findAcademyTenantByKey(headerSlug);
  if (fromHeader) return fromHeader;

  return findAcademyTenantByKey(explicitSlug);
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
