import type { FastifyInstance } from "fastify";

import bcrypt from "bcryptjs";

import { UserRole } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

import { slugify, uniqueTenantSlug } from "../../lib/slug.js";
import { academyPublicUrl } from "../../middleware/tenant.js";

import { requireAuth, requireRole } from "../../middleware/auth.js";

import {

  academyCreateSchema,

  academyUpdateSchema,

  brandingToForm,

  formToBranding,

  parseBilling,

} from "./academy.js";

import { getPlatformPlanValue } from "./billing.js";
import { DEV_NEW_ACADEMIES_GOAL, percentValue } from "../../lib/goals.js";
import { registerDevModalityRoutes } from "../modalities/routes.js";
import { PLATFORM_TENANT_SLUGS } from "../../middleware/tenant.js";
import { sumPlatformRevenueForOpenCycles } from "../../lib/charge-payments.js";
import { centsToBrl } from "../../lib/platform-fees.js";
import { asaasSetupChecklist, isAsaasConfigured } from "../../lib/asaas/config.js";



async function findAcademyOr404(id: string) {

  const tenant = await prisma.tenant.findUnique({

    where: { id },

    include: {

      users: {

        where: { role: UserRole.PROPRIETARIO },

        take: 1,

      },

    },

  });



  if (
    !tenant ||
    (PLATFORM_TENANT_SLUGS as readonly string[]).includes(tenant.slug)
  ) {
    return null;
  }



  return tenant;

}



async function isOwnerEmailTaken(email: string, excludeUserId?: string) {

  const existingOwner = await prisma.user.findFirst({

    where: {

      email,

      role: UserRole.PROPRIETARIO,

      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),

    },

  });



  return Boolean(existingOwner);

}



export async function devRoutes(app: FastifyInstance): Promise<void> {

  app.get(
    "/dev/overview",
    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },
    async (request, reply) => {
      const tenants = await prisma.tenant.findMany({
        where: { slug: { notIn: [...PLATFORM_TENANT_SLUGS] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true,
          createdAt: true,
          branding: true,
          users: {
            where: { role: UserRole.PROPRIETARIO },
            select: { id: true, email: true, name: true, active: true },
            take: 1,
          },
        },
      });

      let academiasAtivas = 0;
      let academiasInativas = 0;
      let donosCadastrados = 0;
      let receitaPlanosLegado = 0;

      for (const tenant of tenants) {
        if (tenant.active) {
          academiasAtivas += 1;
          const billing = parseBilling(tenant.branding);
          receitaPlanosLegado += getPlatformPlanValue(billing.plano, billing.periodo);
        } else {
          academiasInativas += 1;
        }

        if (tenant.users[0]) {
          donosCadastrados += 1;
        }
      }

      const feeRevenue = await sumPlatformRevenueForOpenCycles();
      const receitaPlataforma = centsToBrl(feeRevenue.receitaPlataformaCents);

      return reply.send({
        user: { name: request.user.name ?? null },
        metrics: {
          totalAcademias: tenants.length,
          academiasAtivas,
          academiasInativas,
          donosCadastrados,
          receitaPlataforma,
          cobrancasPagasCiclo: feeRevenue.cobrancasPagas,
          academiasComPagamento: feeRevenue.academiasComPagamento,
          receitaPlanosLegado,
        },
        billingModel: {
          tier1Fee: 1.9,
          tier2Fee: 1.49,
          tier1Limit: 100,
          basis: "por academia · mês da academia · só cobranças pagas",
        },
        asaas: {
          configured: isAsaasConfigured(),
          missingEnv: asaasSetupChecklist(),
        },
        recentAcademias: tenants.slice(0, 5).map((tenant) => {
          const billing = parseBilling(tenant.branding);
          return {
            id: tenant.id,
            name: tenant.name,
            active: tenant.active,
            createdAt: tenant.createdAt.toISOString(),
            billing,
            ownerEmail: tenant.users[0]?.email ?? null,
          };
        }),
        metas: [
          {
            id: "academias-ativas",
            label: "Academias ativas",
            atual: academiasAtivas,
            meta: Math.max(tenants.length, 1),
            unidade: "academias",
            status: "ativo",
          },
          {
            id: "receita-plataforma",
            label: "Receita taxas (ciclos abertos)",
            atual: receitaPlataforma,
            meta: Math.max(receitaPlataforma, 1),
            unidade: "R$",
            status: "ativo",
          },
          {
            id: "cobrancas-pagas",
            label: "Cobranças pagas (ciclos)",
            atual: feeRevenue.cobrancasPagas,
            meta: Math.max(feeRevenue.cobrancasPagas, 1),
            unidade: "pagamentos",
            status: feeRevenue.cobrancasPagas > 0 ? "ativo" : "em_breve",
          },
          {
            id: "novas-academias-mes",
            label: "Novas academias no mês",
            atual: tenants.filter((tenant) => {
              const created = tenant.createdAt;
              const now = new Date();
              return (
                created.getMonth() === now.getMonth() &&
                created.getFullYear() === now.getFullYear()
              );
            }).length,
            meta: DEV_NEW_ACADEMIES_GOAL,
            unidade: "academias",
            status: "ativo",
          },
          {
            id: "churn-plataforma",
            label: "Churn da plataforma",
            atual: percentValue(academiasInativas, tenants.length),
            meta: 5,
            unidade: "%",
            status: "ativo",
            direction: "down",
          },
        ],
      });
    },
  );

  app.get(

    "/dev/academias",

    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },

    async (_request, reply) => {

      const tenants = await prisma.tenant.findMany({

        where: {

          slug: { notIn: [...PLATFORM_TENANT_SLUGS] },

        },

        orderBy: { createdAt: "desc" },

        select: {

          id: true,

          slug: true,

          subdomain: true,

          name: true,

          active: true,

          createdAt: true,

          branding: true,

          users: {

            where: { role: UserRole.PROPRIETARIO },

            select: {

              id: true,

              email: true,

              name: true,

              active: true,

            },

            take: 1,

          },

        },

      });



      const academias = tenants.map((tenant) => {

        const owner = tenant.users[0] ?? null;

        const hostKey = tenant.subdomain || tenant.slug;

        return {

          id: tenant.id,

          slug: tenant.slug,

          subdomain: hostKey,

          url: academyPublicUrl(hostKey),

          name: tenant.name,

          active: tenant.active,

          createdAt: tenant.createdAt,

          billing: parseBilling(tenant.branding),

          owner: owner

            ? {

                id: owner.id,

                email: owner.email,

                name: owner.name,

                active: owner.active,

              }

            : null,

        };

      });



      return reply.send({ academias });

    },

  );



  app.get(

    "/dev/academias/:id",

    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },

    async (request, reply) => {

      const { id } = request.params as { id: string };

      const tenant = await findAcademyOr404(id);



      if (!tenant) {

        return reply.status(404).send({ error: "Academia não encontrada." });

      }



      const owner = tenant.users[0] ?? null;

      const form = brandingToForm(tenant.branding, tenant.name, {
        subdominio: tenant.subdomain ?? tenant.slug,
      });

      if (owner && !form.emailLogin) {
        form.emailLogin = owner.email;
      }

      return reply.send({
        id: tenant.id,
        slug: tenant.slug,
        subdomain: tenant.subdomain ?? tenant.slug,
        active: tenant.active,
        form,

        owner: owner

          ? {

              id: owner.id,

              email: owner.email,

              name: owner.name,

              active: owner.active,

            }

          : null,

      });

    },

  );



  app.patch(

    "/dev/academias/:id",

    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },

    async (request, reply) => {

      const { id } = request.params as { id: string };

      const parsed = academyUpdateSchema.safeParse(request.body);



      if (!parsed.success) {

        return reply.status(400).send({

          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",

        });

      }



      const tenant = await findAcademyOr404(id);



      if (!tenant) {

        return reply.status(404).send({ error: "Academia não encontrada." });

      }



      const data = parsed.data;

      const emailLogin = data.emailLogin.toLowerCase();

      const owner = tenant.users[0];



      if (!owner) {

        return reply.status(400).send({

          error: "Academia sem usuário dono cadastrado.",

        });

      }



      if (await isOwnerEmailTaken(emailLogin, owner.id)) {

        return reply.status(409).send({

          error: "Este e-mail de login já está em uso por outra academia.",

        });

      }



      const ownerUpdate: {

        email: string;

        name: string;

        active: boolean;

        passwordHash?: string;

      } = {

        email: emailLogin,

        name: data.nomeResponsavel,

        active: data.active,

      };



      if (data.senha) {
        ownerUpdate.passwordHash = await bcrypt.hash(data.senha, 10);
      }

      let nextSubdomain = tenant.subdomain;
      if (data.subdominio) {
        const customSub = slugify(data.subdominio);
        const taken = await prisma.tenant.findFirst({
          where: {
            id: { not: tenant.id },
            OR: [{ slug: customSub }, { subdomain: customSub }],
          },
          select: { id: true },
        });
        if (taken) {
          return reply.status(409).send({
            error: "Este subdomínio já está em uso por outra academia.",
          });
        }
        nextSubdomain = customSub;
      }

      const updated = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          name: data.nomeFantasia,
          active: data.active,
          subdomain: nextSubdomain,
          branding: formToBranding(data, emailLogin),
          users: {
            update: {
              where: { id: owner.id },
              data: ownerUpdate,
            },
          },
        },
        include: {
          users: {
            where: { role: UserRole.PROPRIETARIO },
            select: { id: true, email: true, name: true, role: true, active: true },
          },
        },
      });

      const updatedOwner = updated.users[0];

      return reply.send({
        tenant: {
          id: updated.id,
          slug: updated.slug,
          subdomain: updated.subdomain ?? updated.slug,
          name: updated.name,
          active: updated.active,
          url: academyPublicUrl(updated.subdomain ?? updated.slug),
        },
        owner: updatedOwner,
        message: "Academia atualizada com sucesso.",
      });

    },

  );



  app.delete(

    "/dev/academias/:id",

    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },

    async (request, reply) => {

      const { id } = request.params as { id: string };

      const tenant = await findAcademyOr404(id);



      if (!tenant) {

        return reply.status(404).send({ error: "Academia não encontrada." });

      }



      await prisma.tenant.delete({

        where: { id: tenant.id },

      });



      return reply.send({ message: "Academia excluída com sucesso." });

    },

  );



  app.post(

    "/dev/academias",

    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },

    async (request, reply) => {

      const parsed = academyCreateSchema.safeParse(request.body);



      if (!parsed.success) {

        return reply.status(400).send({

          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",

        });

      }



      const data = parsed.data;

      const emailLogin = data.emailLogin.toLowerCase();

      const customSub = data.subdominio ? slugify(data.subdominio) : "";

      let slug: string;

      if (customSub) {
        const taken = await prisma.tenant.findFirst({
          where: {
            OR: [{ slug: customSub }, { subdomain: customSub }],
          },
          select: { id: true },
        });

        if (taken) {
          return reply.status(409).send({
            error: `O subdomínio "${customSub}" já está em uso.`,
          });
        }

        slug = customSub;
      } else {
        slug = await uniqueTenantSlug(data.nomeFantasia, async (candidate) => {
          const found = await prisma.tenant.findFirst({
            where: {
              OR: [{ slug: candidate }, { subdomain: candidate }],
            },
            select: { id: true },
          });
          return Boolean(found);
        });
      }

      if (await isOwnerEmailTaken(emailLogin)) {

        return reply.status(409).send({

          error: "Este e-mail de login já está em uso por outra academia.",

        });

      }



      const passwordHash = await bcrypt.hash(data.senha, 10);



      const tenant = await prisma.tenant.create({

        data: {

          slug,

          name: data.nomeFantasia,

          subdomain: slug,

          active: true,

          branding: formToBranding(data, emailLogin),

          config: {

            create: {

              planosPrecos: {},

            },

          },

          users: {

            create: {

              email: emailLogin,

              passwordHash,

              name: data.nomeResponsavel,

              role: UserRole.PROPRIETARIO,

              active: true,

            },

          },

        },

        include: {

          users: {

            where: { role: UserRole.PROPRIETARIO },

            select: { id: true, email: true, name: true, role: true },

          },

        },

      });



      const owner = tenant.users[0];



      return reply.status(201).send({

        tenant: {

          id: tenant.id,

          slug: tenant.slug,

          subdomain: tenant.subdomain ?? tenant.slug,

          url: academyPublicUrl(tenant.subdomain ?? tenant.slug),

          name: tenant.name,

        },

        owner,

        message: "Academia cadastrada e acesso do dono liberado.",

      });

    },

  );

  await registerDevModalityRoutes(app);
}

