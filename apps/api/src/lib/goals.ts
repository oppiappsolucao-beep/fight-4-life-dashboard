export interface WorkoutExerciseProgressInput {
  sets: number;
  completedSets: number[];
}

export function isExerciseComplete(exercise: WorkoutExerciseProgressInput): boolean {
  if (exercise.sets <= 0) return false;
  return exercise.completedSets.length >= exercise.sets;
}

export function countWorkoutSetProgress(
  exercises: WorkoutExerciseProgressInput[],
): { completedSets: number; totalSets: number; completedExercises: number; totalExercises: number } {
  let completedSets = 0;
  let totalSets = 0;
  let completedExercises = 0;

  for (const exercise of exercises) {
    totalSets += exercise.sets;
    completedSets += Math.min(exercise.completedSets.length, exercise.sets);
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

export function workoutProgressPercent(exercises: WorkoutExerciseProgressInput[]): number {
  const { completedSets, totalSets } = countWorkoutSetProgress(exercises);
  if (totalSets <= 0) return 0;
  return Math.round((completedSets / totalSets) * 100);
}

export function isWorkoutComplete(exercises: WorkoutExerciseProgressInput[]): boolean {
  return exercises.length > 0 && exercises.every(isExerciseComplete);
}

export function percentValue(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function monthRange(reference = new Date()): { start: string; end: string } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const WEEKLY_WORKOUT_GOAL = 4;
export const MONTHLY_WORKOUT_GOAL = 12;
export const OWNER_WEEKLY_WORKOUT_GOAL = 20;
export const OWNER_NEW_STUDENTS_GOAL = 10;
export const DEV_NEW_ACADEMIES_GOAL = 5;
