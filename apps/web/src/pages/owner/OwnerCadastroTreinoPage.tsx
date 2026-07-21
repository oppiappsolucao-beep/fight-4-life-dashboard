import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type {
  ExerciseCatalogItem,
  StudentWorkout,
  WorkoutExerciseDraft,
} from "../../types/workout";
import OwnerSectionPage from "./OwnerSectionPage";

interface AlunoOption {
  id: string;
  nomeCompleto: string;
  planoModalidade: string;
}

function emptyDraft(exercise: ExerciseCatalogItem, order: number): WorkoutExerciseDraft {
  return {
    exerciseId: exercise.id,
    order,
    sets: 3,
    reps: "12",
    load: "",
    restSeconds: 60,
    notes: "",
  };
}

export default function OwnerCadastroTreinoPage() {
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
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
      if (muscleFilter !== "Todos" && item.muscleGroup !== muscleFilter) {
        return false;
      }
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.muscleGroup.toLowerCase().includes(term) ||
        (item.equipment ?? "").toLowerCase().includes(term)
      );
    });
  }, [catalog, muscleFilter, search]);

  const selectedStudent = alunos.find((item) => item.id === selectedStudentId);

  const loadBase = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<{ alunos: AlunoOption[] }>("/owner/alunos"),
      apiFetch<{ exercises: ExerciseCatalogItem[] }>("/owner/exercises"),
    ])
      .then(([alunosData, exercisesData]) => {
        setAlunos(alunosData.alunos);
        setCatalog(exercisesData.exercises);
        if (alunosData.alunos.length > 0) {
          setSelectedStudentId((current) => current || alunosData.alunos[0].id);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar dados."),
      )
      .finally(() => setLoading(false));
  }, []);

  const loadStudentWorkout = useCallback((studentId: string) => {
    if (!studentId) return;
    setLoadingTreino(true);
    setError("");
    apiFetch<{ treino: StudentWorkout | null }>(`/owner/alunos/${studentId}/treino`)
      .then((data) => {
        if (!data.treino) {
          setTitle("Treino personalizado");
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
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar treino."),
      )
      .finally(() => setLoadingTreino(false));
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentWorkout(selectedStudentId);
    }
  }, [selectedStudentId, loadStudentWorkout]);

  function addExercise(exercise: ExerciseCatalogItem) {
    if (drafts.some((item) => item.exerciseId === exercise.id)) {
      setError("Este exercício já está no treino.");
      return;
    }

    setError("");
    setDrafts((current) => [...current, emptyDraft(exercise, current.length + 1)]);
    setDraftMeta((current) => ({ ...current, [exercise.id]: exercise }));
  }

  function updateDraft(index: number, patch: Partial<WorkoutExerciseDraft>) {
    setDrafts((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    setSuccess("");
  }

  function removeDraft(index: number) {
    setDrafts((current) =>
      current
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, order: i + 1 })),
    );
    setSuccess("");
  }

  function moveDraft(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, i) => ({ ...item, order: i + 1 }));
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
            notes: notes.trim() || undefined,
            exercises: drafts,
          }),
        },
      );
      setSuccess(result.message);
      loadStudentWorkout(selectedStudentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar treino.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OwnerSectionPage
      title="Cadastro de Treino"
      description="Monte a ficha personalizada do aluno a partir do catálogo de exercícios. O aluno visualiza na aba Treino."
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

          <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 sm:p-5">
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
                    {aluno.nomeCompleto} • {aluno.planoModalidade}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Título do treino
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                Observações para o aluno
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex.: Aquecer 5 min na esteira antes de iniciar."
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base font-semibold text-white">Catálogo</h2>
                  <p className="mt-1 text-sm text-white/45">
                    {filteredCatalog.length} exercício(s) disponíveis
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
                    placeholder="Buscar exercício"
                    className="min-w-[180px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {filteredCatalog.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    {exercise.imageUrl ? (
                      <img
                        src={exercise.imageUrl}
                        alt={exercise.name}
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-white/40">
                        IMG
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-semibold text-white">{exercise.name}</p>
                      <p className="mt-0.5 text-xs text-white/45">
                        {exercise.muscleGroup}
                        {exercise.equipment ? ` • ${exercise.equipment}` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => addExercise(exercise)}
                        className="mt-2 rounded-md bg-[#e85d6f]/20 px-3 py-1.5 text-xs font-semibold text-[#f08a98] transition hover:bg-[#e85d6f]/30"
                      >
                        Adicionar ao treino
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4">
                <h2 className="m-0 text-base font-semibold text-white">
                  Ficha de {selectedStudent?.nomeCompleto ?? "aluno"}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {loadingTreino
                    ? "Carregando treino atual..."
                    : `${drafts.length} exercício(s) na ficha`}
                </p>
              </div>

              {drafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                  Selecione exercícios no catálogo para montar a aula do aluno.
                </div>
              ) : (
                <div className="space-y-4">
                  {drafts.map((draft, index) => {
                    const exercise = draftMeta[draft.exerciseId];
                    if (!exercise) return null;

                    return (
                      <div
                        key={`${draft.exerciseId}-${index}`}
                        className="rounded-xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="m-0 text-sm font-semibold text-white">
                              {index + 1}. {exercise.name}
                            </p>
                            <p className="mt-0.5 text-xs text-white/45">{exercise.muscleGroup}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveDraft(index, -1)}
                              className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDraft(index, 1)}
                              className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraft(index)}
                              className="rounded border border-red-400/20 px-2 py-1 text-xs text-red-300"
                            >
                              Remover
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <label className="text-xs text-white/50">
                            Séries
                            <input
                              type="number"
                              min={1}
                              value={draft.sets}
                              onChange={(e) =>
                                updateDraft(index, { sets: Number(e.target.value) || 1 })
                              }
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="text-xs text-white/50">
                            Repetições
                            <input
                              value={draft.reps}
                              onChange={(e) => updateDraft(index, { reps: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="text-xs text-white/50">
                            Carga
                            <input
                              value={draft.load}
                              onChange={(e) => updateDraft(index, { load: e.target.value })}
                              placeholder="Ex.: 20kg"
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="text-xs text-white/50">
                            Descanso (s)
                            <input
                              type="number"
                              min={0}
                              value={draft.restSeconds}
                              onChange={(e) =>
                                updateDraft(index, {
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
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || drafts.length === 0}
                  className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d44d5f] disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Publicar treino para o aluno"}
                </button>
              </div>
            </section>
          </div>
        </form>
      )}
    </OwnerSectionPage>
  );
}
