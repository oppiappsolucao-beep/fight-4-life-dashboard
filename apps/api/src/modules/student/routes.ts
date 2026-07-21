import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireStudent } from "../../middleware/student.js";
import { serializeWorkout, workoutInclude } from "../owner/workouts.js";

export async function studentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/student/treino",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const workout = await prisma.studentWorkout.findFirst({
        where: {
          studentId: request.studentId,
          active: true,
        },
        include: workoutInclude,
        orderBy: { updatedAt: "desc" },
      });

      if (!workout) {
        return reply.send({ treino: null });
      }

      return reply.send({ treino: serializeWorkout(workout) });
    },
  );
}
