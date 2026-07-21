import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StudentTreinoBuilder from "../../components/student/StudentTreinoBuilder";
import WorkoutDateStrip from "../../components/student/WorkoutDateStrip";
import WorkoutExerciseCard from "../../components/student/WorkoutExerciseCard";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import {
  WORKOUT_PHASES,
  countPhaseExercises,
  countWorkoutSetProgress,
  formatWorkoutDateLabel,
  getWorkoutCompletionStatus,
  groupExercisesByPhase,
  groupMeioExercisesByRegion,
  pickDefaultWorkoutDate,
  sortWorkoutsAscending,
  toggleCompletedSet,
  todayDateInputValue,
  workoutSetProgressPercent,
  type WorkoutCompletionStatus,
  type WorkoutPhase,
} from "../../lib/workout";
import type { StudentWorkout, WorkoutExerciseItem, WorkoutSummary } from "../../types/workout";
import StudentSectionPage from "./StudentSectionPage";

type PageMode = "execute" | "build";

function buildSetsMap(treino: StudentWorkout | null): Record<string, number[]> {
  if (!treino) return {};
  return Object.fromEntries(
    treino.exercises
      .filter((item) => item.id)
      .map((item) => [item.id!, item.completedSets ?? []]),
  );
}

export default function StudentTreinoPage() {
  const session = getStudentSession();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("date") ?? "";
  const saveTimerRef = useRef<number | null>(null);

  const [treinos, setTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayDateInputValue());
  const [activePhase, setActivePhase] = useState<WorkoutPhase>("INICIO");
  const [mode, setMode] = useState<PageMode>("execute");
  const [treino, setTreino] = useState<StudentWorkout | null>(null);
  const [setsMap, setSetsMap] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingTreino, setLoadingTreino] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [error, setError] = useState("");

  const groupedExercises = useMemo(
    () => (treino ? groupExercisesByPhase(treino.exercises) : null),
    [treino],
  );

  const phaseCounts = useMemo(
    () => (groupedExercises ? countPhaseExercises(groupedExercises) : null),
    [groupedExercises],
  );

  const setProgress = useMemo(() => {
    if (!treino) return null;
    return countWorkoutSetProgress(
      treino.exercises.map((item) => ({
        sets: item.sets,
        completedSets: setsMap[item.id ?? ""] ?? item.completedSets ?? [],
      })),
    );
  }, [treino, setsMap]);

  const completionPercent = treino
    ? workoutSetProgressPercent(
        treino.exercises.map((item) => ({
          sets: item.sets,
          completedSets: setsMap[item.id ?? ""] ?? item.completedSets ?? [],
        })),
      )
    : 0;

  const completionStatus: WorkoutCompletionStatus = treino
    ? getWorkoutCompletionStatus(
        setProgress?.totalSets ?? 0,
        setProgress?.completedSets ?? 0,
      )
    : "pending";

  const completionByDate = useMemo(() => {
    return Object.fromEntries(
      treinos.map((item) => [
        item.workoutDate,
        item.completionStatus ?? "pending",
      ]),
    ) as Record<string, WorkoutCompletionStatus>;
  }, [treinos]);

  const activePhaseItems = groupedExercises?.[activePhase] ?? [];
  const activeMeioGroups =
    activePhase === "MEIO" ? groupMeioExercisesByRegion(activePhaseItems) : null;
  const canEditTreino = !treino || treino.source === "STUDENT";

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
          if (requestedDate) return requestedDate;
          if (current && sorted.some((item) => item.workoutDate === current)) return current;
          if (sorted.length > 0) return pickDefaultWorkoutDate(sorted);
          return todayDateInputValue();
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
        setSetsMap({});
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
          setSetsMap(buildSetsMap(data.treino));
          setMode(data.treino ? "execute" : "build");
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Erro ao carregar treino."),
        )
        .finally(() => setLoadingTreino(false));
    },
    [session?.id],
  );

  const persistProgress = useCallback(
    (nextMap: Record<string, number[]>, date: string) => {
      if (!session?.id || !treino) return;

      const items = treino.exercises
        .filter((item) => item.id)
        .map((item) => ({
          exerciseItemId: item.id!,
          completedSets: nextMap[item.id!] ?? [],
        }));

      if (items.length === 0) return;

      setSavingProgress(true);
      apiFetch<{ treino: StudentWorkout }>(
        "/student/treino/progress",
        {
          method: "PATCH",
          body: JSON.stringify({ workoutDate: date, items }),
        },
        session.id,
      )
        .then((data) => {
          setTreino(data.treino);
          setSetsMap(buildSetsMap(data.treino));
          setTreinos((current) => {
            const progress = countWorkoutSetProgress(data.treino.exercises);
            const status =
              progress.totalExercises === 0
                ? "pending"
                : progress.completedExercises === progress.totalExercises
                  ? "done"
                  : progress.completedSets > 0
                    ? "partial"
                    : "pending";

            const summary = {
              id: data.treino.id,
              title: data.treino.title,
              workoutDate: data.treino.workoutDate,
              updatedAt: data.treino.updatedAt,
              source: data.treino.source,
              exerciseCount: data.treino.exercises.length,
              progressPercent:
                progress.totalSets > 0
                  ? Math.round((progress.completedSets / progress.totalSets) * 100)
                  : 0,
              completionStatus: status as WorkoutCompletionStatus,
            };

            const exists = current.some((item) => item.workoutDate === data.treino.workoutDate);
            if (!exists) {
              return sortWorkoutsAscending([...current, summary]);
            }

            return sortWorkoutsAscending(
              current.map((item) =>
                item.workoutDate === data.treino.workoutDate ? summary : item,
              ),
            );
          });
        })
        .catch(() => {
          setError("Não foi possível salvar o progresso das séries.");
        })
        .finally(() => setSavingProgress(false));
    },
    [session?.id, treino],
  );

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  useEffect(() => {
    if (selectedDate) {
      loadTreino(selectedDate);
    }
  }, [selectedDate, loadTreino]);

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
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  function handleToggleSet(item: WorkoutExerciseItem, setNumber: number) {
    if (!item.id || !selectedDate) return;

    setSetsMap((current) => {
      const next = {
        ...current,
        [item.id!]: toggleCompletedSet(current[item.id!] ?? [], setNumber, item.sets),
      };

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        persistProgress(next, selectedDate);
      }, 400);

      return next;
    });
  }

  function handleTreinoSaved(saved: StudentWorkout) {
    setTreino(saved);
    setSetsMap(buildSetsMap(saved));
    setMode("execute");
    setTreinos((current) => {
      const summary: WorkoutSummary = {
        id: saved.id,
        title: saved.title,
        workoutDate: saved.workoutDate,
        updatedAt: saved.updatedAt,
        source: saved.source,
        exerciseCount: saved.exercises.length,
        progressPercent: 0,
        completionStatus: "pending",
      };
      const exists = current.some((item) => item.workoutDate === saved.workoutDate);
      if (!exists) return sortWorkoutsAscending([...current, summary]);
      return sortWorkoutsAscending(
        current.map((item) => (item.workoutDate === saved.workoutDate ? summary : item)),
      );
    });
  }

  function renderExerciseCard(item: WorkoutExerciseItem) {
    const itemId = item.id ?? "";
    return (
      <WorkoutExerciseCard
        key={itemId || `${item.phase}-${item.order}`}
        item={item}
        index={item.order}
        mediaUrl={item.exercise.gifUrl ?? item.exercise.imageUrl}
        completedSets={setsMap[itemId] ?? item.completedSets ?? []}
        onToggleSet={(setNumber) => handleToggleSet(item, setNumber)}
      />
    );
  }

  return (
    <StudentSectionPage
      title="Treino"
      description="Monte seu treino, escolha a data e marque série por série durante a execução."
    >
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando treinos...
        </div>
      ) : error && !treino && mode === "execute" && treinos.length === 0 ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          <WorkoutDateStrip
            treinos={treinos}
            selectedDate={selectedDate}
            completionByDate={completionByDate}
            onSelect={setSelectedDate}
            onCreateDate={setSelectedDate}
          />

          {error && treino ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {loadingTreino ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
              Carregando ficha...
            </div>
          ) : mode === "build" && session?.id ? (
            <StudentTreinoBuilder
              studentId={session.id}
              workoutDate={selectedDate}
              initialTreino={treino?.source === "STUDENT" ? treino : null}
              onSaved={handleTreinoSaved}
              onCancel={treino ? () => setMode("execute") : undefined}
            />
          ) : !treino ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-center">
              <p className="m-0 text-sm text-white/55">
                Nenhum treino para {formatWorkoutDateLabel(selectedDate)}.
              </p>
              <button
                type="button"
                onClick={() => setMode("build")}
                className="mt-4 rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white"
              >
                Criar meu treino
              </button>
            </div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <ProgressRing percent={completionPercent} status={completionStatus} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                      {formatWorkoutDateLabel(treino.workoutDate)}
                      {treino.source === "STUDENT" ? " • Meu treino" : " • Professor"}
                    </p>
                    <h2 className="m-0 mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                      {treino.title}
                    </h2>
                    <p className="m-0 mt-2 text-sm text-white/60">
                      {setProgress?.completedSets ?? 0}/{setProgress?.totalSets ?? 0} séries •{" "}
                      {setProgress?.completedExercises ?? 0}/{setProgress?.totalExercises ?? 0}{" "}
                      exercícios
                      {savingProgress ? " • salvando..." : ""}
                    </p>
                    {canEditTreino ? (
                      <button
                        type="button"
                        onClick={() => setMode("build")}
                        className="mt-3 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75"
                      >
                        Editar treino
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="sticky top-14 z-20 -mx-1 rounded-2xl border border-white/10 bg-black/80 p-2 backdrop-blur-md md:top-0">
                <div className="grid grid-cols-3 gap-2">
                  {WORKOUT_PHASES.map((phase) => {
                    const total = phaseCounts?.[phase.id] ?? 0;
                    const selected = activePhase === phase.id;
                    const disabled = total === 0;
                    const phaseSets = (groupedExercises?.[phase.id] ?? []).reduce(
                      (sum, item) => sum + (setsMap[item.id ?? ""]?.length ?? 0),
                      0,
                    );
                    const phaseTotalSets = (groupedExercises?.[phase.id] ?? []).reduce(
                      (sum, item) => sum + item.sets,
                      0,
                    );

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
                          {total > 0 ? `${phaseSets}/${phaseTotalSets} séries` : "—"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                {activePhaseItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                    Nenhum exercício nesta etapa.
                  </div>
                ) : activePhase === "MEIO" && activeMeioGroups && activeMeioGroups.length > 0 ? (
                  activeMeioGroups.map((group) => (
                    <div key={group.region} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className="rounded-full bg-[#e85d6f]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#f08a98]">
                          {group.label}
                        </span>
                      </div>
                      {group.items.map((item) => renderExerciseCard(item))}
                    </div>
                  ))
                ) : (
                  activePhaseItems.map((item) => renderExerciseCard(item))
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
