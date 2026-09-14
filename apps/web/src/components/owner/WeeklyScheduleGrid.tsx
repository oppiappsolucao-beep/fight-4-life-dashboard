import {
  WEEKDAY_SHORT,
  buildTimeRows,
  groupEntriesByWeekday,
  professorEntryClassName,
  type ScheduleGridEntry,
} from "../../lib/schedule";

interface WeeklyScheduleGridProps {
  title: string;
  entries: ScheduleGridEntry[];
  emptyMessage?: string;
  filterModalityId?: string | null;
  filterLabel?: string;
}

export default function WeeklyScheduleGrid({
  title,
  entries,
  emptyMessage = "Cadastre horários para montar a grade semanal.",
  filterModalityId = null,
  filterLabel,
}: WeeklyScheduleGridProps) {
  const visibleEntries = filterModalityId
    ? entries.filter(
        (entry) => entry.modalityId === filterModalityId || entry.label === filterLabel,
      )
    : entries;

  const grouped = groupEntriesByWeekday(visibleEntries);
  const timeRows = buildTimeRows(visibleEntries);

  if (visibleEntries.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
        <p className="m-0 font-semibold text-slate-600">{title}</p>
        <p className="m-0 mt-2">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="m-0 text-sm font-semibold text-[#2E496C]">{title}</p>
        {filterModalityId ? (
          <p className="m-0 mt-1 text-xs text-slate-400">Mostrando apenas a categoria selecionada.</p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-white">
              <th className="px-2 py-2 font-semibold text-slate-400">Horário</th>
              {WEEKDAY_SHORT.map((label) => (
                <th key={label} className="px-2 py-2 font-semibold text-slate-600">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeRows.map((timeLabel) => (
              <tr key={timeLabel} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-400">{timeLabel}</td>
                {grouped.map((dayEntries, weekday) => {
                  const matches = dayEntries.filter((entry) => entry.startTime === timeLabel);

                  return (
                    <td key={`${weekday}-${timeLabel}`} className="px-1.5 py-1.5">
                      <div className="space-y-1">
                        {matches.map((entry, index) => (
                          <div
                            key={`${entry.label}-${entry.startTime}-${index}`}
                            className={`rounded-md px-2 py-1 ${
                              entry.colorClass ??
                              (entry.tone === "professor"
                                ? professorEntryClassName()
                                : "bg-[#5B7595]/15 text-[#A9BBD5]")
                            }`}
                          >
                            <p className="m-0 truncate text-[0.7rem] font-semibold">{entry.label}</p>
                            {entry.sublabel ? (
                              <p className="m-0 mt-0.5 truncate text-[0.6rem] opacity-80">
                                {entry.sublabel}
                              </p>
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
