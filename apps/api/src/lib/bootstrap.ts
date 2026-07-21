import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureExerciseCatalog } from "./exercise-catalog.js";

function getApiRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export async function bootstrapDatabase(): Promise<void> {
  const apiRoot = getApiRoot();

  if (process.env.SKIP_DB_BOOTSTRAP === "true") {
    console.log("[bootstrap] SKIP_DB_BOOTSTRAP=true — pulando sync do banco.");
    return;
  }

  try {
    console.log("[bootstrap] Sincronizando schema (prisma db push)...");
    execSync("npx prisma db push --skip-generate", {
      cwd: apiRoot,
      stdio: "inherit",
      env: process.env,
    });
  } catch (error) {
    console.error("[bootstrap] Falha no db push:", error);
  }

  try {
    const count = await ensureExerciseCatalog();
    if (count === 0) {
      console.warn(
        "[bootstrap] Catálogo de exercícios vazio. Confira DATABASE_URL e db:push.",
      );
    }
  } catch (error) {
    console.error("[bootstrap] Falha ao carregar exercícios:", error);
  }
}
