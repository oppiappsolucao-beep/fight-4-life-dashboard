import { z } from "zod";

export const workoutExerciseInputSchema = z.object({
  exerciseId: z.string().uuid(),
  order: z.number().int().min(1),
  sets: z.number().int().min(1).default(3),
  reps: z.string().min(1).default("12"),
  load: z.string().optional(),
  restSeconds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const saveStudentWorkoutSchema = z.object({
  title: z.string().min(1, "Informe um título para o treino."),
  notes: z.string().optional(),
  exercises: z.array(workoutExerciseInputSchema).min(1, "Adicione ao menos um exercício."),
});

export function serializeWorkout(workout: {
  id: string;
  title: string;
  notes: string | null;
  updatedAt: Date;
  exercises: Array<{
    id: string;
    order: number;
    sets: number;
    reps: string;
    load: string | null;
    restSeconds: number | null;
    notes: string | null;
    exercise: {
      id: string;
      slug: string;
      name: string;
      muscleGroup: string;
      equipment: string | null;
      instructions: string;
      imageUrl: string | null;
      gifUrl: string | null;
    };
  }>;
}) {
  return {
    id: workout.id,
    title: workout.title,
    notes: workout.notes,
    updatedAt: workout.updatedAt.toISOString(),
    exercises: workout.exercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        order: item.order,
        sets: item.sets,
        reps: item.reps,
        load: item.load,
        restSeconds: item.restSeconds,
        notes: item.notes,
        exercise: item.exercise,
      })),
  };
}

export const workoutInclude = {
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
        },
      },
    },
  },
} as const;
