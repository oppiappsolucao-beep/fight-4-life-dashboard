import { DEFAULT_PLATFORM_PLANS } from "../../lib/platform-plans.js";

const LEGACY_PLANO_VALORES: Record<string, { mensal: number; anual: number }> = {
  Bronze: { mensal: 199, anual: 1990 },
  Prata: { mensal: 299, anual: 2990 },
  Ouro: { mensal: 399, anual: 3990 },
};

export function getPlatformPlanValue(
  plano: string,
  periodo: string,
  valor?: number | null,
): number {
  if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
    return valor;
  }

  const limitMatch = plano.match(/(\d+)/);
  const limit = limitMatch ? Number(limitMatch[1]) : NaN;
  const fromCatalog = DEFAULT_PLATFORM_PLANS.find(
    (item) =>
      item.billingType.toLowerCase() === periodo.toLowerCase() &&
      item.studentLimit === limit,
  );
  if (fromCatalog) return fromCatalog.price;

  const byTypeAndLimit = DEFAULT_PLATFORM_PLANS.find(
    (item) =>
      plano.toLowerCase().includes(item.billingType.toLowerCase()) &&
      item.studentLimit === limit,
  );
  if (byTypeAndLimit) return byTypeAndLimit.price;

  const valores = LEGACY_PLANO_VALORES[plano];
  if (!valores) return 0;
  return periodo === "Anual" ? valores.anual : valores.mensal;
}
