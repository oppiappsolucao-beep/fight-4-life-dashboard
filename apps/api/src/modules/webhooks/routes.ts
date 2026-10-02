import type { FastifyInstance } from "fastify";
import { getAsaasWebhookToken } from "../../lib/asaas/config.js";
import { confirmAcademyChargePaid } from "../../lib/asaas/charges.js";
import { confirmStudentChargePaid } from "../../lib/charge-payments.js";

type AsaasWebhookBody = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    confirmedDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
  };
};

function extractToken(request: {
  headers: Record<string, unknown>;
  query?: Record<string, unknown>;
}): string | null {
  const headerToken =
    (request.headers["asaas-access-token"] as string | undefined) ||
    (request.headers["asaas_access_token"] as string | undefined) ||
    (request.headers["x-asaas-access-token"] as string | undefined);

  if (headerToken?.trim()) return headerToken.trim();

  const queryToken = request.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();

  return null;
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/webhooks/asaas", async (request, reply) => {
    const expected = getAsaasWebhookToken();
    if (expected) {
      const received = extractToken(
        request as {
          headers: Record<string, unknown>;
          query?: Record<string, unknown>;
        },
      );
      if (!received || received !== expected) {
        return reply.status(401).send({ error: "Webhook não autorizado." });
      }
    }

    const body = (request.body ?? {}) as AsaasWebhookBody;
    const event = (body.event ?? "").toUpperCase();
    const paymentId = body.payment?.id?.trim();

    if (!paymentId) {
      return reply.send({ ok: true, ignored: true, reason: "sem payment.id" });
    }

    const confirmEvents = new Set([
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_RECEIVED_IN_CASH",
    ]);

    if (!confirmEvents.has(event)) {
      return reply.send({ ok: true, ignored: true, event });
    }

    const paidAtRaw =
      body.payment?.confirmedDate ||
      body.payment?.paymentDate ||
      body.payment?.clientPaymentDate;
    const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

    const paid = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;

    try {
      const result = await confirmStudentChargePaid({
        asaasPaymentId: paymentId,
        paidAt: paid,
      });
      return reply.send({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no webhook.";
      if (message.includes("não encontrada")) {
        const academy = await confirmAcademyChargePaid({
          asaasPaymentId: paymentId,
          paidAt: paid,
        });
        if (academy) {
          return reply.send({ ok: true, academy: true, ...academy });
        }
        request.log.warn({ paymentId, event }, "Webhook Asaas sem cobrança local");
        return reply.send({ ok: true, ignored: true, reason: message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: message });
    }
  });
}
