import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tenants = await prisma.tenant.findMany({
  where: { slug: { not: "oppi-tech" } },
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
      active: t.active,
      ownerEmail: t.users[0]?.email ?? null,
      createdAt: t.createdAt,
    })),
    null,
    2,
  ),
);

await prisma.$disconnect();
