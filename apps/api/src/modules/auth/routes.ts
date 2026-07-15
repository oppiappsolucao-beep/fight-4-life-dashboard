import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { requireAuth } from "../../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha obrigatória."),
});

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
