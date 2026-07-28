import { useCallback, useEffect, useState } from "react";
import {
  OverviewHero,
  OverviewMetricGrid,
  OverviewState,
} from "../../components/dashboard/OverviewCards";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import { contentTypeLabel } from "../../types/modality";
import { formatWorkoutDateLabel } from "../../lib/workout";
import type { ProfessorOverview } from "../../types/overview";

export default function ProfessorVisaoGeralPage() {
  const { user, tenant } = useAuth();
  const [overview, setOverview] = useState<ProfessorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<ProfessorOverview>("/professor/visao-geral")
      .then((data) => setOverview(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar visão geral."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = user?.name?.split(" ")[0] ?? "Professor";
  const academyName = overview?.tenant.name ?? tenant?.name ?? "Sua academia";

  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <header className="mb-6">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#4a9fd8]">
          Professor
        </p>
        <h1 className="m-0 text-2xl font-semibold text-white">Visão Geral</h1>
        <p className="mt-2 text-sm text-white/60">
          Indicadores executivos das suas modalidades, alunos e aulas do mês.
        </p>
      </header>

      <OverviewState loading={loading} error={error} />
      {!loading && !error && overview ? (
        <div className="space-y-4 pb-8">
          <OverviewHero
            eyebrow="Painel do professor"
            title={`Olá, ${displayName}`}
            subtitle={`${academyName} • ${formatWorkoutDateLabel(overview.mes.start)} a ${formatWorkoutDateLabel(overview.mes.end)}`}
          />

          <OverviewMetricGrid
            items={[
              { label: "Alunos nas suas modalidades", value: String(overview.metrics.totalAlunos) },
              {
                label: "Modalidades ativas",
                value: String(overview.metrics.modalidadesAtivas),
              },
              {
                label: "Aulas do mês",
                value: String(overview.metrics.aulasMes),
                hint: "Publicadas por você",
              },
              {
                label: "Presenças pendentes",
                value: String(overview.metrics.presencasPendentes),
                hint: `${overview.metrics.presencasValidadasMes} confirmadas no mês`,
              },
            ]}
          />

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="m-0 text-sm font-semibold text-white">Por modalidade</p>
            <p className="m-0 mt-1 text-xs text-white/45">
              Alunos elegíveis e aulas publicadas no mês atual
            </p>
            {overview.modalidades.length === 0 ? (
              <p className="m-0 mt-4 text-sm text-white/45">Nenhuma modalidade liberada.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {overview.modalidades.map((modality) => (
                  <div
                    key={modality.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <p className="m-0 font-semibold text-white">{modality.name}</p>
                    <p className="m-0 mt-1 text-xs text-white/45">
                      {contentTypeLabel(modality.contentType)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
                          Alunos
                        </p>
                        <p className="m-0 mt-1 text-xl font-semibold text-white">{modality.alunos}</p>
                      </div>
                      <div>
                        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
                          Aulas/mês
                        </p>
                        <p className="m-0 mt-1 text-xl font-semibold text-white">
                          {modality.aulasMes}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
