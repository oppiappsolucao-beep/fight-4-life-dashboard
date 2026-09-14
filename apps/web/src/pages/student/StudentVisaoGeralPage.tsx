import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import {
  WORKOUT_PHASES,
  formatWorkoutDateLabel,
  formatWorkoutWeekdayShort,
  formatWorkoutDay,
  formatWorkoutMonthShort,
} from "../../lib/workout";
import type { StudentOverview } from "../../types/student";
import StudentSectionPage from "./StudentSectionPage";

export default function StudentVisaoGeralPage() {
  const session = getStudentSession();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
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
    apiFetch<StudentOverview>("/student/overview", {}, session.id)
      .then((data) => setOverview(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar visão geral."),
      )
      .finally(() => setLoading(false));
  }, [session?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const firstName =
    overview?.aluno.nomeCompleto.split(" ")[0] ?? session?.nomeCompleto.split(" ")[0];

  return (
    <StudentSectionPage
      title="Visão Geral"
      description="Acompanhe metas, treinos da semana e atalhos da sua jornada."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : overview ? (
        <div className="space-y-4 pb-8">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#5B7595]/20 via-black/30 to-black/40 p-5">
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Bem-vindo de volta
            </p>
            <h2 className="m-0 mt-1 text-2xl font-semibold text-[#2E496C]">{firstName}</h2>
            <p className="m-0 mt-2 text-sm text-slate-500">
              Plano: <strong>{overview.aluno.planoModalidade}</strong>
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {overview.metas.map((meta) => {
              const emBreve = meta.status === "em_breve";
              const lowerIsBetter = meta.direction === "down";
              const percent = (() => {
                if (emBreve || meta.meta <= 0) return 0;
                if (lowerIsBetter) {
                  if (meta.atual <= meta.meta) return 100;
                  return Math.max(0, Math.round((meta.meta / meta.atual) * 100));
                }
                return Math.min(100, Math.round((meta.atual / meta.meta) * 100));
              })();
              const onTrack = lowerIsBetter ? meta.atual <= meta.meta : meta.atual >= meta.meta;

              return (
                <div
                  key={meta.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="m-0 text-sm font-semibold text-[#2E496C]">{meta.label}</p>
                    {emBreve ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500">
                        Em breve
                      </span>
                    ) : onTrack ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-700">
                        No alvo
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 mt-2 text-2xl font-semibold text-[#2E496C]">
                    {meta.atual}
                    <span className="text-base font-medium text-slate-400">
                      {" "}
                      / {meta.meta} {meta.unidade}
                    </span>
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        emBreve ? "bg-white/20" : onTrack ? "bg-emerald-400" : "bg-[#5B7595]"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Treinos da semana
                </p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                  {formatWorkoutDateLabel(overview.semana.start)} a{" "}
                  {formatWorkoutDateLabel(overview.semana.end)}
                </p>
              </div>
              <Link
                to="/treino"
                className="rounded-full bg-[#5B7595]/20 px-3 py-1.5 text-xs font-semibold text-[#A9BBD5]"
              >
                Ver treinos
              </Link>
            </div>

            {overview.treinosSemana.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                Nenhum treino publicado para esta semana.
              </p>
            ) : (
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {overview.treinosSemana.map((item) => (
                  <Link
                    key={item.id}
                    to={`/treino?date=${item.workoutDate}`}
                    className="min-w-[5.5rem] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-[#5B7595]/40"
                  >
                    <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                      {formatWorkoutWeekdayShort(item.workoutDate)}
                    </p>
                    <p className="m-0 mt-1 text-2xl font-semibold leading-none text-[#2E496C]">
                      {formatWorkoutDay(item.workoutDate)}
                    </p>
                    <p className="m-0 mt-1 text-xs text-slate-500">
                      {formatWorkoutMonthShort(item.workoutDate)}
                    </p>
                    <p className="m-0 mt-2 truncate text-[0.65rem] text-[#2E496C]/40">
                      {item.exerciseCount} ex.
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {overview.proximoTreino ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Próximo treino
              </p>
              <h3 className="m-0 mt-2 text-lg font-semibold text-[#2E496C]">
                {overview.proximoTreino.title}
              </h3>
              <p className="m-0 mt-1 text-sm text-slate-500">
                {formatWorkoutDateLabel(overview.proximoTreino.workoutDate)} •{" "}
                {overview.proximoTreino.exerciseCount} exercícios
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {WORKOUT_PHASES.map((phase) => (
                  <span
                    key={phase.id}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[0.65rem] text-slate-500"
                  >
                    {phase.label}
                  </span>
                ))}
              </div>
              <Link
                to={`/treino?date=${overview.proximoTreino.workoutDate}`}
                className="mt-4 inline-flex rounded-xl bg-[#5B7595] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Abrir treino
              </Link>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <QuickLink to="/treino" label="Treino" />
            <QuickLink to="/galeria" label="Galeria" />
            <QuickLink to="/pagamentos" label="Pagamentos" />
            <QuickLink to="/termo-saude" label="Termo de Saúde" />
          </section>
        </div>
      ) : null}
    </StudentSectionPage>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-700 transition hover:border-[#5B7595]/40 hover:text-[#2E496C]"
    >
      {label}
    </Link>
  );
}
