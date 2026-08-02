import { ChargeStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { getAcademyBillingCycle } from "./academy-billing-cycle.js";
import { PLATFORM_TENANT_SLUGS } from "../middleware/tenant.js";
import { platformFeeCentsForPaidIndex } from "./platform-fees.js";
import { isMinorStudent, resolveBillingPayer } from "./student-age.js";

/**
 * Confirma pagamento e grava a taxa OPPI da posição no ciclo da academia.
 * Chamado pelo webhook Asaas (PAYMENT_CONFIRMED / RECEIVED).
 */
export async function confirmStudentChargePaid(options: {
  chargeId?: string;
  asaasPaymentId?: string;
  paidAt?: Date;
}): Promise<{
  chargeId: string;
  platformFeeCents: number;
  paidIndex: number;
  billingCycleKey: string;
}> {
  const paidAt = options.paidAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    if (!options.chargeId && !options.asaasPaymentId) {
      throw new Error("Informe chargeId ou asaasPaymentId.");
    }

    const charge = await tx.studentCharge.findFirst({
      where: options.chargeId
        ? { id: options.chargeId }
        : { asaasPaymentId: options.asaasPaymentId! },
      include: {
        tenant: { select: { id: true, createdAt: true, billingCycleDay: true } },
      },
    });

    if (!charge) {
      throw new Error("Cobrança não encontrada.");
    }

    if (charge.status === ChargeStatus.PAID) {
      return {
        chargeId: charge.id,
        platformFeeCents: charge.platformFeeCents,
        paidIndex: 0,
        billingCycleKey: charge.billingCycleKey,
      };
    }

    const cycle = getAcademyBillingCycle(
      charge.tenant.createdAt,
      paidAt,
      charge.tenant.billingCycleDay,
    );

    const alreadyPaid = await tx.studentCharge.count({
      where: {
        tenantId: charge.tenantId,
        status: ChargeStatus.PAID,
        billingCycleKey: cycle.key,
      },
    });

    const paidIndex = alreadyPaid + 1;
    const platformFeeCents = platformFeeCentsForPaidIndex(paidIndex);

    await tx.studentCharge.update({
      where: { id: charge.id },
      data: {
        status: ChargeStatus.PAID,
        paidAt,
        billingCycleKey: cycle.key,
        platformFeeCents,
      },
    });

    return {
      chargeId: charge.id,
      platformFeeCents,
      paidIndex,
      billingCycleKey: cycle.key,
    };
  });
}

export async function sumPlatformRevenueForOpenCycles(
  reference = new Date(),
): Promise<{
  receitaPlataformaCents: number;
  cobrancasPagas: number;
  academiasComPagamento: number;
}> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, createdAt: true, billingCycleDay: true, slug: true },
  });

  let receitaPlataformaCents = 0;
  let cobrancasPagas = 0;
  let academiasComPagamento = 0;

  for (const tenant of tenants) {
    if ((PLATFORM_TENANT_SLUGS as readonly string[]).includes(tenant.slug)) continue;

    const cycle = getAcademyBillingCycle(
      tenant.createdAt,
      reference,
      tenant.billingCycleDay,
    );

    const agg = await prisma.studentCharge.aggregate({
      where: {
        tenantId: tenant.id,
        status: ChargeStatus.PAID,
        billingCycleKey: cycle.key,
      },
      _sum: { platformFeeCents: true },
      _count: { _all: true },
    });

    const fees = agg._sum.platformFeeCents ?? 0;
    const count = agg._count._all;
    if (count > 0) academiasComPagamento += 1;
    receitaPlataformaCents += fees;
    cobrancasPagas += count;
  }

  return { receitaPlataformaCents, cobrancasPagas, academiasComPagamento };
}

export function assertStudentCanBeCharged(student: {
  dataNascimento: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone?: string | null;
  responsavelNome?: string | null;
  responsavelCpf?: string | null;
  responsavelEmail?: string | null;
  responsavelTelefone?: string | null;
  active: boolean;
}): { ok: true; isMinor: boolean } | { ok: false; error: string } {
  if (!student.active) {
    return { ok: false, error: "Aluno inativo." };
  }

  const payer = resolveBillingPayer(student);
  if (payer.isMinor && payer.missingResponsible) {
    return {
      ok: false,
      error:
        "Aluno menor de 18 anos: cadastre o responsável (nome, CPF e e-mail) para emitir cobrança.",
    };
  }

  return { ok: true, isMinor: isMinorStudent(student.dataNascimento) };
}
