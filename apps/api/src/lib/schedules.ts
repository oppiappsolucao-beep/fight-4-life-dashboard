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
