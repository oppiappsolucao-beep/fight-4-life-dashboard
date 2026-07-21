import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import WorkoutDateStrip, {
  readStoredCompletionStatus,
} from "../../components/student/WorkoutDateStrip";
import WorkoutExerciseCard from "../../components/student/WorkoutExerciseCard";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import {
  WORKOUT_PHASES,
  countPhaseExercises,
  formatWorkoutDateLabel,
  getWorkoutCompletionStatus,
  groupExercisesByPhase,
  groupMeioExercisesByRegion,
  pickDefaultWorkoutDate,
  sortWorkoutsAscending,
  workoutDoneStorageKey,
  type WorkoutCompletionStatus,
  type WorkoutPhase,
} from "../../lib/workout";
import type { StudentWorkout, WorkoutExerciseItem, WorkoutSummary } from "../../types/workout";
import StudentSectionPage from "./StudentSectionPage";

function exerciseKey(item: WorkoutExerciseItem): string {
  return item.id ?? `${item.phase}-${item.order}-${item.exercise.id}`;
}

function loadDoneMap(studentId: string, workoutDate: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(workoutDoneStorageKey(studentId, workoutDate));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveDoneMap(
  studentId: string,
  workoutDate: string,
  doneMap: Record<string, boolean>,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    workoutDoneStorageKey(studentId, workoutDate),
    JSON.stringify(doneMap),
  );
}

export default function StudentTreinoPage() {
  const session = getStudentSession();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("date") ?? "";
  const [treinos, setTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [activePhase, setActivePhase] = useState<WorkoutPhase>("INICIO");
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
    if (!groupedExercises) return null;

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
  }, [groupedExercises, doneMap]);

  const completedCount = treino
    ? treino.exercises.filter((item) => doneMap[exerciseKey(item)]).length
    : 0;

  const completionPercent = treino
    ? Math.round((completedCount / treino.exercises.length) * 100)
    : 0;

  const completionStatus = getWorkoutCompletionStatus(
    treino?.exercises.length ?? 0,
    completedCount,
  );

  const completionByDate = useMemo(() => {
    if (!session?.id) return {} as Record<string, WorkoutCompletionStatus>;

    return Object.fromEntries(
      treinos.map((item) => {
        if (item.workoutDate === selectedDate && treino) {
          return [
            item.workoutDate,
            getWorkoutCompletionStatus(treino.exercises.length, completedCount),
          ];
        }

        return [
          item.workoutDate,
          readStoredCompletionStatus(session.id, item.workoutDate, item.exerciseCount),
        ];
      }),
    );
  }, [session?.id, treinos, selectedDate, treino, completedCount]);

  const activePhaseItems = groupedExercises?.[activePhase] ?? [];
  const activeMeioGroups =
    activePhase === "MEIO" ? groupMeioExercisesByRegion(activePhaseItems) : null;

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
        const sorted = sortWorkoutsAscending(data.treinos);
        setTreinos(sorted);
        setSelectedDate((current) => {
          if (requestedDate && sorted.some((item) => item.workoutDate === requestedDate)) {
            return requestedDate;
          }
          if (current && sorted.some((item) => item.workoutDate === current)) {
            return current;
          }
          return pickDefaultWorkoutDate(sorted);
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar treinos."),
      )
      .finally(() => setLoading(false));
  }, [session?.id, requestedDate]);

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
          setDoneMap(loadDoneMap(session.id, date));
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

  useEffect(() => {
    if (!requestedDate || treinos.length === 0) return;
    if (treinos.some((item) => item.workoutDate === requestedDate)) {
      setSelectedDate(requestedDate);
    }
  }, [requestedDate, treinos]);

  useEffect(() => {
    if (!groupedExercises) return;

    const firstPhaseWithItems = WORKOUT_PHASES.find(
      (phase) => groupedExercises[phase.id].length > 0,
    );
    if (firstPhaseWithItems) {
      setActivePhase(firstPhaseWithItems.id);
    }
  }, [selectedDate, groupedExercises]);

  useEffect(() => {
    if (!session?.id || !selectedDate) return;
    saveDoneMap(session.id, selectedDate, doneMap);
  }, [session?.id, selectedDate, doneMap]);

  function toggleDone(key: string) {
    setDoneMap((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <StudentSectionPage
      title="Treino"
      description="Selecione a data e execute sua ficha por etapas."
    >
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando treinos...
        </div>
      ) : error && treinos.length === 0 ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : treinos.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/50">
            Nenhum treino publicado ainda. Fale com a recepção ou seu professor.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-8 sm:space-y-5">
          <WorkoutDateStrip
            treinos={treinos}
            selectedDate={selectedDate}
            completionByDate={completionByDate}
            onSelect={setSelectedDate}
          />

          {loadingTreino ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
              Carregando ficha...
            </div>
          ) : !treino ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
              Nenhum treino encontrado para esta data.
            </div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <ProgressRing percent={completionPercent} status={completionStatus} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                      {formatWorkoutDateLabel(treino.workoutDate)}
                    </p>
                    <h2 className="m-0 mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                      {treino.title}
                    </h2>
                    <p className="m-0 mt-2 text-sm text-white/60">
                      {completedCount}/{treino.exercises.length} exercícios •{" "}
                      {completionStatus === "done"
                        ? "Treino concluído"
                        : completionStatus === "partial"
                          ? "Em andamento"
                          : "Pronto para começar"}
                    </p>
                    {treino.notes ? (
                      <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-relaxed text-white/70">
                        {treino.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="sticky top-14 z-20 -mx-1 rounded-2xl border border-white/10 bg-black/80 p-2 backdrop-blur-md md:top-0">
                <div className="grid grid-cols-3 gap-2">
                  {WORKOUT_PHASES.map((phase) => {
                    const total = phaseCounts?.[phase.id] ?? 0;
                    const done = phaseProgress?.[phase.id]?.done ?? 0;
                    const selected = activePhase === phase.id;
                    const disabled = total === 0;

                    return (
                      <button
                        key={phase.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setActivePhase(phase.id)}
                        className={`rounded-xl px-2 py-3 text-left transition ${
                          selected
                            ? "bg-[#e85d6f] text-white shadow-[0_8px_24px_rgba(232,93,111,0.25)]"
                            : disabled
                              ? "cursor-not-allowed bg-white/[0.02] text-white/25"
                              : "bg-white/[0.04] text-white/70 hover:bg-white/[0.07]"
                        }`}
                      >
                        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide">
                          {phase.label}
                        </p>
                        <p className="m-0 mt-1 text-xs opacity-80">
                          {total > 0 ? `${done}/${total}` : "—"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <h3 className="m-0 text-lg font-semibold text-white">
                      {WORKOUT_PHASES.find((phase) => phase.id === activePhase)?.label}
                    </h3>
                    <p className="m-0 mt-1 text-sm text-white/45">
                      {
                        WORKOUT_PHASES.find((phase) => phase.id === activePhase)
                          ?.description
                      }
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                    {activePhaseItems.length} exercício
                    {activePhaseItems.length === 1 ? "" : "s"}
                  </span>
                </div>

                {activePhaseItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                    Nenhum exercício nesta etapa.
                  </div>
                ) : activePhase === "MEIO" && activeMeioGroups && activeMeioGroups.length > 0 ? (
                  <div className="space-y-5">
                    {activeMeioGroups.map((group) => (
                      <div key={group.region} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <span className="rounded-full bg-[#e85d6f]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#f08a98]">
                            {group.label}
                          </span>
                          <span className="text-xs text-white/35">
                            {group.items.length} exercício
                            {group.items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {group.items.map((item) => (
                          <WorkoutExerciseCard
                            key={exerciseKey(item)}
                            item={item}
                            index={item.order}
                            mediaUrl={item.exercise.gifUrl ?? item.exercise.imageUrl}
                            done={Boolean(doneMap[exerciseKey(item)])}
                            onToggle={() => toggleDone(exerciseKey(item))}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  activePhaseItems.map((item) => (
                    <WorkoutExerciseCard
                      key={exerciseKey(item)}
                      item={item}
                      index={item.order}
                      mediaUrl={item.exercise.gifUrl ?? item.exercise.imageUrl}
                      done={Boolean(doneMap[exerciseKey(item)])}
                      onToggle={() => toggleDone(exerciseKey(item))}
                    />
                  ))
                )}
              </section>
            </>
          )}
        </div>
      )}
    </StudentSectionPage>
  );
}

function ProgressRing({
  percent,
  status,
}: {
  percent: number;
  status: WorkoutCompletionStatus;
}) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const stroke =
    status === "done" ? "#34d399" : status === "partial" ? "#fbbf24" : "#e85d6f";

  return (
    <div className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-white">{percent}%</span>
      </div>
    </div>
  );
}
