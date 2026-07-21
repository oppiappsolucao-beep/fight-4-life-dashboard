export interface ScheduleSlot {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleGridEntry extends ScheduleSlot {
  id?: string;
  label: string;
  sublabel?: string;
  tone?: "modality" | "professor";
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const DEFAULT_WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export function emptyScheduleSlot(weekday = 1): ScheduleSlot {
  return { weekday, startTime: "08:00", endTime: "09:00" };
}

export function scheduleSlotKey(slot: ScheduleSlot): string {
  return `${slot.weekday}-${slot.startTime}-${slot.endTime}`;
}

export function scheduleSlotsEqual(a: ScheduleSlot, b: ScheduleSlot): boolean {
  return scheduleSlotKey(a) === scheduleSlotKey(b);
}

export function weekdayFromDateInput(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTimeRange(slot: ScheduleSlot): string {
  return `${slot.startTime} – ${slot.endTime}`;
}

export function groupEntriesByWeekday(entries: ScheduleGridEntry[]): ScheduleGridEntry[][] {
  return WEEKDAY_SHORT.map((_, weekday) =>
    entries
      .filter((entry) => entry.weekday === weekday)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
  );
}

export function buildTimeRows(entries: ScheduleGridEntry[]): string[] {
  if (entries.length === 0) return ["08:00", "09:00", "10:00", "11:00", "18:00", "19:00", "20:00"];

  const minutes = new Set<number>();
  for (const entry of entries) {
    minutes.add(timeToMinutes(entry.startTime));
    minutes.add(timeToMinutes(entry.endTime));
  }

  return Array.from(minutes)
    .sort((a, b) => a - b)
    .map((value) => {
      const hours = Math.floor(value / 60)
        .toString()
        .padStart(2, "0");
      const mins = (value % 60).toString().padStart(2, "0");
      return `${hours}:${mins}`;
    });
}
