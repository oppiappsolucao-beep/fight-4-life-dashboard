import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  MEIO_TREINO_REGIONS,
  WORKOUT_PHASES,
  bodyRegionLabel,
  formatWorkoutDateLabel,
  groupExercisesByPhase,
  matchesCatalogFilter,
  todayDateInputValue,
  type MeioTreinoRegion,
  type WorkoutPhase,
} from "../../lib/workout";
import type {
  ExerciseCatalogItem,
  StudentWorkout,
  WorkoutExerciseDraft,
  WorkoutSummary,
} from "../../types/workout";
import type { ModalityItem, ProfessorModalitySchedule, WarmupMovementCatalogEntry } from "../../types/modality";
import { LESSON_PHASES, type LessonPhase } from "../../lib/lesson";
import LessonVideoUploadField from "../../components/professor/LessonVideoUploadField";
import {
  WEEKDAY_LABELS,
  formatTimeRange,
  scheduleSlotKey,
  weekdayFromDateInput,
  type ScheduleSlot,
} from "../../lib/schedule";

interface AlunoOption {
  id: string;
  nomeCompleto: string;
  planoModalidade: string;
}

function emptyDraft(
  exercise: ExerciseCatalogItem,
  phase: WorkoutPhase,
  order: number,
): WorkoutExerciseDraft {
  return {
    exerciseId: exercise.id,
    phase,
    order,
    sets: 3,
    reps: "12",
    load: "",
    restSeconds: 60,
    notes: "",
  };
}

function customExerciseCatalogItem(id: string, name: string): ExerciseCatalogItem {
  return {
    id,
    slug: id,
    name,
    muscleGroup: "Personalizado",
    equipment: null,
    instructions: "",
    imageUrl: null,
    gifUrl: null,
    phases: ["INICIO"],
    bodyRegion: "AQUECIMENTO",
  };
}

function isCustomExerciseId(exerciseId: string) {
  return exerciseId.startsWith("custom:");
}

function reindexPhase(drafts: WorkoutExerciseDraft[], phase: WorkoutPhase) {
  let order = 1;
  return drafts.map((item) => {
    if (item.phase !== phase) return item;
    const next = { ...item, order };
    order += 1;
    return next;
  });
}

export default function ProfessorCadastroTreinoPage() {
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [modalidades, setModalidades] = useState<ModalityItem[]>([]);
  const [professorSchedules, setProfessorSchedules] = useState<ProfessorModalitySchedule[]>([]);
  const [selectedModalityId, setSelectedModalityId] = useState("");
  const [savedTreinos, setSavedTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [workoutDate, setWorkoutDate] = useState(todayDateInputValue());
  const [activePhase, setActivePhase] = useState<WorkoutPhase | null>(null);
  const [activeLessonPhase, setActiveLessonPhase] = useState<LessonPhase | null>(null);
  const [meioRegion, setMeioRegion] = useState<MeioTreinoRegion>("SUPERIOR");
  const [savedDatesOpen, setSavedDatesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [expandedDraftKey, setExpandedDraftKey] = useState<string | null>(null);
  const [title, setTitle] = useState("Treino personalizado");
  const [notes, setNotes] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [drafts, setDrafts] = useState<WorkoutExerciseDraft[]>([]);
  const [draftMeta, setDraftMeta] = useState<Record<string, ExerciseCatalogItem>>({});
  const [search, setSearch] = useState("");
  const [customMovementName, setCustomMovementName] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [loadingTreino, setLoadingTreino] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const muscleGroups = useMemo(() => {
    if (!activePhase) return ["Todos"];
    const phaseCatalog = catalog.filter((item) =>
      matchesCatalogFilter(item, activePhase, meioRegion),
    );
    const groups = new Set(phaseCatalog.map((item) => item.muscleGroup));
    return ["Todos", ...Array.from(groups).sort()];
  }, [catalog, activePhase, meioRegion]);

  const phaseCatalog = useMemo(() => {
    if (!activePhase) return [];
    return catalog.filter((item) => matchesCatalogFilter(item, activePhase, meioRegion));
  }, [catalog, activePhase, meioRegion]);

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return phaseCatalog.filter((item) => {
      if (muscleFilter !== "Todos" && item.muscleGroup !== muscleFilter) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.muscleGroup.toLowerCase().includes(term) ||
        (item.equipment ?? "").toLowerCase().includes(term)
      );
    });
  }, [phaseCatalog, muscleFilter, search]);

  const activePhaseMeta = WORKOUT_PHASES.find((p) => p.id === activePhase);
  const meioRegionMeta = MEIO_TREINO_REGIONS.find((r) => r.id === meioRegion);

  const selectedStudent = alunos.find((item) => item.id === selectedStudentId);
  const groupedDrafts = useMemo(() => groupExercisesByPhase(drafts), [drafts]);
  const selectedModality = useMemo(
    () => modalidades.find((item) => item.id === selectedModalityId),
    [modalidades, selectedModalityId],
  );
  const isMusculacao = selectedModality?.contentType === "EXERCISE_CATALOG";

  const savedCatalog = useMemo(
    () => selectedModality?.warmupMovementCatalog ?? [],
    [selectedModality],
  );

  const filteredSavedCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return savedCatalog.filter((entry) => {
      const label =
        entry.customName ??
        catalog.find((item) => item.id === entry.exerciseId)?.name ??
        "";
      if (!term) return true;
      return label.toLowerCase().includes(term);
    });
  }, [savedCatalog, search, catalog]);

  const filteredGlobalCatalog = useMemo(() => {
    return catalog
      .filter(
        (item) => item.bodyRegion === "AQUECIMENTO" || item.phases.includes("INICIO"),
      )
      .filter((item) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return item.name.toLowerCase().includes(term);
      });
  }, [catalog, search]);

  const loadBase = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      apiFetch<{ alunos: AlunoOption[] }>("/professor/alunos"),
      apiFetch<{ exercises: ExerciseCatalogItem[] }>("/professor/exercises"),
      apiFetch<{ modalidades: ModalityItem[] }>("/professor/modalidades"),
      apiFetch<{ schedules: ProfessorModalitySchedule[] }>("/professor/horarios"),
    ])
      .then(([alunosResult, exercisesResult, modalidadesResult, schedulesResult]) => {
        if (alunosResult.status === "fulfilled") {
          setAlunos(alunosResult.value.alunos);
          if (alunosResult.value.alunos.length > 0) {
            setSelectedStudentId((current) => current || alunosResult.value.alunos[0].id);
          }
        }
        if (exercisesResult.status === "fulfilled") {
          setCatalog(exercisesResult.value.exercises);
        }
        if (modalidadesResult.status === "fulfilled") {
          const activeModalities = modalidadesResult.value.modalidades.filter((item) => item.active);
          setModalidades(activeModalities);
          if (activeModalities.length > 0) {
            setSelectedModalityId((current) => current || activeModalities[0].id);
          }
        }
        if (schedulesResult.status === "fulfilled") {
          setProfessorSchedules(schedulesResult.value.schedules);
        }
        const failures: string[] = [];
        if (alunosResult.status === "rejected") {
          failures.push(
            alunosResult.reason instanceof Error
              ? alunosResult.reason.message
              : "Erro ao carregar alunos.",
          );
        }
        if (exercisesResult.status === "rejected") {
          failures.push(
            exercisesResult.reason instanceof Error
              ? exercisesResult.reason.message
              : "Erro ao carregar catálogo.",
          );
        }
        if (modalidadesResult.status === "rejected") {
          failures.push(
            modalidadesResult.reason instanceof Error
              ? modalidadesResult.reason.message
              : "Erro ao carregar modalidades.",
          );
        }
        if (schedulesResult.status === "rejected") {
          failures.push(
            schedulesResult.reason instanceof Error
              ? schedulesResult.reason.message
              : "Erro ao carregar horários.",
          );
        }
        if (failures.length > 0) setError(failures.join(" "));
      })
      .finally(() => setLoading(false));
  }, []);

  const loadStudentTreinos = useCallback((studentId: string) => {
    if (!studentId) return;
    apiFetch<{ treinos: WorkoutSummary[] }>(`/professor/alunos/${studentId}/treinos`)
      .then((data) => setSavedTreinos(data.treinos))
      .catch(() => {
        setSavedTreinos([]);
      });
  }, []);

  const loadStudentWorkout = useCallback((studentId: string, date: string) => {
    if (!studentId) return;
    setLoadingTreino(true);
    apiFetch<{ treino: StudentWorkout | null }>(
      `/professor/alunos/${studentId}/treino?date=${encodeURIComponent(date)}`,
    )
      .then((data) => {
        setError("");
        if (!data.treino) {
          setTitle(`Treino ${formatWorkoutDateLabel(date)}`);
          setNotes("");
          setDrafts([]);
          setDraftMeta({});
          return;
        }
        if (data.treino.modalityId) {
          setSelectedModalityId(data.treino.modalityId);
        }
        setTitle(data.treino.title);
        setNotes(data.treino.notes ?? "");
        setDrafts(
          data.treino.exercises.map((item) => ({
            exerciseId: item.exercise.id,
            phase: item.phase,
            order: item.order,
            sets: item.sets,
            reps: item.reps,
            load: item.load ?? "",
            restSeconds: item.restSeconds ?? 60,
            notes: item.notes ?? "",
          })),
        );
        setDraftMeta(
          Object.fromEntries(
            data.treino.exercises.map((item) => [item.exercise.id, item.exercise]),
          ),
        );
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Erro ao carregar treino desta data.";
        if (!message.includes("indisponível")) {
          setError(message);
        }
      })
      .finally(() => setLoadingTreino(false));
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!muscleGroups.includes(muscleFilter)) {
      setMuscleFilter("Todos");
    }
  }, [muscleGroups, muscleFilter]);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentTreinos(selectedStudentId);
      loadStudentWorkout(selectedStudentId, workoutDate);
    }
  }, [selectedStudentId, workoutDate, loadStudentTreinos, loadStudentWorkout]);

  useEffect(() => {
    setActivePhase(null);
    setActiveLessonPhase(null);
    setExpandedDraftKey(null);
    setSelectedSlotKey("");
    setStartTime("");
    setEndTime("");
  }, [selectedStudentId, workoutDate, selectedModalityId]);

  useEffect(() => {
    if (!selectedModality || isMusculacao) return;
    const warmup = selectedModality.warmupExercises ?? [];
    const nextDrafts: WorkoutExerciseDraft[] = warmup.map((item, index) => {
      const customId = item.customName ? `custom:${index}-${item.order}` : (item.exerciseId ?? "");
      return {
        exerciseId: customId,
        phase: "INICIO",
        order: item.order ?? index + 1,
        sets: item.sets,
        reps: item.reps ?? "",
        load: item.load ?? "",
        restSeconds: item.restSeconds ?? 60,
        notes: item.notes ?? "",
      };
    });
    setDrafts(nextDrafts);
    const meta: Record<string, ExerciseCatalogItem> = {};
    warmup.forEach((item, index) => {
      if (item.customName) {
        const customId = `custom:${index}-${item.order}`;
        meta[customId] = customExerciseCatalogItem(customId, item.customName);
        return;
      }
      if (!item.exerciseId) return;
      const exercise = catalog.find((entry) => entry.id === item.exerciseId);
      if (exercise) meta[item.exerciseId] = exercise;
    });
    setDraftMeta(meta);
  }, [selectedModality, isMusculacao, catalog]);

  const weekday = useMemo(() => weekdayFromDateInput(workoutDate), [workoutDate]);
  const availableSlots = useMemo(() => {
    const professorSlots =
      professorSchedules.find((entry) => entry.modalityId === selectedModalityId)?.slots ?? [];
    const modalitySlots = selectedModality?.scheduleSlots ?? [];
    const source = professorSlots.length > 0 ? professorSlots : modalitySlots;
    return source.filter((slot) => slot.weekday === weekday);
  }, [professorSchedules, selectedModality, selectedModalityId, weekday]);

  function openLessonPhaseEditor(phase: LessonPhase) {
    setActiveLessonPhase(phase);
    setMuscleFilter("Todos");
    setSearch("");
    setExpandedDraftKey(null);
    if (phase === "AQUECIMENTO") {
      setActivePhase("INICIO");
    } else {
      setActivePhase(null);
    }
  }

  function closeLessonPhaseEditor() {
    setActiveLessonPhase(null);
    setActivePhase(null);
    setExpandedDraftKey(null);
  }

  function selectSlot(slot: ScheduleSlot) {
    const key = scheduleSlotKey(slot);
    setSelectedSlotKey(key);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
  }

  function openPhaseEditor(phase: WorkoutPhase) {
    setActivePhase(phase);
    setMuscleFilter("Todos");
    setSearch("");
    setExpandedDraftKey(null);
  }

  function closePhaseEditor() {
    setActivePhase(null);
    setExpandedDraftKey(null);
  }

  function addFromSavedCatalog(entry: WarmupMovementCatalogEntry) {
    const phase: WorkoutPhase = "INICIO";
    setError("");

    if (entry.customName) {
      const customId = `custom:${entry.id}`;
      if (drafts.some((item) => item.phase === phase && item.exerciseId === customId)) {
        setError("Este movimento já está no aquecimento de hoje.");
        return;
      }
      const order = drafts.filter((item) => item.phase === phase).length + 1;
      setDrafts((current) => [
        ...current,
        {
          exerciseId: customId,
          phase,
          order,
          sets: entry.sets ?? 3,
          reps: "",
          load: "",
          restSeconds: 60,
          notes: "",
        },
      ]);
      setDraftMeta((current) => ({
        ...current,
        [customId]: customExerciseCatalogItem(customId, entry.customName!),
      }));
      return;
    }

    if (entry.exerciseId) {
      const exercise = catalog.find((item) => item.id === entry.exerciseId);
      if (exercise) {
        setActivePhase("INICIO");
        addExercise(exercise);
      }
    }
  }

  async function addCustomMovement() {
    const name = customMovementName.trim();
    if (!name) {
      setError("Informe o nome do movimento.");
      return;
    }
    if (!selectedModalityId) {
      setError("Selecione a modalidade.");
      return;
    }
    if (
      savedCatalog.some(
        (entry) => entry.customName?.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("Este movimento já está salvo no catálogo.");
      return;
    }

    const newEntry: WarmupMovementCatalogEntry = {
      id: crypto.randomUUID(),
      customName: name,
      sets: 3,
    };
    const updatedCatalog = [...savedCatalog, newEntry];

    setSavingCatalog(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ modalidade: ModalityItem; message: string }>(
        `/professor/modalidades/${selectedModalityId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ warmupMovementCatalog: updatedCatalog }),
        },
      );
      setModalidades((current) =>
        current.map((item) => (item.id === selectedModalityId ? result.modalidade : item)),
      );
      setCustomMovementName("");
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar movimento.");
    } finally {
      setSavingCatalog(false);
    }
  }

  function addExercise(exercise: ExerciseCatalogItem) {
    const phase: WorkoutPhase | null = isMusculacao
      ? activePhase
      : activeLessonPhase === "AQUECIMENTO"
        ? "INICIO"
        : null;
    if (!phase) return;
    if (drafts.some((item) => item.phase === phase && item.exerciseId === exercise.id)) {
      setError("Este exercício já está nesta parte do treino.");
      return;
    }
    setError("");
    const order = drafts.filter((item) => item.phase === phase).length + 1;
    setDrafts((current) => [...current, emptyDraft(exercise, phase, order)]);
    setDraftMeta((current) => ({ ...current, [exercise.id]: exercise }));
  }

  function updateDraft(draftKey: string, patch: Partial<WorkoutExerciseDraft>) {
    setDrafts((current) =>
      current.map((item) => {
        const key = `${item.phase}-${item.exerciseId}-${item.order}`;
        return key === draftKey ? { ...item, ...patch } : item;
      }),
    );
    setSuccess("");
  }

  function removeDraft(phase: WorkoutPhase, order: number) {
    setDrafts((current) =>
      reindexPhase(
        current.filter((item) => !(item.phase === phase && item.order === order)),
        phase,
      ),
    );
    setSuccess("");
  }

  function moveDraft(phase: WorkoutPhase, order: number, direction: -1 | 1) {
    setDrafts((current) => {
      const phaseItems = current
        .filter((item) => item.phase === phase)
        .sort((a, b) => a.order - b.order);
      const index = phaseItems.findIndex((item) => item.order === order);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= phaseItems.length) return current;

      const swappedOrders = new Map<number, number>();
      swappedOrders.set(phaseItems[index].order, phaseItems[target].order);
      swappedOrders.set(phaseItems[target].order, phaseItems[index].order);

      return reindexPhase(
        current.map((item) => {
          if (item.phase !== phase) return item;
          const newOrder = swappedOrders.get(item.order);
          return newOrder ? { ...item, order: newOrder } : item;
        }),
        phase,
      );
    });
  }

  async function handleVideoSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedModalityId) {
      setError("Selecione a modalidade.");
      return;
    }
    if (!selectedSlotKey || !startTime || !endTime) {
      setError("Selecione um horário da grade cadastrada pela academia.");
      return;
    }
    if (!videoUrl.trim()) {
      setError("Envie o vídeo da aula ou informe a URL.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const warmupExercises = drafts.map((item, index) => {
        const exercise = draftMeta[item.exerciseId];
        const isCustom = isCustomExerciseId(item.exerciseId);
        return {
          ...(isCustom
            ? { customName: exercise?.name ?? "Movimento" }
            : { exerciseId: item.exerciseId }),
          order: index + 1,
          sets: item.sets,
        };
      });

      await apiFetch(`/professor/modalidades/${selectedModalityId}`, {
        method: "PATCH",
        body: JSON.stringify({ warmupExercises }),
      });

      const result = await apiFetch<{ message: string }>("/professor/aulas", {
        method: "POST",
        body: JSON.stringify({
          modalityId: selectedModalityId,
          classDate: workoutDate,
          title: title.trim(),
          description: lessonDescription.trim() || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          videoUrl,
        }),
      });

      setSuccess(result.message);
      closeLessonPhaseEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao publicar aula.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudentId) {
      setError("Selecione um aluno.");
      return;
    }
    if (!selectedModalityId) {
      setError("Selecione a modalidade do treino.");
      return;
    }
    if (drafts.length === 0) {
      setError("Adicione ao menos um exercício ao treino.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiFetch<{ message: string }>(
        `/professor/alunos/${selectedStudentId}/treino`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: title.trim(),
            workoutDate,
            modalityId: selectedModalityId,
            notes: notes.trim() || undefined,
            exercises: drafts,
          }),
        },
      );
      setSuccess(result.message);
      loadStudentTreinos(selectedStudentId);
      loadStudentWorkout(selectedStudentId, workoutDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar treino.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <header className="mb-6">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
          Professor
        </p>
        <h1 className="m-0 text-2xl font-semibold text-white">Cadastro de Treino</h1>
        <p className="mt-2 text-sm text-white/60">
          Monte a ficha ou a aula do dia nas modalidades liberadas para você.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando alunos e exercícios...
        </div>
      ) : modalidades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
          Nenhuma modalidade liberada. Peça ao dono da academia para liberar seu acesso.
        </div>
      ) : (
        <form
          onSubmit={isMusculacao ? handleSubmit : handleVideoSubmit}
          className="space-y-6"
        >
          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          ) : null}

          <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-5 sm:p-5">
            {isMusculacao ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Aluno
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
              >
                {alunos.map((aluno) => (
                  <option key={aluno.id} value={aluno.id} className="bg-zinc-900">
                    {aluno.nomeCompleto}
                  </option>
                ))}
              </select>
            </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Modalidade
              </label>
              <select
                value={selectedModalityId}
                onChange={(event) => setSelectedModalityId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                required
              >
                {modalidades.length === 0 ? (
                  <option value="">Ative modalidades em Modalidades</option>
                ) : (
                  modalidades.map((modality) => (
                    <option key={modality.id} value={modality.id} className="bg-zinc-900">
                      {modality.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Data do treino
              </label>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                required
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Título
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                required
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <button
                type="button"
                onClick={() => setNotesOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-left text-sm text-white/70 transition hover:border-white/20"
              >
                <span>Observações do treino</span>
                <span className="text-white/40">{notesOpen ? "−" : "+"}</span>
              </button>
              {notesOpen ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                />
              ) : null}
            </div>
            {savedTreinos.length > 0 ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={() => setSavedDatesOpen((current) => !current)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-left text-sm text-white/70 transition hover:border-white/20"
                >
                  <span>
                    Treinos cadastrados ({savedTreinos.length})
                  </span>
                  <span className="text-white/40">{savedDatesOpen ? "−" : "+"}</span>
                </button>
                {savedDatesOpen ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {savedTreinos.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setWorkoutDate(item.workoutDate);
                          closePhaseEditor();
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          item.workoutDate === workoutDate
                            ? "bg-[#e85d6f] text-white"
                            : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                        }`}
                      >
                        {formatWorkoutDateLabel(item.workoutDate)} • {item.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {!isMusculacao ? (
              <div className="sm:col-span-2 lg:col-span-5">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-white/50">
                  Horário da grade — {WEEKDAY_LABELS[weekday]}
                </p>
                {availableSlots.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableSlots.map((slot) => {
                      const key = scheduleSlotKey(slot);
                      const selected = selectedSlotKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => selectSlot(slot)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            selected
                              ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                              : "border border-white/15 text-white/65 hover:border-emerald-400/30"
                          }`}
                        >
                          {formatTimeRange(slot)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-amber-200/80">
                    Nenhum horário cadastrado para este dia. Peça ao dono da academia para montar a
                    grade.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold text-white">
                  {isMusculacao
                    ? `${selectedStudent?.nomeCompleto ?? "Aluno"} • ${formatWorkoutDateLabel(workoutDate)}`
                    : `${selectedModality?.name ?? "Modalidade"} • ${formatWorkoutDateLabel(workoutDate)}`}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {loadingTreino && isMusculacao
                    ? "Carregando..."
                    : isMusculacao
                      ? `${drafts.length} exercício(s) na ficha`
                      : `${drafts.length} movimento(s) de aquecimento`}
                </p>
              </div>
              <button
                type="submit"
                disabled={
                  saving ||
                  (isMusculacao
                    ? drafts.length === 0
                    : !videoUrl.trim() || !selectedSlotKey)
                }
                className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d44d5f] disabled:opacity-60"
              >
                {saving ? "Salvando..." : isMusculacao ? "Publicar treino" : "Publicar aula"}
              </button>
            </div>

            {isMusculacao ? (
            !activePhase ? (
              <>
                <p className="mb-3 text-sm text-white/45">
                  Clique em uma etapa para montar ou revisar os exercícios.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {WORKOUT_PHASES.map((phase) => {
                    const count = groupedDrafts[phase.id].length;
                    return (
                      <button
                        key={phase.id}
                        type="button"
                        onClick={() => openPhaseEditor(phase.id)}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-left transition hover:border-[#e85d6f]/40 hover:bg-[#e85d6f]/10"
                      >
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#e85d6f]">
                          {phase.label}
                        </p>
                        <p className="m-0 mt-2 text-sm text-white/55">{phase.description}</p>
                        <p className="m-0 mt-3 text-xs font-medium text-white/70">
                          {count} exercício{count === 1 ? "" : "s"}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {drafts.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
                    Comece escolhendo <strong>Começo</strong>, <strong>Meio</strong> ou{" "}
                    <strong>Fim</strong>.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closePhaseEditor}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    ← Voltar às etapas
                  </button>
                  <span className="rounded-full bg-[#e85d6f]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#f08a98]">
                    Editando: {activePhaseMeta?.label}
                  </span>
                </div>

                {activePhase === "MEIO" ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                      Tipo do meio do treino
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MEIO_TREINO_REGIONS.map((region) => (
                        <button
                          key={region.id}
                          type="button"
                          onClick={() => {
                            setMeioRegion(region.id);
                            setMuscleFilter("Todos");
                            setSearch("");
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            meioRegion === region.id
                              ? "bg-[#e85d6f] text-white"
                              : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                          }`}
                        >
                          {region.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-sm font-semibold text-white">Catálogo</h3>
                        <p className="mt-1 text-xs text-white/45">
                          {filteredCatalog.length} opção(ões) para {activePhaseMeta?.label}
                          {activePhase === "MEIO" ? ` — ${meioRegionMeta?.label?.toLowerCase()}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={muscleFilter}
                          onChange={(e) => setMuscleFilter(e.target.value)}
                          className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                        >
                          {muscleGroups.map((group) => (
                            <option key={group} value={group} className="bg-zinc-900">
                              {group}
                            </option>
                          ))}
                        </select>
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar"
                          className="min-w-[120px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {filteredCatalog.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
                          Nenhum exercício disponível nesta etapa.
                        </div>
                      ) : (
                        filteredCatalog.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="flex gap-3 rounded-lg border border-white/10 bg-black/25 p-3"
                          >
                            {exercise.imageUrl ? (
                              <img
                                src={exercise.imageUrl}
                                alt={exercise.name}
                                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <p className="m-0 text-sm font-semibold text-white">{exercise.name}</p>
                              <p className="mt-0.5 text-xs text-white/45">
                                {exercise.muscleGroup}
                                {exercise.bodyRegion
                                  ? ` • ${bodyRegionLabel(exercise.bodyRegion)}`
                                  : ""}
                              </p>
                              <button
                                type="button"
                                onClick={() => addExercise(exercise)}
                                className="mt-2 rounded-md bg-[#e85d6f]/20 px-3 py-1 text-xs font-semibold text-[#f08a98]"
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <h3 className="m-0 text-sm font-semibold text-white">
                      Ficha — {activePhaseMeta?.label}
                    </h3>
                    <p className="mt-1 text-xs text-white/45">
                      {groupedDrafts[activePhase].length} exercício
                      {groupedDrafts[activePhase].length === 1 ? "" : "s"} nesta etapa
                    </p>

                    {groupedDrafts[activePhase].length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
                        Adicione exercícios pelo catálogo ao lado.
                      </div>
                    ) : (
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {groupedDrafts[activePhase].map((draft) => {
                          const exercise = draftMeta[draft.exerciseId];
                          if (!exercise) return null;
                          const draftKey = `${draft.phase}-${draft.exerciseId}-${draft.order}`;
                          const expanded = expandedDraftKey === draftKey;

                          return (
                            <div
                              key={draftKey}
                              className="rounded-lg border border-white/10 bg-black/25"
                            >
                              <div className="flex items-center gap-2 p-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDraftKey(expanded ? null : draftKey)
                                  }
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="m-0 truncate text-sm font-semibold text-white">
                                    {draft.order}. {exercise.name}
                                  </p>
                                  <p className="m-0 mt-0.5 text-xs text-white/45">
                                    {draft.sets}x{draft.reps}
                                    {draft.load ? ` • ${draft.load}` : ""}
                                  </p>
                                </button>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveDraft(draft.phase, draft.order, -1)}
                                    className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveDraft(draft.phase, draft.order, 1)}
                                    className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      removeDraft(draft.phase, draft.order);
                                      if (expandedDraftKey === draftKey) setExpandedDraftKey(null);
                                    }}
                                    className="rounded border border-red-400/20 px-2 py-1 text-xs text-red-300"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>

                              {expanded ? (
                                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <label className="text-xs text-white/50">
                                      Séries
                                      <input
                                        type="number"
                                        min={1}
                                        value={draft.sets}
                                        onChange={(e) =>
                                          updateDraft(draftKey, {
                                            sets: Number(e.target.value) || 1,
                                          })
                                        }
                                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                                      />
                                    </label>
                                    <label className="text-xs text-white/50">
                                      Reps
                                      <input
                                        value={draft.reps}
                                        onChange={(e) =>
                                          updateDraft(draftKey, { reps: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                                      />
                                    </label>
                                    <label className="text-xs text-white/50">
                                      Carga
                                      <input
                                        value={draft.load}
                                        onChange={(e) =>
                                          updateDraft(draftKey, { load: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                                      />
                                    </label>
                                    <label className="text-xs text-white/50">
                                      Descanso
                                      <input
                                        type="number"
                                        min={0}
                                        value={draft.restSeconds}
                                        onChange={(e) =>
                                          updateDraft(draftKey, {
                                            restSeconds: Number(e.target.value) || 0,
                                          })
                                        }
                                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                                      />
                                    </label>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
            ) : !activeLessonPhase ? (
              <>
                <p className="mb-3 text-sm text-white/45">
                  Clique em uma etapa para montar o aquecimento ou publicar a aula em vídeo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {LESSON_PHASES.map((phase) => {
                    const count =
                      phase.id === "AQUECIMENTO"
                        ? drafts.length
                        : videoUrl.trim()
                          ? 1
                          : 0;
                    return (
                      <button
                        key={phase.id}
                        type="button"
                        onClick={() => openLessonPhaseEditor(phase.id)}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-left transition hover:border-[#e85d6f]/40 hover:bg-[#e85d6f]/10"
                      >
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#e85d6f]">
                          {phase.label}
                        </p>
                        <p className="m-0 mt-2 text-sm text-white/55">{phase.description}</p>
                        <p className="m-0 mt-3 text-xs font-medium text-white/70">
                          {phase.id === "AQUECIMENTO"
                            ? `${count} movimento${count === 1 ? "" : "s"}`
                            : count > 0
                              ? "Vídeo pronto"
                              : "Sem vídeo"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : activeLessonPhase === "AULA" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeLessonPhaseEditor}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    ← Voltar às etapas
                  </button>
                  <span className="rounded-full bg-[#e85d6f]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#f08a98]">
                    Editando: Aula
                  </span>
                </div>
                <label className="block text-xs text-white/50">
                  Descrição da aula
                  <textarea
                    value={lessonDescription}
                    onChange={(event) => setLessonDescription(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  />
                </label>
                <LessonVideoUploadField onChange={setVideoUrl} />
                <input
                  value={videoUrl.startsWith("data:") ? "" : videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="URL do vídeo (opcional se fez upload)"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeLessonPhaseEditor}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    ← Voltar às etapas
                  </button>
                  <span className="rounded-full bg-[#e85d6f]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#f08a98]">
                    Editando: Aquecimento
                  </span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <h3 className="m-0 text-sm font-semibold text-white">Catálogo</h3>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={customMovementName}
                        onChange={(event) => setCustomMovementName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void addCustomMovement();
                          }
                        }}
                        placeholder="Nome do movimento"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() => void addCustomMovement()}
                        disabled={savingCatalog}
                        className="shrink-0 rounded-lg bg-[#e85d6f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {savingCatalog ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar exercício"
                      className="mt-3 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                    />
                    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
                      {filteredSavedCatalog.length > 0 ? (
                        <div className="space-y-2">
                          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
                            Meus movimentos
                          </p>
                          {filteredSavedCatalog.map((entry) => {
                            const label =
                              entry.customName ??
                              catalog.find((item) => item.id === entry.exerciseId)?.name ??
                              "Movimento";
                            return (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3"
                              >
                                <div>
                                  <span className="text-sm text-white">{label}</span>
                                  <p className="m-0 mt-0.5 text-xs text-white/40">
                                    {entry.sets ?? 3}x
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addFromSavedCatalog(entry)}
                                  className="rounded-md bg-[#e85d6f]/20 px-3 py-1 text-xs font-semibold text-[#f08a98]"
                                >
                                  Adicionar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
                          Catálogo geral
                        </p>
                        {filteredGlobalCatalog.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-white/45">
                            Nenhum exercício encontrado.
                          </div>
                        ) : (
                          filteredGlobalCatalog.map((exercise) => (
                            <div
                              key={exercise.id}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 p-3"
                            >
                              <span className="text-sm text-white">{exercise.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePhase("INICIO");
                                  addExercise(exercise);
                                }}
                                className="rounded-md bg-[#e85d6f]/20 px-3 py-1 text-xs font-semibold text-[#f08a98]"
                              >
                                Adicionar
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <h3 className="m-0 text-sm font-semibold text-white">Movimentos</h3>
                    <p className="mt-1 text-xs text-white/45">
                      {groupedDrafts.INICIO.length} movimento
                      {groupedDrafts.INICIO.length === 1 ? "" : "s"} no aquecimento
                    </p>
                    {groupedDrafts.INICIO.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
                        Adicione movimentos pelo catálogo ao lado.
                      </div>
                    ) : (
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {groupedDrafts.INICIO.map((draft) => {
                          const exercise = draftMeta[draft.exerciseId];
                          if (!exercise) return null;
                          const draftKey = `${draft.phase}-${draft.exerciseId}-${draft.order}`;
                          const expanded = expandedDraftKey === draftKey;

                          return (
                            <div
                              key={draftKey}
                              className="rounded-lg border border-white/10 bg-black/25"
                            >
                              <div className="flex items-center gap-2 p-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDraftKey(expanded ? null : draftKey)
                                  }
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="m-0 truncate text-sm font-semibold text-white">
                                    {draft.order}. {exercise.name}
                                  </p>
                                  <p className="m-0 mt-0.5 text-xs text-white/45">{draft.sets}x</p>
                                </button>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveDraft(draft.phase, draft.order, -1)}
                                    className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveDraft(draft.phase, draft.order, 1)}
                                    className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      removeDraft(draft.phase, draft.order);
                                      if (expandedDraftKey === draftKey) setExpandedDraftKey(null);
                                    }}
                                    className="rounded border border-red-400/20 px-2 py-1 text-xs text-red-300"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>

                              {expanded ? (
                                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                                  <label className="text-xs text-white/50">
                                    Quantidade de vezes
                                    <input
                                      type="number"
                                      min={1}
                                      value={draft.sets}
                                      onChange={(e) =>
                                        updateDraft(draftKey, {
                                          sets: Number(e.target.value) || 1,
                                        })
                                      }
                                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                                    />
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </form>
      )}
    </div>
  );
}
