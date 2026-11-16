import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { ExerciseCatalogItem } from "../../types/workout";
import type { ModalityItem } from "../../types/modality";

interface WarmupDraft {
  key: string;
  exerciseId: string;
  customName: string;
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
        const warmup = current?.warmupExercises ?? [];
        setDrafts(
          warmup.map((item, index) => ({
            key: `${item.exerciseId ?? "custom"}-${item.order}-${index}`,
            exerciseId: item.exerciseId ?? "",
            customName: item.customName ?? "",
            order: item.order ?? index + 1,
            sets: item.sets,
            reps: item.reps ?? "12",
            load: item.load ?? "",
            restSeconds: item.restSeconds ?? 60,
            notes: item.notes ?? "",
          })),
        );
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
        key: exercise.id,
        exerciseId: exercise.id,
        customName: "",
        order: current.length + 1,
        sets: 3,
        reps: "12",
        restSeconds: 60,
      },
    ]);
    setSuccess("");
  }

  function removeDraft(key: string) {
    setDrafts((current) =>
      current
        .filter((item) => item.key !== key)
        .map((item, index) => ({ ...item, order: index + 1 })),
    );
  }

  function updateDraft(key: string, patch: Partial<WarmupDraft>) {
    setDrafts((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
    setSuccess("");
  }

  async function saveWarmup() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/owner/modalidades/${modality.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          warmupExercises: drafts.map((item, index) => ({
            ...(item.exerciseId ? { exerciseId: item.exerciseId } : {}),
            ...(item.customName.trim() ? { customName: item.customName.trim() } : {}),
            order: index + 1,
            sets: item.sets,
            reps: item.reps,
            load: item.load,
            restSeconds: item.restSeconds,
            notes: item.notes,
          })),
        }),
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando aquecimento...
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="m-0 text-sm font-semibold text-[#2E496C]">
        Aquecimento — {modality.name}
      </p>
      <p className="m-0 mt-1 text-sm text-slate-500">
        Movimentos desta modalidade. Dá para alterar o nome, as séries e a ordem depois de salvar. O aluno só vê o aquecimento quando a aula tiver vídeo.
      </p>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar exercício de aquecimento..."
        className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
      />

      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        {filteredCatalog.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => addExercise(exercise)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:border-[#5B7595]/40"
          >
            <span>{exercise.name}</span>
            <span className="text-xs text-[#2E496C]/40">{exercise.muscleGroup}</span>
          </button>
        ))}
      </div>

      {drafts.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Selecionados ({drafts.length})
          </p>
          {drafts.map((draft) => {
            const exercise = catalog.find((item) => item.id === draft.exerciseId);
            const label = draft.customName || exercise?.name || "Movimento";
            return (
              <div
                key={draft.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  {draft.exerciseId ? (
                    <span className="text-sm text-[#2E496C]">{label}</span>
                  ) : (
                    <input
                      value={draft.customName}
                      aria-label="Nome do movimento"
                      onChange={(event) =>
                        updateDraft(draft.key, { customName: event.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-[#2E496C]"
                    />
                  )}
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  Séries
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={draft.sets}
                    onChange={(event) =>
                      updateDraft(draft.key, { sets: Number(event.target.value) || 1 })
                    }
                    className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-[#2E496C]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeDraft(draft.key)}
                  className="rounded-md border border-red-400/25 px-2 py-1 text-xs text-red-700"
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
        className="mt-4 rounded-xl bg-[#5B7595] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar aquecimento"}
      </button>
    </section>
  );
}
