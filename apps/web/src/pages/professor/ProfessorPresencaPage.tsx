import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatTimeRange } from "../../lib/schedule";
import { formatWorkoutDateLabel, todayDateInputValue } from "../../lib/workout";
import WorkoutDateStrip from "../../components/student/WorkoutDateStrip";
import type { LessonAttendanceItem, ProfessorLessonItem } from "../../types/modality";
import type { WorkoutSummary } from "../../types/workout";

export default function ProfessorPresencaPage() {
  const [aulas, setAulas] = useState<ProfessorLessonItem[]>([]);
  const [pendingPresencas, setPendingPresencas] = useState<LessonAttendanceItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayDateInputValue());
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      apiFetch<{ aulas: ProfessorLessonItem[] }>("/professor/aulas"),
      apiFetch<{ presencas: LessonAttendanceItem[] }>("/professor/presencas/pendentes"),
    ])
      .then(([aulasResult, presencasResult]) => {
        if (aulasResult.status === "fulfilled") {
          setAulas(aulasResult.value.aulas);
        } else {
          setAulas([]);
        }
        if (presencasResult.status === "fulfilled") {
          setPendingPresencas(presencasResult.value.presencas);
        } else {
          setPendingPresencas([]);
        }
        const failures: string[] = [];
        if (aulasResult.status === "rejected") {
          failures.push(
            aulasResult.reason instanceof Error
              ? aulasResult.reason.message
              : "Erro ao carregar aulas.",
          );
        }
        if (presencasResult.status === "rejected") {
          failures.push(
            presencasResult.reason instanceof Error
              ? presencasResult.reason.message
              : "Erro ao carregar confirmações.",
          );
        }
        if (failures.length > 0) setError(failures.join(" "));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dateSummaries = useMemo(() => {
    const dates = new Set<string>();
    for (const aula of aulas) dates.add(aula.classDate);
    for (const presenca of pendingPresencas) {
      if (presenca.lesson?.classDate) dates.add(presenca.lesson.classDate);
    }
    if (selectedDate) dates.add(selectedDate);

    return Array.from(dates)
      .sort((a, b) => b.localeCompare(a))
      .map(
        (workoutDate): WorkoutSummary => ({
          id: workoutDate,
          title: "Aula",
          workoutDate,
          updatedAt: "",
          source: "OWNER",
          exerciseCount: aulas.filter((item) => item.classDate === workoutDate).length,
        }),
      );
  }, [aulas, pendingPresencas, selectedDate]);

  const aulasDoDia = useMemo(
    () => aulas.filter((item) => item.classDate === selectedDate),
    [aulas, selectedDate],
  );

  const presencasDoDia = useMemo(() => {
    return pendingPresencas.filter((item) => {
      const lessonDate = item.lesson?.classDate;
      if (lessonDate !== selectedDate) return false;
      if (selectedLessonId && item.lessonId !== selectedLessonId) return false;
      return true;
    });
  }, [pendingPresencas, selectedDate, selectedLessonId]);

  useEffect(() => {
    if (aulasDoDia.some((item) => item.id === selectedLessonId)) return;
    setSelectedLessonId(aulasDoDia[0]?.id ?? "");
  }, [aulasDoDia, selectedLessonId]);

  async function handlePresencaAction(attendanceId: string, action: "validate" | "reject") {
    setValidatingId(attendanceId);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>(`/professor/presencas/${attendanceId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setSuccess(result.message);
      setPendingPresencas((current) => current.filter((item) => item.id !== attendanceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao validar presença.");
    } finally {
      setValidatingId(null);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <header className="mb-6">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
          Professor
        </p>
        <h1 className="m-0 text-2xl font-semibold text-white">Presença</h1>
        <p className="mt-2 text-sm text-white/60">
          Selecione a data, escolha a aula e valide os alunos que confirmaram frequência.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando presenças...
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          <WorkoutDateStrip
            treinos={dateSummaries}
            selectedDate={selectedDate}
            completionByDate={{}}
            onSelect={setSelectedDate}
            onCreateDate={setSelectedDate}
          />

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold text-white">
                  Aulas — {formatWorkoutDateLabel(selectedDate)}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {aulasDoDia.length} aula{aulasDoDia.length === 1 ? "" : "s"} nesta data
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-[#e85d6f]/40 hover:text-white"
              >
                Atualizar
              </button>
            </div>

            {aulasDoDia.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                Nenhuma aula publicada para esta data.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLessonId("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    !selectedLessonId
                      ? "bg-[#e85d6f] text-white"
                      : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                  }`}
                >
                  Todas
                </button>
                {aulasDoDia.map((aula) => (
                  <button
                    key={aula.id}
                    type="button"
                    onClick={() => setSelectedLessonId(aula.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedLessonId === aula.id
                        ? "bg-[#e85d6f] text-white"
                        : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                    }`}
                  >
                    {aula.title}
                    {aula.startTime && aula.endTime
                      ? ` • ${formatTimeRange({ weekday: 0, startTime: aula.startTime, endTime: aula.endTime })}`
                      : ""}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="m-0 text-base font-semibold text-white">Alunos que confirmaram</h2>
              <p className="mt-1 text-sm text-white/45">
                {presencasDoDia.length} confirmação(ões) aguardando validação
              </p>
            </div>

            {presencasDoDia.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                Nenhum aluno aguardando validação nesta data
                {selectedLessonId ? " para a aula selecionada" : ""}.
              </div>
            ) : (
              <div className="space-y-3">
                {presencasDoDia.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-4"
                  >
                    <div>
                      <p className="m-0 font-semibold text-white">
                        {item.student?.nomeCompleto ?? "Aluno"}
                      </p>
                      <p className="m-0 mt-1 text-sm text-white/50">
                        {item.lesson?.title ?? "Aula"}
                        {item.lesson?.modality?.name ? ` • ${item.lesson.modality.name}` : ""}
                      </p>
                      {item.studentConfirmedAt ? (
                        <p className="m-0 mt-1 text-xs text-white/40">
                          Confirmou em{" "}
                          {new Date(item.studentConfirmedAt).toLocaleString("pt-BR")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={validatingId === item.id}
                        onClick={() => handlePresencaAction(item.id, "validate")}
                        className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/30 disabled:opacity-60"
                      >
                        {validatingId === item.id ? "..." : "Validar presença"}
                      </button>
                      <button
                        type="button"
                        disabled={validatingId === item.id}
                        onClick={() => handlePresencaAction(item.id, "reject")}
                        className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-60"
                      >
                        Não compareceu
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
