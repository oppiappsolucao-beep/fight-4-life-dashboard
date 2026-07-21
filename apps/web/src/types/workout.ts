import type { ExerciseBodyRegion, WorkoutPhase } from "../lib/workout";
import type { WorkoutCompletionStatus } from "../lib/workout";

export type WorkoutSource = "OWNER" | "STUDENT";

export interface ExerciseCatalogItem {
  id: string;
  slug: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  instructions: string;
  imageUrl: string | null;
  gifUrl: string | null;
  phases: string[];
  bodyRegion: ExerciseBodyRegion;
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
  completedSets?: number[];
  exercise: ExerciseCatalogItem;
}

export interface StudentWorkout {
  id: string;
  title: string;
  notes: string | null;
  workoutDate: string;
  updatedAt: string;
  source: WorkoutSource;
  exercises: WorkoutExerciseItem[];
}

export interface WorkoutSummary {
  id: string;
  title: string;
  workoutDate: string;
  updatedAt: string;
  source: WorkoutSource;
  exerciseCount: number;
  progressPercent?: number;
  completionStatus?: WorkoutCompletionStatus;
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
