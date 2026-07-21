import type { WorkoutPhase } from "../lib/workout";

export interface ExerciseCatalogItem {
  id: string;
  slug: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  instructions: string;
  imageUrl: string | null;
  gifUrl: string | null;
}

export interface WorkoutExerciseItem {
  id?: string;
  phase: WorkoutPhase;
  order: number;
  sets: number;
  reps: string;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: ExerciseCatalogItem;
}

export interface StudentWorkout {
  id: string;
  title: string;
  notes: string | null;
  workoutDate: string;
  updatedAt: string;
  exercises: WorkoutExerciseItem[];
}

export interface WorkoutSummary {
  id: string;
  title: string;
  workoutDate: string;
  updatedAt: string;
  exerciseCount: number;
}

export interface WorkoutExerciseDraft {
  exerciseId: string;
  phase: WorkoutPhase;
  order: number;
  sets: number;
  reps: string;
  load: string;
  restSeconds: number;
  notes: string;
}
