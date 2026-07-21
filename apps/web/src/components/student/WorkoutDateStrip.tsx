import {
  formatWorkoutDateLabel,
  formatWorkoutDay,
  formatWorkoutMonthShort,
  formatWorkoutWeekdayShort,
  getWeekRange,
  getWorkoutCompletionStatus,
  isTodayWorkoutDate,
  type WorkoutCompletionStatus,
} from "../../lib/workout";
import type { WorkoutSummary } from "../../types/workout";

interface WorkoutDateStripProps {
  treinos: WorkoutSummary[];
  selectedDate: string;
  completionByDate: Record<string, WorkoutCompletionStatus>;
  onSelect: (workoutDate: string) => void;
}

export default function WorkoutDateStrip({
  treinos,
  selectedDate,
  completionByDate,
  onSelect,
}: WorkoutDateStripProps) {
  const week = getWeekRange();

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-3 backdrop-blur-md sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
            Seus treinos
          </p>
          <p className="m-0 mt-1 text-sm text-white/70">
            {treinos.length} data{treinos.length === 1 ? "" : "s"} • semana{" "}
            {formatWorkoutDateLabel(week.start)} a {formatWorkoutDateLabel(week.end)}
          </p>
        </div>
        <div className="hidden items-center gap-3 text-[0.65rem] text-white/45 sm:flex">
          <LegendDot tone="done" label="Concluído" />
          <LegendDot tone="partial" label="Em andamento" />
          <LegendDot tone="pending" label="Pendente" />
        </div>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {treinos.map((item) => {
          const selected = item.workoutDate === selectedDate;
          const status = completionByDate[item.workoutDate] ?? "pending";
          const today = isTodayWorkoutDate(item.workoutDate);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.workoutDate)}
              className={`relative min-w-[5.5rem] shrink-0 snap-start rounded-2xl border px-3 py-3 text-left transition ${
                selected
                  ? "border-[#e85d6f] bg-[#e85d6f]/15 shadow-[0_0_0_1px_rgba(232,93,111,0.35)]"
                  : "border-white/10 bg-black/25 hover:border-white/20"
              }`}
            >
              <StatusDot status={status} />
              <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
                {formatWorkoutWeekdayShort(item.workoutDate)}
              </p>
              <p className="m-0 mt-1 text-2xl font-semibold leading-none text-white">
                {formatWorkoutDay(item.workoutDate)}
              </p>
              <p className="m-0 mt-1 text-xs text-white/55">
                {formatWorkoutMonthShort(item.workoutDate)}
              </p>
              {today ? (
                <span className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/70">
                  Hoje
                </span>
              ) : (
                <p className="m-0 mt-2 truncate text-[0.65rem] text-white/40">
                  {item.exerciseCount} ex.
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LegendDot({ tone, label }: { tone: WorkoutCompletionStatus; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={tone} compact />
      {label}
    </span>
  );
}

function StatusDot({
  status,
  compact = false,
}: {
  status: WorkoutCompletionStatus;
  compact?: boolean;
}) {
  const colors = {
    done: "bg-emerald-400",
    partial: "bg-amber-400",
    pending: "bg-white/20",
  } as const;

  return (
    <span
      className={`${compact ? "relative" : "absolute right-2.5 top-2.5"} inline-flex h-2 w-2 rounded-full ${colors[status]}`}
      aria-hidden
    />
  );
}

export function readStoredCompletionStatus(
  studentId: string,
  workoutDate: string,
  exerciseCount: number,
): WorkoutCompletionStatus {
  if (typeof window === "undefined" || exerciseCount <= 0) return "pending";

  try {
    const raw = window.localStorage.getItem(
      `f4l-student-workout-done:${studentId}:${workoutDate}`,
    );
    if (!raw) return "pending";
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    const done = Object.values(parsed).filter(Boolean).length;
    return getWorkoutCompletionStatus(exerciseCount, done);
  } catch {
    return "pending";
  }
}
