import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { requireAuth } from "../../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha obrigatória."),
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
  tenant: {
    select: { id: true, slug: true, name: true, active: true },
  },
} as const;

async function findActiveStudent(identifier: string) {
  const byEmail = isEmailIdentifier(identifier);

  return prisma.student.findFirst({
    where: byEmail
      ? {
          active: true,
          email: normalizeEmail(identifier),
          tenant: { active: true },
        }
      : {
          active: true,
          cpf: normalizeCpf(identifier),
          tenant: { active: true },
        },
    select: activeStudentSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
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
        select: { id: true, slug: true, name: true },
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
            error: "Acesso bloqueado. Entre em contato com a equipe Oppi Tech.",
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
    }

    const student = await findActiveStudent(rawIdentifier);

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

    let student;

    try {
      student = await findActiveStudent(identifier);
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

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const owners = await prisma.user.findMany({
      where: {
        email: normalizedEmail,
        role: "PROPRIETARIO",
        active: true,
      },
      include: {
        tenant: {
          select: { id: true, slug: true, name: true, active: true },
        },
      },
    });

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
        error: "Acesso bloqueado. Entre em contato com a equipe Oppi Tech.",
      });
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
}
