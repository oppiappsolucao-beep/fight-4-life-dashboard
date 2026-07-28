import "dotenv/config";
import { syncExerciseDbCatalog } from "../lib/exercise-import.js";
import { ensureExerciseCatalog } from "../lib/exercise-catalog.js";

async function main() {
  process.env.EXERCISEDB_FORCE_SYNC = "true";

  console.log("[exercises] Atualizando seed local...");
  const localCount = await ensureExerciseCatalog();
  console.log(`[exercises] Seed local sincronizado: ${localCount} itens.`);

  console.log("[exercises] Importando ExerciseDB...");
  const result = await syncExerciseDbCatalog({ force: true });

  if (result.skipped) {
    console.warn(`[exercises] Import ignorado: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[exercises] Importados/atualizados: ${result.imported} exercícios.`);
}

main()
  .catch((error) => {
    console.error("[exercises] Falha no import:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma.js");
    await prisma.$disconnect();
  });
