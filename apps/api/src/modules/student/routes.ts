import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  formatBrDate,
  formatIsoDate,
  getDueStatus,
  getNextDueDate,
} from "../../lib/billing.js";
import { requireStudent } from "../../middleware/student.js";
import { normalizePlans, plansToPriceMap } from "../owner/plans.js";
import {
  parseWorkoutDate,
  serializeWorkout,
  serializeWorkoutSummary,
  workoutInclude,
} from "../owner/workouts.js";

async function getTenantPlans(tenantId: string) {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { planosPrecos: true },
  });

  return normalizePlans(config?.planosPrecos ?? null);
}

function getWeekRange(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}

export async function studentRoutes(app: FastifyInstance): Promise<void> {
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
            _count: { select: { exercises: true } },
          },
        });

        return reply.send({
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
            tenantId: true,
          },
        });

        if (!student) {
          return reply.status(404).send({ error: "Aluno não encontrado." });
        }

        const week = getWeekRange();
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
            _count: { select: { exercises: true } },
          },
        });

        const summaries = treinos.map(serializeWorkoutSummary);
        const treinosSemana = summaries.filter(
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
          treinosSemana,
          proximoTreino,
          metas: [
            {
              id: "treinos-semana",
              label: "Treinos na semana",
              atual: treinosSemana.length,
              meta: 4,
              unidade: "treinos",
              status: "ativo",
            },
            {
              id: "frequencia-mes",
              label: "Frequência mensal",
              atual: 0,
              meta: 12,
              unidade: "presenças",
              status: "em_breve",
            },
            {
              id: "meta-corporal",
              label: "Meta corporal",
              atual: 0,
              meta: 100,
              unidade: "%",
              status: "em_breve",
            },
            {
              id: "evolucao-carga",
              label: "Evolução de carga",
              atual: 0,
              meta: 100,
              unidade: "%",
              status: "em_breve",
            },
          ],
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
