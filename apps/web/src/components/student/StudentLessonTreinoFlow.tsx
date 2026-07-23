import { useCallback, useEffect, useMemo, useState } from "react";
import ModalityVideoPlayer from "../modality/ModalityVideoPlayer";
import ProgressRing from "./ProgressRing";
import WorkoutDateStrip from "./WorkoutDateStrip";
import WorkoutExerciseCard from "./WorkoutExerciseCard";
import { apiFetch } from "../../lib/api";
import { LESSON_PHASES, lessonProgressStorageKey, type LessonPhase } from "../../lib/lesson";
import { getStudentSession } from "../../lib/studentSession";
import {
  countWorkoutSetProgress,
  formatWorkoutDateLabel,
  getWorkoutCompletionStatus,
  todayDateInputValue,
  toggleCompletedSet,
  workoutSetProgressPercent,
  type WorkoutCompletionStatus,
} from "../../lib/workout";
import {
  lessonToVideoCard,
  type ProfessorLessonItem,
  type StudentLessonSlotOption,
  type StudentTreinoAulasResponse,
} from "../../types/modality";
import type { WorkoutExerciseItem, WorkoutSummary } from "../../types/workout";

interface StudentLessonTreinoFlowProps {
  modalityId: string;
  modalityName: string;
  planoModalidade: string;
}

function lessonSlotKey(slot: Pick<StudentLessonSlotOption, "startTime" | "endTime">): string {
  return `${slot.startTime}-${slot.endTime}`;
}

function readAulaCompleted(modalityId: string, classDate: string, lessonId: string): boolean {
  try {
    const raw = sessionStorage.getItem(lessonProgressStorageKey(modalityId, classDate));
    if (!raw) return false;
    const data = JSON.parse(raw) as { aulaCompleted?: string[] };
    return (data.aulaCompleted ?? []).includes(lessonId);
  } catch {
    return false;
  }
}

function writeAulaCompleted(
  modalityId: string,
  classDate: string,
  lessonId: string,
  completed: boolean,
): void {
  const key = lessonProgressStorageKey(modalityId, classDate);
  try {
    const raw = sessionStorage.getItem(key);
    const data = raw ? (JSON.parse(raw) as { aulaCompleted?: string[]; setsMap?: Record<string, number[]> }) : {};
    const current = new Set(data.aulaCompleted ?? []);
    if (completed) current.add(lessonId);
    else current.delete(lessonId);
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...data, aulaCompleted: Array.from(current) }),
    );
  } catch {
    sessionStorage.setItem(key, JSON.stringify({ aulaCompleted: completed ? [lessonId] : [] }));
  }
}

function readWarmupSetsMap(modalityId: string, classDate: string): Record<string, number[]> {
  try {
    const raw = sessionStorage.getItem(lessonProgressStorageKey(modalityId, classDate));
    if (!raw) return {};
    const data = JSON.parse(raw) as { setsMap?: Record<string, number[]> };
    return data.setsMap ?? {};
  } catch {
    return {};
  }
}

function writeWarmupSetsMap(
  modalityId: string,
  classDate: string,
  setsMap: Record<string, number[]>,
): void {
  const key = lessonProgressStorageKey(modalityId, classDate);
  try {
    const raw = sessionStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    sessionStorage.setItem(key, JSON.stringify({ ...data, setsMap }));
  } catch {
    sessionStorage.setItem(key, JSON.stringify({ setsMap }));
  }
}

export default function StudentLessonTreinoFlow({
  modalityId,
  modalityName,
  planoModalidade,
}: StudentLessonTreinoFlowProps) {
  const session = getStudentSession();
  const [classDate, setClassDate] = useState(todayDateInputValue());
  const [lessonDates, setLessonDates] = useState<WorkoutSummary[]>([]);
  const [horarios, setHorarios] = useState<StudentLessonSlotOption[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [activeLesson, setActiveLesson] = useState<ProfessorLessonItem | null>(null);
  const [warmupExercises, setWarmupExercises] = useState<WorkoutExerciseItem[]>([]);
  const [setsMap, setSetsMap] = useState<Record<string, number[]>>({});
  const [aulaCompleted, setAulaCompleted] = useState(false);
  const [activePhase, setActivePhase] = useState<LessonPhase>("AQUECIMENTO");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedSlot = useMemo(
    () => horarios.find((item) => lessonSlotKey(item) === selectedSlotKey) ?? null,
    [horarios, selectedSlotKey],
  );

  const warmupProgress = useMemo(
    () =>
      countWorkoutSetProgress(
        warmupExercises.map((item) => ({
          sets: item.sets,
          completedSets: setsMap[item.id ?? ""] ?? [],
        })),
      ),
    [warmupExercises, setsMap],
  );

  const completionPercent = useMemo(() => {
    const warmupDone =
      warmupExercises.length > 0 &&
      (warmupProgress?.completedSets ?? 0) >= (warmupProgress?.totalSets ?? 1) &&
      (warmupProgress?.totalSets ?? 0) > 0
        ? 1
        : warmupExercises.length === 0
          ? 1
          : 0;
    const aulaTotal = activeLesson ? 1 : 0;
    const aulaDone = aulaCompleted ? 1 : 0;
    const totalParts = (warmupExercises.length > 0 ? 1 : 0) + aulaTotal;
    if (totalParts === 0) return 0;
    return Math.round(((warmupDone + aulaDone) / totalParts) * 100);
  }, [warmupExercises.length, warmupProgress, activeLesson, aulaCompleted]);

  const completionStatus: WorkoutCompletionStatus = getWorkoutCompletionStatus(
    warmupExercises.length > 0 ? (warmupProgress?.totalSets ?? 0) + (activeLesson ? 1 : 0) : activeLesson ? 1 : 0,
    (warmupProgress?.completedSets ?? 0) >= (warmupProgress?.totalSets ?? 0) && (warmupProgress?.totalSets ?? 0) > 0
      ? (warmupProgress?.completedSets ?? 0) + (aulaCompleted ? 1 : 0)
      : aulaCompleted
        ? (warmupProgress?.completedSets ?? 0) + 1
        : warmupProgress?.completedSets ?? 0,
  );

  const completionByDate = useMemo(() => {
    return Object.fromEntries(
      lessonDates.map((item) => [item.workoutDate, "pending" as WorkoutCompletionStatus]),
    );
  }, [lessonDates]);

  const loadDates = useCallback(() => {
    if (!session?.id || !modalityId) return;
    apiFetch<{ dates: Array<{ classDate: string }> }>(
      `/student/treino-aulas-datas?modalityId=${encodeURIComponent(modalityId)}`,
      {},
      session.id,
    )
      .then((data) => {
        const summaries: WorkoutSummary[] = data.dates.map((item) => ({
          id: item.classDate,
          workoutDate: item.classDate,
          title: modalityName,
          updatedAt: item.classDate,
          source: "OWNER",
          exerciseCount: 0,
        }));
        setLessonDates(summaries);
        if (summaries.length > 0 && !summaries.some((item) => item.workoutDate === classDate)) {
          setClassDate(summaries[summaries.length - 1]?.workoutDate ?? todayDateInputValue());
        }
      })
      .catch(() => setLessonDates([]));
  }, [session?.id, modalityId, modalityName, classDate]);

  const loadWarmup = useCallback(() => {
    if (!session?.id || !modalityId) return;
    apiFetch<{ exercises: WorkoutExerciseItem[] }>(
      `/student/modality-aquecimento?modalityId=${encodeURIComponent(modalityId)}`,
      {},
      session.id,
    )
      .then((data) => {
        setWarmupExercises(data.exercises);
        setSetsMap(readWarmupSetsMap(modalityId, classDate));
      })
      .catch(() => {
        setWarmupExercises([]);
        setSetsMap({});
      });
  }, [session?.id, modalityId, classDate]);

  const loadSchedule = useCallback(() => {
    if (!session?.id || !modalityId || !classDate) return;

    setLoading(true);
    setError("");
    apiFetch<StudentTreinoAulasResponse>(
      `/student/treino-aulas?modalityId=${encodeURIComponent(modalityId)}&classDate=${encodeURIComponent(classDate)}`,
      {},
      session.id,
    )
      .then((data) => {
        setHorarios(data.horarios);
        const firstWithLesson = data.horarios.find((item) => item.lesson);
        if (firstWithLesson?.lesson) {
          setSelectedSlotKey(lessonSlotKey(firstWithLesson));
          setActiveLesson(firstWithLesson.lesson);
          setAulaCompleted(
            readAulaCompleted(modalityId, classDate, firstWithLesson.lesson.id),
          );
        } else {
          setSelectedSlotKey("");
          setActiveLesson(null);
          setAulaCompleted(false);
        }
      })
      .catch((err) => {
        setHorarios([]);
        setActiveLesson(null);
        setSelectedSlotKey("");
        setAulaCompleted(false);
        setError(err instanceof Error ? err.message : "Erro ao carregar aulas.");
      })
      .finally(() => setLoading(false));
  }, [session?.id, modalityId, classDate]);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  useEffect(() => {
    loadWarmup();
  }, [loadWarmup]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  function selectSlot(slot: StudentLessonSlotOption) {
    if (!slot.lesson) return;
    setSelectedSlotKey(lessonSlotKey(slot));
    setActiveLesson(slot.lesson);
    setAulaCompleted(readAulaCompleted(modalityId, classDate, slot.lesson.id));
    setActivePhase("AULA");
  }

  function handleToggleSet(item: WorkoutExerciseItem, setNumber: number) {
    if (!item.id) return;
    setSetsMap((current) => {
      const next = toggleCompletedSet(current[item.id!] ?? [], setNumber, item.sets);
      const updated = { ...current, [item.id!]: next };
      writeWarmupSetsMap(modalityId, classDate, updated);
      return updated;
    });
  }

  function markAulaCompleted() {
    if (!activeLesson) return;
    const next = !aulaCompleted;
    setAulaCompleted(next);
    writeAulaCompleted(modalityId, classDate, activeLesson.id, next);
    if (next && session?.id) {
      apiFetch(`/student/aulas/${activeLesson.id}/presenca`, { method: "POST" }, session.id).catch(
        () => undefined,
      );
    }
  }

  const warmupPercent =
    warmupExercises.length > 0
      ? workoutSetProgressPercent(
          warmupExercises.map((item) => ({
            sets: item.sets,
            completedSets: setsMap[item.id ?? ""] ?? [],
          })),
        )
      : 100;

  return (
    <div className="space-y-4 pb-8">
      <WorkoutDateStrip
        treinos={lessonDates}
        selectedDate={classDate}
        completionByDate={completionByDate}
        onSelect={setClassDate}
        onCreateDate={setClassDate}
      />

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando aula...
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-4 sm:p-5">
            <div className="flex items-start gap-4">
              <ProgressRing percent={completionPercent} status={completionStatus} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {formatWorkoutDateLabel(classDate)} • {modalityName}
                </p>
                <h2 className="m-0 mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                  {activeLesson?.title ?? "Aula do dia"}
                </h2>
                <p className="m-0 mt-2 text-sm text-white/60">
                  Plano: {planoModalidade}
                  {selectedSlot?.professorName ? ` • Prof. ${selectedSlot.professorName}` : ""}
                </p>
              </div>
            </div>
          </section>

          {horarios.length > 0 ? (
            <section className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="m-0 text-sm font-semibold text-white">Horários do dia</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {horarios.map((slot) => {
                  const key = lessonSlotKey(slot);
                  const selected = selectedSlotKey === key;
                  const disabled = !slot.lesson;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectSlot(slot)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "bg-[#e85d6f] text-white"
                          : disabled
                            ? "cursor-not-allowed border border-white/10 text-white/30"
                            : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                      }`}
                    >
                      {slot.label}
                      {slot.professorName ? ` • ${slot.professorName}` : ""}
                      {disabled ? " (sem aula)" : ""}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="sticky top-14 z-20 -mx-1 rounded-2xl border border-white/10 bg-black/80 p-2 backdrop-blur-md md:top-0">
            <div className="grid grid-cols-2 gap-2">
              {LESSON_PHASES.map((phase) => {
                const selected = activePhase === phase.id;
                const disabled =
                  phase.id === "AQUECIMENTO"
                    ? warmupExercises.length === 0
                    : !activeLesson;
                const subtitle =
                  phase.id === "AQUECIMENTO"
                    ? warmupExercises.length > 0
                      ? `${warmupPercent}% movimentos`
                      : "Sem movimentos"
                    : activeLesson
                      ? aulaCompleted
                        ? "Assistida"
                        : "Vídeo disponível"
                      : "Sem aula";

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
                    <p className="m-0 mt-1 text-xs opacity-80">{subtitle}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {activePhase === "AQUECIMENTO" ? (
            <section className="space-y-4">
              {warmupExercises.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                  Nenhum movimento de aquecimento cadastrado para {modalityName}.
                </div>
              ) : (
                warmupExercises.map((item) => (
                  <WorkoutExerciseCard
                    key={item.id ?? `${item.order}-${item.exercise.name}`}
                    item={item}
                    index={item.order}
                    mediaUrl={item.exercise.gifUrl ?? item.exercise.imageUrl}
                    completedSets={setsMap[item.id ?? ""] ?? []}
                    onToggleSet={(setNumber) => handleToggleSet(item, setNumber)}
                  />
                ))
              )}
            </section>
          ) : activeLesson ? (
            <div className="space-y-3">
              <ModalityVideoPlayer
                video={lessonToVideoCard(activeLesson)}
                professorName={
                  activeLesson.professor?.name ??
                  activeLesson.professor?.email ??
                  selectedSlot?.professorName
                }
                classDate={formatWorkoutDateLabel(classDate)}
                timeLabel={selectedSlot?.label}
              />
              <button
                type="button"
                onClick={markAulaCompleted}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold ${
                  aulaCompleted
                    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    : "bg-[#e85d6f] text-white"
                }`}
              >
                {aulaCompleted ? "Aula marcada como assistida" : "Marcar aula como assistida"}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
              Nenhuma aula publicada para {formatWorkoutDateLabel(classDate)} em {modalityName}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
