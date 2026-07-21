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
import type { ModalityItem } from "../../types/modality";
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
  const [modalidades, setModalidades] = useState<ModalityItem[]>([]);
  const [selectedModalityId, setSelectedModalityId] = useState("");
  const [savedTreinos, setSavedTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [workoutDate, setWorkoutDate] = useState(todayDateInputValue());
  const [activePhase, setActivePhase] = useState<WorkoutPhase | null>(null);
  const [meioRegion, setMeioRegion] = useState<MeioTreinoRegion>("SUPERIOR");
  const [savedDatesOpen, setSavedDatesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [expandedDraftKey, setExpandedDraftKey] = useState<string | null>(null);
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

  const loadBase = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      apiFetch<{ alunos: AlunoOption[] }>("/owner/alunos"),
      apiFetch<{ exercises: ExerciseCatalogItem[] }>("/owner/exercises"),
      apiFetch<{ modalidades: ModalityItem[] }>("/owner/modalidades"),
    ])
      .then(([alunosResult, exercisesResult, modalidadesResult]) => {
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
    setExpandedDraftKey(null);
  }, [selectedStudentId, workoutDate]);

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

  function addExercise(exercise: ExerciseCatalogItem) {
    if (!activePhase) return;
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
        `/owner/alunos/${selectedStudentId}/treino`,
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
    <OwnerSectionPage
      title="Cadastro de Treino"
      description="Monte a ficha por data e modalidade. Escolha a disciplina ofertada pela academia antes de publicar o treino."
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

          <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-5 sm:p-5">
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
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold text-white">
                  {selectedStudent?.nomeCompleto ?? "Aluno"} • {formatWorkoutDateLabel(workoutDate)}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {loadingTreino
                    ? "Carregando..."
                    : `${drafts.length} exercício(s) na ficha`}
                </p>
              </div>
              <button
                type="submit"
                disabled={saving || drafts.length === 0}
                className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d44d5f] disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Publicar treino"}
              </button>
            </div>

            {!activePhase ? (
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
            )}
          </section>
        </form>
      )}
    </OwnerSectionPage>
  );
}
