import { ExerciseBodyRegion } from "@prisma/client";
import { prisma } from "./prisma.js";
import {
  mapExerciseDbItem,
  type ExerciseDbApiItem,
  type ExerciseSeedItem,
} from "./exercise-mapping.js";

interface ExerciseDbPage {
  success?: boolean;
  meta?: {
    total?: number;
    hasNextPage?: boolean;
    nextCursor?: string | null;
  };
  data?: ExerciseDbApiItem[];
}

const OSS_BASE = "https://oss.exercisedb.dev/api/v1/exercises";
const RAPIDAPI_HOST = "edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com";
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/api/v1/exercises`;

function getRapidApiKey(): string {
  return (
    process.env.EXERCISEDB_RAPIDAPI_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim() ||
    ""
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchExerciseDbPage(params: {
  limit: number;
  after?: string;
}): Promise<ExerciseDbPage> {
  const key = getRapidApiKey();
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.after) search.set("after", params.after);

  const url = `${key ? RAPIDAPI_BASE : OSS_BASE}?${search.toString()}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) {
    headers["X-RapidAPI-Key"] = key;
    headers["X-RapidAPI-Host"] = RAPIDAPI_HOST;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers });
    if (response.status === 429) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ExerciseDB HTTP ${response.status}: ${body.slice(0, 200) || response.statusText}`,
      );
    }
    return (await response.json()) as ExerciseDbPage;
  }

  throw new Error("ExerciseDB rate limit (429) após várias tentativas.");
}

export async function fetchAllExerciseDbItems(options?: {
  pageSize?: number;
  maxPages?: number;
}): Promise<ExerciseSeedItem[]> {
  // API pública costuma devolver no máximo 25 por página.
  const pageSize = options?.pageSize ?? 25;
  const maxPages = options?.maxPages ?? 80;
  const mapped: ExerciseSeedItem[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  let page = 0;

  while (page < maxPages) {
    page += 1;
    const payload = await fetchExerciseDbPage({ limit: pageSize, after });
    const rows = Array.isArray(payload.data) ? payload.data : [];

    for (const row of rows) {
      if (!row?.exerciseId || !row?.name) continue;
      const item = mapExerciseDbItem(row);
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      mapped.push(item);
    }

    if (!payload.meta?.hasNextPage || !payload.meta.nextCursor) break;
    after = payload.meta.nextCursor;
    await sleep(650);
  }

  return mapped;
}

export async function upsertExerciseSeeds(items: ExerciseSeedItem[]): Promise<number> {
  let saved = 0;

  for (const item of items) {
    const bodyRegion = ExerciseBodyRegion[item.bodyRegion];
    await prisma.exercise.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        muscleGroup: item.muscleGroup,
        equipment: item.equipment ?? null,
        instructions: item.instructions,
        imageUrl: item.imageUrl ?? null,
        ...(item.gifUrl ? { gifUrl: item.gifUrl } : {}),
        phases: item.phases,
        bodyRegion,
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
        phases: item.phases,
        bodyRegion,
        active: true,
      },
    });
    saved += 1;
  }

  return saved;
}

export async function syncExerciseDbCatalog(options?: {
  force?: boolean;
}): Promise<{ imported: number; skipped: boolean; reason?: string }> {
  if (process.env.EXERCISEDB_SYNC === "false") {
    return { imported: 0, skipped: true, reason: "EXERCISEDB_SYNC=false" };
  }

  const force =
    options?.force === true ||
    process.env.EXERCISEDB_FORCE_SYNC === "true" ||
    process.env.EXERCISEDB_FORCE_SYNC === "1";

  const withGif = await prisma.exercise.count({
    where: { active: true, gifUrl: { not: null } },
  });
  const total = await prisma.exercise.count({ where: { active: true } });

  if (!force && withGif >= 200) {
    return {
      imported: 0,
      skipped: true,
      reason: `catálogo já possui ${withGif} exercícios com GIF`,
    };
  }

  // Se já temos catálogo local grande, o remoto vira enriquecimento opcional.
  if (!force && total >= 400 && withGif < 200) {
    // Continua para tentar trazer GIFs, mas não bloqueia se falhar.
  }

  try {
    const items = await fetchAllExerciseDbItems();
    if (items.length === 0) {
      return { imported: 0, skipped: true, reason: "API retornou lista vazia" };
    }

    const imported = await upsertExerciseSeeds(items);
    return { imported, skipped: false };
  } catch (error) {
    // Catálogo local expandido já cobre o uso; remoto é best-effort.
    const message = error instanceof Error ? error.message : String(error);
    return { imported: 0, skipped: true, reason: message };
  }
}
