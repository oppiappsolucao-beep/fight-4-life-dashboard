import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import {
  isStudentBillingBlocked,
  STUDENT_BILLING_BLOCKED_MESSAGE,
} from "../../lib/billing.js";
import {
  extractSubdomainFromHost,
  findAcademyTenantByKey,
  getRequestHost,
  resolveAcademyTenant,
  resolveTenant,
  resolveTenantFromHost,
} from "../../middleware/tenant.js";
import { requireAuth } from "../../middleware/auth.js";

function tenantMatchesHost(
  tenant: { slug: string; subdomain?: string | null },
  hostSub: string,
): boolean {
  return tenant.slug === hostSub || tenant.subdomain === hostSub;
}

/** Garante que a academia autenticada fique ligada ao subdomínio da URL. */
async function bindTenantToHostSubdomain<
  T extends { id: string; slug: string; subdomain?: string | null },
>(tenant: T, hostSub: string): Promise<T> {
  if (tenantMatchesHost(tenant, hostSub)) return tenant;

  // Libera o campo subdomain em outro tenant (não altera slug de ninguém)
  await prisma.tenant.updateMany({
    where: {
      id: { not: tenant.id },
      subdomain: hostSub,
    },
    data: { subdomain: null },
  });

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { subdomain: hostSub },
    select: {
      id: true,
      slug: true,
      name: true,
      active: true,
      subdomain: true,
    },
  });

  return { ...tenant, ...updated };
}

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha obrigatória."),
  /** Fallback quando o proxy não repassa o Host do subdomínio. */
  tenantSlug: z.string().min(1).optional(),
});

const studentLoginSchema = z.object({
  type: z.enum(["cpf", "email"]),
  identifier: z.string().min(1, "Informe CPF ou e-mail."),
});

const lookupSchema = z.object({
  identifier: z.string().min(1, "Informe CPF ou e-mail."),
});

const STAFF_DEV_ROLES: UserRole[] = [UserRole.DESENVOLVIMENTO];

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmailIdentifier(value: string): boolean {
  return value.includes("@") || /[a-zA-Z]/.test(value);
}

const activeStudentSelect = {
  id: true,
  nomeCompleto: true,
  cpf: true,
  email: true,
  diaVencimento: true,
  acessoLiberadoAte: true,
  tenant: {
    select: { id: true, slug: true, name: true, active: true },
  },
} as const;

async function findActiveStudent(identifier: string, tenantId?: string | null) {
  const byEmail = isEmailIdentifier(identifier);

  return prisma.student.findFirst({
    where: byEmail
      ? {
          active: true,
          email: normalizeEmail(identifier),
          ...(tenantId ? { tenantId } : { tenant: { active: true } }),
        }
      : {
          active: true,
          cpf: normalizeCpf(identifier),
          ...(tenantId ? { tenantId } : { tenant: { active: true } }),
        },
    select: activeStudentSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/public/tenant-context", async (request, reply) => {
    const tenant = await resolveTenantFromHost(request);
    if (!tenant) {
      return reply.send({ mode: "platform" as const, tenant: null });
    }
    return reply.send({ mode: "tenant" as const, tenant });
  });

  app.post("/auth/login", async (request, reply) => {
    let tenant;

    try {
      tenant = await resolveTenant(request);
    } catch (error) {
      request.log.error(error);
      return reply.status(503).send({
        error:
          "Banco de dados indisponível. Verifique a conexão Neon no arquivo .env.",
      });
    }

    if (!tenant) {
      return reply.status(404).send({ error: "Academia não encontrada." });
    }

    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: email.toLowerCase(),
        },
      },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: "Usuário ou senha incorretos." });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return reply.status(401).send({ error: "Usuário ou senha incorretos." });
    }

    const token = app.jwt.sign(
      {
        sub: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      { expiresIn: "8h" },
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    });
  });

  app.get(
    "/auth/me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.user.tenantId },
        select: { id: true, slug: true, name: true, subdomain: true },
      });

      if (!tenant) {
        return reply.status(404).send({ error: "Academia não encontrada." });
      }

      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: "Usuário não encontrado." });
      }

      return reply.send({ user, tenant });
    },
  );

  app.post("/auth/lookup", async (request, reply) => {
    const parsed = lookupSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const rawIdentifier = parsed.data.identifier.trim();

    const hostTenant = await resolveTenantFromHost(request);

    if (isEmailIdentifier(rawIdentifier)) {
      const email = normalizeEmail(rawIdentifier);

      const devUser = await prisma.user.findFirst({
        where: {
          email,
          role: { in: STAFF_DEV_ROLES },
          active: true,
        },
        select: {
          name: true,
          email: true,
          tenant: {
            select: { slug: true, name: true, active: true },
          },
        },
      });

      if (devUser) {
        if (!devUser.tenant.active) {
          return reply.status(403).send({
            error: "Acesso bloqueado. Entre em contato com a equipe Oppi Fit.",
          });
        }

        return reply.send({
          type: "dev",
          name: devUser.name,
          email: devUser.email,
          tenant: {
            slug: devUser.tenant.slug,
            name: devUser.tenant.name,
          },
        });
      }

      const owner = await prisma.user.findFirst({
        where: {
          email,
          role: UserRole.PROPRIETARIO,
          active: true,
          tenant: { active: true },
          ...(hostTenant ? { tenantId: hostTenant.id } : {}),
        },
        select: {
          name: true,
          email: true,
          tenant: {
            select: { slug: true, name: true },
          },
        },
      });

      if (owner) {
        return reply.send({
          type: "owner",
          name: owner.name,
          email: owner.email,
          tenant: {
            slug: owner.tenant.slug,
            name: owner.tenant.name,
          },
        });
      }

      const professor = await prisma.user.findFirst({
        where: {
          email,
          role: UserRole.PROFESSOR,
          active: true,
          tenant: { active: true },
          professorModalities: { some: { active: true } },
          ...(hostTenant ? { tenantId: hostTenant.id } : {}),
        },
        select: {
          name: true,
          email: true,
          tenant: { select: { slug: true, name: true } },
        },
      });

      if (professor) {
        return reply.send({
          type: "professor",
          name: professor.name,
          email: professor.email,
          tenant: {
            slug: professor.tenant.slug,
            name: professor.tenant.name,
          },
        });
      }
    }

    const student = await findActiveStudent(rawIdentifier, hostTenant?.id);

    if (!student) {
      return reply.status(404).send({
        error: isEmailIdentifier(rawIdentifier)
          ? "E-mail não encontrado. Verifique o cadastro ou fale com a recepção."
          : "CPF não encontrado. Verifique o cadastro ou fale com a recepção.",
      });
    }

    return reply.send({
      type: "student",
      name: student.nomeCompleto,
      loginType: isEmailIdentifier(rawIdentifier) ? "email" : "cpf",
      tenant: {
        slug: student.tenant.slug,
        name: student.tenant.name,
      },
    });
  });

  app.post("/auth/student-login", async (request, reply) => {
    const parsed = studentLoginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const { type, identifier } = parsed.data;
    const academyTenant = await resolveAcademyTenant(request);

    let student;

    try {
      student = await findActiveStudent(identifier, academyTenant?.id);
    } catch (error) {
      request.log.error(error);
      return reply.status(503).send({
        error:
          "Banco de dados indisponível. Verifique a conexão Neon no arquivo .env.",
      });
    }

    if (!student) {
      return reply.status(401).send({
        error:
          "CPF ou e-mail não encontrado. Verifique o cadastro com a recepção.",
      });
    }

    const loginType = type === "email" ? "email" : "cpf";
    const identifierMatches =
      loginType === "email"
        ? student.email === normalizeEmail(identifier)
        : student.cpf === normalizeCpf(identifier);

    if (!identifierMatches) {
      return reply.status(401).send({
        error:
          "CPF ou e-mail não encontrado. Verifique o cadastro com a recepção.",
      });
    }

    if (isStudentBillingBlocked(student)) {
      return reply.status(403).send({
        error: STUDENT_BILLING_BLOCKED_MESSAGE,
        code: "BILLING_BLOCKED",
      });
    }

    return reply.send({
      student: {
        id: student.id,
        nomeCompleto: student.nomeCompleto,
        cpf: student.cpf,
        email: student.email,
      },
      tenant: {
        id: student.tenant.id,
        slug: student.tenant.slug,
        name: student.tenant.name,
      },
    });
  });

  app.post("/auth/owner-login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const { email, password, tenantSlug } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const hostSub = extractSubdomainFromHost(getRequestHost(request));
    // Só isola pelo Host quando a academia já existe com esse subdomínio/slug no banco
    const hostTenant = hostSub ? await findAcademyTenantByKey(hostSub) : null;
    const preferredTenant = !hostTenant && tenantSlug
      ? await findAcademyTenantByKey(tenantSlug)
      : null;
    const scopedTenant = hostTenant ?? preferredTenant;

    const ownerInclude = {
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          active: true,
          subdomain: true,
        },
      },
    } as const;

    let owners = await prisma.user.findMany({
      where: {
        email: normalizedEmail,
        role: "PROPRIETARIO",
        active: true,
        ...(scopedTenant ? { tenantId: scopedTenant.id } : {}),
      },
      include: ownerInclude,
    });

    // Academia antiga: host ainda não está no banco — busca global e vincula depois
    if (owners.length === 0) {
      owners = await prisma.user.findMany({
        where: {
          email: normalizedEmail,
          role: "PROPRIETARIO",
          active: true,
        },
        include: ownerInclude,
      });
    }

    if (owners.length === 0) {
      return reply.status(401).send({
        error: "E-mail ou senha incorretos. Verifique se a academia foi cadastrada.",
      });
    }

    let matchedOwner: (typeof owners)[number] | null = null;

    for (const owner of owners) {
      const valid = await bcrypt.compare(password, owner.passwordHash);
      if (valid) {
        matchedOwner = owner;
        break;
      }
    }

    if (!matchedOwner) {
      return reply.status(401).send({ error: "E-mail ou senha incorretos." });
    }

    if (!matchedOwner.tenant.active) {
      return reply.status(403).send({
        error: "Acesso bloqueado. Entre em contato com a equipe Oppi Fit.",
      });
    }

    // Host já é de outra academia COM dono → bloqueia. Sem dono → libera subdomain.
    if (hostTenant && hostTenant.id !== matchedOwner.tenant.id) {
      const hostOwnerCount = await prisma.user.count({
        where: {
          tenantId: hostTenant.id,
          role: "PROPRIETARIO",
          active: true,
        },
      });
      if (hostOwnerCount > 0) {
        return reply.status(403).send({
          error: "Esta conta não pertence a esta academia.",
        });
      }
      await prisma.tenant.update({
        where: { id: hostTenant.id },
        data: { subdomain: null },
      });
    }

    if (hostSub) {
      matchedOwner.tenant = await bindTenantToHostSubdomain(
        matchedOwner.tenant,
        hostSub,
      );
    }

    const token = app.jwt.sign(
      {
        sub: matchedOwner.id,
        tenantId: matchedOwner.tenant.id,
        email: matchedOwner.email,
        role: matchedOwner.role,
        name: matchedOwner.name,
      },
      { expiresIn: "8h" },
    );

    return reply.send({
      token,
      user: {
        id: matchedOwner.id,
        email: matchedOwner.email,
        name: matchedOwner.name,
        role: matchedOwner.role,
      },
      tenant: matchedOwner.tenant,
    });
  });

  app.post("/auth/professor-login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const { email, password, tenantSlug } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const hostSub = extractSubdomainFromHost(getRequestHost(request));
    const hostTenant = hostSub ? await findAcademyTenantByKey(hostSub) : null;
    const preferredTenant = !hostTenant && tenantSlug
      ? await findAcademyTenantByKey(tenantSlug)
      : null;
    const scopedTenant = hostTenant ?? preferredTenant;

    const professorInclude = {
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          active: true,
          subdomain: true,
        },
      },
      professorModalities: { where: { active: true }, select: { id: true } },
    } as const;

    const professorWhere = {
      email: normalizedEmail,
      active: true as const,
      OR: [
        { role: UserRole.PROFESSOR },
        {
          role: UserRole.PROPRIETARIO,
          professorModalities: { some: { active: true } },
        },
      ],
    };

    let candidates = await prisma.user.findMany({
      where: {
        ...professorWhere,
        ...(scopedTenant ? { tenantId: scopedTenant.id } : {}),
      },
      include: professorInclude,
    });

    if (candidates.length === 0) {
      candidates = await prisma.user.findMany({
        where: professorWhere,
        include: professorInclude,
      });
    }

    if (candidates.length === 0) {
      return reply.status(401).send({ error: "E-mail ou senha incorretos." });
    }

    let matched: (typeof candidates)[number] | null = null;
    for (const user of candidates) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (valid && user.professorModalities.length > 0) {
        matched = user;
        break;
      }
    }

    if (!matched) {
      return reply.status(401).send({ error: "E-mail ou senha incorretos." });
    }

    if (!matched.tenant.active) {
      return reply.status(403).send({
        error: "Acesso bloqueado. Entre em contato com a academia.",
      });
    }

    if (hostTenant && hostTenant.id !== matched.tenant.id) {
      const hostOwnerCount = await prisma.user.count({
        where: {
          tenantId: hostTenant.id,
          role: "PROPRIETARIO",
          active: true,
        },
      });
      if (hostOwnerCount > 0) {
        return reply.status(403).send({
          error: "Esta conta não pertence a esta academia.",
        });
      }
      await prisma.tenant.update({
        where: { id: hostTenant.id },
        data: { subdomain: null },
      });
    }

    if (hostSub) {
      matched.tenant = await bindTenantToHostSubdomain(matched.tenant, hostSub);
    }

    const token = app.jwt.sign(
      {
        sub: matched.id,
        tenantId: matched.tenant.id,
        email: matched.email,
        role: matched.role,
        name: matched.name,
      },
      { expiresIn: "8h" },
    );

    return reply.send({
      token,
      user: {
        id: matched.id,
        email: matched.email,
        name: matched.name,
        role: matched.role,
      },
      tenant: matched.tenant,
    });
  });
}
