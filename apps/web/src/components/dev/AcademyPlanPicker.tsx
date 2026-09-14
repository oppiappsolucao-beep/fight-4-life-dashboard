import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { PlatformPlan } from "../../types/platformPlan";

export default function AcademyPlanPicker({
  planId,
  onSelect,
}: {
  planId: string;
  onSelect: (plan: PlatformPlan | null) => void;
}) {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ plans: PlatformPlan[] }>("/dev/platform-plans")
      .then((data) => setPlans(data.plans))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformPlan[]>();
    for (const plan of plans) {
      const list = map.get(plan.billingType) ?? [];
      list.push(plan);
      map.set(plan.billingType, list);
    }
    return Array.from(map.entries());
  }, [plans]);

  return (
    <select
      value={planId}
      onChange={(event) => {
        const next = plans.find((item) => item.id === event.target.value) ?? null;
        onSelect(next);
      }}
      required
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#5B7595]/70 focus:ring-2 focus:ring-[#5B7595]/20"
    >
      <option value="">{loading ? "Carregando planos..." : "Selecione o plano contratado"}</option>
      {grouped.map(([type, items]) => (
        <optgroup key={type} label={type}>
          {items.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
