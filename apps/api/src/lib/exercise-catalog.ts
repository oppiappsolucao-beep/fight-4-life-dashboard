import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExerciseBodyRegion } from "@prisma/client";
import { prisma } from "./prisma.js";
import { upsertExerciseSeeds, syncExerciseDbCatalog } from "./exercise-import.js";
import type { ExerciseSeedItem } from "./exercise-mapping.js";

interface ExerciseSeed {
  slug: string;
  name: string;
  muscleGroup: string;
  equipment?: string | null;
  instructions: string;
  imageUrl?: string | null;
  gifUrl?: string | null;
  phases: string[];
  bodyRegion: keyof typeof ExerciseBodyRegion;
}

function resolveDataFile(fileName: string): string | null {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, `../../data/${fileName}`),
    resolve(currentDir, `../data/${fileName}`),
    resolve(process.cwd(), `apps/api/data/${fileName}`),
    resolve(process.cwd(), `data/${fileName}`),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function loadJsonSeed(fileName: string): ExerciseSeed[] {
  const path = resolveDataFile(fileName);
  if (!path) return [];
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as ExerciseSeed[];
  return Array.isArray(parsed) ? parsed : [];
}

function toSeedItem(item: ExerciseSeed): ExerciseSeedItem {
  return {
    slug: item.slug,
    name: item.name,
    muscleGroup: item.muscleGroup,
    equipment: item.equipment ?? null,
    instructions: item.instructions,
    imageUrl: item.imageUrl ?? null,
    gifUrl: item.gifUrl ?? null,
    phases: item.phases,
    bodyRegion: item.bodyRegion,
  };
}

export async function ensureExerciseCatalog(options?: {
  syncRemote?: boolean;
  forceSeed?: boolean;
}): Promise<number> {
  try {
    await prisma.exercise.count();
  } catch (error) {
    console.error(
      "[exercises] Tabela Exercise indisponível. Rode db:push no deploy.",
      error,
    );
    return 0;
  }

  const local = loadJsonSeed("exercises.json");
  const edbSeed = loadJsonSeed("exercises-edb.json");
  const extended = edbSeed.length > 0 ? [] : loadJsonSeed("exercises-extended.json");

  const bySlug = new Map<string, ExerciseSeedItem>();
  // Importados primeiro; exercícios locais customizados sobrescrevem se houver conflito de slug.
  for (const item of [...extended, ...edbSeed, ...local]) {
    if (!item?.slug || !item?.name) continue;
    bySlug.set(item.slug, toSeedItem(item));
  }

  const merged = Array.from(bySlug.values());
  const currentCount = await prisma.exercise.count({ where: { active: true } });
  const shouldSeedLocal =
    options?.forceSeed === true ||
    currentCount < Math.max(100, Math.floor(merged.length * 0.8));

  if (merged.length > 0 && shouldSeedLocal) {
    await upsertExerciseSeeds(merged);
    console.log(`[exercises] Catálogo local sincronizado: ${merged.length} exercícios.`);
  } else if (merged.length > 0) {
    console.log(
      `[exercises] Catálogo local já carregado (${currentCount} ativos). Seed com ${merged.length} itens disponível.`,
    );
  }

  if (options?.syncRemote === true) {
    try {
      const sync = await syncExerciseDbCatalog();
      if (sync.skipped) {
        console.log(`[exercises] ExerciseDB remoto pulado: ${sync.reason}`);
      } else {
        console.log(`[exercises] ExerciseDB remoto importado: ${sync.imported}.`);
      }
    } catch (error) {
      console.error("[exercises] Falha no sync remoto ExerciseDB:", error);
    }
  }

  return prisma.exercise.count({ where: { active: true } });
}
