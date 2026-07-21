export type WorkoutPhase = "INICIO" | "MEIO" | "FIM";

export const WORKOUT_PHASES: Array<{
  id: WorkoutPhase;
  label: string;
  description: string;
}> = [
  {
    id: "INICIO",
    label: "Começo",
    description: "Aquecimento e preparação",
  },
  {
    id: "MEIO",
    label: "Meio",
    description: "Parte principal do treino",
  },
  {
    id: "FIM",
    label: "Fim",
    description: "Alongamento e volta à calma",
  },
];

export function workoutPhaseLabel(phase: WorkoutPhase): string {
  return WORKOUT_PHASES.find((item) => item.id === phase)?.label ?? phase;
}

export function todayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWorkoutDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function groupExercisesByPhase<T extends { phase: WorkoutPhase; order: number }>(
  exercises: T[],
): Record<WorkoutPhase, T[]> {
  const grouped: Record<WorkoutPhase, T[]> = {
    INICIO: [],
    MEIO: [],
    FIM: [],
  };

  for (const phase of WORKOUT_PHASES) {
    grouped[phase.id] = exercises
      .filter((item) => item.phase === phase.id)
      .sort((a, b) => a.order - b.order);
  }

  return grouped;
}
