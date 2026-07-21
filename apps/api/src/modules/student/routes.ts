import type { FastifyInstance } from "fastify";
import { WorkoutSource } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  formatBrDate,
  formatIsoDate,
  getDueStatus,
  getNextDueDate,
  getWeekRange,
} from "../../lib/billing.js";
import {
  MONTHLY_WORKOUT_GOAL,
  WEEKLY_WORKOUT_GOAL,
  countWorkoutSetProgress,
  isWorkoutComplete,
  monthRange,
  percentValue,
} from "../../lib/goals.js";
import { ensureExerciseCatalog } from "../../lib/exercise-catalog.js";
import { requireStudent } from "../../middleware/student.js";
import { normalizePlans, plansToPriceMap } from "../owner/plans.js";
import {
  parseWorkoutDate,
  serializeWorkout,
  serializeWorkoutSummary,
  workoutInclude,
} from "../owner/workouts.js";
import { saveStudentWorkoutSchema, saveWorkoutProgressSchema } from "./workouts.js";

async function getTenantPlans(tenantId: string) {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { planosPrecos: true },
  });

  return normalizePlans(config?.planosPrecos ?? null);
}

async function getStudentTenantId(studentId: string): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { tenantId: true },
  });
  return student?.tenantId ?? null;
}

function buildStudentMetas(
  treinosSemana: number,
  treinosConcluidosSemana: number,
  treinosMes: number,
  seriesConcluidasSemana: number,
  seriesTotaisSemana: number,
) {
  return [
    {
      id: "treinos-semana",
      label: "Treinos na semana",
      atual: treinosSemana,
      meta: WEEKLY_WORKOUT_GOAL,
      unidade: "treinos",
      status: "ativo" as const,
    },
    {
      id: "treinos-concluidos-semana",
      label: "Treinos concluídos",
      atual: treinosConcluidosSemana,
      meta: WEEKLY_WORKOUT_GOAL,
      unidade: "treinos",
      status: "ativo" as const,
    },
    {
      id: "frequencia-mes",
      label: "Frequência mensal",
      atual: treinosMes,
      meta: MONTHLY_WORKOUT_GOAL,
      unidade: "treinos",
      status: "ativo" as const,
    },
    {
      id: "series-semana",
      label: "Séries executadas",
      atual: seriesConcluidasSemana,
      meta: Math.max(seriesTotaisSemana, 1),
      unidade: "séries",
      status: "ativo" as const,
    },
  ];
}

export async function studentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/student/exercises",
    { preHandler: [requireStudent] },
    async (request, reply) => {
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
            phases: true,
            bodyRegion: true,
          },
        });
        return reply.send({ exercises });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Catálogo indisponível. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );

  app.get(
    "/student/treinos",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      try {
        const treinos = await prisma.studentWorkout.findMany({
          where: {
            studentId: request.studentId,
            active: true,
          },
          orderBy: { workoutDate: "asc" },
          select: {
            id: true,
            title: true,
            workoutDate: true,
            updatedAt: true,
            source: true,
            exercises: {
              select: {
                sets: true,
                completedSets: true,
              },
            },
          },
        });

        return reply.send({
          treinos: treinos.map((item) => {
            const summary = serializeWorkoutSummary({
              id: item.id,
              title: item.title,
              workoutDate: item.workoutDate,
              updatedAt: item.updatedAt,
              source: item.source,
              _count: { exercises: item.exercises.length },
            });
            const progress = countWorkoutSetProgress(item.exercises);
            const status =
              progress.totalExercises === 0
                ? "pending"
                : isWorkoutComplete(item.exercises)
                  ? "done"
                  : progress.completedSets > 0
                    ? "partial"
                    : "pending";

            return {
              ...summary,
              progressPercent:
                progress.totalSets > 0
                  ? Math.round((progress.completedSets / progress.totalSets) * 100)
                  : 0,
              completionStatus: status,
            };
          }),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Treinos indisponíveis. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );

  app.get<{ Querystring: { date?: string } }>(
    "/student/treino",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      try {
        const dateParam = request.query.date;

        if (!dateParam) {
          const latest = await prisma.studentWorkout.findFirst({
            where: {
              studentId: request.studentId,
              active: true,
            },
            include: workoutInclude,
            orderBy: { workoutDate: "desc" },
          });

          return reply.send({ treino: latest ? serializeWorkout(latest) : null });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          return reply.status(400).send({ error: "Data inválida. Use AAAA-MM-DD." });
        }

        const workout = await prisma.studentWorkout.findUnique({
          where: {
            studentId_workoutDate: {
              studentId: request.studentId!,
              workoutDate: parseWorkoutDate(dateParam),
            },
          },
          include: workoutInclude,
        });

        if (!workout || !workout.active) {
          return reply.send({ treino: null });
        }

        return reply.send({ treino: serializeWorkout(workout) });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Treino indisponível. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );

  app.put(
    "/student/treino",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      try {
        const parsed = saveStudentWorkoutSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
          });
        }

        const tenantId = await getStudentTenantId(request.studentId!);
        if (!tenantId) {
          return reply.status(404).send({ error: "Aluno não encontrado." });
        }

        const data = parsed.data;
        const workoutDate = parseWorkoutDate(data.workoutDate);
        const existing = await prisma.studentWorkout.findUnique({
          where: {
            studentId_workoutDate: {
              studentId: request.studentId!,
              workoutDate,
            },
          },
          select: { id: true, source: true },
        });

        if (existing?.source === WorkoutSource.OWNER) {
          return reply.status(403).send({
            error: "Este treino foi definido pelo professor e não pode ser alterado.",
          });
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
          if (existing) {
            await tx.studentWorkoutExercise.deleteMany({
              where: { studentWorkoutId: existing.id },
            });

            return tx.studentWorkout.update({
              where: { id: existing.id },
              data: {
                title: data.title.trim(),
                notes: data.notes?.trim() || null,
                source: WorkoutSource.STUDENT,
                active: true,
                assignedBy: null,
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
                    completedSets: [],
                  })),
                },
              },
              include: workoutInclude,
            });
          }

          return tx.studentWorkout.create({
            data: {
              tenantId,
              studentId: request.studentId!,
              title: data.title.trim(),
              notes: data.notes?.trim() || null,
              workoutDate,
              source: WorkoutSource.STUDENT,
              assignedBy: null,
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
                  completedSets: [],
                })),
              },
            },
            include: workoutInclude,
          });
        });

        return reply.send({
          treino: serializeWorkout(treino),
          message: "Seu treino foi salvo.",
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Não foi possível salvar o treino.",
        });
      }
    },
  );

  app.patch(
    "/student/treino/progress",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      try {
        const parsed = saveWorkoutProgressSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
          });
        }

        const workout = await prisma.studentWorkout.findUnique({
          where: {
            studentId_workoutDate: {
              studentId: request.studentId!,
              workoutDate: parseWorkoutDate(parsed.data.workoutDate),
            },
          },
          include: {
            exercises: {
              select: { id: true, sets: true },
            },
          },
        });

        if (!workout || !workout.active) {
          return reply.status(404).send({ error: "Treino não encontrado." });
        }

        const allowedIds = new Set(workout.exercises.map((item) => item.id));

        await prisma.$transaction(
          parsed.data.items
            .filter((item) => allowedIds.has(item.exerciseItemId))
            .map((item) => {
              const exercise = workout.exercises.find((row) => row.id === item.exerciseItemId);
              const maxSets = exercise?.sets ?? 0;
              const normalized = [...new Set(item.completedSets)]
                .filter((setNumber) => setNumber >= 1 && setNumber <= maxSets)
                .sort((a, b) => a - b);

              return prisma.studentWorkoutExercise.update({
                where: { id: item.exerciseItemId },
                data: { completedSets: normalized },
              });
            }),
        );

        const updated = await prisma.studentWorkout.findUnique({
          where: { id: workout.id },
          include: workoutInclude,
        });

        return reply.send({
          treino: updated ? serializeWorkout(updated) : null,
          message: "Progresso salvo.",
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Não foi possível salvar o progresso.",
        });
      }
    },
  );

  app.get(
    "/student/overview",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      try {
        const student = await prisma.student.findUnique({
          where: { id: request.studentId },
          select: {
            nomeCompleto: true,
            planoModalidade: true,
          },
        });

        if (!student) {
          return reply.status(404).send({ error: "Aluno não encontrado." });
        }

        const week = getWeekRange();
        const month = monthRange();
        const treinos = await prisma.studentWorkout.findMany({
          where: {
            studentId: request.studentId,
            active: true,
          },
          orderBy: { workoutDate: "asc" },
          include: {
            exercises: {
              select: {
                sets: true,
                completedSets: true,
              },
            },
          },
        });

        const summaries = treinos.map((item) =>
          serializeWorkoutSummary({
            id: item.id,
            title: item.title,
            workoutDate: item.workoutDate,
            updatedAt: item.updatedAt,
            source: item.source,
            _count: { exercises: item.exercises.length },
          }),
        );

        const treinosSemanaRows = treinos.filter(
          (item) =>
            formatIsoDate(item.workoutDate) >= week.start &&
            formatIsoDate(item.workoutDate) <= week.end,
        );
        const treinosMes = treinos.filter(
          (item) =>
            formatIsoDate(item.workoutDate) >= month.start &&
            formatIsoDate(item.workoutDate) <= month.end,
        ).length;

        const treinosSemana = treinosSemanaRows.length;
        const treinosConcluidosSemana = treinosSemanaRows.filter((item) =>
          isWorkoutComplete(item.exercises),
        ).length;

        const weekSetProgress = countWorkoutSetProgress(
          treinosSemanaRows.flatMap((item) => item.exercises),
        );

        const treinosSemanaSummaries = summaries.filter(
          (item) => item.workoutDate >= week.start && item.workoutDate <= week.end,
        );

        const proximoTreino =
          summaries.find((item) => item.workoutDate >= formatIsoDate(new Date())) ??
          summaries[summaries.length - 1] ??
          null;

        return reply.send({
          aluno: {
            nomeCompleto: student.nomeCompleto,
            planoModalidade: student.planoModalidade,
          },
          semana: week,
          treinosSemana: treinosSemanaSummaries,
          proximoTreino,
          metas: buildStudentMetas(
            treinosSemana,
            treinosConcluidosSemana,
            treinosMes,
            weekSetProgress.completedSets,
            weekSetProgress.totalSets,
          ),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Visão geral indisponível. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );

  app.get(
    "/student/pagamentos",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      try {
        const student = await prisma.student.findUnique({
          where: { id: request.studentId },
          select: {
            planoModalidade: true,
            dataInicio: true,
            diaVencimento: true,
            formaPagamento: true,
            tenantId: true,
          },
        });

        if (!student) {
          return reply.status(404).send({ error: "Aluno não encontrado." });
        }

        const planos = await getTenantPlans(student.tenantId);
        const priceMap = plansToPriceMap(planos);
        const valorMensalidade = priceMap[student.planoModalidade] ?? 0;
        const proximoVencimentoDate = getNextDueDate(student.diaVencimento);
        const proximoVencimento = formatIsoDate(proximoVencimentoDate);
        const status = getDueStatus(student.diaVencimento);

        return reply.send({
          planoModalidade: student.planoModalidade,
          valorMensalidade,
          diaVencimento: student.diaVencimento,
          proximoVencimento,
          proximoVencimentoLabel: formatBrDate(proximoVencimento),
          formaPagamento: student.formaPagamento,
          dataInicio: student.dataInicio,
          status,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({
          error: "Pagamentos indisponíveis. Aguarde o redeploy da API concluir.",
        });
      }
    },
  );
}
