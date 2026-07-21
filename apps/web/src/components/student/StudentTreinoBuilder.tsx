import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  MEIO_TREINO_REGIONS,
  WORKOUT_PHASES,
  bodyRegionLabel,
  formatWorkoutDateLabel,
  matchesCatalogFilter,
  type MeioTreinoRegion,
  type WorkoutPhase,
} from "../../lib/workout";
import type {
  ExerciseCatalogItem,
  StudentWorkout,
  WorkoutExerciseDraft,
} from "../../types/workout";

interface StudentTreinoBuilderProps {
  studentId: string;
  workoutDate: string;
  initialTreino?: StudentWorkout | null;
  onSaved: (treino: StudentWorkout) => void;
  onCancel?: () => void;
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

export default function StudentTreinoBuilder({
  studentId,
  workoutDate,
  initialTreino,
  onSaved,
  onCancel,
}: StudentTreinoBuilderProps) {
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [activePhase, setActivePhase] = useState<WorkoutPhase>("INICIO");
  const [meioRegion, setMeioRegion] = useState<MeioTreinoRegion>("SUPERIOR");
  const [title, setTitle] = useState(
    initialTreino?.title ?? `Meu treino ${formatWorkoutDateLabel(workoutDate)}`,
  );
  const [drafts, setDrafts] = useState<WorkoutExerciseDraft[]>(
    initialTreino?.exercises.map((item) => ({
      exerciseId: item.exercise.id,
      phase: item.phase,
      order: item.order,
      sets: item.sets,
      reps: item.reps,
      load: item.load ?? "",
      restSeconds: item.restSeconds ?? 60,
      notes: item.notes ?? "",
    })) ?? [],
  );
  const [draftMeta, setDraftMeta] = useState<Record<string, ExerciseCatalogItem>>(
    initialTreino
      ? Object.fromEntries(initialTreino.exercises.map((item) => [item.exercise.id, item.exercise]))
      : {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoadingCatalog(true);
    apiFetch<{ exercises: ExerciseCatalogItem[] }>("/student/exercises", {}, studentId)
      .then((data) => setCatalog(data.exercises))
      .catch(() => setError("Erro ao carregar exercícios."))
      .finally(() => setLoadingCatalog(false));
  }, [studentId]);

  const phaseCatalog = useMemo(() => {
    return catalog.filter((item) => matchesCatalogFilter(item, activePhase, meioRegion));
  }, [catalog, activePhase, meioRegion]);

  const phaseDrafts = drafts.filter((item) => item.phase === activePhase);

  function addExercise(exercise: ExerciseCatalogItem) {
    if (drafts.some((item) => item.phase === activePhase && item.exerciseId === exercise.id)) {
      setError("Este exercício já está nesta etapa.");
      return;
    }
    setError("");
    const order = phaseDrafts.length + 1;
    setDrafts((current) => [...current, emptyDraft(exercise, activePhase, order)]);
    setDraftMeta((current) => ({ ...current, [exercise.id]: exercise }));
  }

  function removeDraft(phase: WorkoutPhase, order: number) {
    setDrafts((current) => {
      let nextOrder = 1;
      return current
        .filter((item) => !(item.phase === phase && item.order === order))
        .map((item) => {
          if (item.phase !== phase) return item;
          const next = { ...item, order: nextOrder };
          nextOrder += 1;
          return next;
        });
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (drafts.length === 0) {
      setError("Adicione ao menos um exercício.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await apiFetch<{ treino: StudentWorkout; message: string }>(
        "/student/treino",
        {
          method: "PUT",
          body: JSON.stringify({
            title: title.trim(),
            workoutDate,
            exercises: drafts,
          }),
        },
        studentId,
      );
      onSaved(result.treino);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar treino.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
          Criar treino • {formatWorkoutDateLabel(workoutDate)}
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
          required
        />
      </section>

      <div className="grid grid-cols-3 gap-2">
        {WORKOUT_PHASES.map((phase) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => setActivePhase(phase.id)}
            className={`rounded-xl px-2 py-3 text-left ${
              activePhase === phase.id
                ? "bg-[#e85d6f] text-white"
                : "bg-white/[0.04] text-white/70"
            }`}
          >
            <p className="m-0 text-[0.65rem] font-semibold uppercase">{phase.label}</p>
            <p className="m-0 mt-1 text-xs opacity-80">
              {drafts.filter((item) => item.phase === phase.id).length} ex.
            </p>
          </button>
        ))}
      </div>

      {activePhase === "MEIO" ? (
        <div className="flex flex-wrap gap-2">
          {MEIO_TREINO_REGIONS.map((region) => (
            <button
              key={region.id}
              type="button"
              onClick={() => setMeioRegion(region.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                meioRegion === region.id
                  ? "bg-[#e85d6f] text-white"
                  : "border border-white/15 text-white/70"
              }`}
            >
              {region.label}
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="m-0 mb-3 text-sm font-semibold text-white">Adicionar exercícios</p>
        {loadingCatalog ? (
          <p className="m-0 text-sm text-white/45">Carregando catálogo...</p>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {phaseCatalog.map((exercise) => (
              <div
                key={exercise.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-medium text-white">{exercise.name}</p>
                  <p className="m-0 text-xs text-white/45">
                    {exercise.muscleGroup} • {bodyRegionLabel(exercise.bodyRegion)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addExercise(exercise)}
                  className="shrink-0 rounded-lg bg-[#e85d6f]/20 px-3 py-1.5 text-xs font-semibold text-[#f08a98]"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {phaseDrafts.length > 0 ? (
        <section className="space-y-2">
          <p className="m-0 px-1 text-sm font-semibold text-white">
            Ficha — {WORKOUT_PHASES.find((phase) => phase.id === activePhase)?.label}
          </p>
          {phaseDrafts.map((draft) => {
            const exercise = draftMeta[draft.exerciseId];
            if (!exercise) return null;
            return (
              <div
                key={`${draft.phase}-${draft.exerciseId}-${draft.order}`}
                className="rounded-xl border border-white/10 bg-black/25 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-white">
                    {draft.order}. {exercise.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.phase, draft.order)}
                    className="text-xs text-red-300"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-white/50">
                    Séries
                    <input
                      type="number"
                      min={1}
                      value={draft.sets}
                      onChange={(e) =>
                        setDrafts((current) =>
                          current.map((item) =>
                            item.phase === draft.phase && item.order === draft.order
                              ? { ...item, sets: Number(e.target.value) || 1 }
                              : item,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-white/50">
                    Reps
                    <input
                      value={draft.reps}
                      onChange={(e) =>
                        setDrafts((current) =>
                          current.map((item) =>
                            item.phase === draft.phase && item.order === draft.order
                              ? { ...item, reps: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving || drafts.length === 0}
          className="flex-1 rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar meu treino"}
        </button>
      </div>
    </form>
  );
}
