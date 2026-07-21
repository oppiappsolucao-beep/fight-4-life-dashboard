import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  OverviewGoalsGrid,
  OverviewHero,
  OverviewMetricGrid,
  OverviewQuickLinks,
  OverviewState,
} from "../../components/dashboard/OverviewCards";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import { formatPlanCurrency } from "../../lib/plans";
import { formatWorkoutDateLabel } from "../../lib/workout";
import type { OwnerOverview } from "../../types/overview";
import OwnerSectionPage from "./OwnerSectionPage";

export default function OwnerVisaoGeralPage() {
  const { user, tenant } = useAuth();
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<OwnerOverview>("/owner/overview")
      .then((data) => setOverview(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar visão geral."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = user?.name?.split(" ")[0] ?? "Dono";
  const academyName = overview?.tenant.name ?? tenant?.name ?? "Sua academia";

  return (
    <OwnerSectionPage
      title="Visão Geral"
      description="Painel executivo da academia com indicadores, metas e atalhos rápidos."
    >
      <OverviewState loading={loading} error={error} />
      {!loading && !error && overview ? (
        <div className="space-y-4 pb-8">
          <OverviewHero
            eyebrow="Painel da academia"
            title={`Olá, ${displayName}`}
            subtitle={`${academyName} • semana ${formatWorkoutDateLabel(overview.semana.start)} a ${formatWorkoutDateLabel(overview.semana.end)}`}
          />

          <OverviewMetricGrid
            items={[
              { label: "Alunos ativos", value: String(overview.metrics.totalAlunos) },
              {
                label: "Treinos publicados",
                value: String(overview.metrics.treinosPublicados),
                hint: `${overview.metrics.treinosSemana} nesta semana`,
              },
              {
                label: "Receita prevista",
                value: formatPlanCurrency(overview.metrics.receitaPrevista),
                hint: "Mensalidades dos alunos ativos",
              },
              {
                label: "Vencidos",
                value: String(overview.metrics.vencidos),
                hint:
                  overview.metrics.venceHoje > 0
                    ? `${overview.metrics.venceHoje} vence(m) hoje`
                    : "Cobranças em atraso",
              },
            ]}
          />

          <OverviewGoalsGrid metas={overview.metas} />

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold text-white">Últimos alunos cadastrados</p>
              <Link
                to="/dono/alunos"
                className="text-xs font-semibold text-[#f08a98] hover:text-[#e85d6f]"
              >
                Ver todos
              </Link>
            </div>
            {overview.recentAlunos.length === 0 ? (
              <p className="m-0 text-sm text-white/45">Nenhum aluno cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {overview.recentAlunos.map((aluno) => (
                  <div
                    key={aluno.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-medium text-white">
                        {aluno.nomeCompleto}
                      </p>
                      <p className="m-0 truncate text-xs text-white/45">
                        {aluno.planoModalidade}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <OverviewQuickLinks
            links={[
              { to: "/dono/cadastro-aluno", label: "Cadastrar aluno" },
              { to: "/dono/cadastro-treino", label: "Montar treino" },
              { to: "/dono/contas-a-receber", label: "Contas a receber" },
              { to: "/dono/planos", label: "Planos" },
              { to: "/dono/alunos", label: "Lista de alunos" },
            ]}
          />
        </div>
      ) : null}
    </OwnerSectionPage>
  );
}
