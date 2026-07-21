import { useState } from "react";
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
  const [showInstructions, setShowInstructions] = useState(false);
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

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition ${
        done
          ? "border-emerald-400/35 bg-emerald-500/[0.07]"
          : "border-white/10 bg-black/30"
      }`}
    >
      {mediaUrl ? (
        <div className="relative aspect-[16/10] max-h-44 w-full overflow-hidden bg-black/40">
          <img
            src={mediaUrl}
            alt={item.exercise.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/80">
                #{index}
              </span>
              {regionBadge ? (
                <span className="rounded-full bg-[#e85d6f]/80 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                  {regionBadge}
                </span>
              ) : null}
            </div>
            <h4 className="m-0 mt-2 text-lg font-semibold leading-tight text-white">
              {item.exercise.name}
            </h4>
          </div>
        </div>
      ) : (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/70">
              #{index}
            </span>
            {regionBadge ? (
              <span className="rounded-full bg-[#e85d6f]/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[#f08a98]">
                {regionBadge}
              </span>
            ) : null}
          </div>
          <h4 className="m-0 mt-2 text-lg font-semibold text-white">{item.exercise.name}</h4>
        </div>
      )}

      <div className="p-4">
        <p className="m-0 text-sm text-white/50">
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
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
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "border border-white/10 bg-black/20 text-white/70 hover:border-[#e85d6f]/40"
                  }`}
                >
                  S{setNumber}
                </button>
              );
            })}
          </div>
          <p className="m-0 mt-2 text-xs text-white/45">
            {completedSets.length}/{item.sets} séries concluídas
          </p>
        </div>

        {item.notes ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
            {item.notes}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowInstructions((current) => !current)}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white/75"
        >
          <span>{showInstructions ? "Ocultar execução" : "Ver como executar"}</span>
          <span className="text-white/40">{showInstructions ? "−" : "+"}</span>
        </button>

        {showInstructions ? (
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            {item.exercise.instructions}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center">
      <p className="m-0 text-[0.6rem] uppercase tracking-wide text-white/40">{label}</p>
      <p className="m-0 mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
