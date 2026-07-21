import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireStudent } from "../../middleware/student.js";
import {
  parseWorkoutDate,
  serializeWorkout,
  serializeWorkoutSummary,
  workoutInclude,
} from "../owner/workouts.js";

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
          orderBy: { workoutDate: "desc" },
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
}
