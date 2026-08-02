import { PrismaClient } from "@prisma/client";
import { PLATFORM_TENANT_SLUGS } from "../src/middleware/tenant.js";

const prisma = new PrismaClient();

const tenants = await prisma.tenant.findMany({
  where: { slug: { notIn: [...PLATFORM_TENANT_SLUGS] } },
  include: {
    users: { where: { role: "PROPRIETARIO" } },
  },
  orderBy: { createdAt: "desc" },
});

console.log(
  JSON.stringify(
    tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      subdomain: t.subdomain,
      active: t.active,
      ownerEmail: t.users[0]?.email ?? null,
      createdAt: t.createdAt,
    })),
    null,
    2,
  ),
);

await prisma.$disconnect();
