import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  DEFAULT_OWNER_PLANS,
  formatPlanCurrency,
  type PlanItem,
} from "../../lib/plans";
import OwnerSectionPage from "./OwnerSectionPage";

export default function OwnerPlanosPage() {
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<{ planos: PlanItem[] }>("/owner/planos")
      .then((data) => setPlanos(data.planos.length ? data.planos : DEFAULT_OWNER_PLANS))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar planos."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updatePlan(index: number, field: keyof PlanItem, value: string) {
    setPlanos((current) =>
      current.map((plan, i) => {
        if (i !== index) return plan;
        if (field === "valor") {
          const numeric = Number(value.replace(",", "."));
          return { ...plan, valor: Number.isFinite(numeric) ? numeric : 0 };
        }
        return { ...plan, nome: value };
      }),
    );
    setSuccess("");
    setError("");
  }

  function addPlan() {
    setPlanos((current) => [...current, { nome: "Novo plano", valor: 0 }]);
    setSuccess("");
  }

  function removePlan(index: number) {
    setPlanos((current) => current.filter((_, i) => i !== index));
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const cleaned = planos
        .map((plan) => ({
          nome: plan.nome.trim(),
          valor: Number(plan.valor),
        }))
        .filter((plan) => plan.nome.length > 0);

      if (cleaned.length === 0) {
        throw new Error("Adicione ao menos um plano.");
      }

      const result = await apiFetch<{ planos: PlanItem[]; message: string }>(
        "/owner/planos",
        {
          method: "PUT",
          body: JSON.stringify({ planos: cleaned }),
        },
      );

      setPlanos(result.planos);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar planos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OwnerSectionPage
      title="Planos"
      description="Configure os planos, modalidades e valores usados no cadastro do aluno e nas contas a receber."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando planos...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              {planos.length} plano(s) configurado(s)
            </p>
            <button
              type="button"
              onClick={addPlan}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-[#e85d6f]/50 hover:text-white"
            >
              Adicionar plano
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[0.7rem] uppercase tracking-wide text-white/45">
                  <th className="px-4 py-3 font-medium">Plano / modalidade</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {planos.map((plan, index) => (
                  <tr key={`${plan.nome}-${index}`} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <input
                        value={plan.nome}
                        onChange={(e) => updatePlan(index, "nome", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={plan.valor}
                          onChange={(e) => updatePlan(index, "valor", e.target.value)}
                          className="w-36 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                          required
                        />
                        <span className="text-xs text-white/40">
                          {formatPlanCurrency(plan.valor)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removePlan(index)}
                        disabled={planos.length <= 1}
                        className="rounded-md border border-red-400/25 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d44d5f] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar planos"}
            </button>
          </div>
        </form>
      )}
    </OwnerSectionPage>
  );
}
