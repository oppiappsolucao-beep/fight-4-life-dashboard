import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { PlatformPlan } from "../../types/platformPlan";
import DevSectionPage from "./DevSectionPage";

export default function DevPlanosPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [name, setName] = useState("");
  const [billingType, setBillingType] = useState<"Boleto" | "Recorrente" | "Anual">("Boleto");
  const [studentLimit, setStudentLimit] = useState("50");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ plans: PlatformPlan[] }>("/dev/platform-plans")
      .then((data) => setPlans(data.plans))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar planos."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiFetch<{ message: string }>("/dev/platform-plans", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || undefined,
          billingType,
          studentLimit: Number(studentLimit),
          price: Number(price.replace(",", ".")),
        }),
      });
      setSuccess(result.message);
      setName("");
      setPrice("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DevSectionPage
      title="Planos da Plataforma"
      description="Planos que o dono contrata na usemint. No cadastro da academia, escolha um destes. Você também pode criar um plano novo, como nas modalidades."
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="m-0 text-sm font-semibold text-slate-900">Novo plano</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              Nome (opcional)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Boleto 50"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Tipo
              <select
                value={billingType}
                onChange={(e) =>
                  setBillingType(e.target.value as "Boleto" | "Recorrente" | "Anual")
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="Boleto">Boleto</option>
                <option value="Recorrente">Recorrente</option>
                <option value="Anual">Anual</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Limite de alunos
              <input
                value={studentLimit}
                onChange={(e) => setStudentLimit(e.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                required
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Valor (R$)
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="99,90"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                required
              />
            </label>
          </div>
          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-[#2E496C] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Adicionar plano"}
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="m-0 text-sm font-semibold text-slate-900">Planos disponíveis</p>
          {loading ? (
            <p className="mt-4 text-sm text-slate-600">Carregando...</p>
          ) : plans.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Nenhum plano cadastrado.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {plans.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="m-0 font-semibold text-slate-900">{item.name}</p>
                  <p className="m-0 mt-1 text-xs text-slate-700">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DevSectionPage>
  );
}
