export type LessonPhase = "AQUECIMENTO" | "AULA";

export const LESSON_PHASES: Array<{
  id: LessonPhase;
  label: string;
  description: string;
}> = [
  {
    id: "AQUECIMENTO",
    label: "Aquecimento",
    description: "Movimentos preparatórios antes da aula.",
  },
  {
    id: "AULA",
    label: "Aula",
    description: "Vídeo da aula com o professor.",
  },
];

export function lessonProgressStorageKey(modalityId: string, classDate: string): string {
  return `lesson-progress:${modalityId}:${classDate}`;
}
