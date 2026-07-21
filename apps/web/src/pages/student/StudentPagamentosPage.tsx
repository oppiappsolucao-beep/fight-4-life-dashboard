import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { billingStatusLabel } from "../../lib/billing";
import { formatPlanCurrency } from "../../lib/plans";
import { getStudentSession } from "../../lib/studentSession";
import type { StudentBilling } from "../../types/student";
import StudentSectionPage from "./StudentSectionPage";

export default function StudentPagamentosPage() {
  const session = getStudentSession();
  const [billing, setBilling] = useState<StudentBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!session?.id) {
      setLoading(false);
      setError("Faça login novamente.");
      return;
    }

    setLoading(true);
    setError("");
    apiFetch<StudentBilling>("/student/pagamentos", {}, session.id)
      .then((data) => setBilling(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar pagamentos."),
      )
      .finally(() => setLoading(false));
  }, [session?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const statusClass =
    billing?.status === "vencido"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : billing?.status === "hoje"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
        : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";

  return (
    <StudentSectionPage
      title="Pagamentos"
      description="Consulte seu plano, vencimento e valor da mensalidade."
    >
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : billing ? (
        <div className="space-y-4 pb-8">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-5">
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              Plano contratado
            </p>
            <h2 className="m-0 mt-2 text-2xl font-semibold text-white">
              {billing.planoModalidade}
            </h2>
            <p className="m-0 mt-3 text-3xl font-semibold text-[#f08a98]">
              {formatPlanCurrency(billing.valorMensalidade)}
            </p>
            <p className="m-0 mt-1 text-sm text-white/50">Valor da mensalidade</p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <InfoCard label="Próximo vencimento" value={billing.proximoVencimentoLabel} />
            <InfoCard label="Dia fixo de vencimento" value={`Dia ${billing.diaVencimento}`} />
            <InfoCard label="Forma de pagamento" value={billing.formaPagamento || "Não informada"} />
            <InfoCard label="Início do plano" value={billing.dataInicio} />
          </section>

          <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClass}`}>
            Status: <strong>{billingStatusLabel(billing.status)}</strong>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="m-0 text-sm text-white/55">
              Histórico de pagamentos e comprovantes estarão disponíveis em breve nesta aba.
            </p>
          </section>
        </div>
      ) : null}
    </StudentSectionPage>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="m-0 mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
