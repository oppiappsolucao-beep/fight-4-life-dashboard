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

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ExerciseDB HTTP ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    );
  }

  return (await response.json()) as ExerciseDbPage;
}

export async function fetchAllExerciseDbItems(options?: {
  pageSize?: number;
  maxPages?: number;
}): Promise<ExerciseSeedItem[]> {
  const pageSize = options?.pageSize ?? 100;
  const maxPages = options?.maxPages ?? 40;
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
  }

  return mapped;
}

export async function upsertExerciseSeeds(items: ExerciseSeedItem[]): Promise<number> {
  let saved = 0;

  for (const item of items) {
    await prisma.exercise.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        muscleGroup: item.muscleGroup,
        equipment: item.equipment ?? null,
        instructions: item.instructions,
        imageUrl: item.imageUrl ?? null,
        gifUrl: item.gifUrl ?? null,
        phases: item.phases,
        bodyRegion: ExerciseBodyRegion[item.bodyRegion],
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
        bodyRegion: ExerciseBodyRegion[item.bodyRegion],
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

  if (!force && withGif >= 200) {
    return {
      imported: 0,
      skipped: true,
      reason: `catálogo já possui ${withGif} exercícios com GIF`,
    };
  }

  const items = await fetchAllExerciseDbItems();
  if (items.length === 0) {
    return { imported: 0, skipped: true, reason: "API retornou lista vazia" };
  }

  const imported = await upsertExerciseSeeds(items);
  return { imported, skipped: false };
}
