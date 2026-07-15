import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { formToBranding } from "../src/modules/dev/academy.js";
import { uniqueTenantSlug } from "../src/lib/slug.js";

const prisma = new PrismaClient();

const ACADEMY = {
  razaoSocial: "Four Ar BJJ Ltda",
  nomeFantasia: "Four Ar BJJ",
  cnpj: "00.000.000/0001-00",
  emailCorporativo: "contato@fourarbjj.com.br",
  nomeResponsavel: "Proprietario Four Ar",
  cpfResponsavel: "000.000.000-00",
  emailLogin: "dono@fourarbjj.com.br",
  telefoneResponsavel: "",
  telefoneComercial: "",
  plano: "Bronze",
  periodo: "Mensal",
  formaPagamento: "Pix",
  senha: "fourar123",
};

async function main() {
  const existing = await prisma.tenant.findFirst({
    where: {
      OR: [
        { name: { equals: ACADEMY.nomeFantasia, mode: "insensitive" } },
        { slug: "four-ar-bjj" },
      ],
    },
  });

  if (existing) {
    console.log("Four Ar BJJ ja existe:", existing.slug);
    return;
  }

  const emailLogin = ACADEMY.emailLogin.toLowerCase();
  const slug = await uniqueTenantSlug(ACADEMY.nomeFantasia, async (candidate) => {
    const found = await prisma.tenant.findUnique({ where: { slug: candidate } });
    return Boolean(found);
  });

  const passwordHash = await bcrypt.hash(ACADEMY.senha, 10);

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: ACADEMY.nomeFantasia,
      subdomain: slug,
      active: true,
      branding: formToBranding(ACADEMY, emailLogin),
      config: { create: { planosPrecos: {} } },
      users: {
        create: {
          email: emailLogin,
          passwordHash,
          name: ACADEMY.nomeResponsavel,
          role: UserRole.PROPRIETARIO,
          active: true,
        },
      },
    },
    include: {
      users: { where: { role: UserRole.PROPRIETARIO } },
    },
  });

  console.log("Four Ar BJJ cadastrada com sucesso!");
  console.log("Slug:", tenant.slug);
  console.log("Dono login:", tenant.users[0]?.email);
  console.log("Senha dono:", ACADEMY.senha);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
