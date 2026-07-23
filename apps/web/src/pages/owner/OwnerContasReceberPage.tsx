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
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function parseDueDay(diaVencimento: string): number {
  const day = Number.parseInt(diaVencimento.replace(/\D/g, ""), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return 1;
  return day;
}

export default function OwnerContasReceberPage() {
  const [alunos, setAlunos] = useState<AlunoRecebivel[]>([]);
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [releasingId, setReleasingId] = useState<string | null>(null);

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

  const totalPrevisto = alunos.reduce(
    (sum, aluno) => sum + (priceMap[aluno.planoModalidade] ?? 0),
    0,
  );
  const vencidos = alunos.filter(
    (a) => getEffectiveDueStatus(a) === "vencido",
  ).length;
  const venceHoje = alunos.filter((a) => getEffectiveDueStatus(a) === "hoje").length;

  return (
    <OwnerSectionPage
      title="Contas a Receber"
      description="Mensalidades e cobranças dos alunos cadastrados na academia."
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
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
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
            className="mt-4 inline-block text-sm font-medium text-[#e85d6f] hover:underline"
          >
            Cadastrar aluno →
          </Link>
        </div>
      ) : null}

      {!loading && !error && alunos.length > 0 ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Alunos ativos" value={String(alunos.length)} />
            <SummaryCard
              label="Receita prevista (mês)"
              value={formatPlanCurrency(totalPrevisto)}
            />
            <SummaryCard label="Vencidos no mês" value={String(vencidos)} />
            <SummaryCard label="Vencem hoje" value={String(venceHoje)} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[0.7rem] uppercase tracking-wide text-white/45">
                  <th className="px-4 py-3 font-medium">Aluno</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Próximo venc.</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => {
                  const valor = priceMap[aluno.planoModalidade];
                  const status = getEffectiveDueStatus(aluno);
                  const proximoVenc = getNextDueDate(aluno.diaVencimento);

                  return (
                    <tr
                      key={aluno.id}
                      className="border-b border-white/5 text-white/85 last:border-0"
                    >
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
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-white/75">
                        {proximoVenc.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {aluno.formaPagamento || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} liberadoAte={aluno.acessoLiberadoAte} />
                      </td>
                      <td className="px-4 py-3">
                        {status === "vencido" ? (
                          <button
                            type="button"
                            disabled={releasingId === aluno.id}
                            onClick={() => liberarAluno(aluno)}
                            className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            {releasingId === aluno.id ? "Liberando..." : "Liberar aluno"}
                          </button>
                        ) : (
                          <span className="text-xs text-white/35">—</span>
                        )}
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
  const styles = {
    em_dia: "bg-emerald-500/15 text-emerald-300",
    vencido: "bg-red-500/15 text-red-300",
    hoje: "bg-amber-500/15 text-amber-300",
  } as const;

  const labels = {
    em_dia: liberadoAte ? "Liberado" : "Em dia",
    vencido: "Vencido",
    hoje: "Vence hoje",
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
