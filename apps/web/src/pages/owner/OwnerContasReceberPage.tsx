import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import {
  getDueStatus,
  getNextDueDate,
  hasActiveBillingRelease,
} from "../../lib/billing";
import { formatCpf, formatPhone } from "../../lib/format";
import {
  DEFAULT_OWNER_PLANS,
  formatPlanCurrency,
  plansToPriceMap,
  type PlanItem,
} from "../../lib/plans";
import OwnerSectionPage from "./OwnerSectionPage";

interface LatestCharge {
  id: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED";
  dueDate: string;
  amountBrl: number;
  asaasPaymentId: string | null;
  paidAt: string | null;
}

interface AlunoRecebivel {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  planoModalidade: string;
  dataInicio: string;
  diaVencimento: string;
  formaPagamento: string | null;
  acessoLiberadoAte: string | null;
  createdAt: string;
  latestCharge?: LatestCharge | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function parseDueDay(diaVencimento: string): number {
  const day = Number.parseInt(diaVencimento.replace(/\D/g, ""), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return 1;
  return day;
}

type ContaGrupo = "cancelado" | "pago" | "a_pagar" | "vencido";

function contaGrupo(aluno: AlunoRecebivel): ContaGrupo {
  const charge = aluno.latestCharge?.status;
  if (charge === "CANCELLED" || charge === "REFUNDED") return "cancelado";
  const overdue = charge === "OVERDUE" || getDueStatus(aluno.diaVencimento) === "vencido";
  const paidAndOpen = charge === "PAID" && (hasActiveBillingRelease(aluno) || !overdue);
  if (paidAndOpen) return "pago";
  if (overdue) return "vencido";
  return "a_pagar";
}

function valorAluno(aluno: AlunoRecebivel, priceMap: Record<string, number>): number {
  return aluno.latestCharge?.amountBrl ?? priceMap[aluno.planoModalidade] ?? 0;
}

export default function OwnerContasReceberPage() {
  const [alunos, setAlunos] = useState<AlunoRecebivel[]>([]);
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [releaseDays, setReleaseDays] = useState<Record<string, string>>({});

  const priceMap = useMemo(() => plansToPriceMap(planos), [planos]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");

    Promise.all([
      apiFetch<{ alunos: AlunoRecebivel[] }>("/owner/alunos"),
      apiFetch<{ planos: PlanItem[] }>("/owner/planos"),
    ])
      .then(([alunosData, planosData]) => {
        setAlunos(alunosData.alunos);
        if (planosData.planos.length) setPlanos(planosData.planos);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Erro ao carregar contas a receber.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyGestao(
    alunoId: string,
    result: {
      aluno: { acessoLiberadoAte: string | null };
      latestCharge: LatestCharge | null;
    },
  ) {
    setAlunos((current) =>
      current.map((item) =>
        item.id === alunoId
          ? {
              ...item,
              acessoLiberadoAte: result.aluno.acessoLiberadoAte,
              latestCharge: result.latestCharge ?? item.latestCharge,
            }
          : item,
      ),
    );
  }

  async function darBaixa(aluno: AlunoRecebivel) {
    setSettlingId(aluno.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{
        message: string;
        aluno: { acessoLiberadoAte: string | null };
        latestCharge: LatestCharge;
      }>(`/owner/alunos/${aluno.id}/dar-baixa`, { method: "POST" });
      applyGestao(aluno.id, result);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao marcar como pago.");
    } finally {
      setSettlingId(null);
    }
  }

  async function gerirAluno(aluno: AlunoRecebivel, acao: "cancelado" | "liberar") {
    const dias = Number.parseInt(releaseDays[aluno.id] ?? "", 10);
    if (acao === "liberar" && (!Number.isFinite(dias) || dias < 1 || dias > 90)) {
      setError("Informe de 1 a 90 dias para liberar.");
      setSuccess("");
      return;
    }

    setSettlingId(aluno.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{
        message: string;
        aluno: { acessoLiberadoAte: string | null };
        latestCharge: LatestCharge | null;
      }>(`/owner/alunos/${aluno.id}/gestao`, {
        method: "POST",
        body: JSON.stringify({
          acao,
          ...(acao === "liberar" ? { dias } : {}),
        }),
      });
      applyGestao(aluno.id, result);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar o aluno.");
    } finally {
      setSettlingId(null);
    }
  }

  const grupos = useMemo(() => {
    const buckets: Record<ContaGrupo, { count: number; total: number }> = {
      cancelado: { count: 0, total: 0 },
      pago: { count: 0, total: 0 },
      a_pagar: { count: 0, total: 0 },
      vencido: { count: 0, total: 0 },
    };
    for (const aluno of alunos) {
      const grupo = contaGrupo(aluno);
      buckets[grupo].count += 1;
      buckets[grupo].total += valorAluno(aluno, priceMap);
    }
    return buckets;
  }, [alunos, priceMap]);
  return (
    <OwnerSectionPage
      title="Contas a Receber"
      description="Mensalidades dos alunos, combinadas direto com a academia. A cobrança Asaas da plataforma é do dono, no cadastro da academia."
    >
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando contas...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 break-all">
          {success}
        </div>
      ) : null}

      {!loading && !error && alunos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-500">
            Nenhum aluno cadastrado ainda. As cobranças aparecem após o cadastro.
          </p>
          <Link
            to="/dono/cadastro-aluno"
            className="mt-4 inline-block text-sm font-medium text-[#5B7595] hover:underline"
          >
            Cadastrar aluno →
          </Link>
        </div>
      ) : null}

      {!loading && !error && alunos.length > 0 ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Cancelados"
              value={formatPlanCurrency(grupos.cancelado.total)}
              hint={`${grupos.cancelado.count} aluno(s)`}
            />
            <SummaryCard
              label="Pagos"
              value={formatPlanCurrency(grupos.pago.total)}
              hint={`${grupos.pago.count} aluno(s)`}
            />
            <SummaryCard
              label="A pagar"
              value={formatPlanCurrency(grupos.a_pagar.total)}
              hint={`${grupos.a_pagar.count} aluno(s)`}
            />
            <SummaryCard
              label="Vencidos"
              value={formatPlanCurrency(grupos.vencido.total)}
              hint={`${grupos.vencido.count} aluno(s)`}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white backdrop-blur-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[0.7rem] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Aluno</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => {
                  const valor = valorAluno(aluno, priceMap);
                  const grupo = contaGrupo(aluno);
                  const proximoVenc = getNextDueDate(aluno.diaVencimento);

                  return (
                    <tr
                      key={aluno.id}
                      className="border-b border-slate-100 text-[#2E496C]/85 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="m-0 font-medium text-[#2E496C]">{aluno.nomeCompleto}</p>
                        <p className="m-0 text-xs text-slate-400">
                          {formatCpf(aluno.cpf)}
                          {aluno.telefone
                            ? ` · ${formatPhone(aluno.telefone)}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {aluno.planoModalidade}
                        <span className="block text-xs text-[#2E496C]/40">
                          Início {formatDate(aluno.dataInicio)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#2E496C]">
                        {valor != null ? formatPlanCurrency(valor) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        Dia {parseDueDay(aluno.diaVencimento)}
                        <span className="block text-xs text-[#2E496C]/40">
                          Próx. {proximoVenc.toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge grupo={grupo} liberadoAte={aluno.acessoLiberadoAte} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[16rem] flex-col gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={settlingId === aluno.id || grupo === "pago"}
                              onClick={() => darBaixa(aluno)}
                              className="rounded-lg border border-emerald-400/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              {settlingId === aluno.id ? "Salvando..." : "Pago"}
                            </button>
                            <button
                              type="button"
                              disabled={settlingId === aluno.id || grupo === "cancelado"}
                              onClick={() => gerirAluno(aluno, "cancelado")}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Cancelado
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Liberar</span>
                            <input
                              type="number"
                              min={1}
                              max={90}
                              inputMode="numeric"
                              value={releaseDays[aluno.id] ?? ""}
                              placeholder="dias"
                              onChange={(event) =>
                                setReleaseDays((current) => ({
                                  ...current,
                                  [aluno.id]: event.target.value,
                                }))
                              }
                              className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-[#2E496C] outline-none"
                            />
                            <span className="text-xs text-slate-500">dias</span>
                            <button
                              type="button"
                              disabled={settlingId === aluno.id}
                              onClick={() => gerirAluno(aluno, "liberar")}
                              className="rounded-lg border border-[#5B7595]/30 px-2.5 py-1.5 text-xs font-semibold text-[#2E496C] hover:bg-[#5B7595]/10 disabled:opacity-50"
                            >
                              Liberar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </OwnerSectionPage>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 backdrop-blur-sm">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[#2E496C]">{value}</p>
      <p className="m-0 mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function StatusBadge({
  grupo,
  liberadoAte,
}: {
  grupo: ContaGrupo;
  liberadoAte: string | null;
}) {
  const styles =
    grupo === "pago"
      ? "bg-emerald-500/15 text-emerald-700"
      : grupo === "a_pagar"
        ? "bg-amber-500/15 text-amber-800"
        : grupo === "cancelado"
          ? "bg-slate-200 text-slate-600"
          : "bg-red-500/15 text-red-700";
  const label =
    grupo === "pago"
      ? "Pago"
      : grupo === "a_pagar"
        ? "A pagar"
        : grupo === "cancelado"
          ? "Cancelado"
          : "Vencido";

  return (
    <div>
      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${styles}`}>
        {label}
      </span>
      {liberadoAte ? (
        <p className="m-0 mt-1 text-[0.65rem] text-[#2E496C]/40">
          Liberado até {liberadoAte.split("-").reverse().join("/")}
        </p>
      ) : null}
    </div>
  );
}
