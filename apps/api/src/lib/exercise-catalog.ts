import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";

interface ExerciseSeed {
  slug: string;
  name: string;
  muscleGroup: string;
  equipment?: string;
  instructions: string;
  imageUrl?: string;
  gifUrl?: string;
}

function resolveExercisesJsonPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, "../../data/exercises.json"),
    resolve(currentDir, "../data/exercises.json"),
    resolve(process.cwd(), "apps/api/data/exercises.json"),
    resolve(process.cwd(), "data/exercises.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Arquivo exercises.json não encontrado. Verifique apps/api/data/exercises.json.",
  );
}

function loadExerciseSeeds(): ExerciseSeed[] {
  const raw = readFileSync(resolveExercisesJsonPath(), "utf-8");
  return JSON.parse(raw) as ExerciseSeed[];
}

export async function ensureExerciseCatalog(): Promise<number> {
  let existing = 0;

  try {
    existing = await prisma.exercise.count();
  } catch (error) {
    console.error(
      "[exercises] Tabela Exercise indisponível. Rode db:push no deploy.",
      error,
    );
    return 0;
  }

  if (existing > 0) {
    return existing;
  }

  const exercises = loadExerciseSeeds();

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

  console.log(`[exercises] Catálogo carregado: ${exercises.length} exercícios.`);
  return exercises.length;
}
