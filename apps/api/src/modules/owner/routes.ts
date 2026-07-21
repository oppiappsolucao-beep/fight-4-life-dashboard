import type { FastifyInstance } from "fastify";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { normalizePlans } from "./plans.js";
import {
  saveStudentWorkoutSchema,
  serializeWorkout,
  workoutInclude,
} from "./workouts.js";
import { ensureExerciseCatalog } from "../../lib/exercise-catalog.js";

const studentCreateSchema = z.object({
  nomeCompleto: z.string().min(1),
  cpf: z.string().min(1),
  rg: z.string().optional(),
  dataNascimento: z.string().min(1),
  genero: z.string().optional(),
  email: z.string().email(),
  telefone: z.string().optional(),
  emergenciaNome: z.string().optional(),
  emergenciaParentesco: z.string().optional(),
  emergenciaTelefone: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  planoModalidade: z.string().min(1),
  dataInicio: z.string().min(1),
  diaVencimento: z.string().min(1),
  formaPagamento: z.string().optional(),
  fotoUrl: z.string().nullable().optional(),
});

const studentUpdateSchema = studentCreateSchema.extend({
  active: z.boolean().optional(),
});

const plansUpdateSchema = z.object({
  planos: z
    .array(
      z.object({
        nome: z.string().min(1),
        valor: z.number().min(0),
      }),
    )
    .min(1),
});

async function getOrCreateTenantPlans(tenantId: string) {
  const config = await prisma.tenantConfig.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      planosPrecos: normalizePlans(null) as unknown as Prisma.InputJsonValue,
    },
    select: { planosPrecos: true },
  });

  return normalizePlans(config.planosPrecos);
}

export async function ownerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook(
    "preHandler",
    requireRole(
      UserRole.PROPRIETARIO,
      UserRole.DESENVOLVIMENTO,
      UserRole.ADMIN,
      UserRole.DIRETORIA,
    ),
  );

  app.get("/owner/alunos", async (request, reply) => {
    const tenantId = request.user.tenantId;

    const alunos = await prisma.student.findMany({
      where: { tenantId, active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nomeCompleto: true,
        cpf: true,
        email: true,
        telefone: true,
        planoModalidade: true,
        dataInicio: true,
        diaVencimento: true,
        formaPagamento: true,
        fotoUrl: true,
        createdAt: true,
      },
    });

    return reply.send({ alunos });
  });

  app.post("/owner/alunos", async (request, reply) => {
    const parsed = studentCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    const data = parsed.data;
    const cpfDigits = data.cpf.replace(/\D/g, "");

    const existing = await prisma.student.findFirst({
      where: { tenantId, cpf: cpfDigits },
      select: { id: true },
    });

    if (existing) {
      return reply.status(409).send({ error: "Já existe um aluno com este CPF." });
    }

    const aluno = await prisma.student.create({
      data: {
        tenantId,
        nomeCompleto: data.nomeCompleto.trim(),
        cpf: cpfDigits,
        rg: data.rg || null,
        dataNascimento: data.dataNascimento,
        genero: data.genero || null,
        email: data.email.trim().toLowerCase(),
        telefone: data.telefone || null,
        emergenciaNome: data.emergenciaNome || null,
        emergenciaParentesco: data.emergenciaParentesco || null,
        emergenciaTelefone: data.emergenciaTelefone || null,
        rua: data.rua || null,
        numero: data.numero || null,
        cep: data.cep || null,
        cidade: data.cidade || null,
        planoModalidade: data.planoModalidade,
        dataInicio: data.dataInicio,
        diaVencimento: data.diaVencimento,
        formaPagamento: data.formaPagamento || null,
        fotoUrl: data.fotoUrl || null,
      },
    });

    return reply.status(201).send({
      aluno: {
        id: aluno.id,
        nomeCompleto: aluno.nomeCompleto,
        cpf: aluno.cpf,
        email: aluno.email,
      },
      message: "Aluno cadastrado com sucesso.",
    });
  });

  app.get<{ Params: { id: string } }>(
    "/owner/alunos/:id",
    async (request, reply) => {
      const aluno = await prisma.student.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
        },
      });

      if (!aluno) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      return reply.send({ aluno });
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/owner/alunos/:id",
    async (request, reply) => {
      const parsed = studentUpdateSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const current = await prisma.student.findFirst({
        where: { id: request.params.id, tenantId },
        select: { id: true },
      });

      if (!current) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const data = parsed.data;
      const cpfDigits = data.cpf.replace(/\D/g, "");
      const duplicate = await prisma.student.findFirst({
        where: {
          tenantId,
          cpf: cpfDigits,
          id: { not: current.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return reply.status(409).send({
          error: "Já existe outro aluno com este CPF.",
        });
      }

      const aluno = await prisma.student.update({
        where: { id: current.id },
        data: {
          nomeCompleto: data.nomeCompleto.trim(),
          cpf: cpfDigits,
          rg: data.rg || null,
          dataNascimento: data.dataNascimento,
          genero: data.genero || null,
          email: data.email.trim().toLowerCase(),
          telefone: data.telefone || null,
          emergenciaNome: data.emergenciaNome || null,
          emergenciaParentesco: data.emergenciaParentesco || null,
          emergenciaTelefone: data.emergenciaTelefone || null,
          rua: data.rua || null,
          numero: data.numero || null,
          cep: data.cep || null,
          cidade: data.cidade || null,
          planoModalidade: data.planoModalidade,
          dataInicio: data.dataInicio,
          diaVencimento: data.diaVencimento,
          formaPagamento: data.formaPagamento || null,
          fotoUrl: data.fotoUrl || null,
          ...(data.active === undefined ? {} : { active: data.active }),
        },
      });

      return reply.send({
        aluno,
        message: "Aluno atualizado com sucesso.",
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/owner/alunos/:id",
    async (request, reply) => {
      const aluno = await prisma.student.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
        },
        select: { id: true },
      });

      if (!aluno) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      await prisma.student.delete({ where: { id: aluno.id } });
      return reply.send({ message: "Aluno removido com sucesso." });
    },
  );

  app.get("/owner/planos", async (request, reply) => {
    const planos = await getOrCreateTenantPlans(request.user.tenantId);
    return reply.send({ planos });
  });

  app.put("/owner/planos", async (request, reply) => {
    const parsed = plansUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const planos = normalizePlans(parsed.data.planos);
    const names = planos.map((plan) => plan.nome.toLowerCase());
    if (new Set(names).size !== names.length) {
      return reply.status(400).send({
        error: "Existem planos com o mesmo nome.",
      });
    }

    await prisma.tenantConfig.upsert({
      where: { tenantId: request.user.tenantId },
      update: {
        planosPrecos: planos as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId: request.user.tenantId,
        planosPrecos: planos as unknown as Prisma.InputJsonValue,
      },
    });

    return reply.send({
      planos,
      message: "Planos atualizados com sucesso.",
    });
  });

  app.get("/owner/exercises", async (request, reply) => {
    try {
      await ensureExerciseCatalog();

      const exercises = await prisma.exercise.findMany({
        where: { active: true },
        orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          muscleGroup: true,
          equipment: true,
          instructions: true,
          imageUrl: true,
          gifUrl: true,
        },
      });

      return reply.send({ exercises });
    } catch (error) {
      request.log.error(error);
      return reply.status(503).send({
        error:
          "Catálogo de exercícios indisponível. Aguarde o deploy da API ou contate o suporte.",
      });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/owner/alunos/:id/treino",
    async (request, reply) => {
      const student = await prisma.student.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
          active: true,
        },
        select: { id: true, nomeCompleto: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const treino = await prisma.studentWorkout.findFirst({
        where: {
          studentId: student.id,
          tenantId: request.user.tenantId,
          active: true,
        },
        include: workoutInclude,
        orderBy: { updatedAt: "desc" },
      });

      return reply.send({
        aluno: student,
        treino: treino ? serializeWorkout(treino) : null,
      });
    },
  );

  app.put<{ Params: { id: string } }>(
    "/owner/alunos/:id/treino",
    async (request, reply) => {
      const parsed = saveStudentWorkoutSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const student = await prisma.student.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
          active: true,
        },
        select: { id: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const data = parsed.data;
      const exerciseIds = data.exercises.map((item) => item.exerciseId);
      const validCount = await prisma.exercise.count({
        where: { id: { in: exerciseIds }, active: true },
      });

      if (validCount !== exerciseIds.length) {
        return reply.status(400).send({
          error: "Um ou mais exercícios selecionados não existem.",
        });
      }

      const treino = await prisma.$transaction(async (tx) => {
        await tx.studentWorkout.updateMany({
          where: {
            studentId: student.id,
            tenantId: request.user.tenantId,
            active: true,
          },
          data: { active: false },
        });

        return tx.studentWorkout.create({
          data: {
            tenantId: request.user.tenantId,
            studentId: student.id,
            title: data.title.trim(),
            notes: data.notes?.trim() || null,
            assignedBy: request.user.sub,
            exercises: {
              create: data.exercises.map((item) => ({
                exerciseId: item.exerciseId,
                order: item.order,
                sets: item.sets,
                reps: item.reps,
                load: item.load?.trim() || null,
                restSeconds: item.restSeconds ?? 60,
                notes: item.notes?.trim() || null,
              })),
            },
          },
          include: workoutInclude,
        });
      });

      return reply.send({
        treino: serializeWorkout(treino),
        message: "Treino salvo e publicado para o aluno.",
      });
    },
  );
}
