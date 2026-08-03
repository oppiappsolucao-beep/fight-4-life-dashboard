/**
 * Emissão de cobranças Asaas pela subconta da academia.
 * Fatura no nome da academia; split da taxa OPPI → wallet master.
 */

import { ChargeStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { getAcademyBillingCycle } from "../academy-billing-cycle.js";
import { formatIsoDate, getNextDueDate } from "../billing.js";
import { assertStudentCanBeCharged } from "../charge-payments.js";
import { platformFeeCentsForPaidIndex, centsToBrl } from "../platform-fees.js";
import { resolveBillingPayer } from "../student-age.js";
import {
  getAsaasPlatformWalletId,
  isAsaasConfigured,
} from "./config.js";
import { asaasRequest, AsaasError, normalizeAsaasApiKey } from "./client.js";
import {
  createAsaasSubaccountForTenant,
  ensureAsaasSubaccountQuiet,
} from "./subaccounts.js";
import { normalizePlans, plansToPriceMap } from "../../modules/owner/plans.js";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

async function estimateNextPlatformFeeCents(tenantId: string, cycleKey: string) {
  const [paid, pending] = await Promise.all([
    prisma.studentCharge.count({
      where: { tenantId, status: ChargeStatus.PAID, billingCycleKey: cycleKey },
    }),
    prisma.studentCharge.count({
      where: {
        tenantId,
        status: { in: [ChargeStatus.PENDING, ChargeStatus.OVERDUE] },
        billingCycleKey: cycleKey,
      },
    }),
  ]);
  return platformFeeCentsForPaidIndex(paid + pending + 1);
}

async function upsertAsaasCustomer(options: {
  apiKey: string;
  existingCustomerId: string | null;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  externalReference: string;
}): Promise<string> {
  const cpfCnpj = digitsOnly(options.cpf);
  if (options.existingCustomerId) {
    try {
      await asaasRequest(`/customers/${options.existingCustomerId}`, {
        apiKey: options.apiKey,
        method: "PUT",
        body: JSON.stringify({
          name: options.name,
          cpfCnpj,
          email: options.email,
          mobilePhone: options.phone ? digitsOnly(options.phone) : undefined,
          externalReference: options.externalReference,
          notificationDisabled: false,
        }),
      });
      return options.existingCustomerId;
    } catch {
      // Cliente pode ser de outra conta (master antiga) — recria na subconta
    }
  }

  const created = await asaasRequest<{ id?: string }>("/customers", {
    apiKey: options.apiKey,
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      cpfCnpj,
      email: options.email,
      mobilePhone: options.phone ? digitsOnly(options.phone) : undefined,
      externalReference: options.externalReference,
      notificationDisabled: false,
    }),
  });

  if (!created.id) {
    throw new AsaasError("Asaas não retornou id do customer.", 502, created);
  }
  return created.id;
}

export async function createStudentAsaasCharge(options: {
  tenantId: string;
  studentId: string;
  amountBrl?: number;
  dueDate?: Date;
  billingType?: "UNDEFINED" | "BOLETO" | "PIX" | "CREDIT_CARD";
  description?: string;
}) {
  if (!isAsaasConfigured()) {
    throw new AsaasError("Asaas não configurado no servidor.", 503, null);
  }

  const masterWalletId = getAsaasPlatformWalletId();
  if (!masterWalletId) {
    throw new AsaasError("ASAAS_WALLET_ID ausente.", 503, null);
  }

  const student = await prisma.student.findFirst({
    where: { id: options.studentId, tenantId: options.tenantId },
    include: {
      tenant: {
        select: {
          id: true,
          createdAt: true,
          billingCycleDay: true,
          asaasWalletId: true,
          asaasAccountId: true,
          asaasApiKey: true,
          name: true,
        },
      },
    },
  });

  if (!student) {
    throw new Error("Aluno não encontrado.");
  }

  const canCharge = assertStudentCanBeCharged(student);
  if (!canCharge.ok) {
    throw new Error(canCharge.error);
  }

  let academyApiKey = normalizeAsaasApiKey(student.tenant.asaasApiKey);
  let academyWalletId = student.tenant.asaasWalletId;

  if (!academyApiKey || !academyWalletId) {
    const linked = await ensureAsaasSubaccountQuiet(student.tenantId);
    if (!linked.ok) {
      throw new Error(
        `Academia sem subconta Asaas pronta. No Dev, vincule a subconta (e a chave). (${linked.error})`,
      );
    }
    academyApiKey = linked.result.apiKey;
    academyWalletId = linked.result.walletId;
  }

  // Garante que ainda temos os 3 campos (caso ensure tenha retornado parcial no passado)
  if (!academyApiKey) {
    try {
      const refreshed = await createAsaasSubaccountForTenant(student.tenantId);
      academyApiKey = refreshed.apiKey;
      academyWalletId = refreshed.walletId;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Subconta sem apiKey. Cole a chave no painel Dev.",
      );
    }
  }

  let amountBrl = options.amountBrl;
  if (amountBrl == null) {
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId: options.tenantId },
      select: { planosPrecos: true },
    });
    const priceMap = plansToPriceMap(normalizePlans(config?.planosPrecos ?? null));
    const price = priceMap[student.planoModalidade.trim()];
    if (typeof price !== "number" || !(price > 0)) {
      throw new Error(
        `Plano "${student.planoModalidade}" sem preço cadastrado. Defina o valor em Planos.`,
      );
    }
    amountBrl = price;
  }

  const amountCents = Math.round(amountBrl * 100);
  if (amountCents < 500) {
    throw new Error("Valor mínimo da cobrança é R$ 5,00.");
  }

  const due = options.dueDate ?? getNextDueDate(student.diaVencimento);
  const dueDateIso = formatIsoDate(due);
  const cycle = getAcademyBillingCycle(
    student.tenant.createdAt,
    due,
    student.tenant.billingCycleDay,
  );

  const existingOpen = await prisma.studentCharge.findFirst({
    where: {
      studentId: student.id,
      status: { in: [ChargeStatus.PENDING, ChargeStatus.OVERDUE] },
      dueDate: dueDateIso,
    },
    select: { id: true, asaasPaymentId: true },
  });
  if (existingOpen) {
    throw new Error("Já existe cobrança em aberto para este vencimento.");
  }

  const estimatedFeeCents = await estimateNextPlatformFeeCents(
    student.tenantId,
    cycle.key,
  );
  // Taxa OPPI em valor fixo (cabe no líquido; bem menor que a taxa Asaas)
  const feeCents = Math.min(estimatedFeeCents, Math.max(amountCents - 200, 0));
  if (feeCents <= 0) {
    throw new Error("Valor insuficiente para split da taxa OPPI.");
  }

  const billingType = options.billingType ?? "PIX";
  const payer = resolveBillingPayer(student);
  const customerId = await upsertAsaasCustomer({
    apiKey: academyApiKey,
    existingCustomerId: student.asaasCustomerId,
    name: payer.name,
    cpf: payer.cpf,
    email: payer.email,
    phone: payer.phone,
    externalReference: `student:${student.id}`,
  });

  if (customerId !== student.asaasCustomerId) {
    await prisma.student.update({
      where: { id: student.id },
      data: { asaasCustomerId: customerId },
    });
  }

  const description =
    options.description?.trim() ||
    `Mensalidade ${student.planoModalidade} — ${student.tenant.name}`;

  // Emitido pela subconta → fatura no nome da academia.
  // Split da taxa OPPI → wallet master; restante fica na academia.
  const payment = await asaasRequest<{
    id?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    status?: string;
  }>("/payments", {
    apiKey: academyApiKey,
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: centsToBrl(amountCents),
      dueDate: dueDateIso,
      description,
      externalReference: `charge:${student.id}:${dueDateIso}`,
      split: [
        {
          walletId: masterWalletId,
          fixedValue: centsToBrl(feeCents),
        },
      ],
    }),
  });

  if (!payment.id) {
    throw new AsaasError("Asaas não retornou id do pagamento.", 502, payment);
  }

  const charge = await prisma.studentCharge.create({
    data: {
      tenantId: student.tenantId,
      studentId: student.id,
      amountCents,
      platformFeeCents: 0,
      status: ChargeStatus.PENDING,
      dueDate: dueDateIso,
      billingCycleKey: cycle.key,
      asaasPaymentId: payment.id,
      payerName: payer.name,
      payerCpf: digitsOnly(payer.cpf),
      isMinorStudent: payer.isMinor,
      description,
    },
  });

  return {
    charge,
    invoiceUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
    estimatedFeeCents: feeCents,
  };
}
