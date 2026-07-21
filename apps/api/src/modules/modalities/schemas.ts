import { z } from "zod";

export const modalityContentTypeSchema = z.enum(["EXERCISE_CATALOG", "VIDEO_GALLERY"]);

export const modalityTemplateSchema = z.object({
  name: z.string().min(1, "Informe o nome da modalidade."),
  slug: z.string().min(1).optional(),
  contentType: modalityContentTypeSchema.default("VIDEO_GALLERY"),
  description: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const tenantModalityOfferSchema = z.object({
  modalityIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma modalidade."),
});

export const tenantModalityUpdateSchema = z.object({
  linkedPlans: z.array(z.string().min(1)).optional(),
  active: z.boolean().optional(),
});

export const tenantModalityCreateSchema = z.object({
  name: z.string().min(1, "Informe o nome da modalidade."),
  contentType: modalityContentTypeSchema.default("VIDEO_GALLERY"),
  description: z.string().optional(),
});

export const scheduleSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
});

export const modalityScheduleSchema = z.object({
  slots: z.array(scheduleSlotSchema),
});

export const professorModalityScheduleSchema = z.object({
  modalityId: z.string().uuid(),
  slots: z.array(scheduleSlotSchema),
});

export const professorCreateSchema = z.object({
  name: z.string().min(1, "Informe o nome do professor."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Senha com no mínimo 6 caracteres."),
  modalityIds: z.array(z.string().uuid()).min(1, "Libere ao menos uma modalidade."),
  schedules: z.array(professorModalityScheduleSchema).optional(),
});

export const professorSelfSchema = z.object({
  modalityIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma modalidade."),
  schedules: z.array(professorModalityScheduleSchema).optional(),
});

export const professorUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  modalityIds: z.array(z.string().uuid()).optional(),
  modalityUpdates: z
    .array(
      z.object({
        modalityId: z.string().uuid(),
        active: z.boolean(),
      }),
    )
    .optional(),
  password: z.string().min(6).optional(),
  schedules: z.array(professorModalityScheduleSchema).optional(),
});

export const professorLessonActiveSchema = z.object({
  active: z.boolean(),
});

export const professorLessonSchema = z.object({
  modalityId: z.string().uuid(),
  title: z.string().min(1, "Informe o título da aula."),
  description: z.string().optional(),
  classDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD."),
  startTime: scheduleSlotSchema.shape.startTime.optional(),
  endTime: scheduleSlotSchema.shape.endTime.optional(),
  videoUrl: z.string().min(1, "Envie o vídeo ou informe a URL."),
  thumbnailUrl: z.union([z.string(), z.literal("")]).optional(),
});

export const ownerLessonCreateSchema = professorLessonSchema.extend({
  professorId: z.string().uuid("Selecione o professor."),
});
