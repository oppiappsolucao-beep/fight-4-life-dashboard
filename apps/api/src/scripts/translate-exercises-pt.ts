import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { mapExerciseDbItem } from "../lib/exercise-mapping.js";

async function fetchPage(after?: string) {
  const url = new URL("https://oss.exercisedb.dev/api/v1/exercises");
  url.searchParams.set("limit", "25");
  if (after) url.searchParams.set("after", after);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url);
    if (response.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<{
      data?: Array<Record<string, unknown>>;
      meta?: { hasNextPage?: boolean; nextCursor?: string | null };
    }>;
  }
  throw new Error("ExerciseDB rate limited");
}

async function main() {
  const out: Array<ReturnType<typeof mapExerciseDbItem>> = [];
  const seen = new Set<string>();
  let after: string | undefined;

  console.log("[i18n] Regenerando catálogo ExerciseDB em PT-BR...");

  for (let page = 0; page < 80; page += 1) {
    const payload = await fetchPage(after);
    for (const row of payload.data ?? []) {
      const mapped = mapExerciseDbItem(row as never);
      if (seen.has(mapped.slug)) continue;
      seen.add(mapped.slug);
      out.push(mapped);
    }
    console.log(`[i18n] página ${page + 1} • ${out.length}`);
    if (!payload.meta?.hasNextPage || !payload.meta.nextCursor) break;
    after = payload.meta.nextCursor;
    await sleep(650);
  }

  writeFileSync(new URL("../../data/exercises-edb.json", import.meta.url), JSON.stringify(out));
  console.log(`[i18n] Gravado: ${out.length} exercícios`);
  console.log("[i18n] Amostras:");
  for (const item of out.slice(0, 20)) {
    console.log(` - ${item.name}`);
  }
}

main().catch((error) => {
  console.error("[i18n] Falha:", error);
  process.exitCode = 1;
});
