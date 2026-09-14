import { useEffect, useState } from "react";
import { bodyRegionLabel, isExerciseComplete } from "../../lib/workout";
import type { WorkoutExerciseItem } from "../../types/workout";

interface WorkoutExerciseCardProps {
  item: WorkoutExerciseItem;
  index: number;
  mediaUrl: string | null;
  completedSets: number[];
  onToggleSet: (setNumber: number) => void;
}

export default function WorkoutExerciseCard({
  item,
  index,
  mediaUrl,
  completedSets,
  onToggleSet,
}: WorkoutExerciseCardProps) {
  const [showExecution, setShowExecution] = useState(false);
  const done = isExerciseComplete({ sets: item.sets, completedSets });

  const regionBadge =
    item.phase === "MEIO" &&
    (item.exercise.bodyRegion === "SUPERIOR" ||
      item.exercise.bodyRegion === "INFERIOR" ||
      item.exercise.bodyRegion === "CARDIO")
      ? bodyRegionLabel(item.exercise.bodyRegion)
      : item.exercise.bodyRegion === "AQUECIMENTO" ||
          item.exercise.bodyRegion === "ALONGAMENTO"
        ? bodyRegionLabel(item.exercise.bodyRegion)
        : null;

  useEffect(() => {
    if (!showExecution) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowExecution(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showExecution]);

  return (
    <>
      <article
        className={`overflow-hidden rounded-2xl border transition ${
          done
            ? "border-emerald-400/35 bg-emerald-500/[0.07]"
            : "border-slate-200 bg-slate-100"
        }`}
      >
        {mediaUrl ? (
          <button
            type="button"
            onClick={() => setShowExecution(true)}
            className="group relative block w-full bg-black/50 text-left"
            aria-label={`Ver execução de ${item.exercise.name}`}
          >
            <div className="relative mx-auto flex aspect-square max-h-56 w-full items-center justify-center overflow-hidden sm:max-h-64">
              <img
                src={mediaUrl}
                alt={item.exercise.name}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700">
                    #{index}
                  </span>
                  {regionBadge ? (
                    <span className="rounded-full bg-[#5B7595]/80 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                      {regionBadge}
                    </span>
                  ) : null}
                </div>
                <h4 className="m-0 mt-2 text-lg font-semibold leading-tight text-[#2E496C]">
                  {item.exercise.name}
                </h4>
                <p className="m-0 mt-1 text-xs font-medium text-[#A9BBD5] opacity-90 group-hover:opacity-100">
                  Toque para ver o movimento completo
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
                #{index}
              </span>
              {regionBadge ? (
                <span className="rounded-full bg-[#5B7595]/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[#A9BBD5]">
                  {regionBadge}
                </span>
              ) : null}
            </div>
            <h4 className="m-0 mt-2 text-lg font-semibold text-[#2E496C]">{item.exercise.name}</h4>
          </div>
        )}

        <div className="p-4">
          <p className="m-0 text-sm text-slate-500">
            {item.exercise.muscleGroup}
            {item.exercise.equipment ? ` • ${item.exercise.equipment}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <Metric label="Séries" value={String(item.sets)} />
            <Metric label="Reps" value={item.reps} />
            <Metric label="Carga" value={item.load || "—"} />
            <Metric label="Pausa" value={item.restSeconds ? `${item.restSeconds}s` : "—"} />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Marcar séries feitas
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: item.sets }, (_, idx) => {
                const setNumber = idx + 1;
                const checked = completedSets.includes(setNumber);
                return (
                  <button
                    key={setNumber}
                    type="button"
                    onClick={() => onToggleSet(setNumber)}
                    className={`min-w-[3rem] rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      checked
                        ? "bg-emerald-500/20 text-emerald-700"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-[#5B7595]/40"
                    }`}
                  >
                    S{setNumber}
                  </button>
                );
              })}
            </div>
            <p className="m-0 mt-2 text-xs text-slate-400">
              {completedSets.length}/{item.sets} séries concluídas
            </p>
          </div>

          {item.notes ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {item.notes}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowExecution(true)}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#5B7595]/35 bg-[#5B7595]/10 px-3 py-2.5 text-left text-sm font-medium text-[#A9BBD5] transition hover:bg-[#5B7595]/20"
          >
            <span>Ver como executar</span>
            <span className="text-[#5B7595]">↗</span>
          </button>
        </div>
      </article>

      {showExecution ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Execução: ${item.exercise.name}`}
          onClick={() => setShowExecution(false)}
        >
          <div
            className="flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#0f1724] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#5B7595]">
                  Como executar
                </p>
                <h3 className="m-0 mt-1 truncate text-base font-semibold text-[#2E496C] sm:text-lg">
                  {item.exercise.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExecution(false)}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:text-[#2E496C]"
              >
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {mediaUrl ? (
                <div className="flex items-center justify-center bg-black px-3 py-4 sm:px-5 sm:py-5">
                  <img
                    src={mediaUrl}
                    alt={`Movimento: ${item.exercise.name}`}
                    className="max-h-[min(52vh,420px)] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="border-b border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  Sem animação disponível para este exercício.
                </div>
              )}

              <div className="space-y-3 px-4 py-4">
                <p className="m-0 text-sm text-slate-500">
                  {item.exercise.muscleGroup}
                  {item.exercise.equipment ? ` • ${item.exercise.equipment}` : ""}
                </p>
                <p className="m-0 text-sm leading-relaxed text-slate-700">
                  {item.exercise.instructions?.trim()
                    ? item.exercise.instructions
                    : "Siga a animação e mantenha a postura controlada em todo o movimento."}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
      <p className="m-0 text-[0.6rem] uppercase tracking-wide text-[#2E496C]/40">{label}</p>
      <p className="m-0 mt-1 truncate text-sm font-semibold text-[#2E496C]">{value}</p>
    </div>
  );
}
