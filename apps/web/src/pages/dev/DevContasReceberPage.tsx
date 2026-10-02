import { useState } from "react";
import { Link } from "react-router-dom";
import DevAcademiaEditModal from "../../components/dev/DevAcademiaEditModal";
import DevAcademiaDeleteButton from "../../components/dev/DevAcademiaDeleteButton";
import { apiFetch } from "../../lib/api";
import { useDevAcademias, type DevAcademia } from "../../hooks/useDevAcademias";
import DevSectionPage from "./DevSectionPage";

function getValorPlano(billing: { plano: string; periodo: string; valor?: number | null }) {
  if (typeof billing.valor === "number" && billing.valor > 0) return billing.valor;
  return null;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function DevContasReceberPage() {
  const { academias, loading, error, reload } = useDevAcademias();
  const [editingAcademia, setEditingAcademia] = useState<DevAcademia | null>(null);
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const totalReceber = academias.reduce((sum, academia) => {
    if (!academia.active) return sum;
    const valor = getValorPlano(academia.billing);
    return sum + (valor ?? 0);
  }, 0);

  async function emitirCobranca(academia: DevAcademia) {
    setChargingId(academia.id);
    setActionError("");
    setActionMessage("");
    try {
      const result = await apiFetch<{ message: string }>(`/dev/academias/${academia.id}/cobranca`, {
        method: "POST",
      });
      setActionMessage(result.message);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao emitir cobrança.");
    } finally {
      setChargingId(null);
    }
  }

  return (
    <DevSectionPage
      title="Contas a Receber"
      description="Cobrança Asaas do plano da academia, emitida para o dono no cadastro."
    >
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando contas...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {actionMessage}
        </div>
      ) : null}

      {!loading && !error && academias.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-500">
            Nenhuma academia cadastrada ainda. As contas aparecem após o cadastro.
          </p>
          <Link
            to="/dev/cadastro-academias"
            className="mt-4 inline-block text-sm font-medium text-[#5B7595] hover:underline"
          >
            Cadastrar academia →
          </Link>
        </div>
      )}

      {!loading && !error && academias.length > 0 && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Academias ativas"
              value={String(academias.filter((a) => a.active).length)}
            />
            <SummaryCard
              label="Total de academias"
              value={String(academias.length)}
            />
            <SummaryCard
              label="Receita prevista (ativas)"
              value={formatCurrency(totalReceber)}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Academia</th>
                    <th className="px-5 py-3">Plano</th>
                    <th className="px-5 py-3">Período</th>
                    <th className="px-5 py-3">Forma de pagamento</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Cadastro</th>
                    <th className="px-5 py-3">Asaas (dono)</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {academias.map((academia) => {
                    const valor = getValorPlano(academia.billing);

                    return (
                      <tr key={academia.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-4">
                          <p className="font-medium text-[#2E496C]">{academia.name}</p>
                          <p className="mt-0.5 text-xs text-[#2E496C]/40">{academia.slug}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {academia.billing.plano || "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {academia.billing.periodo || "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {academia.billing.formaPagamento || "—"}
                        </td>
                        <td className="px-5 py-4 font-medium text-[#2E496C]">
                          {valor != null ? formatCurrency(valor) : "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {formatDate(academia.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600">
                          {academia.asaasCharge ? (
                            <>
                              <span className="font-semibold text-[#2E496C]">
                                {academia.asaasCharge.status === "PAID" ? "Paga" : "Pendente"}
                              </span>
                              {academia.asaasCharge.dueDate ? (
                                <span className="block text-slate-400">
                                  Vence {academia.asaasCharge.dueDate.split("-").reverse().join("/")}
                                </span>
                              ) : null}
                              {academia.asaasCharge.invoiceUrl ? (
                                <a
                                  href={academia.asaasCharge.invoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-block font-semibold text-[#5B7595] underline"
                                >
                                  Abrir cobrança
                                </a>
                              ) : null}
                            </>
                          ) : (
                            "Sem cobrança"
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge active={academia.active} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {!academia.asaasCharge || academia.asaasCharge.status === "CANCELLED" ? (
                              <button
                                type="button"
                                disabled={chargingId === academia.id}
                                onClick={() => void emitirCobranca(academia)}
                                className="rounded-lg border border-[#5B7595]/40 px-3 py-1.5 text-[0.72rem] font-medium text-[#2E496C] transition hover:border-[#5B7595]"
                              >
                                {chargingId === academia.id ? "Emitindo..." : "Cobrar dono"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setEditingAcademia(academia)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[0.72rem] font-medium text-slate-700 transition hover:border-[#5B7595]/50 hover:text-[#5B7595]"
                            >
                              Editar
                            </button>
                            <DevAcademiaDeleteButton
                              academiaId={academia.id}
                              academiaName={academia.name}
                              onDeleted={reload}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingAcademia && (
        <DevAcademiaEditModal
          academiaId={editingAcademia.id}
          academiaName={editingAcademia.name}
          onClose={() => setEditingAcademia(null)}
          onSaved={reload}
        />
      )}
    </DevSectionPage>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 backdrop-blur-sm">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[#2E496C]">{value}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
        active
          ? "bg-emerald-500/15 text-emerald-700"
          : "bg-red-500/15 text-red-300"
      }`}
    >
      {active ? "Ativa" : "Bloqueada"}
    </span>
  );
}
