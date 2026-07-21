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
import type { DevOverview } from "../../types/overview";
import DevSectionPage from "./DevSectionPage";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function DevVisaoGeralPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<DevOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<DevOverview>("/dev/overview")
      .then((data) => setOverview(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar visão geral."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = user?.name?.split(" ")[0] ?? overview?.user.name?.split(" ")[0] ?? "Dev";

  return (
    <DevSectionPage
      title="Visão Geral"
      description="Painel executivo da plataforma Oppi Tech com academias, receita e metas."
    >
      <OverviewState loading={loading} error={error} />
      {!loading && !error && overview ? (
        <div className="space-y-4 pb-8">
          <OverviewHero
            eyebrow="Painel Oppi Tech"
            title={`Olá, ${displayName}`}
            subtitle="Acompanhe academias, receita da plataforma e evolução operacional."
          />

          <OverviewMetricGrid
            items={[
              { label: "Academias", value: String(overview.metrics.totalAcademias) },
              {
                label: "Ativas",
                value: String(overview.metrics.academiasAtivas),
                hint: `${overview.metrics.academiasInativas} inativa(s)`,
              },
              {
                label: "Donos cadastrados",
                value: String(overview.metrics.donosCadastrados),
              },
              {
                label: "Receita da plataforma",
                value: formatPlanCurrency(overview.metrics.receitaPlataforma),
                hint: "Com base nos planos das academias ativas",
              },
            ]}
          />

          <OverviewGoalsGrid metas={overview.metas} />

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold text-white">Últimas academias</p>
              <Link
                to="/dev/cadastro-academias"
                className="text-xs font-semibold text-[#f08a98] hover:text-[#e85d6f]"
              >
                Ver todas
              </Link>
            </div>
            {overview.recentAcademias.length === 0 ? (
              <p className="m-0 text-sm text-white/45">Nenhuma academia cadastrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {overview.recentAcademias.map((academia) => (
                  <div
                    key={academia.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 text-sm font-medium text-white">{academia.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                          academia.active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/10 text-white/45"
                        }`}
                      >
                        {academia.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="m-0 mt-1 text-xs text-white/45">
                      {academia.billing.plano || "Sem plano"} • {formatDate(academia.createdAt)}
                    </p>
                    {academia.ownerEmail ? (
                      <p className="m-0 mt-1 truncate text-xs text-white/35">
                        {academia.ownerEmail}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <OverviewQuickLinks
            links={[
              { to: "/dev/cadastro-academias", label: "Cadastrar academia" },
              { to: "/dev/donos-academias", label: "Donos de academias" },
              { to: "/dev/contas-a-receber", label: "Contas a receber" },
            ]}
          />
        </div>
      ) : null}
    </DevSectionPage>
  );
}
