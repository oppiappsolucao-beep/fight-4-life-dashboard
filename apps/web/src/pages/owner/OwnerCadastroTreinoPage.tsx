import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  WORKOUT_PHASES,
  formatWorkoutDateLabel,
  groupExercisesByPhase,
  todayDateInputValue,
  type WorkoutPhase,
} from "../../lib/workout";
import type {
  ExerciseCatalogItem,
  StudentWorkout,
  WorkoutExerciseDraft,
  WorkoutSummary,
} from "../../types/workout";
import OwnerSectionPage from "./OwnerSectionPage";

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

function reindexPhase(drafts: WorkoutExerciseDraft[], phase: WorkoutPhase) {
  let order = 1;
  return drafts.map((item) => {
    if (item.phase !== phase) return item;
    const next = { ...item, order };
    order += 1;
    return next;
  });
}

export default function OwnerCadastroTreinoPage() {
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [savedTreinos, setSavedTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [workoutDate, setWorkoutDate] = useState(todayDateInputValue());
  const [activePhase, setActivePhase] = useState<WorkoutPhase>("INICIO");
  const [title, setTitle] = useState("Treino personalizado");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<WorkoutExerciseDraft[]>([]);
  const [draftMeta, setDraftMeta] = useState<Record<string, ExerciseCatalogItem>>({});
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [loadingTreino, setLoadingTreino] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const muscleGroups = useMemo(() => {
    const groups = new Set(catalog.map((item) => item.muscleGroup));
    return ["Todos", ...Array.from(groups).sort()];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.filter((item) => {
      if (muscleFilter !== "Todos" && item.muscleGroup !== muscleFilter) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.muscleGroup.toLowerCase().includes(term) ||
        (item.equipment ?? "").toLowerCase().includes(term)
      );
    });
  }, [catalog, muscleFilter, search]);

  const selectedStudent = alunos.find((item) => item.id === selectedStudentId);
  const groupedDrafts = useMemo(() => groupExercisesByPhase(drafts), [drafts]);

  const loadBase = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      apiFetch<{ alunos: AlunoOption[] }>("/owner/alunos"),
      apiFetch<{ exercises: ExerciseCatalogItem[] }>("/owner/exercises"),
    ])
      .then(([alunosResult, exercisesResult]) => {
        if (alunosResult.status === "fulfilled") {
          setAlunos(alunosResult.value.alunos);
          if (alunosResult.value.alunos.length > 0) {
            setSelectedStudentId((current) => current || alunosResult.value.alunos[0].id);
          }
        }
        if (exercisesResult.status === "fulfilled") {
          setCatalog(exercisesResult.value.exercises);
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
        if (failures.length > 0) setError(failures.join(" "));
      })
      .finally(() => setLoading(false));
  }, []);

  const loadStudentTreinos = useCallback((studentId: string) => {
    if (!studentId) return;
    apiFetch<{ treinos: WorkoutSummary[] }>(`/owner/alunos/${studentId}/treinos`)
      .then((data) => setSavedTreinos(data.treinos))
      .catch(() => {
        setSavedTreinos([]);
      });
  }, []);

  const loadStudentWorkout = useCallback((studentId: string, date: string) => {
    if (!studentId) return;
    setLoadingTreino(true);
    apiFetch<{ treino: StudentWorkout | null }>(
      `/owner/alunos/${studentId}/treino?date=${encodeURIComponent(date)}`,
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
    if (selectedStudentId) {
      loadStudentTreinos(selectedStudentId);
      loadStudentWorkout(selectedStudentId, workoutDate);
    }
  }, [selectedStudentId, workoutDate, loadStudentTreinos, loadStudentWorkout]);

  function addExercise(exercise: ExerciseCatalogItem) {
    if (drafts.some((item) => item.phase === activePhase && item.exerciseId === exercise.id)) {
      setError("Este exercício já está nesta parte do treino.");
      return;
    }
    setError("");
    const order = drafts.filter((item) => item.phase === activePhase).length + 1;
    setDrafts((current) => [...current, emptyDraft(exercise, activePhase, order)]);
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudentId) {
      setError("Selecione um aluno.");
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
        `/owner/alunos/${selectedStudentId}/treino`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: title.trim(),
            workoutDate,
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
    <OwnerSectionPage
      title="Cadastro de Treino"
      description="Monte a ficha por data com começo, meio e fim. O aluno escolhe a data na aba Treino."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando alunos e exercícios...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
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

          <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
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
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
              />
            </div>
            {savedTreinos.length > 0 ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                  Treinos já cadastrados
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedTreinos.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setWorkoutDate(item.workoutDate)}
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
              </div>
            ) : null}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {WORKOUT_PHASES.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setActivePhase(phase.id)}
                    className={`rounded-lg px-3 py-2 text-left transition ${
                      activePhase === phase.id
                        ? "bg-[#e85d6f]/25 text-white"
                        : "border border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase">{phase.label}</span>
                    <span className="block text-[0.65rem] text-white/45">{phase.description}</span>
                  </button>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base font-semibold text-white">Catálogo</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Adicionando em:{" "}
                    <strong>{WORKOUT_PHASES.find((p) => p.id === activePhase)?.label}</strong>
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
                    className="min-w-[140px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {filteredCatalog.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    {exercise.imageUrl ? (
                      <img
                        src={exercise.imageUrl}
                        alt={exercise.name}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-semibold text-white">{exercise.name}</p>
                      <p className="mt-0.5 text-xs text-white/45">{exercise.muscleGroup}</p>
                      <button
                        type="button"
                        onClick={() => addExercise(exercise)}
                        className="mt-2 rounded-md bg-[#e85d6f]/20 px-3 py-1.5 text-xs font-semibold text-[#f08a98]"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4">
                <h2 className="m-0 text-base font-semibold text-white">
                  {selectedStudent?.nomeCompleto ?? "Aluno"} • {formatWorkoutDateLabel(workoutDate)}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {loadingTreino
                    ? "Carregando..."
                    : `${drafts.length} exercício(s) na ficha`}
                </p>
              </div>

              {drafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                  Monte o treino em 3 partes: começo, meio e fim.
                </div>
              ) : (
                <div className="space-y-5">
                  {WORKOUT_PHASES.map((phase) => {
                    const items = groupedDrafts[phase.id];
                    if (items.length === 0) return null;

                    return (
                      <div key={phase.id}>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#e85d6f]">
                          {phase.label}
                        </h3>
                        <div className="space-y-3">
                          {items.map((draft) => {
                            const exercise = draftMeta[draft.exerciseId];
                            if (!exercise) return null;
                            const draftKey = `${draft.phase}-${draft.exerciseId}-${draft.order}`;

                            return (
                              <div
                                key={draftKey}
                                className="rounded-xl border border-white/10 bg-black/20 p-4"
                              >
                                <div className="mb-3 flex items-start justify-between gap-2">
                                  <p className="m-0 text-sm font-semibold text-white">
                                    {draft.order}. {exercise.name}
                                  </p>
                                  <div className="flex gap-1">
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
                                      onClick={() => removeDraft(draft.phase, draft.order)}
                                      className="rounded border border-red-400/20 px-2 py-1 text-xs text-red-300"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
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
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || drafts.length === 0}
                  className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d44d5f] disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Publicar treino"}
                </button>
              </div>
            </section>
          </div>
        </form>
      )}
    </OwnerSectionPage>
  );
}
