export interface PlanItem {
  nome: string;
  valor: number;
  liberaTodaGrade?: boolean;
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

export function normalizePlans(raw: unknown): PlanItem[] {
  if (Array.isArray(raw)) {
    const items = raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as {
          nome?: unknown;
          valor?: unknown;
          liberaTodaGrade?: unknown;
        };
        const nome = typeof row.nome === "string" ? row.nome.trim() : "";
        const valor = Number(row.valor);
        if (!nome || !Number.isFinite(valor) || valor < 0) return null;
        const plan: PlanItem = {
          nome,
          valor,
          liberaTodaGrade: row.liberaTodaGrade === true,
        };
        return plan;
      })
      .filter((item): item is PlanItem => item !== null);

    return items.length > 0 ? items : DEFAULT_OWNER_PLANS;
  }

  if (raw && typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>)
      .map(([nome, valor]) => {
        const num = Number(valor);
        if (!nome.trim() || !Number.isFinite(num) || num < 0) return null;
        return { nome: nome.trim(), valor: num };
      })
      .filter((item): item is PlanItem => item !== null);

    return entries.length > 0 ? entries : DEFAULT_OWNER_PLANS;
  }

  return DEFAULT_OWNER_PLANS;
}

export function plansToPriceMap(plans: PlanItem[]): Record<string, number> {
  return Object.fromEntries(plans.map((plan) => [plan.nome, plan.valor]));
}
