export type ModalityContentType = "EXERCISE_CATALOG" | "VIDEO_GALLERY";

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
}

export interface StudentGalleryResponse {
  planoModalidade: string;
  modalidadeAtual: ModalityItem | null;
  modalidadeSelecionada: ModalityItem | null;
  modalidades: ModalityItem[];
  aulas: ProfessorLessonItem[];
}

export interface StudentFrequencyResponse {
  planoModalidade: string;
  aulasDisponiveis: ProfessorLessonItem[];
  historico: Array<{
    id: string;
    markedAt: string;
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
