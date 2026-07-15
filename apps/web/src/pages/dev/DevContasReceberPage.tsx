import { useState } from "react";
import { Link } from "react-router-dom";
import DevAcademiaEditModal from "../../components/dev/DevAcademiaEditModal";
import DevAcademiaDeleteButton from "../../components/dev/DevAcademiaDeleteButton";
import { useDevAcademias, type DevAcademia } from "../../hooks/useDevAcademias";
import DevSectionPage from "./DevSectionPage";

const PLANO_VALORES: Record<string, { mensal: number; anual: number }> = {
  Bronze: { mensal: 199, anual: 1990 },
  Prata: { mensal: 299, anual: 2990 },
  Ouro: { mensal: 399, anual: 3990 },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getValorPlano(plano: string, periodo: string) {
  const valores = PLANO_VALORES[plano];
  if (!valores) return null;
  return periodo === "Anual" ? valores.anual : valores.mensal;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function DevContasReceberPage() {
  const { academias, loading, error, reload } = useDevAcademias();
  const [editingAcademia, setEditingAcademia] = useState<DevAcademia | null>(null);

  const totalReceber = academias.reduce((sum, academia) => {
    if (!academia.active) return sum;
    const valor = getValorPlano(academia.billing.plano, academia.billing.periodo);
    return sum + (valor ?? 0);
  }, 0);

  return (
    <DevSectionPage
      title="Contas a Receber"
      description="Mensalidades e cobranças das academias cadastradas na plataforma."
    >
      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando contas...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && academias.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/60">
            Nenhuma academia cadastrada ainda. As contas aparecem após o cadastro.
          </p>
          <Link
            to="/dev/cadastro-academias"
            className="mt-4 inline-block text-sm font-medium text-[#e85d6f] hover:underline"
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

          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[0.65rem] font-semibold uppercase tracking-wide text-white/50">
                    <th className="px-5 py-3">Academia</th>
                    <th className="px-5 py-3">Plano</th>
                    <th className="px-5 py-3">Período</th>
                    <th className="px-5 py-3">Forma de pagamento</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Cadastro</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {academias.map((academia) => {
                    const valor = getValorPlano(
                      academia.billing.plano,
                      academia.billing.periodo,
                    );

                    return (
                      <tr key={academia.id} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">{academia.name}</p>
                          <p className="mt-0.5 text-xs text-white/40">{academia.slug}</p>
                        </td>
                        <td className="px-5 py-4 text-white/80">
                          {academia.billing.plano || "—"}
                        </td>
                        <td className="px-5 py-4 text-white/80">
                          {academia.billing.periodo || "—"}
                        </td>
                        <td className="px-5 py-4 text-white/80">
                          {academia.billing.formaPagamento || "—"}
                        </td>
                        <td className="px-5 py-4 font-medium text-white">
                          {valor != null ? formatCurrency(valor) : "—"}
                        </td>
                        <td className="px-5 py-4 text-white/60">
                          {formatDate(academia.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge active={academia.active} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingAcademia(academia)}
                              className="rounded-lg border border-white/15 px-3 py-1.5 text-[0.72rem] font-medium text-white/80 transition hover:border-[#e85d6f]/50 hover:text-[#e85d6f]"
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
    <div className="rounded-xl border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-sm">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-red-500/15 text-red-300"
      }`}
    >
      {active ? "Ativa" : "Bloqueada"}
    </span>
  );
}
