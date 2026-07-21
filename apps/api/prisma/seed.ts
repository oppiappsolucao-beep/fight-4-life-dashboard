import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { seedExercises } from "./seed-exercises.js";

const prisma = new PrismaClient();

const DEFAULT_TENANT = {
  slug: "oppi-tech",
  name: "Oppi Tech",
  subdomain: "oppitech",
};

const DEFAULT_USERS = [
  {
    email: "admin@oppitech.com.br",
    password: "100316*",
    name: "Administrador",
    role: UserRole.ADMIN,
  },
  {
    email: "comercial@oppitech.com.br",
    password: "comercial123",
    name: "Equipe Comercial",
    role: UserRole.COMERCIAL,
  },
  {
    email: "diretoria@oppitech.com.br",
    password: "diretoria123",
    name: "Diretoria",
    role: UserRole.DIRETORIA,
  },
  {
    email: "dev@oppitech.com.br",
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

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT.slug },
    update: {
      name: DEFAULT_TENANT.name,
      subdomain: DEFAULT_TENANT.subdomain,
      branding: {
        primaryColor: "#ff1f3d",
        logo: "/oppi_logo.png",
      },
    },
    create: {
      slug: DEFAULT_TENANT.slug,
      name: DEFAULT_TENANT.name,
      subdomain: DEFAULT_TENANT.subdomain,
      branding: {
        primaryColor: "#ff1f3d",
        logo: "/oppi_logo.png",
      },
    },
  });

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
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
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
        tenantId: tenant.id,
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
      },
    });
  }

  const exerciseCount = await seedExercises(prisma);

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
