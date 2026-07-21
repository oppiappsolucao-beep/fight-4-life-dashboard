import type {
  Modality,
  ModalityContentType,
  ModalityScheduleSlot,
  ModalityTemplate,
  ProfessorLesson,
  User,
} from "@prisma/client";
import { prisma } from "./prisma.js";
import { serializeScheduleSlot } from "./schedules.js";

export interface ModalityTemplateSeed {
  name: string;
  slug: string;
  contentType: ModalityContentType;
  description: string;
  linkedPlans: string[];
  sortOrder: number;
}

export const DEFAULT_MODALITY_TEMPLATES: ModalityTemplateSeed[] = [
  {
    name: "Musculação",
    slug: "musculacao",
    contentType: "EXERCISE_CATALOG",
    description: "Treinos com catálogo de exercícios.",
    linkedPlans: ["Musculação Livre", "Plano Trimestral", "Plano Semestral", "Plano Anual"],
    sortOrder: 1,
  },
  {
    name: "Jiu-Jitsu",
    slug: "jiu-jitsu",
    contentType: "VIDEO_GALLERY",
    description: "Aulas em vídeo publicadas pelo professor.",
    linkedPlans: ["Jiu-Jitsu"],
    sortOrder: 2,
  },
  {
    name: "Muay Thai",
    slug: "muay-thai",
    contentType: "VIDEO_GALLERY",
    description: "Aulas e drills em vídeo.",
    linkedPlans: ["Muay Thai"],
    sortOrder: 3,
  },
  {
    name: "MMA",
    slug: "mma",
    contentType: "VIDEO_GALLERY",
    description: "Conteúdo multimodalidade em vídeo.",
    linkedPlans: ["MMA"],
    sortOrder: 4,
  },
  {
    name: "Pilates",
    slug: "pilates",
    contentType: "VIDEO_GALLERY",
    description: "Exercícios guiados em vídeo.",
    linkedPlans: ["Pilates"],
    sortOrder: 5,
  },
];

export function slugifyModality(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function normalizePlanName(value: string): string {
  return value.trim().toLowerCase();
}

export function modalityMatchesPlan(
  modality: Pick<Modality, "name" | "linkedPlans">,
  planName: string,
): boolean {
  const normalizedPlan = normalizePlanName(planName);
  if (!normalizedPlan) return false;

  if (modality.linkedPlans.some((plan) => normalizePlanName(plan) === normalizedPlan)) {
    return true;
  }

  const normalizedName = normalizePlanName(modality.name);
  return (
    normalizedPlan.includes(normalizedName) || normalizedName.includes(normalizedPlan)
  );
}

export function parseClassDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function formatClassDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function ensureModalityTemplates(): Promise<number> {
  let count = 0;

  for (const template of DEFAULT_MODALITY_TEMPLATES) {
    await prisma.modalityTemplate.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        contentType: template.contentType,
        description: template.description,
        sortOrder: template.sortOrder,
        active: true,
      },
      create: {
        name: template.name,
        slug: template.slug,
        contentType: template.contentType,
        description: template.description,
        sortOrder: template.sortOrder,
        active: true,
      },
    });
    count += 1;
  }

  return count;
}

export async function ensureTenantModalities(tenantId: string): Promise<number> {
  await ensureModalityTemplates();

  const existing = await prisma.modality.count({ where: { tenantId } });
  if (existing > 0) return existing;

  const templates = await prisma.modalityTemplate.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const templateBySlug = new Map(
    DEFAULT_MODALITY_TEMPLATES.map((item) => [item.slug, item.linkedPlans]),
  );

  for (const template of templates) {
    await prisma.modality.create({
      data: {
        tenantId,
        templateId: template.id,
        name: template.name,
        slug: template.slug,
        contentType: template.contentType,
        description: template.description,
        linkedPlans: templateBySlug.get(template.slug) ?? [],
        sortOrder: template.sortOrder,
        active: true,
      },
    });
  }

  return templates.length;
}

export function serializeModalityTemplate(template: ModalityTemplate) {
  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    contentType: template.contentType,
    description: template.description,
    active: template.active,
    sortOrder: template.sortOrder,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function serializeModality(
  modality: Modality & {
    _count?: { lessons: number; professors?: number };
    scheduleSlots?: ModalityScheduleSlot[];
  },
) {
  return {
    id: modality.id,
    templateId: modality.templateId,
    name: modality.name,
    slug: modality.slug,
    contentType: modality.contentType,
    description: modality.description,
    linkedPlans: modality.linkedPlans,
    active: modality.active,
    sortOrder: modality.sortOrder,
    lessonCount: modality._count?.lessons ?? 0,
    professorCount: modality._count?.professors ?? 0,
    scheduleSlots: (modality.scheduleSlots ?? [])
      .filter((slot) => slot.active)
      .map(serializeScheduleSlot),
    createdAt: modality.createdAt.toISOString(),
    updatedAt: modality.updatedAt.toISOString(),
  };
}

export function serializeProfessor(
  user: Pick<User, "id" | "email" | "name" | "role" | "active">,
  modalityIds: string[],
  schedules?: Array<{ modalityId: string; slots: ReturnType<typeof serializeScheduleSlot>[] }>,
  extras?: {
    modalityStats?: Array<{
      modalityId: string;
      modalityName: string;
      assignmentActive: boolean;
      studentCount: number;
      lessonCount: number;
      activeLessonCount: number;
      attendanceCount: number;
    }>;
    recentLessons?: ReturnType<typeof serializeProfessorLesson>[];
  },
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    modalityIds,
    schedules: schedules ?? [],
    modalityStats: extras?.modalityStats ?? [],
    recentLessons: extras?.recentLessons ?? [],
  };
}

export function serializeProfessorLesson(
  lesson: ProfessorLesson & {
    modality?: Pick<Modality, "id" | "name" | "slug">;
    professor?: Pick<User, "id" | "name" | "email">;
    _count?: { attendances: number };
  },
) {
  return {
    id: lesson.id,
    modalityId: lesson.modalityId,
    professorId: lesson.professorId,
    title: lesson.title,
    description: lesson.description,
    classDate: formatClassDate(lesson.classDate),
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    videoUrl: lesson.videoUrl,
    thumbnailUrl: lesson.thumbnailUrl,
    active: lesson.active,
    attendanceCount: lesson._count?.attendances ?? 0,
    modality: lesson.modality
      ? { id: lesson.modality.id, name: lesson.modality.name, slug: lesson.modality.slug }
      : null,
    professor: lesson.professor
      ? { id: lesson.professor.id, name: lesson.professor.name, email: lesson.professor.email }
      : null,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export function contentTypeLabel(contentType: ModalityContentType): string {
  return contentType === "EXERCISE_CATALOG" ? "Catálogo de treinos" : "Galeria de vídeos";
}

export function isVideoDataUrl(value: string): boolean {
  return value.startsWith("data:video/") || value.startsWith("data:application/octet-stream");
}

export function isAllowedVideoUrl(value: string): boolean {
  if (isVideoDataUrl(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
