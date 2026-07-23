import type { FastifyReply, FastifyRequest } from "fastify";
import {
  isStudentBillingBlocked,
  STUDENT_BILLING_BLOCKED_MESSAGE,
} from "../lib/billing.js";
import { prisma } from "../lib/prisma.js";

declare module "fastify" {
  interface FastifyRequest {
    studentId?: string;
  }
}

export async function requireStudent(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const studentId = request.headers["x-student-id"] as string | undefined;

  if (!studentId?.trim()) {
    reply.status(401).send({ error: "Sessão de aluno inválida." });
    return;
  }

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      active: true,
      tenant: { active: true },
    },
    select: {
      id: true,
      diaVencimento: true,
      acessoLiberadoAte: true,
    },
  });

  if (!student) {
    reply.status(401).send({ error: "Aluno não encontrado ou inativo." });
    return;
  }

  if (isStudentBillingBlocked(student)) {
    reply.status(403).send({
      error: STUDENT_BILLING_BLOCKED_MESSAGE,
      code: "BILLING_BLOCKED",
    });
    return;
  }

  request.studentId = student.id;
}
