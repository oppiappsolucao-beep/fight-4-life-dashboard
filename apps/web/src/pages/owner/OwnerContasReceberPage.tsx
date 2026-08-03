import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import {
  getEffectiveDueStatus,
  getNextDueDate,
  type BillingDueStatus,
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

function chargeLabel(status: LatestCharge["status"] | undefined) {
  switch (status) {
    case "PAID":
      return "Paga (Asaas)";
    case "PENDING":
      return "Pendente (Asaas)";
    case "OVERDUE":
      return "Vencida (Asaas)";
    case "CANCELLED":
      return "Cancelada";
    case "REFUNDED":
      return "Estornada";
    default:
      return "Sem cobrança";
  }
}

export default function OwnerContasReceberPage() {
  const [alunos, setAlunos] = useState<AlunoRecebivel[]>([]);
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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

  async function liberarAluno(aluno: AlunoRecebivel) {
    setReleasingId(aluno.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string; aluno: AlunoRecebivel }>(
        `/owner/alunos/${aluno.id}/liberar-acesso`,
        { method: "POST" },
      );
      setAlunos((current) =>
        current.map((item) =>
          item.id === aluno.id
            ? { ...item, acessoLiberadoAte: result.aluno.acessoLiberadoAte }
            : item,
        ),
      );
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao liberar aluno.");
    } finally {
      setReleasingId(null);
    }
  }

  async function gerarCobranca(aluno: AlunoRecebivel) {
    setChargingId(aluno.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{
        message: string;
        invoiceUrl: string | null;
        charge: LatestCharge;
      }>(`/owner/alunos/${aluno.id}/cobrancas`, { method: "POST" });

      setAlunos((current) =>
        current.map((item) =>
          item.id === aluno.id
            ? {
                ...item,
                latestCharge: {
                  id: result.charge.id,
                  status: result.charge.status,
                  dueDate: result.charge.dueDate,
                  amountBrl: result.charge.amountBrl,
                  asaasPaymentId: result.charge.asaasPaymentId,
                  paidAt: null,
                },
              }
            : item,
        ),
      );
      setSuccess(
        result.invoiceUrl
          ? `${result.message} Link: ${result.invoiceUrl}`
          : result.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar cobrança.");
    } finally {
      setChargingId(null);
    }
  }

  async function gerarLote() {
    const studentIds = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (!studentIds.length) {
      setError("Selecione ao menos um aluno.");
      return;
    }
    setBatchLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/cobrancas/lote", {
        method: "POST",
        body: JSON.stringify({ studentIds }),
      });
      setSuccess(result.message);
      setSelected({});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no lote de cobranças.");
    } finally {
      setBatchLoading(false);
    }
  }

  const totalPrevisto = alunos.reduce(
    (sum, aluno) => sum + (priceMap[aluno.planoModalidade] ?? 0),
    0,
  );
  const vencidos = alunos.filter(
    (a) => getEffectiveDueStatus(a) === "vencido",
  ).length;
  const venceHoje = alunos.filter((a) => getEffectiveDueStatus(a) === "hoje").length;
  const asaasPendentes = alunos.filter(
    (a) => a.latestCharge?.status === "PENDING" || a.latestCharge?.status === "OVERDUE",
  ).length;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <OwnerSectionPage
      title="Contas a Receber"
      description="Mensalidades Asaas dos alunos. Gere cobrança individual ou em lote."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando contas...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 break-all">
          {success}
        </div>
      ) : null}

      {!loading && !error && alunos.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/60">
            Nenhum aluno cadastrado ainda. As cobranças aparecem após o cadastro.
          </p>
          <Link
            to="/dono/cadastro-aluno"
            className="mt-4 inline-block text-sm font-medium text-[#4a9fd8] hover:underline"
          >
            Cadastrar aluno →
          </Link>
        </div>
      ) : null}

      {!loading && !error && alunos.length > 0 ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-xs text-white/45">
              {selectedCount > 0
                ? `${selectedCount} aluno(s) selecionado(s)`
                : "Selecione alunos para cobrança em lote"}
            </p>
            <button
              type="button"
              disabled={batchLoading || selectedCount === 0}
              onClick={() => void gerarLote()}
              className="rounded-lg bg-[#4a9fd8] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {batchLoading ? "Gerando lote..." : "Gerar cobranças (lote)"}
            </button>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Alunos ativos" value={String(alunos.length)} />
            <SummaryCard
              label="Receita prevista (mês)"
              value={formatPlanCurrency(totalPrevisto)}
            />
            <SummaryCard label="Vencidos no mês" value={String(vencidos)} />
            <SummaryCard label="Asaas pendentes" value={String(asaasPendentes || venceHoje)} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[0.7rem] uppercase tracking-wide text-white/45">
                  <th className="px-3 py-3 font-medium">
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <th className="px-4 py-3 font-medium">Aluno</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Asaas</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => {
                  const valor =
                    aluno.latestCharge?.amountBrl ?? priceMap[aluno.planoModalidade];
                  const status = getEffectiveDueStatus(aluno);
                  const proximoVenc = getNextDueDate(aluno.diaVencimento);
                  const hasOpenAsaas =
                    aluno.latestCharge?.status === "PENDING" ||
                    aluno.latestCharge?.status === "OVERDUE";

                  return (
                    <tr
                      key={aluno.id}
                      className="border-b border-white/5 text-white/85 last:border-0"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[aluno.id])}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [aluno.id]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#4a9fd8]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="m-0 font-medium text-white">{aluno.nomeCompleto}</p>
                        <p className="m-0 text-xs text-white/45">
                          {formatCpf(aluno.cpf)}
                          {aluno.telefone
                            ? ` · ${formatPhone(aluno.telefone)}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {aluno.planoModalidade}
                        <span className="block text-xs text-white/40">
                          Início {formatDate(aluno.dataInicio)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {valor != null ? formatPlanCurrency(valor) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-white/75">
                        Dia {parseDueDay(aluno.diaVencimento)}
                        <span className="block text-xs text-white/40">
                          Próx. {proximoVenc.toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/70">
                        {chargeLabel(aluno.latestCharge?.status)}
                        {aluno.latestCharge?.dueDate ? (
                          <span className="block text-white/40">
                            {aluno.latestCharge.dueDate.split("-").reverse().join("/")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} liberadoAte={aluno.acessoLiberadoAte} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            disabled={chargingId === aluno.id || hasOpenAsaas}
                            onClick={() => void gerarCobranca(aluno)}
                            className="rounded-lg border border-[#4a9fd8]/40 px-3 py-1.5 text-xs font-semibold text-[#9fd0f0] hover:bg-[#4a9fd8]/10 disabled:opacity-50"
                          >
                            {chargingId === aluno.id
                              ? "Gerando..."
                              : hasOpenAsaas
                                ? "Já pendente"
                                : "Gerar cobrança"}
                          </button>
                          {status === "vencido" ? (
                            <button
                              type="button"
                              disabled={releasingId === aluno.id}
                              onClick={() => liberarAluno(aluno)}
                              className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              {releasingId === aluno.id ? "Liberando..." : "Liberar aluno"}
                            </button>
                          ) : null}
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

function StatusBadge({
  status,
  liberadoAte,
}: {
  status: BillingDueStatus;
  liberadoAte: string | null;
}) {
  const styles =
    status === "em_dia"
      ? "bg-emerald-500/15 text-emerald-200"
      : status === "hoje"
        ? "bg-amber-500/15 text-amber-200"
        : "bg-red-500/15 text-red-200";
  const label =
    status === "em_dia" ? "Em dia" : status === "hoje" ? "Vence hoje" : "Vencido";

  return (
    <div>
      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${styles}`}>
        {label}
      </span>
      {liberadoAte ? (
        <p className="m-0 mt-1 text-[0.65rem] text-white/40">
          Liberado até {liberadoAte.split("-").reverse().join("/")}
        </p>
      ) : null}
    </div>
  );
}
