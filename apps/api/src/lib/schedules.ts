export interface ScheduleSlotInput {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleSlotRecord extends ScheduleSlotInput {
  id?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeScheduleSlots(slots: ScheduleSlotInput[]): ScheduleSlotInput[] {
  return slots
    .filter(
      (slot) =>
        slot.weekday >= 0 &&
        slot.weekday <= 6 &&
        isValidTime(slot.startTime) &&
        isValidTime(slot.endTime) &&
        timeToMinutes(slot.startTime) < timeToMinutes(slot.endTime),
    )
    .sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
}

export function serializeScheduleSlot(slot: {
  weekday: number;
  startTime: string;
  endTime: string;
  id?: string;
}) {
  return {
    id: slot.id,
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
  };
}

export function weekdayFromDateInput(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatDateInput(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMonthInput(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function currentMonthInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function listDatesInMonth(year: number, month: number, weekdays: number[]): string[] {
  if (weekdays.length === 0) return [];
  const weekdaySet = new Set(weekdays);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const classDate = formatDateInput(year, month, day);
    if (weekdaySet.has(weekdayFromDateInput(classDate))) {
      dates.push(classDate);
    }
  }

  return dates;
}

export function scheduleOccurrenceKey(classDate: string, startTime: string, endTime: string): string {
  return `${classDate}|${startTime}|${endTime}`;
}
