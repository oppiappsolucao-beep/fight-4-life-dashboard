export type WorkoutPhase = "INICIO" | "MEIO" | "FIM";

export type MeioTreinoRegion = "SUPERIOR" | "INFERIOR" | "CARDIO";

export type ExerciseBodyRegion =
  | MeioTreinoRegion
  | "AQUECIMENTO"
  | "ALONGAMENTO"
  | "GERAL";

export const WORKOUT_PHASES: Array<{
  id: WorkoutPhase;
  label: string;
  description: string;
}> = [
  {
    id: "INICIO",
    label: "Começo",
    description: "Aquecimento, mobilidade e cardio leve",
  },
  {
    id: "MEIO",
    label: "Meio",
    description: "Parte principal — escolha superior, inferior ou cardio",
  },
  {
    id: "FIM",
    label: "Fim",
    description: "Alongamento e volta à calma",
  },
];

export const MEIO_TREINO_REGIONS: Array<{
  id: MeioTreinoRegion;
  label: string;
}> = [
  { id: "SUPERIOR", label: "Treino superior" },
  { id: "INFERIOR", label: "Treino inferior" },
  { id: "CARDIO", label: "Cardio" },
];

export function bodyRegionLabel(region: ExerciseBodyRegion): string {
  const labels: Record<ExerciseBodyRegion, string> = {
    SUPERIOR: "Superior",
    INFERIOR: "Inferior",
    CARDIO: "Cardio",
    AQUECIMENTO: "Aquecimento",
    ALONGAMENTO: "Alongamento",
    GERAL: "Geral",
  };
  return labels[region] ?? region;
}

export function matchesCatalogFilter(
  exercise: { phases: string[]; bodyRegion: ExerciseBodyRegion },
  phase: WorkoutPhase,
  meioRegion: MeioTreinoRegion,
): boolean {
  if (!exercise.phases.includes(phase)) {
    return false;
  }

  if (phase === "MEIO") {
    return exercise.bodyRegion === meioRegion;
  }

  return true;
}

export function workoutPhaseLabel(phase: WorkoutPhase): string {
  return WORKOUT_PHASES.find((item) => item.id === phase)?.label ?? phase;
}

export function todayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWorkoutDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatWorkoutWeekdayShort(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });
  return weekday.replace(".", "").slice(0, 3);
}

export function formatWorkoutDay(value: string): string {
  return value.split("-")[2] ?? "";
}

export function formatWorkoutMonthShort(value: string): string {
  const month = Number(value.split("-")[1]);
  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return names[month - 1] ?? "";
}

export function isTodayWorkoutDate(value: string): boolean {
  return value === todayDateInputValue();
}

export function workoutDoneStorageKey(studentId: string, workoutDate: string): string {
  return `f4l-student-workout-done:${studentId}:${workoutDate}`;
}

export type WorkoutCompletionStatus = "done" | "partial" | "pending";

export function getWorkoutCompletionStatus(
  total: number,
  done: number,
): WorkoutCompletionStatus {
  if (total <= 0 || done <= 0) return "pending";
  if (done >= total) return "done";
  return "partial";
}

export function isExerciseComplete(item: { sets: number; completedSets?: number[] }): boolean {
  return (item.completedSets?.length ?? 0) >= item.sets;
}

export function countWorkoutSetProgress(
  exercises: Array<{ sets: number; completedSets?: number[] }>,
): {
  completedSets: number;
  totalSets: number;
  completedExercises: number;
  totalExercises: number;
} {
  let completedSets = 0;
  let totalSets = 0;
  let completedExercises = 0;

  for (const exercise of exercises) {
    totalSets += exercise.sets;
    completedSets += Math.min(exercise.completedSets?.length ?? 0, exercise.sets);
    if (isExerciseComplete(exercise)) {
      completedExercises += 1;
    }
  }

  return {
    completedSets,
    totalSets,
    completedExercises,
    totalExercises: exercises.length,
  };
}

export function workoutSetProgressPercent(
  exercises: Array<{ sets: number; completedSets?: number[] }>,
): number {
  const { completedSets, totalSets } = countWorkoutSetProgress(exercises);
  if (totalSets <= 0) return 0;
  return Math.round((completedSets / totalSets) * 100);
}

export function toggleCompletedSet(
  current: number[],
  setNumber: number,
  maxSets: number,
): number[] {
  if (setNumber < 1 || setNumber > maxSets) return current;
  const next = new Set(current);
  if (next.has(setNumber)) {
    next.delete(setNumber);
  } else {
    next.add(setNumber);
  }
  return Array.from(next).sort((a, b) => a - b);
}

export function sortWorkoutsAscending<T extends { workoutDate: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));
}

export function pickDefaultWorkoutDate<T extends { workoutDate: string }>(items: T[]): string {
  if (items.length === 0) return "";

  const sorted = sortWorkoutsAscending(items);
  const today = todayDateInputValue();

  if (sorted.some((item) => item.workoutDate === today)) {
    return today;
  }

  const upcoming = sorted.find((item) => item.workoutDate >= today);
  return upcoming?.workoutDate ?? sorted[sorted.length - 1].workoutDate;
}

export function getWeekRange(reference = new Date()): { start: string; end: string } {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatWorkoutDateIso(start),
    end: formatWorkoutDateIso(end),
  };
}

export function formatWorkoutDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isWorkoutDateInRange(
  workoutDate: string,
  start: string,
  end: string,
): boolean {
  return workoutDate >= start && workoutDate <= end;
}

export function groupExercisesByPhase<T extends { phase: WorkoutPhase; order: number }>(
  exercises: T[],
): Record<WorkoutPhase, T[]> {
  const grouped: Record<WorkoutPhase, T[]> = {
    INICIO: [],
    MEIO: [],
    FIM: [],
  };

  for (const phase of WORKOUT_PHASES) {
    grouped[phase.id] = exercises
      .filter((item) => item.phase === phase.id)
      .sort((a, b) => a.order - b.order);
  }

  return grouped;
}

export function groupMeioExercisesByRegion<
  T extends { order: number; exercise: { bodyRegion: ExerciseBodyRegion } },
>(exercises: T[]): Array<{ region: MeioTreinoRegion; label: string; items: T[] }> {
  const buckets = new Map<MeioTreinoRegion, T[]>();

  for (const item of exercises) {
    const region = item.exercise.bodyRegion;
    if (region !== "SUPERIOR" && region !== "INFERIOR" && region !== "CARDIO") {
      continue;
    }
    const current = buckets.get(region) ?? [];
    current.push(item);
    buckets.set(region, current);
  }

  return MEIO_TREINO_REGIONS.filter((entry) => buckets.has(entry.id)).map((entry) => ({
    region: entry.id,
    label: entry.label,
    items: (buckets.get(entry.id) ?? []).sort((a, b) => a.order - b.order),
  }));
}

export function countPhaseExercises(
  grouped: Record<WorkoutPhase, unknown[]>,
): Record<WorkoutPhase, number> {
  return {
    INICIO: grouped.INICIO.length,
    MEIO: grouped.MEIO.length,
    FIM: grouped.FIM.length,
  };
}
