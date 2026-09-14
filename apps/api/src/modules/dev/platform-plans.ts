import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  PLATFORM_BILLING_TYPES,
  defaultPlanName,
  ensurePlatformPlans,
  serializePlatformPlan,
} from "../../lib/platform-plans.js";

const planSchema = z.object({
  name: z.string().optional(),
  billingType: z.enum(PLATFORM_BILLING_TYPES),
  studentLimit: z.coerce.number().int().min(1).max(100000),
  price: z.coerce.number().positive(),
});

export async function registerDevPlatformPlanRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/dev/platform-plans",
    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },
    async (_request, reply) => {
      await ensurePlatformPlans();
      const plans = await prisma.platformPlan.findMany({
        where: { active: true },
        orderBy: [{ billingType: "asc" }, { studentLimit: "asc" }, { price: "asc" }],
      });
      return reply.send({ plans: plans.map(serializePlatformPlan) });
    },
  );

  app.post(
    "/dev/platform-plans",
    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },
    async (request, reply) => {
      const parsed = planSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const data = parsed.data;
      const name = data.name?.trim() || defaultPlanName(data.billingType, data.studentLimit);
      const plan = await prisma.platformPlan.create({
        data: {
          name,
          billingType: data.billingType,
          studentLimit: data.studentLimit,
          price: data.price,
          active: true,
        },
      });

      return reply.send({
        plan: serializePlatformPlan(plan),
        message: "Plano cadastrado para contratação das academias.",
      });
    },
  );
}
