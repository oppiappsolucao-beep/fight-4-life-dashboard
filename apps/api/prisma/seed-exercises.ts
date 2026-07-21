import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

interface ExerciseSeed {
  slug: string;
  name: string;
  muscleGroup: string;
  equipment?: string;
  instructions: string;
  imageUrl?: string;
  gifUrl?: string;
}

export async function seedExercises(prisma: PrismaClient): Promise<number> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const jsonPath = resolve(currentDir, "../data/exercises.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const exercises = JSON.parse(raw) as ExerciseSeed[];

  for (const item of exercises) {
    await prisma.exercise.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        muscleGroup: item.muscleGroup,
        equipment: item.equipment ?? null,
        instructions: item.instructions,
        imageUrl: item.imageUrl ?? null,
        gifUrl: item.gifUrl ?? null,
        active: true,
      },
      create: {
        slug: item.slug,
        name: item.name,
        muscleGroup: item.muscleGroup,
        equipment: item.equipment ?? null,
        instructions: item.instructions,
        imageUrl: item.imageUrl ?? null,
        gifUrl: item.gifUrl ?? null,
      },
    });
  }

  return exercises.length;
}
