/**
 * Emissão de cobranças Asaas na conta master.
 * O valor integral cai na conta master. A taxa da plataforma é só controle interno.
 */

import { ChargeStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { getAcademyBillingCycle } from "../academy-billing-cycle.js";
import { formatIsoDate, getNextDueDate } from "../billing.js";
import { assertStudentCanBeCharged } from "../charge-payments.js";
import { platformFeeCentsForPaidIndex, centsToBrl } from "../platform-fees.js";
import { resolveBillingPayer } from "../student-age.js";
import { isAsaasConfigured } from "./config.js";
import { asaasRequest, AsaasError } from "./client.js";
import { normalizePlans, plansToPriceMap } from "../../modules/owner/plans.js";
import {
  brandingWithAsaasCharge,
  parseAsaasCharge,
  parseBilling,
  type AcademyAsaasChargeRecord,
} from "../../modules/dev/academy.js";

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
      // Cliente pode ser de outra conta — recria na conta master
    }
  }

  const created = await asaasRequest<{ id?: string }>("/customers", {
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

  const student = await prisma.student.findFirst({
    where: { id: options.studentId, tenantId: options.tenantId },
    include: {
      tenant: {
        select: {
          id: true,
          createdAt: true,
          billingCycleDay: true,
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

  const billingType = options.billingType ?? "PIX";
  const payer = resolveBillingPayer(student);
  const customerId = await upsertAsaasCustomer({
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

  const payment = await asaasRequest<{
    id?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    status?: string;
  }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: centsToBrl(amountCents),
      dueDate: dueDateIso,
      description,
      externalReference: `charge:${student.id}:${dueDateIso}`,
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
    estimatedFeeCents,
  };
}

function asaasBillingType(
  periodo: string,
  forma: string,
): "UNDEFINED" | "BOLETO" | "PIX" | "CREDIT_CARD" {
  const text = `${periodo} ${forma}`.toLowerCase();
  if (text.includes("pix")) return "PIX";
  if (text.includes("cart")) return "CREDIT_CARD";
  if (text.includes("boleto")) return "BOLETO";
  return "UNDEFINED";
}

/**
 * Cobrança Asaas do plano da academia, no CPF/e-mail do dono.
 * A mensalidade do aluno fica entre a academia e o aluno.
 */
export async function issueAcademyOwnerCharge(tenantId: string) {
  if (!isAsaasConfigured()) {
    throw new AsaasError("Asaas não configurado no servidor.", 503, null);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, branding: true },
  });
  if (!tenant) {
    throw new Error("Academia não encontrada.");
  }

  const existing = parseAsaasCharge(tenant.branding);
  if (
    existing &&
    (existing.status === "PENDING" || existing.status === "PAID" || existing.status === "OVERDUE")
  ) {
    return {
      invoiceUrl: existing.invoiceUrl,
      paymentId: existing.paymentId,
      dueDate: existing.dueDate,
      amountBrl: existing.amountCents / 100,
      status: existing.status,
      alreadyIssued: true,
    };
  }

  const billing = parseBilling(tenant.branding);
  const branding = (tenant.branding ?? {}) as {
    responsavel?: { nome?: string; cpf?: string; telefone?: string; emailLogin?: string };
    emailCorporativo?: string;
  };
  const amountBrl = typeof billing.valor === "number" ? billing.valor : 0;
  if (!(amountBrl >= 5)) {
    throw new Error(
      "O plano da academia precisa ter valor de pelo menos R$ 5,00 para emitir a cobrança.",
    );
  }

  const payerName = branding.responsavel?.nome?.trim() || tenant.name;
  const payerCpf = (branding.responsavel?.cpf ?? "").replace(/\D/g, "");
  const payerEmail = (
    branding.responsavel?.emailLogin ||
    branding.emailCorporativo ||
    ""
  )
    .trim()
    .toLowerCase();
  const payerPhone = branding.responsavel?.telefone?.trim() || null;

  if (!payerName || payerCpf.length < 11 || !payerEmail) {
    throw new Error("Informe nome, CPF e e-mail do dono para emitir a cobrança da academia.");
  }

  const customerId = await upsertAsaasCustomer({
    existingCustomerId: existing?.customerId ?? null,
    name: payerName,
    cpf: payerCpf,
    email: payerEmail,
    phone: payerPhone,
    externalReference: `academy:${tenant.id}`,
  });

  const due = new Date();
  due.setDate(due.getDate() + 3);
  const dueDateIso = formatIsoDate(due);
  const amountCents = Math.round(amountBrl * 100);
  const description = `Plano ${billing.plano || "usemint"} — ${tenant.name}`;

  const payment = await asaasRequest<{
    id?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    status?: string;
  }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: asaasBillingType(billing.periodo, billing.formaPagamento),
      value: centsToBrl(amountCents),
      dueDate: dueDateIso,
      description,
      externalReference: `academy-charge:${tenant.id}:${dueDateIso}`,
    }),
  });

  if (!payment.id) {
    throw new AsaasError("Asaas não retornou id do pagamento.", 502, payment);
  }

  const record: AcademyAsaasChargeRecord = {
    customerId,
    paymentId: payment.id,
    invoiceUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
    status: "PENDING",
    amountCents,
    dueDate: dueDateIso,
    payerName,
    payerCpf,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { branding: brandingWithAsaasCharge(tenant.branding, record) },
  });

  return {
    invoiceUrl: record.invoiceUrl,
    paymentId: record.paymentId,
    dueDate: record.dueDate,
    amountBrl,
    status: record.status,
    alreadyIssued: false,
  };
}

export async function confirmAcademyChargePaid(options: {
  asaasPaymentId: string;
  paidAt: Date;
}): Promise<{ tenantId: string; alreadyPaid: boolean } | null> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, branding: true },
  });
  const tenant = tenants.find(
    (item) => parseAsaasCharge(item.branding)?.paymentId === options.asaasPaymentId,
  );
  if (!tenant) return null;

  const charge = parseAsaasCharge(tenant.branding);
  if (!charge) return null;
  if (charge.status === "PAID") {
    return { tenantId: tenant.id, alreadyPaid: true };
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      branding: brandingWithAsaasCharge(tenant.branding, {
        ...charge,
        status: "PAID",
        paidAt: options.paidAt.toISOString(),
      }),
    },
  });

  return { tenantId: tenant.id, alreadyPaid: false };
}
