const PLANO_VALORES: Record<string, { mensal: number; anual: number }> = {
  Bronze: { mensal: 199, anual: 1990 },
  Prata: { mensal: 299, anual: 2990 },
  Ouro: { mensal: 399, anual: 3990 },
};

export function getPlatformPlanValue(plano: string, periodo: string): number {
  const valores = PLANO_VALORES[plano];
  if (!valores) return 0;
  return periodo === "Anual" ? valores.anual : valores.mensal;
}
