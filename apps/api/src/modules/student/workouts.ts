import { z } from "zod";
import { saveStudentWorkoutSchema } from "../owner/workouts.js";

export const saveWorkoutProgressSchema = z.object({
  workoutDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD."),
  items: z
    .array(
      z.object({
        exerciseItemId: z.string().uuid(),
        completedSets: z.array(z.number().int().min(1)).default([]),
      }),
    )
    .min(1),
});

export { saveStudentWorkoutSchema };
