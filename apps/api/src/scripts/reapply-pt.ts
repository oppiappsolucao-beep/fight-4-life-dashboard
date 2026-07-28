import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  translateExerciseInstructions,
  translateExerciseName,
} from "../lib/exercise-i18n-pt.js";

interface SeedItem {
  slug: string;
  name: string;
  instructions: string;
  [key: string]: unknown;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const path = resolve(root, "exercises-edb.json");
const items = JSON.parse(readFileSync(path, "utf-8")) as SeedItem[];

const translated = items.map((item) => ({
  ...item,
  name: translateExerciseName(String(item.name)),
  instructions: translateExerciseInstructions(String(item.instructions ?? "")),
}));

writeFileSync(path, JSON.stringify(translated));
console.log(`[i18n] Reaplicado PT-BR em ${translated.length} exercícios`);
console.log("[i18n] Amostras:");
for (const item of translated.slice(0, 25)) {
  console.log(` - ${item.name}`);
}
