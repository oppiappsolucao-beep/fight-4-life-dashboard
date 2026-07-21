import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import {
  WORKOUT_PHASES,
  bodyRegionLabel,
  countPhaseExercises,
  formatWorkoutDateLabel,
  groupExercisesByPhase,
  groupMeioExercisesByRegion,
  type WorkoutPhase,
} from "../../lib/workout";
import type { StudentWorkout, WorkoutExerciseItem, WorkoutSummary } from "../../types/workout";
import StudentSectionPage from "./StudentSectionPage";

function exerciseKey(item: WorkoutExerciseItem): string {
  return item.id ?? `${item.phase}-${item.order}-${item.exercise.id}`;
}

export default function StudentTreinoPage() {
  const session = getStudentSession();
  const [treinos, setTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [treino, setTreino] = useState<StudentWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTreino, setLoadingTreino] = useState(false);
  const [error, setError] = useState("");
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  const groupedExercises = useMemo(
    () => (treino ? groupExercisesByPhase(treino.exercises) : null),
    [treino],
  );

  const phaseCounts = useMemo(
    () => (groupedExercises ? countPhaseExercises(groupedExercises) : null),
    [groupedExercises],
  );

  const phaseProgress = useMemo(() => {
    if (!treino || !groupedExercises) return null;

    const progress: Record<WorkoutPhase, { done: number; total: number }> = {
      INICIO: { done: 0, total: 0 },
      MEIO: { done: 0, total: 0 },
      FIM: { done: 0, total: 0 },
    };

    for (const phase of WORKOUT_PHASES) {
      const items = groupedExercises[phase.id];
      progress[phase.id] = {
        total: items.length,
        done: items.filter((item) => doneMap[exerciseKey(item)]).length,
      };
    }

    return progress;
  }, [treino, groupedExercises, doneMap]);

  const completedCount = treino
    ? treino.exercises.filter((item) => doneMap[exerciseKey(item)]).length
    : 0;

  const loadDates = useCallback(() => {
    if (!session?.id) {
      setLoading(false);
      setError("Faça login novamente para ver seu treino.");
      return;
    }

    setLoading(true);
    setError("");
    apiFetch<{ treinos: WorkoutSummary[] }>("/student/treinos", {}, session.id)
      .then((data) => {
        setTreinos(data.treinos);
        setSelectedDate((current) => {
          if (current && data.treinos.some((item) => item.workoutDate === current)) {
            return current;
          }
          return data.treinos[0]?.workoutDate ?? "";
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar treinos."),
      )
      .finally(() => setLoading(false));
  }, [session?.id]);

  const loadTreino = useCallback(
    (date: string) => {
      if (!session?.id || !date) {
        setTreino(null);
        return;
      }

      setLoadingTreino(true);
      setError("");
      apiFetch<{ treino: StudentWorkout | null }>(
        `/student/treino?date=${encodeURIComponent(date)}`,
        {},
        session.id,
      )
        .then((data) => {
          setTreino(data.treino);
          setDoneMap({});
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Erro ao carregar treino."),
        )
        .finally(() => setLoadingTreino(false));
    },
    [session?.id],
  );

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  useEffect(() => {
    if (selectedDate) {
      loadTreino(selectedDate);
    } else {
      setTreino(null);
    }
  }, [selectedDate, loadTreino]);

  function toggleDone(key: string) {
    setDoneMap((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <StudentSectionPage
      title="Treino"
      description="Escolha a data e execute sua ficha em começo, meio (superior, inferior ou cardio) e fim."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando datas...
        </div>
      ) : error && treinos.length === 0 ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : treinos.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/50">
            Nenhum treino publicado ainda. Fale com a recepção ou seu professor.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm sm:p-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
              Data do treino
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60 sm:max-w-md"
            >
              {treinos.map((item) => (
                <option key={item.id} value={item.workoutDate} className="bg-zinc-900">
                  {formatWorkoutDateLabel(item.workoutDate)} — {item.title} ({item.exerciseCount}{" "}
                  exercícios)
                </option>
              ))}
            </select>
          </div>

          {loadingTreino ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-8 text-center text-sm text-white/50">
              Carregando treino...
            </div>
          ) : !treino ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-8 text-center text-sm text-white/50">
              Nenhum treino encontrado para esta data.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
                <p className="m-0 text-xs uppercase tracking-wide text-white/45">
                  {formatWorkoutDateLabel(treino.workoutDate)}
                </p>
                <h2 className="m-0 mt-1 text-lg font-semibold text-white">{treino.title}</h2>
                {treino.notes ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{treino.notes}</p>
                ) : null}
                <p className="mt-3 text-xs text-white/40">
                  {completedCount}/{treino.exercises.length} exercícios concluídos
                </p>
              </div>

              {phaseCounts ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {WORKOUT_PHASES.map((phase) => {
                    const total = phaseCounts[phase.id];
                    const done = phaseProgress?.[phase.id]?.done ?? 0;
                    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

                    return (
                      <div
                        key={phase.id}
                        className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                      >
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#e85d6f]">
                          {phase.label}
                        </p>
                        <p className="mt-1 text-sm text-white/55">{phase.description}</p>
                        <p className="mt-2 text-xs text-white/40">
                          {total} exercício{total === 1 ? "" : "s"} • {done}/{total} feitos
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
                          <div
                            className="h-full rounded-full bg-[#e85d6f] transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {WORKOUT_PHASES.map((phase) => {
                const items = groupedExercises?.[phase.id] ?? [];
                if (items.length === 0) return null;

                const meioGroups =
                  phase.id === "MEIO" ? groupMeioExercisesByRegion(items) : null;

                return (
                  <section
                    key={phase.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <h3 className="m-0 text-base font-semibold uppercase tracking-wide text-[#e85d6f]">
                          {phase.label}
                        </h3>
                        <p className="mt-1 text-sm text-white/45">{phase.description}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                        {items.length} exercício{items.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {phase.id === "MEIO" && meioGroups && meioGroups.length > 0 ? (
                      <div className="space-y-6">
                        {meioGroups.map((group) => (
                          <div key={group.region}>
                            <div className="mb-3 flex items-center gap-2">
                              <span className="rounded-full bg-[#e85d6f]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#f08a98]">
                                {group.label}
                              </span>
                              <span className="text-xs text-white/35">
                                {group.items.length} exercício
                                {group.items.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="space-y-4">
                              {group.items.map((item) => (
                                <ExerciseCard
                                  key={exerciseKey(item)}
                                  item={item}
                                  index={item.order}
                                  mediaUrl={item.exercise.gifUrl ?? item.exercise.imageUrl}
                                  done={Boolean(doneMap[exerciseKey(item)])}
                                  onToggle={() => toggleDone(exerciseKey(item))}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {items.map((item) => (
                          <ExerciseCard
                            key={exerciseKey(item)}
                            item={item}
                            index={item.order}
                            mediaUrl={item.exercise.gifUrl ?? item.exercise.imageUrl}
                            done={Boolean(doneMap[exerciseKey(item)])}
                            onToggle={() => toggleDone(exerciseKey(item))}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </StudentSectionPage>
  );
}

function ExerciseCard({
  item,
  index,
  mediaUrl,
  done,
  onToggle,
}: {
  item: WorkoutExerciseItem;
  index: number;
  mediaUrl: string | null;
  done: boolean;
  onToggle: () => void;
}) {
  const regionBadge =
    item.phase === "MEIO" &&
    (item.exercise.bodyRegion === "SUPERIOR" ||
      item.exercise.bodyRegion === "INFERIOR" ||
      item.exercise.bodyRegion === "CARDIO")
      ? bodyRegionLabel(item.exercise.bodyRegion)
      : item.exercise.bodyRegion === "AQUECIMENTO" ||
          item.exercise.bodyRegion === "ALONGAMENTO"
        ? bodyRegionLabel(item.exercise.bodyRegion)
        : null;

  return (
    <article
      className={`overflow-hidden rounded-xl border backdrop-blur-sm transition ${
        done ? "border-emerald-400/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        {mediaUrl ? (
          <img
            src={mediaUrl}
            alt={item.exercise.name}
            className="h-48 w-full object-cover md:h-full"
            loading="lazy"
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-black/20 text-sm text-white/35 md:h-full">
            Sem imagem
          </div>
        )}

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-white/45">
                  Exercício {index}
                </p>
                {regionBadge ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/55">
                    {regionBadge}
                  </span>
                ) : null}
              </div>
              <h4 className="m-0 mt-1 text-lg font-semibold text-white">{item.exercise.name}</h4>
              <p className="mt-1 text-sm text-white/45">
                {item.exercise.muscleGroup}
                {item.exercise.equipment ? ` • ${item.exercise.equipment}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                done
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-[#e85d6f]/20 text-[#f08a98] hover:bg-[#e85d6f]/30"
              }`}
            >
              {done ? "Feito" : "Marcar feito"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Séries" value={String(item.sets)} />
            <Metric label="Repetições" value={item.reps} />
            <Metric label="Carga" value={item.load || "—"} />
            <Metric label="Descanso" value={item.restSeconds ? `${item.restSeconds}s` : "—"} />
          </div>

          {item.notes ? (
            <p className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
              {item.notes}
            </p>
          ) : null}

          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/45">
              Como executar
            </p>
            <p className="m-0 text-sm leading-relaxed text-white/75">
              {item.exercise.instructions}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="m-0 text-[0.65rem] uppercase tracking-wide text-white/40">{label}</p>
      <p className="m-0 mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
