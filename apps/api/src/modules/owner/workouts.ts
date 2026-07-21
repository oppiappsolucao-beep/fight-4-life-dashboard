import { WorkoutPhase, WorkoutSource } from "@prisma/client";
import { z } from "zod";

export const workoutPhaseSchema = z.enum(["INICIO", "MEIO", "FIM"]);

export const workoutExerciseInputSchema = z.object({
  exerciseId: z.string().uuid(),
  phase: workoutPhaseSchema,
  order: z.number().int().min(1),
  sets: z.number().int().min(1).default(3),
  reps: z.string().min(1).default("12"),
  load: z.string().optional(),
  restSeconds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const saveStudentWorkoutSchema = z.object({
  title: z.string().min(1, "Informe um título para o treino."),
  workoutDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD."),
  modalityId: z.string().uuid("Selecione a modalidade do treino.").optional(),
  notes: z.string().optional(),
  exercises: z.array(workoutExerciseInputSchema).min(1, "Adicione ao menos um exercício."),
});

const PHASE_ORDER: WorkoutPhase[] = [
  WorkoutPhase.INICIO,
  WorkoutPhase.MEIO,
  WorkoutPhase.FIM,
];

export function parseWorkoutDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function formatWorkoutDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function serializeWorkout(workout: {
  id: string;
  title: string;
  notes: string | null;
  workoutDate: Date;
  updatedAt: Date;
  source?: WorkoutSource;
  modalityId?: string | null;
  modality?: { id: string; name: string; slug: string } | null;
  exercises: Array<{
    id: string;
    phase: WorkoutPhase;
    order: number;
    sets: number;
    reps: string;
    load: string | null;
    restSeconds: number | null;
    notes: string | null;
    completedSets?: number[];
    exercise: {
      id: string;
      slug: string;
      name: string;
      muscleGroup: string;
      equipment: string | null;
      instructions: string;
      imageUrl: string | null;
      gifUrl: string | null;
      phases?: string[];
      bodyRegion?: string;
    };
  }>;
}) {
  const exercises = workout.exercises
    .slice()
    .sort((a, b) => {
      const phaseDiff = PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
      if (phaseDiff !== 0) return phaseDiff;
      return a.order - b.order;
    })
    .map((item) => ({
      id: item.id,
      phase: item.phase,
      order: item.order,
      sets: item.sets,
      reps: item.reps,
      load: item.load,
      restSeconds: item.restSeconds,
      notes: item.notes,
      completedSets: item.completedSets ?? [],
      exercise: item.exercise,
    }));

  return {
    id: workout.id,
    title: workout.title,
    notes: workout.notes,
    workoutDate: formatWorkoutDate(workout.workoutDate),
    updatedAt: workout.updatedAt.toISOString(),
    source: workout.source ?? WorkoutSource.OWNER,
    modalityId: workout.modalityId ?? null,
    modality: workout.modality
      ? { id: workout.modality.id, name: workout.modality.name, slug: workout.modality.slug }
      : null,
    exercises,
  };
}

export const workoutInclude = {
  modality: {
    select: { id: true, name: true, slug: true },
  },
  exercises: {
    include: {
      exercise: {
        select: {
          id: true,
          slug: true,
          name: true,
          muscleGroup: true,
          equipment: true,
          instructions: true,
          imageUrl: true,
          gifUrl: true,
          phases: true,
          bodyRegion: true,
        },
      },
    },
  },
} as const;

export function serializeWorkoutSummary(workout: {
  id: string;
  title: string;
  workoutDate: Date;
  updatedAt: Date;
  source?: WorkoutSource;
  _count?: { exercises: number };
}) {
  return {
    id: workout.id,
    title: workout.title,
    workoutDate: formatWorkoutDate(workout.workoutDate),
    updatedAt: workout.updatedAt.toISOString(),
    source: workout.source ?? WorkoutSource.OWNER,
    exerciseCount: workout._count?.exercises ?? 0,
  };
}
