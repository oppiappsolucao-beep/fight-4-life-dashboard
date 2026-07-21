import {
  WEEKDAY_SHORT,
  buildTimeRows,
  groupEntriesByWeekday,
  timeToMinutes,
  type ScheduleGridEntry,
} from "../../lib/schedule";

interface WeeklyScheduleGridProps {
  title: string;
  entries: ScheduleGridEntry[];
  emptyMessage?: string;
}

export default function WeeklyScheduleGrid({
  title,
  entries,
  emptyMessage = "Cadastre horários para montar a grade semanal.",
}: WeeklyScheduleGridProps) {
  const grouped = groupEntriesByWeekday(entries);
  const timeRows = buildTimeRows(entries);

  if (entries.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
        <p className="m-0 font-semibold text-white/70">{title}</p>
        <p className="m-0 mt-2">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="m-0 text-sm font-semibold text-white">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-3 py-2 font-semibold text-white/45">Horário</th>
              {WEEKDAY_SHORT.map((label) => (
                <th key={label} className="px-3 py-2 font-semibold text-white/70">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeRows.map((timeLabel) => (
              <tr key={timeLabel} className="border-b border-white/5 align-top">
                <td className="whitespace-nowrap px-3 py-3 font-medium text-white/45">{timeLabel}</td>
                {grouped.map((dayEntries, weekday) => {
                  const matches = dayEntries.filter((entry) => {
                    const start = timeToMinutes(entry.startTime);
                    const end = timeToMinutes(entry.endTime);
                    const row = timeToMinutes(timeLabel);
                    return row >= start && row < end;
                  });

                  return (
                    <td key={`${weekday}-${timeLabel}`} className="px-2 py-2">
                      <div className="space-y-1">
                        {matches.map((entry, index) => (
                          <div
                            key={`${entry.label}-${index}`}
                            className={`rounded-lg px-2 py-1.5 ${
                              entry.tone === "professor"
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-[#e85d6f]/15 text-[#f08a98]"
                            }`}
                          >
                            <p className="m-0 font-semibold">{entry.label}</p>
                            {entry.sublabel ? (
                              <p className="m-0 mt-0.5 text-[0.65rem] opacity-80">{entry.sublabel}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
