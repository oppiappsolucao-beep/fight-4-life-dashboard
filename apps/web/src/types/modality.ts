export type ModalityContentType = "EXERCISE_CATALOG" | "VIDEO_GALLERY";

export interface WarmupMovementCatalogEntry {
  id: string;
  customName?: string | null;
  exerciseId?: string | null;
  sets?: number;
}

export interface ModalityTemplate {
  id: string;
  name: string;
  slug: string;
  contentType: ModalityContentType;
  description: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModalityItem {
  id: string;
  templateId: string | null;
  name: string;
  slug: string;
  contentType: ModalityContentType;
  description: string | null;
  linkedPlans: string[];
  warmupExercises?: Array<{
    exerciseId?: string;
    customName?: string | null;
    order: number;
    sets: number;
    reps?: string | null;
    load?: string | null;
    restSeconds?: number | null;
    notes?: string | null;
  }>;
  warmupMovementCatalog?: WarmupMovementCatalogEntry[];
  scheduleRepeatsMonthly?: boolean;
  active: boolean;
  sortOrder: number;
  lessonCount: number;
  professorCount?: number;
  scheduleSlots?: ScheduleSlot[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSlot {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export type LessonAttendanceStatus = "STUDENT_CONFIRMED" | "VALIDATED" | "REJECTED";

export interface LessonAttendanceItem {
  id: string;
  status: LessonAttendanceStatus;
  markedAt: string;
  studentConfirmedAt: string | null;
  professorValidatedAt: string | null;
  lessonId: string;
  studentId: string;
  student?: { id: string; nomeCompleto: string; planoModalidade: string };
  lesson?: ProfessorLessonItem;
}

export interface ProfessorModalitySchedule {
  modalityId: string;
  slots: ScheduleSlot[];
}

export interface ProfessorModalityStats {
  modalityId: string;
  modalityName: string;
  assignmentActive: boolean;
  studentCount: number;
  lessonCount: number;
  activeLessonCount: number;
  attendanceCount: number;
}

export interface ProfessorItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  modalityIds: string[];
  schedules: ProfessorModalitySchedule[];
  modalityStats?: ProfessorModalityStats[];
  recentLessons?: ProfessorLessonItem[];
}

export interface ProfessorLessonItem {
  id: string;
  modalityId: string;
  professorId: string;
  title: string;
  description: string | null;
  classDate: string;
  startTime: string | null;
  endTime: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  active: boolean;
  attendanceCount: number;
  modality: { id: string; name: string; slug: string } | null;
  professor: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
  presencaMarcada?: boolean;
  presencaStatus?: LessonAttendanceStatus | null;
  presencaPendente?: boolean;
}

export interface StudentGalleryResponse {
  planoModalidade: string;
  modalidadeAtual: ModalityItem | null;
  modalidadeSelecionada: ModalityItem | null;
  modalidades: ModalityItem[];
  aulas: ProfessorLessonItem[];
}

export interface StudentLessonSlotOption {
  startTime: string;
  endTime: string;
  label: string;
  professorName: string | null;
  lesson: ProfessorLessonItem | null;
}

export interface StudentTreinoAulasResponse {
  planoModalidade: string;
  modality: ModalityItem;
  classDate: string;
  weekday: number;
  horarios: StudentLessonSlotOption[];
}

export interface ScheduleOccurrenceItem {
  classDate: string;
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  cancelled: boolean;
}

export interface OwnerScheduleOccurrencesResponse {
  month: string;
  repeatsMonthly: boolean;
  ocorrencias: ScheduleOccurrenceItem[];
}

export interface StudentDayGradeEntry {
  modalityId: string;
  modalityName: string;
  contentType: ModalityContentType;
  startTime: string;
  endTime: string;
  label: string;
  hasLesson: boolean;
}

export interface StudentDayGradeResponse {
  planoModalidade: string;
  classDate: string;
  weekday: number;
  sequencia: StudentDayGradeEntry[];
}

export interface StudentFrequencyResponse {
  planoModalidade: string;
  aulasDisponiveis: ProfessorLessonItem[];
  historico: Array<{
    id: string;
    markedAt: string;
    professorValidatedAt?: string | null;
    aula: ProfessorLessonItem;
  }>;
  totalPresencas: number;
}

export function contentTypeLabel(contentType: ModalityContentType): string {
  return contentType === "EXERCISE_CATALOG" ? "Catálogo de treinos" : "Galeria de vídeos";
}

/** Compatível com player de vídeo existente */
export interface LessonVideoCardItem {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
}

export function lessonToVideoCard(lesson: ProfessorLessonItem): LessonVideoCardItem {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    videoUrl: lesson.videoUrl,
    thumbnailUrl: lesson.thumbnailUrl,
  };
}
