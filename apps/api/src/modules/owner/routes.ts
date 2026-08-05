import type { FastifyInstance } from "fastify";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getDueStatus, getNextDueDate, getWeekRange, formatIsoDate } from "../../lib/billing.js";
import {
  DEV_NEW_ACADEMIES_GOAL,
  OWNER_NEW_STUDENTS_GOAL,
  OWNER_WEEKLY_WORKOUT_GOAL,
  percentValue,
} from "../../lib/goals.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { normalizePlans, plansToPriceMap } from "./plans.js";
import {
  parseWorkoutDate,
  saveStudentWorkoutSchema,
  serializeWorkout,
  serializeWorkoutSummary,
  workoutInclude,
} from "./workouts.js";
import { ensureExerciseCatalog } from "../../lib/exercise-catalog.js";
import { registerOwnerModalityRoutes } from "../modalities/routes.js";
import { isMinorStudent } from "../../lib/student-age.js";
import { createStudentAsaasCharge } from "../../lib/asaas/charges.js";
import { AsaasError } from "../../lib/asaas/client.js";
import { centsToBrl } from "../../lib/platform-fees.js";
import {
  persistStudentPhoto,
  removeStudentPhoto,
} from "../../lib/student-photos.js";

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
  responsavelNome: z.string().optional(),
  responsavelCpf: z.string().optional(),
  responsavelEmail: z.string().email().optional().or(z.literal("")),
  responsavelTelefone: z.string().optional(),
  responsavelParentesco: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  planoModalidade: z.string().min(1),
  dataInicio: z.string().min(1),
  diaVencimento: z.string().min(1),
  formaPagamento: z.string().optional(),
  fotoUrl: z.string().nullable().optional(),
  dietPlanId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
});

const studentUpdateSchema = studentCreateSchema.extend({
  active: z.boolean().optional(),
});

async function resolveDietPlanId(
  dietPlanId: string | null | undefined,
): Promise<string | null | undefined> {
  if (dietPlanId === undefined) return undefined;
  if (!dietPlanId) return null;

  const plan = await prisma.dietPlan.findFirst({
    where: { id: dietPlanId, active: true },
    select: { id: true },
  });

  return plan?.id ?? null;
}

const plansUpdateSchema = z.object({
  planos: z
    .array(
      z.object({
        nome: z.string().min(1),
        valor: z.number().min(0),
        liberaTodaGrade: z.boolean().optional(),
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

  app.get("/owner/overview", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const week = getWeekRange();

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const [alunos, planos, treinosPublicados, treinosSemana, totalAlunosHistorico] =
      await Promise.all([
      prisma.student.findMany({
        where: { tenantId, active: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          nomeCompleto: true,
          planoModalidade: true,
          diaVencimento: true,
          createdAt: true,
        },
      }),
      getOrCreateTenantPlans(tenantId),
      prisma.studentWorkout.count({
        where: { tenantId, active: true },
      }),
      prisma.studentWorkout.count({
        where: {
          tenantId,
          active: true,
          workoutDate: {
            gte: parseWorkoutDate(week.start),
            lte: parseWorkoutDate(week.end),
          },
        },
      }),
      prisma.student.count({ where: { tenantId } }),
    ]);

    const priceMap = plansToPriceMap(planos);
    let receitaPrevista = 0;
    let vencidos = 0;
    let venceHoje = 0;

    for (const aluno of alunos) {
      receitaPrevista += priceMap[aluno.planoModalidade] ?? 0;
      const status = getDueStatus(aluno.diaVencimento);
      if (status === "vencido") vencidos += 1;
      if (status === "hoje") venceHoje += 1;
    }

    return reply.send({
      tenant: { name: tenant?.name ?? "Academia" },
      user: { name: request.user.name ?? null },
      semana: week,
      metrics: {
        totalAlunos: alunos.length,
        treinosPublicados,
        treinosSemana,
        receitaPrevista,
        vencidos,
        venceHoje,
      },
      recentAlunos: alunos.slice(0, 5).map((aluno) => ({
        id: aluno.id,
        nomeCompleto: aluno.nomeCompleto,
        planoModalidade: aluno.planoModalidade,
        createdAt: aluno.createdAt.toISOString(),
      })),
      metas: [
        {
          id: "novos-alunos-mes",
          label: "Novos alunos no mês",
          atual: alunos.filter((aluno) => {
            const created = aluno.createdAt;
            const now = new Date();
            return (
              created.getMonth() === now.getMonth() &&
              created.getFullYear() === now.getFullYear()
            );
          }).length,
          meta: OWNER_NEW_STUDENTS_GOAL,
          unidade: "alunos",
          status: "ativo",
        },
        {
          id: "treinos-semana",
          label: "Treinos publicados na semana",
          atual: treinosSemana,
          meta: OWNER_WEEKLY_WORKOUT_GOAL,
          unidade: "fichas",
          status: "ativo",
        },
        {
          id: "retencao-alunos",
          label: "Retenção de alunos",
          atual: percentValue(alunos.length, totalAlunosHistorico),
          meta: 95,
          unidade: "%",
          status: "ativo",
        },
        {
          id: "inadimplencia",
          label: "Inadimplência",
          atual: percentValue(vencidos, alunos.length),
          meta: 5,
          unidade: "%",
          status: "ativo",
          direction: "down",
        },
      ],
    });
  });

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
        acessoLiberadoAte: true,
        fotoUrl: true,
        createdAt: true,
        charges: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            dueDate: true,
            amountCents: true,
            asaasPaymentId: true,
            paidAt: true,
          },
        },
      },
    });

    return reply.send({
      alunos: alunos.map((aluno) => {
        const latest = aluno.charges[0] ?? null;
        return {
          id: aluno.id,
          nomeCompleto: aluno.nomeCompleto,
          cpf: aluno.cpf,
          email: aluno.email,
          telefone: aluno.telefone,
          planoModalidade: aluno.planoModalidade,
          dataInicio: aluno.dataInicio,
          diaVencimento: aluno.diaVencimento,
          formaPagamento: aluno.formaPagamento,
          acessoLiberadoAte: aluno.acessoLiberadoAte,
          fotoUrl: aluno.fotoUrl,
          createdAt: aluno.createdAt,
          latestCharge: latest
            ? {
                id: latest.id,
                status: latest.status,
                dueDate: latest.dueDate,
                amountBrl: centsToBrl(latest.amountCents),
                asaasPaymentId: latest.asaasPaymentId,
                paidAt: latest.paidAt,
              }
            : null,
        };
      }),
    });
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

    const dietPlanId = await resolveDietPlanId(data.dietPlanId ?? null);
    if (data.dietPlanId && !dietPlanId) {
      return reply.status(400).send({ error: "Plano de dieta inválido." });
    }

    if (isMinorStudent(data.dataNascimento)) {
      const hasResponsible =
        Boolean(data.responsavelNome?.trim()) &&
        Boolean(data.responsavelCpf?.replace(/\D/g, "")) &&
        Boolean(data.responsavelEmail?.trim());
      if (!hasResponsible) {
        return reply.status(400).send({
          error:
            "Aluno menor de 18 anos: informe responsável (nome, CPF e e-mail) para cobranças.",
        });
      }
    }

    let aluno = await prisma.student.create({
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
        responsavelNome: data.responsavelNome?.trim() || null,
        responsavelCpf: data.responsavelCpf?.replace(/\D/g, "") || null,
        responsavelEmail: data.responsavelEmail?.trim().toLowerCase() || null,
        responsavelTelefone: data.responsavelTelefone || null,
        responsavelParentesco: data.responsavelParentesco || null,
        rua: data.rua || null,
        numero: data.numero || null,
        cep: data.cep || null,
        cidade: data.cidade || null,
        planoModalidade: data.planoModalidade,
        dataInicio: data.dataInicio,
        diaVencimento: data.diaVencimento,
        formaPagamento: data.formaPagamento || null,
        fotoUrl: null,
        dietPlanId: dietPlanId ?? null,
      },
    });

    if (data.fotoUrl) {
      try {
        const fotoUrl = await persistStudentPhoto({
          tenantId,
          studentId: aluno.id,
          fotoUrl: data.fotoUrl,
        });
        aluno = await prisma.student.update({
          where: { id: aluno.id },
          data: { fotoUrl },
        });
      } catch (error) {
        await prisma.student.delete({ where: { id: aluno.id } }).catch(() => undefined);
        return reply.status(400).send({
          error:
            error instanceof Error ? error.message : "Não foi possível salvar a foto.",
        });
      }
    }

    return reply.status(201).send({
      aluno: {
        id: aluno.id,
        nomeCompleto: aluno.nomeCompleto,
        cpf: aluno.cpf,
        email: aluno.email,
        fotoUrl: aluno.fotoUrl,
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
        include: {
          dietPlan: {
            select: {
              id: true,
              name: true,
              slug: true,
              goal: true,
              targetCalories: true,
            },
          },
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
        select: { id: true, fotoUrl: true },
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

      const dietPlanId = await resolveDietPlanId(data.dietPlanId);
      if (data.dietPlanId && dietPlanId === null) {
        return reply.status(400).send({ error: "Plano de dieta inválido." });
      }

      if (isMinorStudent(data.dataNascimento)) {
        const hasResponsible =
          Boolean(data.responsavelNome?.trim()) &&
          Boolean(data.responsavelCpf?.replace(/\D/g, "")) &&
          Boolean(data.responsavelEmail?.trim());
        if (!hasResponsible) {
          return reply.status(400).send({
            error:
              "Aluno menor de 18 anos: informe responsável (nome, CPF e e-mail) para cobranças.",
          });
        }
      }

      let fotoUrl = current.fotoUrl;
      if (data.fotoUrl !== undefined) {
        try {
          fotoUrl = await persistStudentPhoto({
            tenantId,
            studentId: current.id,
            fotoUrl: data.fotoUrl,
          });
        } catch (error) {
          return reply.status(400).send({
            error:
              error instanceof Error ? error.message : "Não foi possível salvar a foto.",
          });
        }
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
          responsavelNome: data.responsavelNome?.trim() || null,
          responsavelCpf: data.responsavelCpf?.replace(/\D/g, "") || null,
          responsavelEmail: data.responsavelEmail?.trim().toLowerCase() || null,
          responsavelTelefone: data.responsavelTelefone || null,
          responsavelParentesco: data.responsavelParentesco || null,
          rua: data.rua || null,
          numero: data.numero || null,
          cep: data.cep || null,
          cidade: data.cidade || null,
          planoModalidade: data.planoModalidade,
          dataInicio: data.dataInicio,
          diaVencimento: data.diaVencimento,
          formaPagamento: data.formaPagamento || null,
          fotoUrl,
          ...(dietPlanId === undefined ? {} : { dietPlanId }),
          ...(data.active === undefined ? {} : { active: data.active }),
        },
        include: {
          dietPlan: {
            select: {
              id: true,
              name: true,
              slug: true,
              goal: true,
              targetCalories: true,
            },
          },
        },
      });

      return reply.send({
        aluno,
        message: "Aluno atualizado com sucesso.",
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/owner/alunos/:id/liberar-acesso",
    async (request, reply) => {
      const tenantId = request.user.tenantId;
      const aluno = await prisma.student.findFirst({
        where: { id: request.params.id, tenantId },
        select: { id: true, diaVencimento: true, nomeCompleto: true },
      });

      if (!aluno) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const releaseUntil = formatIsoDate(getNextDueDate(aluno.diaVencimento));
      const updated = await prisma.student.update({
        where: { id: aluno.id },
        data: { acessoLiberadoAte: releaseUntil },
        select: {
          id: true,
          nomeCompleto: true,
          diaVencimento: true,
          acessoLiberadoAte: true,
        },
      });

      return reply.send({
        aluno: updated,
        message: `Acesso liberado até ${releaseUntil.split("-").reverse().join("/")}.`,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/owner/alunos/:id/cobrancas",
    async (request, reply) => {
      try {
        const result = await createStudentAsaasCharge({
          tenantId: request.user.tenantId,
          studentId: request.params.id,
        });
        return reply.status(201).send({
          message: "Cobrança Asaas gerada com sucesso.",
          charge: {
            id: result.charge.id,
            status: result.charge.status,
            dueDate: result.charge.dueDate,
            amountBrl: centsToBrl(result.charge.amountCents),
            asaasPaymentId: result.charge.asaasPaymentId,
          },
          invoiceUrl: result.invoiceUrl,
          estimatedFeeBrl: centsToBrl(result.estimatedFeeCents),
        });
      } catch (error) {
        const message =
          error instanceof AsaasError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Falha ao gerar cobrança.";
        const status = error instanceof AsaasError ? Math.min(error.status, 502) : 400;
        return reply.status(status >= 400 ? status : 400).send({ error: message });
      }
    },
  );

  app.post("/owner/cobrancas/lote", async (request, reply) => {
    const body = z
      .object({
        studentIds: z.array(z.string().uuid()).min(1).max(100),
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: "Informe studentIds (1–100)." });
    }

    const tenantId = request.user.tenantId;
    const created: Array<{ studentId: string; chargeId: string }> = [];
    const errors: Array<{ studentId: string; error: string }> = [];

    for (const studentId of body.data.studentIds) {
      try {
        const result = await createStudentAsaasCharge({ tenantId, studentId });
        created.push({ studentId, chargeId: result.charge.id });
      } catch (error) {
        errors.push({
          studentId,
          error:
            error instanceof Error ? error.message : "Falha ao gerar cobrança.",
        });
      }
    }

    return reply.send({
      message: `Geradas ${created.length} cobrança(s). ${errors.length} falha(s).`,
      created,
      errors,
    });
  });

  app.get("/owner/cobrancas", async (request, reply) => {
    const charges = await prisma.studentCharge.findMany({
      where: { tenantId: request.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        student: {
          select: { id: true, nomeCompleto: true, email: true, cpf: true },
        },
      },
    });

    return reply.send({
      cobrancas: charges.map((charge) => ({
        id: charge.id,
        status: charge.status,
        dueDate: charge.dueDate,
        amountBrl: centsToBrl(charge.amountCents),
        platformFeeBrl: centsToBrl(charge.platformFeeCents),
        asaasPaymentId: charge.asaasPaymentId,
        paidAt: charge.paidAt,
        student: charge.student,
      })),
    });
  });

  app.delete<{ Params: { id: string } }>(
    "/owner/alunos/:id",
    async (request, reply) => {
      const aluno = await prisma.student.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
        },
        select: { id: true, tenantId: true },
      });

      if (!aluno) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      await removeStudentPhoto(aluno.tenantId, aluno.id);
      await prisma.student.delete({ where: { id: aluno.id } });
      return reply.send({ message: "Aluno removido com sucesso." });
    },
  );

  app.get("/owner/planos", async (request, reply) => {
    const planos = await getOrCreateTenantPlans(request.user.tenantId);
    return reply.send({ planos });
  });

  app.get("/owner/dietas", async (_request, reply) => {
    const dietas = await prisma.dietPlan.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        goal: true,
        targetCalories: true,
      },
    });

    return reply.send({ dietas });
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

    const diferencialCount = planos.filter((plan) => plan.liberaTodaGrade).length;
    if (diferencialCount > 1) {
      return reply.status(400).send({
        error: "Somente um plano pode ser marcado como diferencial (acesso total).",
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
      await ensureExerciseCatalog({ syncRemote: false });

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
          phases: true,
          bodyRegion: true,
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
    "/owner/alunos/:id/treinos",
    async (request, reply) => {
      try {
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

        const treinos = await prisma.studentWorkout.findMany({
          where: {
            studentId: student.id,
            tenantId: request.user.tenantId,
            active: true,
          },
          orderBy: { workoutDate: "desc" },
          select: {
            id: true,
            title: true,
            workoutDate: true,
            updatedAt: true,
            source: true,
            _count: { select: { exercises: true } },
          },
        });

        return reply.send({
          aluno: student,
          treinos: treinos.map(serializeWorkoutSummary),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Treinos indisponíveis. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { date?: string } }>(
    "/owner/alunos/:id/treino",
    async (request, reply) => {
      try {
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

        const dateParam = request.query.date;
        let treino;

        if (dateParam) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return reply.status(400).send({ error: "Data inválida. Use AAAA-MM-DD." });
          }

          treino = await prisma.studentWorkout.findUnique({
            where: {
              studentId_workoutDate: {
                studentId: student.id,
                workoutDate: parseWorkoutDate(dateParam),
              },
            },
            include: workoutInclude,
          });
        } else {
          treino = await prisma.studentWorkout.findFirst({
            where: {
              studentId: student.id,
              tenantId: request.user.tenantId,
              active: true,
            },
            include: workoutInclude,
            orderBy: { workoutDate: "desc" },
          });
        }

        return reply.send({
          aluno: student,
          treino: treino && treino.active ? serializeWorkout(treino) : null,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Treino indisponível. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );

  app.put<{ Params: { id: string } }>(
    "/owner/alunos/:id/treino",
    async (request, reply) => {
      try {
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
      const workoutDate = parseWorkoutDate(data.workoutDate);

      if (!data.modalityId) {
        return reply.status(400).send({ error: "Selecione a modalidade do treino." });
      }

      const modality = await prisma.modality.findFirst({
        where: {
          id: data.modalityId,
          tenantId: request.user.tenantId,
          active: true,
        },
        select: { id: true },
      });

      if (!modality) {
        return reply.status(400).send({ error: "Modalidade inválida ou inativa." });
      }

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
        const existing = await tx.studentWorkout.findUnique({
          where: {
            studentId_workoutDate: {
              studentId: student.id,
              workoutDate,
            },
          },
          select: { id: true },
        });

        if (existing) {
          await tx.studentWorkoutExercise.deleteMany({
            where: { studentWorkoutId: existing.id },
          });

          return tx.studentWorkout.update({
            where: { id: existing.id },
            data: {
              title: data.title.trim(),
              notes: data.notes?.trim() || null,
              modalityId: data.modalityId,
              assignedBy: request.user.sub,
              source: "OWNER",
              active: true,
              exercises: {
                create: data.exercises.map((item) => ({
                  exerciseId: item.exerciseId,
                  phase: item.phase,
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
        }

        return tx.studentWorkout.create({
          data: {
            tenantId: request.user.tenantId,
            studentId: student.id,
            modalityId: data.modalityId,
            title: data.title.trim(),
            notes: data.notes?.trim() || null,
            workoutDate,
            assignedBy: request.user.sub,
            source: "OWNER",
            exercises: {
              create: data.exercises.map((item) => ({
                exerciseId: item.exerciseId,
                phase: item.phase,
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
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Não foi possível salvar o treino. Tente novamente após o redeploy.",
        });
      }
    },
  );

  await registerOwnerModalityRoutes(app);
}
