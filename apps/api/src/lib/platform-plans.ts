import { prisma } from "./prisma.js";

export const PLATFORM_BILLING_TYPES = ["Boleto", "Recorrente", "Anual"] as const;
export type PlatformBillingType = (typeof PLATFORM_BILLING_TYPES)[number];

export const DEFAULT_PLATFORM_PLANS: Array<{
  billingType: PlatformBillingType;
  studentLimit: number;
  price: number;
}> = [
  { billingType: "Boleto", studentLimit: 50, price: 99.9 },
  { billingType: "Boleto", studentLimit: 100, price: 149.9 },
  { billingType: "Boleto", studentLimit: 200, price: 199.9 },
  { billingType: "Recorrente", studentLimit: 50, price: 89.9 },
  { billingType: "Recorrente", studentLimit: 100, price: 139.9 },
  { billingType: "Recorrente", studentLimit: 200, price: 189.9 },
  { billingType: "Anual", studentLimit: 50, price: 958.8 },
  { billingType: "Anual", studentLimit: 100, price: 1558.8 },
  { billingType: "Anual", studentLimit: 200, price: 2158.8 },
];

export function defaultPlanName(billingType: string, studentLimit: number): string {
  return `${billingType} ${studentLimit}`;
}

export function paymentMethodForBillingType(billingType: string): string {
  if (billingType === "Recorrente") return "Cartão de Crédito";
  if (billingType === "Anual") return "Pix";
  return "Boleto";
}

export function formatPlanPrice(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function serializePlatformPlan(plan: {
  id: string;
  name: string;
  billingType: string;
  studentLimit: number;
  price: number;
  active: boolean;
}) {
  return {
    id: plan.id,
    name: plan.name,
    billingType: plan.billingType,
    studentLimit: plan.studentLimit,
    price: plan.price,
    active: plan.active,
    label: `${plan.billingType} · até ${plan.studentLimit} alunos · ${formatPlanPrice(plan.price)}`,
    formaPagamento: paymentMethodForBillingType(plan.billingType),
  };
}

export async function ensurePlatformPlans(): Promise<number> {
  for (const item of DEFAULT_PLATFORM_PLANS) {
    const existing = await prisma.platformPlan.findFirst({
      where: {
        billingType: item.billingType,
        studentLimit: item.studentLimit,
        price: item.price,
      },
    });
    if (existing) continue;

    await prisma.platformPlan.create({
      data: {
        name: defaultPlanName(item.billingType, item.studentLimit),
        billingType: item.billingType,
        studentLimit: item.studentLimit,
        price: item.price,
        active: true,
      },
    });
  }

  return prisma.platformPlan.count({ where: { active: true } });
}
