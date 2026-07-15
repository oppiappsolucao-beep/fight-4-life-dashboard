export interface PlanItem {
  nome: string;
  valor: number;
}

export const DEFAULT_OWNER_PLANS: PlanItem[] = [
  { nome: "Musculação Livre", valor: 149 },
  { nome: "Plano Trimestral", valor: 399 },
  { nome: "Plano Semestral", valor: 699 },
  { nome: "Plano Anual", valor: 1199 },
  { nome: "Pilates", valor: 199 },
  { nome: "Muay Thai", valor: 179 },
  { nome: "Jiu-Jitsu", valor: 189 },
  { nome: "MMA", valor: 199 },
  { nome: "Aula Avulsa", valor: 49 },
];

export function formatPlanCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function plansToPriceMap(plans: PlanItem[]): Record<string, number> {
  return Object.fromEntries(plans.map((plan) => [plan.nome, plan.valor]));
}
