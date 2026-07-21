import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";
import { ensureExerciseCatalog } from "./exercise-catalog.js";
import { ensureModalityTemplates } from "./modalities.js";

function getApiRoot(): string {
  // .../src/lib ou .../dist/lib → raiz apps/api
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

async function repairLegacyWorkouts(): Promise<void> {
  try {
    const workouts = await prisma.studentWorkout.findMany({
      orderBy: [{ studentId: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        studentId: true,
        workoutDate: true,
        active: true,
        createdAt: true,
      },
    });

    const seen = new Set<string>();

    for (const workout of workouts) {
      const dateKey = workout.workoutDate.toISOString().slice(0, 10);
      const uniqueKey = `${workout.studentId}:${dateKey}`;

      if (seen.has(uniqueKey)) {
        await prisma.studentWorkout.update({
          where: { id: workout.id },
          data: { active: false },
        });
        continue;
      }

      seen.add(uniqueKey);
    }
  } catch (error) {
    console.warn("[bootstrap] Reparo de treinos legados ignorado:", error);
  }
}

export async function bootstrapDatabase(): Promise<void> {
  const apiRoot = getApiRoot();

  if (process.env.SKIP_DB_BOOTSTRAP === "true") {
    console.log("[bootstrap] SKIP_DB_BOOTSTRAP=true — pulando sync do banco.");
    return;
  }

  try {
    console.log("[bootstrap] Sincronizando schema (prisma db push)...", apiRoot);
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: apiRoot,
      stdio: "inherit",
      env: process.env,
    });
  } catch (error) {
    console.error("[bootstrap] Falha no db push:", error);
  }

  try {
    await repairLegacyWorkouts();
  } catch (error) {
    console.error("[bootstrap] Falha ao reparar treinos:", error);
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

  try {
    const templateCount = await ensureModalityTemplates();
    console.log(`[modalities] Templates sincronizados: ${templateCount}.`);
  } catch (error) {
    console.error("[bootstrap] Falha ao carregar templates de modalidade:", error);
  }
}
