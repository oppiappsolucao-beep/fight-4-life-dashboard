import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatWorkoutDateLabel } from "../../lib/workout";
import { getStudentSession } from "../../lib/studentSession";
import type { ProfessorLessonItem, StudentFrequencyResponse } from "../../types/modality";
import StudentSectionPage from "./StudentSectionPage";

export default function StudentFrequenciaPage() {
  const session = getStudentSession();
  const [data, setData] = useState<StudentFrequencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    if (!session?.id) {
      setLoading(false);
      setError("Faça login novamente.");
      return;
    }

    setLoading(true);
    setError("");
    apiFetch<StudentFrequencyResponse>("/student/frequencia", {}, session.id)
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar frequência."),
      )
      .finally(() => setLoading(false));
  }, [session?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function markPresence(aula: ProfessorLessonItem) {
    if (!session?.id) return;
    setMarkingId(aula.id);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>(
        `/student/aulas/${aula.id}/presenca`,
        { method: "POST" },
        session.id,
      );
      setSuccess(result.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao marcar presença.");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <StudentSectionPage
      title="Frequência"
      description="Marque sua presença nas aulas da sua modalidade e acompanhe o histórico."
    >
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando...
        </div>
      ) : error && !data ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-4 pb-8">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="m-0 text-sm text-white/55">Plano: {data.planoModalidade}</p>
            <p className="m-0 mt-2 text-2xl font-semibold text-white">
              {data.totalPresencas} presença(s) registrada(s)
            </p>
          </section>

          {success ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <section className="space-y-3">
            <p className="m-0 text-sm font-semibold text-white">Marcar presença</p>
            {data.aulasDisponiveis.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                Nenhuma aula disponível para sua modalidade.
              </div>
            ) : (
              data.aulasDisponiveis.map((aula) => (
                <article
                  key={aula.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <div>
                    <p className="m-0 font-semibold text-white">{aula.title}</p>
                    <p className="m-0 mt-1 text-sm text-white/50">
                      {formatWorkoutDateLabel(aula.classDate)} • {aula.modality?.name}
                    </p>
                  </div>
                  {aula.presencaMarcada ? (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      Presente
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={markingId === aula.id}
                      onClick={() => markPresence(aula)}
                      className="rounded-xl bg-[#e85d6f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {markingId === aula.id ? "Salvando..." : "Marcar presença"}
                    </button>
                  )}
                </article>
              ))
            )}
          </section>

          {data.historico.length > 0 ? (
            <section className="space-y-2">
              <p className="m-0 text-sm font-semibold text-white">Histórico</p>
              {data.historico.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70"
                >
                  {item.aula.title} • {formatWorkoutDateLabel(item.aula.classDate)}
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </StudentSectionPage>
  );
}
