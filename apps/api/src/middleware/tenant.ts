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

export async function resolveTenant(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const slug =
    (request.headers["x-tenant-slug"] as string | undefined) ??
    process.env.DEFAULT_TENANT_SLUG ??
    "oppi-tech";

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });

  return tenant;
}
