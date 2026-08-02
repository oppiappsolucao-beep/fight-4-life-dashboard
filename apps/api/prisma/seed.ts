import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { ensureExerciseCatalog } from "../src/lib/exercise-catalog.js";

const prisma = new PrismaClient();

const DEFAULT_TENANT = {
  slug: "oppifit",
  name: "Oppi Fit",
  subdomain: null as string | null,
};

const DEFAULT_USERS = [
  {
    email: "admin@oppifit.com.br",
    legacyEmail: "admin@oppitech.com.br",
    password: "100316*",
    name: "Administrador",
    role: UserRole.ADMIN,
  },
  {
    email: "comercial@oppifit.com.br",
    legacyEmail: "comercial@oppitech.com.br",
    password: "comercial123",
    name: "Equipe Comercial",
    role: UserRole.COMERCIAL,
  },
  {
    email: "diretoria@oppifit.com.br",
    legacyEmail: "diretoria@oppitech.com.br",
    password: "diretoria123",
    name: "Diretoria",
    role: UserRole.DIRETORIA,
  },
  {
    email: "dev@oppifit.com.br",
    legacyEmail: "dev@oppitech.com.br",
    password: "100316*",
    name: "Equipe Desenvolvimento",
    role: UserRole.DESENVOLVIMENTO,
  },
];

const DEFAULT_PLANOS = {
  Mensal: 259,
  Trimestral: 239,
  Semestral: 219,
  Anual: 199,
};

async function ensurePlatformTenant() {
  const legacy = await prisma.tenant.findUnique({
    where: { slug: "oppi-tech" },
  });
  const current = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT.slug },
  });

  if (legacy && !current) {
    await prisma.tenant.update({
      where: { id: legacy.id },
      data: {
        slug: DEFAULT_TENANT.slug,
        name: DEFAULT_TENANT.name,
        subdomain: null,
        branding: {
          primaryColor: "#4a9fd8",
          logo: "/oppi_logo.png",
        },
      },
    });
    return prisma.tenant.findUniqueOrThrow({
      where: { slug: DEFAULT_TENANT.slug },
    });
  }

  if (legacy && current && legacy.id !== current.id) {
    // Mantém oppifit; remove marca antiga do tenant legado sem apagar academias.
    await prisma.tenant.update({
      where: { id: legacy.id },
      data: {
        name: "Oppi Fit (legado)",
        subdomain: null,
        active: false,
      },
    });
  }

  return prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT.slug },
    update: {
      name: DEFAULT_TENANT.name,
      subdomain: null,
      branding: {
        primaryColor: "#4a9fd8",
        logo: "/oppi_logo.png",
      },
    },
    create: {
      slug: DEFAULT_TENANT.slug,
      name: DEFAULT_TENANT.name,
      subdomain: null,
      branding: {
        primaryColor: "#4a9fd8",
        logo: "/oppi_logo.png",
      },
    },
  });
}

async function upsertPlatformUser(
  tenantId: string,
  user: (typeof DEFAULT_USERS)[number],
) {
  const passwordHash = await bcrypt.hash(user.password, 10);

  const legacyUser = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId,
        email: user.legacyEmail,
      },
    },
  });

  if (legacyUser) {
    const emailTaken = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: user.email,
        },
      },
    });

    if (!emailTaken) {
      await prisma.user.update({
        where: { id: legacyUser.id },
        data: {
          email: user.email,
          passwordHash,
          name: user.name,
          role: user.role,
          active: true,
        },
      });
      return;
    }

    await prisma.user.update({
      where: { id: legacyUser.id },
      data: {
        passwordHash,
        name: user.name,
        role: user.role,
        active: false,
      },
    });
  }

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: user.email,
      },
    },
    update: {
      passwordHash,
      name: user.name,
      role: user.role,
      active: true,
    },
    create: {
      tenantId,
      email: user.email,
      passwordHash,
      name: user.name,
      role: user.role,
    },
  });
}

async function main() {
  const tenant = await ensurePlatformTenant();

  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      planosPrecos: DEFAULT_PLANOS,
    },
    create: {
      tenantId: tenant.id,
      planosPrecos: DEFAULT_PLANOS,
    },
  });

  for (const user of DEFAULT_USERS) {
    await upsertPlatformUser(tenant.id, user);
  }

  const exerciseCount = await ensureExerciseCatalog();

  console.log("Seed concluído.");
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Exercícios no catálogo: ${exerciseCount}`);
  console.log("Usuários:");
  for (const user of DEFAULT_USERS) {
    console.log(`  - ${user.email} / ${user.password} (${user.role})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
