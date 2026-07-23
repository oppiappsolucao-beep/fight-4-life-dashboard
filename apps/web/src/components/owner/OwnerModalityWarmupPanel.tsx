import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { ExerciseCatalogItem } from "../../types/workout";
import type { ModalityItem } from "../../types/modality";

interface WarmupDraft {
  exerciseId: string;
  order: number;
  sets: number;
  reps: string;
  load?: string;
  restSeconds?: number;
  notes?: string;
}

interface OwnerModalityWarmupPanelProps {
  modality: ModalityItem;
}

export default function OwnerModalityWarmupPanel({ modality }: OwnerModalityWarmupPanelProps) {
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [drafts, setDrafts] = useState<WarmupDraft[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ exercises: ExerciseCatalogItem[] }>("/owner/exercises"),
      apiFetch<{ modalidades: ModalityItem[] }>("/owner/modalidades"),
    ])
      .then(([exercisesData, modalidadesData]) => {
        setCatalog(exercisesData.exercises);
        const current = modalidadesData.modalidades.find((item) => item.id === modality.id);
        const warmup = (current?.warmupExercises ?? []) as WarmupDraft[];
        setDrafts(warmup);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar aquecimento."),
      )
      .finally(() => setLoading(false));
  }, [modality.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog
      .filter((item) => item.bodyRegion === "AQUECIMENTO" || item.phases.includes("INICIO"))
      .filter((item) => {
        if (!term) return true;
        return (
          item.name.toLowerCase().includes(term) ||
          item.muscleGroup.toLowerCase().includes(term)
        );
      });
  }, [catalog, search]);

  function addExercise(exercise: ExerciseCatalogItem) {
    if (drafts.some((item) => item.exerciseId === exercise.id)) return;
    setDrafts((current) => [
      ...current,
      {
        exerciseId: exercise.id,
        order: current.length + 1,
        sets: 3,
        reps: "12",
        restSeconds: 60,
      },
    ]);
    setSuccess("");
  }

  function removeDraft(exerciseId: string) {
    setDrafts((current) =>
      current
        .filter((item) => item.exerciseId !== exerciseId)
        .map((item, index) => ({ ...item, order: index + 1 })),
    );
  }

  async function saveWarmup() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/owner/modalidades/${modality.id}`, {
        method: "PATCH",
        body: JSON.stringify({ warmupExercises: drafts }),
      });
      setSuccess("Movimentos de aquecimento salvos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar aquecimento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/50">
        Carregando aquecimento...
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="m-0 text-sm font-semibold text-white">
        Aquecimento — {modality.name}
      </p>
      <p className="m-0 mt-1 text-sm text-white/50">
        Movimentos que o aluno verá na etapa &quot;Aquecimento&quot; do treino.
      </p>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar exercício de aquecimento..."
        className="mt-4 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
      />

      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        {filteredCatalog.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => addExercise(exercise)}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-left text-sm text-white/80 hover:border-[#e85d6f]/40"
          >
            <span>{exercise.name}</span>
            <span className="text-xs text-white/40">{exercise.muscleGroup}</span>
          </button>
        ))}
      </div>

      {drafts.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-white/45">
            Selecionados ({drafts.length})
          </p>
          {drafts.map((draft) => {
            const exercise = catalog.find((item) => item.id === draft.exerciseId);
            return (
              <div
                key={draft.exerciseId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2"
              >
                <span className="text-sm text-white">{exercise?.name ?? "Exercício"}</span>
                <button
                  type="button"
                  onClick={() => removeDraft(draft.exerciseId)}
                  className="rounded-md border border-red-400/25 px-2 py-1 text-xs text-red-200"
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={saveWarmup}
        disabled={saving}
        className="mt-4 rounded-xl bg-[#e85d6f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar aquecimento"}
      </button>
    </section>
  );
}
