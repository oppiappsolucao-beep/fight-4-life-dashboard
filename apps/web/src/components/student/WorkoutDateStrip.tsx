import {
  formatWorkoutDateLabel,
  formatWorkoutDay,
  formatWorkoutMonthShort,
  formatWorkoutWeekdayShort,
  getWeekRange,
  isTodayWorkoutDate,
  listDatesInWeekForWeekdays,
  pickDefaultWorkoutDate,
  type WorkoutCompletionStatus,
} from "../../lib/workout";
import { useEffect, useMemo, useState } from "react";
import type { WorkoutSummary } from "../../types/workout";

interface WorkoutDateStripProps {
  treinos: WorkoutSummary[];
  selectedDate: string;
  completionByDate: Record<string, WorkoutCompletionStatus>;
  onSelect: (workoutDate: string) => void;
  onCreateDate?: (workoutDate: string) => void;
  scheduleWeekdays?: number[];
}

export default function WorkoutDateStrip({
  treinos,
  selectedDate,
  completionByDate,
  onSelect,
  onCreateDate,
  scheduleWeekdays,
}: WorkoutDateStripProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    setWeekOffset(0);
  }, [scheduleWeekdays?.join(",")]);

  const weekReference = useMemo(() => {
    const reference = new Date();
    reference.setHours(12, 0, 0, 0);
    reference.setDate(reference.getDate() + weekOffset * 7);
    return reference;
  }, [weekOffset]);

  const week = getWeekRange(weekReference);
  const weekScheduleDates =
    scheduleWeekdays && scheduleWeekdays.length > 0
      ? listDatesInWeekForWeekdays(scheduleWeekdays, weekReference)
      : null;

  function shiftWeek(delta: number) {
    if (!scheduleWeekdays?.length) return;

    const nextOffset = weekOffset + delta;
    const reference = new Date();
    reference.setHours(12, 0, 0, 0);
    reference.setDate(reference.getDate() + nextOffset * 7);
    const nextDates = listDatesInWeekForWeekdays(scheduleWeekdays, reference);

    setWeekOffset(nextOffset);
    if (nextDates.length === 0) return;

    onSelect(
      pickDefaultWorkoutDate(nextDates.map((workoutDate) => ({ workoutDate }))),
    );
  }

  const displayTreinos = weekScheduleDates
    ? weekScheduleDates.map((workoutDate) => {
        const existing = treinos.find((item) => item.workoutDate === workoutDate);
        return (
          existing ?? {
            id: workoutDate,
            workoutDate,
            title: "",
            updatedAt: workoutDate,
            source: "OWNER" as const,
            exerciseCount: 0,
          }
        );
      })
    : treinos;

  const allowCreateDate = Boolean(onCreateDate) && !weekScheduleDates;

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-3 backdrop-blur-md sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
            Seus treinos
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {weekScheduleDates ? (
              <>
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-sm text-white/75 transition hover:border-white/30 hover:text-white"
                  aria-label="Semana anterior"
                >
                  ←
                </button>
                <p className="m-0 min-w-0 text-sm text-white/70">
                  {displayTreinos.length} dia{displayTreinos.length === 1 ? "" : "s"} •{" "}
                  {formatWorkoutDateLabel(week.start)} a {formatWorkoutDateLabel(week.end)}
                  {weekOffset !== 0 ? (
                    <button
                      type="button"
                      onClick={() => shiftWeek(-weekOffset)}
                      className="ml-2 text-xs font-semibold text-[#f08a98] hover:text-[#e85d6f]"
                    >
                      Hoje
                    </button>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-sm text-white/75 transition hover:border-white/30 hover:text-white"
                  aria-label="Próxima semana"
                >
                  →
                </button>
              </>
            ) : (
              <p className="m-0 text-sm text-white/70">
                {treinos.length} data{treinos.length === 1 ? "" : "s"} • semana{" "}
                {formatWorkoutDateLabel(week.start)} a {formatWorkoutDateLabel(week.end)}
              </p>
            )}
          </div>
        </div>
        <div className="hidden items-center gap-3 text-[0.65rem] text-white/45 sm:flex">
          <LegendDot tone="done" label="Concluído" />
          <LegendDot tone="partial" label="Em andamento" />
          <LegendDot tone="pending" label="Pendente" />
        </div>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!weekScheduleDates &&
        selectedDate &&
        !displayTreinos.some((item) => item.workoutDate === selectedDate) ? (
          <button
            type="button"
            onClick={() => onSelect(selectedDate)}
            className="relative min-w-[5.5rem] shrink-0 snap-start rounded-2xl border border-[#e85d6f] bg-[#e85d6f]/15 px-3 py-3 text-left shadow-[0_0_0_1px_rgba(232,93,111,0.35)]"
          >
            <StatusDot status="pending" />
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
              {formatWorkoutWeekdayShort(selectedDate)}
            </p>
            <p className="m-0 mt-1 text-2xl font-semibold leading-none text-white">
              {formatWorkoutDay(selectedDate)}
            </p>
            <p className="m-0 mt-1 text-xs text-white/55">
              {formatWorkoutMonthShort(selectedDate)}
            </p>
            <span className="mt-2 inline-flex rounded-full border border-dashed border-white/25 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/60">
              Nova
            </span>
          </button>
        ) : null}
        {displayTreinos.map((item) => {
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
              ) : item.source === "STUDENT" ? (
                <span className="mt-2 inline-flex rounded-full bg-[#e85d6f]/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-[#f08a98]">
                  Meu
                </span>
              ) : (
                <p className="m-0 mt-2 truncate text-[0.65rem] text-white/40">
                  {item.exerciseCount} ex.
                </p>
              )}
            </button>
          );
        })}
        {allowCreateDate ? (
          <label className="relative min-w-[5.5rem] shrink-0 snap-start rounded-2xl border border-dashed border-white/20 bg-black/15 px-3 py-3 text-left">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
              Nova
            </span>
            <span className="mt-3 block text-2xl font-semibold text-[#e85d6f]">+</span>
            <input
              type="date"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => {
                if (event.target.value && onCreateDate) onCreateDate(event.target.value);
              }}
            />
          </label>
        ) : null}
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
  _studentId: string,
  _workoutDate: string,
  _exerciseCount: number,
): WorkoutCompletionStatus {
  return "pending";
}
