import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  ensureModalityTemplates,
  ensureTenantModalities,
  isAllowedVideoUrl,
  modalityMatchesPlan,
  normalizeWarmupExercises,
  normalizeWarmupMovementCatalog,
  parseClassDate,
  formatClassDate,
  serializeModality,
  serializeModalityTemplate,
  serializeLessonAttendance,
  effectiveAttendanceStatus,
  serializeProfessor,
  serializeProfessorLesson,
  slugifyModality,
} from "../../lib/modalities.js";
import { normalizeScheduleSlots, serializeScheduleSlot, weekdayFromDateInput, listDatesInMonth, parseMonthInput, currentMonthInput, scheduleOccurrenceKey } from "../../lib/schedules.js";
import { normalizePlans } from "../owner/plans.js";
import {
  parseWorkoutDate,
  saveStudentWorkoutSchema,
  serializeWorkout,
  serializeWorkoutSummary,
  workoutInclude,
} from "../owner/workouts.js";
import { ensureExerciseCatalog } from "../../lib/exercise-catalog.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireStudent } from "../../middleware/student.js";
import {
  modalityScheduleSchema,
  modalityTemplateSchema,
  ownerLessonCreateSchema,
  scheduleOccurrenceSchema,
  professorCreateSchema,
  professorLessonActiveSchema,
  professorLessonSchema,
  professorPresencaActionSchema,
  professorSelfSchema,
  professorUpdateSchema,
  tenantModalityCreateSchema,
  tenantModalityOfferSchema,
  tenantModalityUpdateSchema,
} from "./schemas.js";

const lessonInclude = {
  modality: { select: { id: true, name: true, slug: true, linkedPlans: true, contentType: true, active: true } },
  professor: { select: { id: true, name: true, email: true } },
  _count: { select: { attendances: true } },
} as const;

async function getTenantPlans(tenantId: string) {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { planosPrecos: true },
  });
  return normalizePlans(config?.planosPrecos ?? null);
}

function buildCancellationKeySet(
  cancellations: Array<{ classDate: Date; startTime: string; endTime: string }>,
): Set<string> {
  return new Set(
    cancellations.map((item) =>
      scheduleOccurrenceKey(formatClassDate(item.classDate), item.startTime, item.endTime),
    ),
  );
}

function isOccurrenceCancelled(
  cancellations: Set<string>,
  classDate: string,
  startTime: string,
  endTime: string,
): boolean {
  return cancellations.has(scheduleOccurrenceKey(classDate, startTime, endTime));
}

async function buildProfessorStats(
  tenantId: string,
  userId: string,
  modalityIds: string[],
) {
  if (modalityIds.length === 0) return [];

  const tenantPlans = await getTenantPlans(tenantId);

  const [modalities, students, lessons, assignments] = await Promise.all([
    prisma.modality.findMany({
      where: { tenantId, id: { in: modalityIds } },
      select: { id: true, name: true, linkedPlans: true, contentType: true, active: true },
    }),
    prisma.student.findMany({
      where: { tenantId, active: true },
      select: { planoModalidade: true },
    }),
    prisma.professorLesson.findMany({
      where: { tenantId, professorId: userId, modalityId: { in: modalityIds } },
      select: {
        modalityId: true,
        active: true,
        _count: { select: { attendances: true } },
      },
    }),
    prisma.professorModality.findMany({
      where: { tenantId, userId, modalityId: { in: modalityIds } },
      select: { modalityId: true, active: true },
    }),
  ]);

  return modalities.map((modality) => {
    const modalityLessons = lessons.filter((lesson) => lesson.modalityId === modality.id);
    const assignment = assignments.find((item) => item.modalityId === modality.id);
    const studentCount = students.filter((student) =>
      modalityMatchesPlan(modality, student.planoModalidade, tenantPlans),
    ).length;

    return {
      modalityId: modality.id,
      modalityName: modality.name,
      assignmentActive: assignment?.active ?? false,
      studentCount,
      lessonCount: modalityLessons.length,
      activeLessonCount: modalityLessons.filter((lesson) => lesson.active).length,
      attendanceCount: modalityLessons.reduce(
        (total, lesson) => total + lesson._count.attendances,
        0,
      ),
    };
  });
}

async function serializeProfessorDetails(
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    active: boolean;
  },
  tenantId: string,
  modalityIds: string[],
) {
  const [professorSchedules, modalityStats, recentLessons] = await Promise.all([
    getProfessorSchedules(user.id, tenantId),
    buildProfessorStats(tenantId, user.id, modalityIds),
    prisma.professorLesson.findMany({
      where: { tenantId, professorId: user.id },
      orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: lessonInclude,
    }),
  ]);

  return serializeProfessor(user, modalityIds, professorSchedules, {
    modalityStats,
    recentLessons: recentLessons.map(serializeProfessorLesson),
  });
}

async function getProfessorModalityIds(userId: string, tenantId: string): Promise<string[]> {
  const rows = await prisma.professorModality.findMany({
    where: { userId, tenantId, active: true },
    select: { modalityId: true },
  });
  return rows.map((row) => row.modalityId);
}

async function assertProfessorAccess(
  userId: string,
  tenantId: string,
  modalityId: string,
): Promise<boolean> {
  const assignment = await prisma.professorModality.findFirst({
    where: { userId, tenantId, modalityId, active: true },
  });
  return Boolean(assignment);
}

const modalityListInclude = {
  _count: {
    select: {
      lessons: { where: { active: true } },
      professors: { where: { active: true } },
    },
  },
  scheduleSlots: {
    where: { active: true },
    orderBy: [{ weekday: "asc" as const }, { startTime: "asc" as const }],
  },
};

async function saveModalitySchedule(
  tenantId: string,
  modalityId: string,
  slots: Array<{ weekday: number; startTime: string; endTime: string }>,
) {
  const normalized = normalizeScheduleSlots(slots);
  await prisma.modalityScheduleSlot.deleteMany({ where: { tenantId, modalityId } });
  if (normalized.length === 0) return;

  await prisma.modalityScheduleSlot.createMany({
    data: normalized.map((slot) => ({
      tenantId,
      modalityId,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      active: true,
    })),
  });
}

async function saveProfessorSchedules(
  tenantId: string,
  userId: string,
  schedules: Array<{ modalityId: string; slots: Array<{ weekday: number; startTime: string; endTime: string }> }>,
) {
  await prisma.professorScheduleSlot.deleteMany({ where: { tenantId, userId } });

  const rows = schedules.flatMap((entry) =>
    normalizeScheduleSlots(entry.slots).map((slot) => ({
      tenantId,
      userId,
      modalityId: entry.modalityId,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      active: true,
    })),
  );

  if (rows.length > 0) {
    await prisma.professorScheduleSlot.createMany({ data: rows });
  }
}

async function getProfessorSchedules(userId: string, tenantId: string) {
  const slots = await prisma.professorScheduleSlot.findMany({
    where: { tenantId, userId, active: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });

  const grouped = new Map<string, ReturnType<typeof serializeScheduleSlot>[]>();
  for (const slot of slots) {
    const current = grouped.get(slot.modalityId) ?? [];
    current.push(serializeScheduleSlot(slot));
    grouped.set(slot.modalityId, current);
  }

  return Array.from(grouped.entries()).map(([modalityId, scheduleSlots]) => ({
    modalityId,
    slots: scheduleSlots,
  }));
}

export async function registerDevModalityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/dev/modality-templates",
    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },
    async (_request, reply) => {
      await ensureModalityTemplates();
      const templates = await prisma.modalityTemplate.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return reply.send({ templates: templates.map(serializeModalityTemplate) });
    },
  );

  app.post(
    "/dev/modality-templates",
    { preHandler: [requireAuth, requireRole(UserRole.DESENVOLVIMENTO)] },
    async (request, reply) => {
      const parsed = modalityTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const data = parsed.data;
      const template = await prisma.modalityTemplate.create({
        data: {
          name: data.name.trim(),
          slug: slugifyModality(data.slug ?? data.name),
          contentType: data.contentType,
          description: data.description?.trim() || null,
          active: data.active ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });

      return reply.send({
        template: serializeModalityTemplate(template),
        message: "Modalidade cadastrada para as academias.",
      });
    },
  );
}

export async function registerOwnerModalityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/owner/modalidades", async (request, reply) => {
    const tenantId = request.user.tenantId;
    await ensureTenantModalities(tenantId);

    const modalidades = await prisma.modality.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: modalityListInclude,
    });

    return reply.send({ modalidades: modalidades.map(serializeModality) });
  });

  app.post("/owner/modalidades", async (request, reply) => {
    const parsed = tenantModalityCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    await ensureTenantModalities(tenantId);
    const data = parsed.data;
    const slug = slugifyModality(data.name);
    const existingSlug = await prisma.modality.findFirst({
      where: { tenantId, slug },
    });

    if (existingSlug) {
      return reply.status(409).send({ error: "Já existe uma modalidade com esse nome." });
    }

    const last = await prisma.modality.findFirst({
      where: { tenantId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const modality = await prisma.modality.create({
      data: {
        tenantId,
        name: data.name.trim(),
        slug,
        contentType: data.contentType,
        description: data.description?.trim() || null,
        linkedPlans: [data.name.trim()],
        sortOrder: (last?.sortOrder ?? 0) + 1,
        active: true,
      },
      include: modalityListInclude,
    });

    return reply.send({
      modalidade: serializeModality(modality),
      message: "Modalidade adicionada à academia.",
    });
  });

  app.put<{ Params: { id: string } }>(
    "/owner/modalidades/:id/horarios",
    async (request, reply) => {
      const parsed = modalityScheduleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const existing = await prisma.modality.findFirst({
        where: { id: request.params.id, tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      await saveModalitySchedule(tenantId, existing.id, parsed.data.slots);
      if (parsed.data.repeatsMonthly !== undefined) {
        await prisma.modality.update({
          where: { id: existing.id },
          data: { scheduleRepeatsMonthly: parsed.data.repeatsMonthly },
        });
      }
      const modality = await prisma.modality.findUniqueOrThrow({
        where: { id: existing.id },
        include: modalityListInclude,
      });

      return reply.send({
        modalidade: serializeModality(modality),
        message: "Horários da modalidade atualizados.",
      });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { month?: string } }>(
    "/owner/modalidades/:id/ocorrencias",
    async (request, reply) => {
      const tenantId = request.user.tenantId;
      const monthInput = request.query.month ?? currentMonthInput();
      const parsedMonth = parseMonthInput(monthInput);
      if (!parsedMonth) {
        return reply.status(400).send({ error: "Informe o mês no formato AAAA-MM." });
      }

      const modality = await prisma.modality.findFirst({
        where: { id: request.params.id, tenantId },
        include: {
          scheduleSlots: {
            where: { active: true },
            orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          },
        },
      });

      if (!modality) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      const cancellations = await prisma.modalityScheduleCancellation.findMany({
        where: {
          tenantId,
          modalityId: modality.id,
          classDate: {
            gte: parseClassDate(`${parsedMonth.year}-${String(parsedMonth.month).padStart(2, "0")}-01`),
            lte: parseClassDate(
              `${parsedMonth.year}-${String(parsedMonth.month).padStart(2, "0")}-${String(new Date(parsedMonth.year, parsedMonth.month, 0).getDate()).padStart(2, "0")}`,
            ),
          },
        },
      });
      const cancelledKeys = buildCancellationKeySet(cancellations);

      const weekdays = Array.from(new Set(modality.scheduleSlots.map((slot) => slot.weekday)));
      const dates = modality.scheduleRepeatsMonthly
        ? listDatesInMonth(parsedMonth.year, parsedMonth.month, weekdays)
        : [];

      const ocorrencias = dates.flatMap((classDate) => {
        const weekday = weekdayFromDateInput(classDate);
        return modality.scheduleSlots
          .filter((slot) => slot.weekday === weekday)
          .map((slot) => ({
            classDate,
            weekday,
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: `${slot.startTime} – ${slot.endTime}`,
            cancelled: isOccurrenceCancelled(
              cancelledKeys,
              classDate,
              slot.startTime,
              slot.endTime,
            ),
          }));
      });

      return reply.send({
        month: monthInput,
        repeatsMonthly: modality.scheduleRepeatsMonthly,
        ocorrencias,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/owner/modalidades/:id/ocorrencias/cancelar",
    async (request, reply) => {
      const parsed = scheduleOccurrenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const modality = await prisma.modality.findFirst({
        where: { id: request.params.id, tenantId },
      });
      if (!modality) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      await prisma.modalityScheduleCancellation.upsert({
        where: {
          modalityId_classDate_startTime_endTime: {
            modalityId: modality.id,
            classDate: parseClassDate(parsed.data.classDate),
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
          },
        },
        update: {},
        create: {
          tenantId,
          modalityId: modality.id,
          classDate: parseClassDate(parsed.data.classDate),
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        },
      });

      return reply.send({ message: "Aula cancelada. A vaga foi liberada a partir desta data." });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/owner/modalidades/:id/ocorrencias/cancelar",
    async (request, reply) => {
      const parsed = scheduleOccurrenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const modality = await prisma.modality.findFirst({
        where: { id: request.params.id, tenantId },
      });
      if (!modality) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      await prisma.modalityScheduleCancellation.deleteMany({
        where: {
          tenantId,
          modalityId: modality.id,
          classDate: parseClassDate(parsed.data.classDate),
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        },
      });

      return reply.send({ message: "Cancelamento removido. A aula voltou para a grade." });
    },
  );

  app.get("/owner/modalidades/grade", async (request, reply) => {
    const tenantId = request.user.tenantId;
    await ensureTenantModalities(tenantId);

    const [modalidades, professorSlots] = await Promise.all([
      prisma.modality.findMany({
        where: { tenantId, active: true },
        include: {
          scheduleSlots: {
            where: { active: true },
            orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.professorScheduleSlot.findMany({
        where: { tenantId, active: true },
        include: {
          user: { select: { id: true, name: true, email: true } },
          modality: { select: { id: true, name: true } },
        },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      }),
    ]);

    return reply.send({
      modalidades: modalidades.map((item) => ({
        id: item.id,
        name: item.name,
        contentType: item.contentType,
        scheduleSlots: item.scheduleSlots.map(serializeScheduleSlot),
      })),
      professores: professorSlots.map((slot) => ({
        id: slot.id,
        modalityId: slot.modalityId,
        modalityName: slot.modality.name,
        professorId: slot.userId,
        professorName: slot.user.name ?? slot.user.email,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    });
  });

  app.get("/owner/minhas-modalidades", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const userId = request.user.sub;
    await ensureTenantModalities(tenantId);

    const assignments = await prisma.professorModality.findMany({
      where: { tenantId, userId, active: true },
      include: {
        modality: {
          include: {
            scheduleSlots: {
              where: { active: true },
              orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
            },
          },
        },
      },
    });

    if (assignments.length > 0) {
      return reply.send({
        modalidades: assignments
          .map((item) => serializeModality(item.modality))
          .filter((item) => item.active),
      });
    }

    const fallback = await prisma.modality.findMany({
      where: { tenantId, active: true, contentType: "EXERCISE_CATALOG" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: modalityListInclude,
    });

    return reply.send({ modalidades: fallback.map(serializeModality) });
  });

  app.put("/owner/modalidades/ofertadas", async (request, reply) => {
    const parsed = tenantModalityOfferSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    await ensureTenantModalities(tenantId);

    const selectedIds = new Set(parsed.data.modalityIds);
    const all = await prisma.modality.findMany({ where: { tenantId } });

    await prisma.$transaction(
      all.map((item) =>
        prisma.modality.update({
          where: { id: item.id },
          data: { active: selectedIds.has(item.id) },
        }),
      ),
    );

    const modalidades = await prisma.modality.findMany({
      where: { tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: modalityListInclude,
    });

    return reply.send({
      modalidades: modalidades.map(serializeModality),
      message: "Modalidades ofertadas atualizadas.",
    });
  });

  app.patch<{ Params: { id: string } }>(
    "/owner/modalidades/:id",
    async (request, reply) => {
      const parsed = tenantModalityUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const existing = await prisma.modality.findFirst({
        where: { id: request.params.id, tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      const data = parsed.data;
      const modality = await prisma.modality.update({
        where: { id: existing.id },
        data: {
          ...(data.linkedPlans ? { linkedPlans: data.linkedPlans } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.warmupExercises
            ? {
                warmupExercises: normalizeWarmupExercises(
                  data.warmupExercises,
                ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
        include: modalityListInclude,
      });

      return reply.send({
        modalidade: serializeModality(modality),
        message: "Modalidade atualizada.",
      });
    },
  );

  app.get("/owner/professores", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const assignments = await prisma.professorModality.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, active: true } },
      },
    });

    const grouped = new Map<
      string,
      { user: (typeof assignments)[number]["user"]; modalityIds: string[] }
    >();

    for (const row of assignments) {
      const current = grouped.get(row.userId) ?? { user: row.user, modalityIds: [] };
      if (!current.modalityIds.includes(row.modalityId)) {
        current.modalityIds.push(row.modalityId);
      }
      grouped.set(row.userId, current);
    }

    const professores = await Promise.all(
      Array.from(grouped.values()).map((item) =>
        serializeProfessorDetails(item.user, tenantId, item.modalityIds),
      ),
    );

    return reply.send({ professores });
  });

  app.post("/owner/professores", async (request, reply) => {
    const parsed = professorCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    const data = parsed.data;
    const email = data.email.trim().toLowerCase();

    const modalities = await prisma.modality.findMany({
      where: {
        tenantId,
        id: { in: data.modalityIds },
        active: true,
      },
    });

    if (modalities.length !== data.modalityIds.length) {
      return reply.status(400).send({
        error: "Selecione modalidades válidas e ativas.",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    if (existing && existing.role !== UserRole.PROFESSOR && existing.role !== UserRole.PROPRIETARIO) {
      return reply.status(409).send({ error: "Este e-mail já está em uso com outro perfil." });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const professor = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: data.name.trim(),
            active: true,
            ...(existing.role === UserRole.PROFESSOR ? { passwordHash } : {}),
          },
        })
      : await prisma.user.create({
          data: {
            tenantId,
            email,
            name: data.name.trim(),
            passwordHash,
            role: UserRole.PROFESSOR,
            active: true,
          },
        });

    await prisma.professorModality.deleteMany({ where: { userId: professor.id, tenantId } });
    await prisma.professorModality.createMany({
      data: data.modalityIds.map((modalityId) => ({
        tenantId,
        userId: professor.id,
        modalityId,
        active: true,
      })),
    });

    const schedules =
      data.schedules?.filter((entry) => data.modalityIds.includes(entry.modalityId)) ?? [];
    if (schedules.length > 0) {
      await saveProfessorSchedules(tenantId, professor.id, schedules);
    }

    return reply.send({
      professor: await serializeProfessorDetails(professor, tenantId, data.modalityIds),
      message: "Professor cadastrado e modalidades liberadas.",
    });
  });

  app.post("/owner/professores/eu", async (request, reply) => {
    const parsed = professorSelfSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    const userId = request.user.sub;
    const data = parsed.data;

    const modalities = await prisma.modality.findMany({
      where: {
        tenantId,
        id: { in: data.modalityIds },
        active: true,
      },
    });

    if (modalities.length !== data.modalityIds.length) {
      return reply.status(400).send({ error: "Selecione modalidades válidas." });
    }

    await prisma.professorModality.deleteMany({ where: { userId, tenantId } });
    await prisma.professorModality.createMany({
      data: data.modalityIds.map((modalityId) => ({
        tenantId,
        userId,
        modalityId,
        active: true,
      })),
    });

    const schedules =
      data.schedules?.filter((entry) => data.modalityIds.includes(entry.modalityId)) ?? [];
    if (schedules.length > 0) {
      await saveProfessorSchedules(tenantId, userId, schedules);
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return reply.send({
      professor: await serializeProfessorDetails(user, tenantId, data.modalityIds),
      message: "Seu acesso de professor foi liberado.",
    });
  });

  app.patch<{ Params: { id: string } }>(
    "/owner/professores/:id",
    async (request, reply) => {
      const parsed = professorUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const professor = await prisma.user.findFirst({
        where: {
          id: request.params.id,
          tenantId,
          role: { in: [UserRole.PROFESSOR, UserRole.PROPRIETARIO] },
        },
      });

      if (!professor) {
        return reply.status(404).send({ error: "Professor não encontrado." });
      }

      const data = parsed.data;
      const updated = await prisma.user.update({
        where: { id: professor.id },
        data: {
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.password && professor.role === UserRole.PROFESSOR
            ? { passwordHash: await bcrypt.hash(data.password, 10) }
            : {}),
        },
      });

      if (data.modalityIds) {
        const modalities = await prisma.modality.findMany({
          where: {
            tenantId,
            id: { in: data.modalityIds },
            active: true,
          },
        });
        if (modalities.length !== data.modalityIds.length) {
          return reply.status(400).send({ error: "Modalidades inválidas." });
        }

        await prisma.professorModality.deleteMany({
          where: { userId: professor.id, tenantId },
        });
        await prisma.professorModality.createMany({
          data: data.modalityIds.map((modalityId) => ({
            tenantId,
            userId: professor.id,
            modalityId,
            active: true,
          })),
        });
      }

      if (data.modalityUpdates?.length) {
        for (const update of data.modalityUpdates) {
          await prisma.professorModality.updateMany({
            where: {
              tenantId,
              userId: professor.id,
              modalityId: update.modalityId,
            },
            data: { active: update.active },
          });
        }
      }

      if (data.schedules) {
        const modalityIds =
          data.modalityIds ??
          (
            await prisma.professorModality.findMany({
              where: { tenantId, userId: professor.id },
              select: { modalityId: true },
            })
          ).map((item) => item.modalityId);
        const schedules = data.schedules.filter((entry) => modalityIds.includes(entry.modalityId));
        await saveProfessorSchedules(tenantId, professor.id, schedules);
      }

      const allModalityIds = (
        await prisma.professorModality.findMany({
          where: { tenantId, userId: professor.id },
          select: { modalityId: true },
        })
      ).map((item) => item.modalityId);

      return reply.send({
        professor: await serializeProfessorDetails(updated, tenantId, allModalityIds),
        message: "Professor atualizado.",
      });
    },
  );

  app.patch<{ Params: { professorId: string; lessonId: string } }>(
    "/owner/professores/:professorId/aulas/:lessonId",
    async (request, reply) => {
      const parsed = professorLessonActiveSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const lesson = await prisma.professorLesson.findFirst({
        where: {
          id: request.params.lessonId,
          tenantId,
          professorId: request.params.professorId,
        },
      });

      if (!lesson) {
        return reply.status(404).send({ error: "Aula não encontrada." });
      }

      await prisma.professorLesson.update({
        where: { id: lesson.id },
        data: { active: parsed.data.active },
      });

      return reply.send({
        message: parsed.data.active ? "Aula liberada para os alunos." : "Aula bloqueada.",
      });
    },
  );

  app.delete<{ Params: { professorId: string; lessonId: string } }>(
    "/owner/professores/:professorId/aulas/:lessonId",
    async (request, reply) => {
      const tenantId = request.user.tenantId;
      const lesson = await prisma.professorLesson.findFirst({
        where: {
          id: request.params.lessonId,
          tenantId,
          professorId: request.params.professorId,
        },
        select: { id: true },
      });

      if (!lesson) {
        return reply.status(404).send({ error: "Aula não encontrada." });
      }

      await prisma.professorLesson.delete({ where: { id: lesson.id } });

      return reply.send({ message: "Aula excluída com sucesso." });
    },
  );

  app.get<{ Querystring: { modalityId?: string; classDate?: string; professorId?: string } }>(
    "/owner/aulas",
    async (request, reply) => {
      const tenantId = request.user.tenantId;
      const { modalityId, classDate, professorId } = request.query;

      const aulas = await prisma.professorLesson.findMany({
        where: {
          tenantId,
          ...(modalityId ? { modalityId } : {}),
          ...(professorId ? { professorId } : {}),
          ...(classDate ? { classDate: parseClassDate(classDate) } : {}),
        },
        orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
        include: lessonInclude,
      });

      return reply.send({ aulas: aulas.map(serializeProfessorLesson) });
    },
  );

  app.post("/owner/aulas", async (request, reply) => {
    const parsed = ownerLessonCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    const data = parsed.data;

    if (!isAllowedVideoUrl(data.videoUrl)) {
      return reply.status(400).send({ error: "URL ou upload de vídeo inválido." });
    }

    const professor = await prisma.user.findFirst({
      where: {
        id: data.professorId,
        tenantId,
        active: true,
        role: { in: [UserRole.PROFESSOR, UserRole.PROPRIETARIO] },
      },
    });

    if (!professor) {
      return reply.status(404).send({ error: "Professor não encontrado." });
    }

    const allowed = await assertProfessorAccess(professor.id, tenantId, data.modalityId);
    if (!allowed) {
      return reply.status(400).send({
        error: "Este professor não está liberado para a modalidade selecionada.",
      });
    }

    const lesson = await prisma.professorLesson.create({
      data: {
        tenantId,
        modalityId: data.modalityId,
        professorId: professor.id,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        classDate: parseClassDate(data.classDate),
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl?.trim() || null,
        active: true,
      },
      include: lessonInclude,
    });

    return reply.send({
      aula: serializeProfessorLesson(lesson),
      message: "Aula publicada para a modalidade.",
    });
  });
}

export async function registerProfessorRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook(
    "preHandler",
    requireRole(UserRole.PROFESSOR, UserRole.PROPRIETARIO, UserRole.DESENVOLVIMENTO),
  );

  app.get("/professor/modalidades", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const modalityIds = await getProfessorModalityIds(request.user.sub, tenantId);

    if (modalityIds.length === 0) {
      return reply.status(403).send({ error: "Nenhuma modalidade liberada para você." });
    }

    const modalidades = await prisma.modality.findMany({
      where: { tenantId, id: { in: modalityIds }, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: modalityListInclude,
    });

    return reply.send({ modalidades: modalidades.map(serializeModality) });
  });

  app.get("/professor/horarios", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const schedules = await getProfessorSchedules(request.user.sub, tenantId);
    return reply.send({ schedules });
  });

  app.get("/professor/presencas/pendentes", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const presencas = await prisma.lessonAttendance.findMany({
      where: {
        tenantId,
        status: "STUDENT_CONFIRMED",
        lesson: {
          professorId: request.user.sub,
          active: true,
        },
      },
      include: {
        student: {
          select: { id: true, nomeCompleto: true, planoModalidade: true },
        },
        lesson: {
          include: lessonInclude,
        },
      },
      orderBy: [{ studentConfirmedAt: "desc" }, { markedAt: "desc" }],
    });

    return reply.send({
      presencas: presencas.map((item) =>
        serializeLessonAttendance({
          ...item,
          lesson: serializeProfessorLesson(item.lesson),
        }),
      ),
    });
  });

  app.patch<{ Params: { id: string } }>(
    "/professor/presencas/:id",
    async (request, reply) => {
      const parsed = professorPresencaActionSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const attendance = await prisma.lessonAttendance.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
          lesson: {
            professorId: request.user.sub,
            active: true,
          },
        },
        include: {
          student: {
            select: { id: true, nomeCompleto: true, planoModalidade: true },
          },
          lesson: {
            include: lessonInclude,
          },
        },
      });

      if (!attendance) {
        return reply.status(404).send({ error: "Confirmação não encontrada." });
      }

      if (effectiveAttendanceStatus(attendance) !== "STUDENT_CONFIRMED") {
        return reply.status(400).send({ error: "Esta presença já foi processada." });
      }

      const now = new Date();
      const updated = await prisma.lessonAttendance.update({
        where: { id: attendance.id },
        data: {
          status: parsed.data.action === "validate" ? "VALIDATED" : "REJECTED",
          professorValidatedAt: now,
        },
        include: {
          student: {
            select: { id: true, nomeCompleto: true, planoModalidade: true },
          },
          lesson: {
            include: lessonInclude,
          },
        },
      });

      return reply.send({
        presenca: serializeLessonAttendance({
          ...updated,
          lesson: serializeProfessorLesson(updated.lesson),
        }),
        message:
          parsed.data.action === "validate"
            ? "Presença validada."
            : "Presença rejeitada.",
      });
    },
  );

  app.get("/professor/aulas", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const modalityIds = await getProfessorModalityIds(request.user.sub, tenantId);

    const aulas = await prisma.professorLesson.findMany({
      where: {
        tenantId,
        professorId: request.user.sub,
        modalityId: { in: modalityIds },
        active: true,
      },
      orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
      include: lessonInclude,
    });

    return reply.send({ aulas: aulas.map(serializeProfessorLesson) });
  });

  app.post("/professor/aulas", async (request, reply) => {
    const parsed = professorLessonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    const data = parsed.data;

    if (!isAllowedVideoUrl(data.videoUrl)) {
      return reply.status(400).send({ error: "URL ou upload de vídeo inválido." });
    }

    const allowed = await assertProfessorAccess(request.user.sub, tenantId, data.modalityId);
    if (!allowed) {
      return reply.status(403).send({ error: "Modalidade não liberada para você." });
    }

    const lesson = await prisma.professorLesson.create({
      data: {
        tenantId,
        modalityId: data.modalityId,
        professorId: request.user.sub,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        classDate: parseClassDate(data.classDate),
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl?.trim() || null,
        active: true,
      },
      include: lessonInclude,
    });

    return reply.send({
      aula: serializeProfessorLesson(lesson),
      message: "Aula publicada.",
    });
  });

  app.patch<{ Params: { id: string } }>("/professor/aulas/:id", async (request, reply) => {
    const parsed = professorLessonSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      });
    }

    const tenantId = request.user.tenantId;
    const existing = await prisma.professorLesson.findFirst({
      where: {
        id: request.params.id,
        tenantId,
        professorId: request.user.sub,
        active: true,
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Aula não encontrada." });
    }

    const data = parsed.data;
    if (data.modalityId) {
      const allowed = await assertProfessorAccess(request.user.sub, tenantId, data.modalityId);
      if (!allowed) {
        return reply.status(403).send({ error: "Modalidade não liberada." });
      }
    }

    if (data.videoUrl && !isAllowedVideoUrl(data.videoUrl)) {
      return reply.status(400).send({ error: "Vídeo inválido." });
    }

    const lesson = await prisma.professorLesson.update({
      where: { id: existing.id },
      data: {
        ...(data.modalityId ? { modalityId: data.modalityId } : {}),
        ...(data.title ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description?.trim() || null }
          : {}),
        ...(data.classDate ? { classDate: parseClassDate(data.classDate) } : {}),
        ...(data.videoUrl ? { videoUrl: data.videoUrl } : {}),
        ...(data.thumbnailUrl !== undefined
          ? { thumbnailUrl: data.thumbnailUrl?.trim() || null }
          : {}),
      },
      include: lessonInclude,
    });

    return reply.send({
      aula: serializeProfessorLesson(lesson),
      message: "Aula atualizada.",
    });
  });

  app.delete<{ Params: { id: string } }>("/professor/aulas/:id", async (request, reply) => {
    const existing = await prisma.professorLesson.findFirst({
      where: {
        id: request.params.id,
        tenantId: request.user.tenantId,
        professorId: request.user.sub,
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Aula não encontrada." });
    }

    await prisma.professorLesson.update({
      where: { id: existing.id },
      data: { active: false },
    });

    return reply.send({ message: "Aula removida." });
  });

  app.get<{ Params: { id: string } }>(
    "/professor/aulas/:id/presencas",
    async (request, reply) => {
      const lesson = await prisma.professorLesson.findFirst({
        where: {
          id: request.params.id,
          tenantId: request.user.tenantId,
          professorId: request.user.sub,
          active: true,
        },
      });

      if (!lesson) {
        return reply.status(404).send({ error: "Aula não encontrada." });
      }

      const presencas = await prisma.lessonAttendance.findMany({
        where: { lessonId: lesson.id },
        include: {
          student: {
            select: { id: true, nomeCompleto: true, planoModalidade: true },
          },
        },
        orderBy: { markedAt: "asc" },
      });

      return reply.send({
        presencas: presencas.map((item) =>
          serializeLessonAttendance({
            ...item,
            student: item.student,
          }),
        ),
      });
    },
  );

  app.get("/professor/alunos", async (request, reply) => {
    const tenantId = request.user.tenantId;
    const alunos = await prisma.student.findMany({
      where: { tenantId, active: true },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        nomeCompleto: true,
        planoModalidade: true,
      },
    });
    return reply.send({ alunos });
  });

  app.get("/professor/exercises", async (request, reply) => {
    await ensureExerciseCatalog();
    const exercises = await prisma.exercise.findMany({
      where: { active: true },
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        instructions: true,
        imageUrl: true,
        gifUrl: true,
        phases: true,
        bodyRegion: true,
      },
    });
    return reply.send({ exercises });
  });

  app.patch<{ Params: { id: string } }>(
    "/professor/modalidades/:id",
    async (request, reply) => {
      const parsed = tenantModalityUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const allowed = await assertProfessorAccess(request.user.sub, tenantId, request.params.id);
      if (!allowed) {
        return reply.status(403).send({ error: "Modalidade não liberada para você." });
      }

      const data = parsed.data;
      const modality = await prisma.modality.update({
        where: { id: request.params.id },
        data: {
          ...(data.warmupMovementCatalog
            ? {
                warmupMovementCatalog: normalizeWarmupMovementCatalog(
                  data.warmupMovementCatalog,
                ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...(data.warmupExercises
            ? {
                warmupExercises: normalizeWarmupExercises(
                  data.warmupExercises,
                ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
        include: modalityListInclude,
      });

      const message = data.warmupMovementCatalog
        ? "Catálogo de movimentos atualizado."
        : "Aquecimento atualizado.";

      return reply.send({
        modalidade: serializeModality(modality),
        message,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/professor/alunos/:id/treinos",
    async (request, reply) => {
      const tenantId = request.user.tenantId;
      const student = await prisma.student.findFirst({
        where: { id: request.params.id, tenantId, active: true },
        select: { id: true, nomeCompleto: true },
      });
      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const treinos = await prisma.studentWorkout.findMany({
        where: { studentId: student.id, tenantId, active: true },
        orderBy: { workoutDate: "desc" },
        select: {
          id: true,
          title: true,
          workoutDate: true,
          updatedAt: true,
          source: true,
          _count: { select: { exercises: true } },
        },
      });

      return reply.send({
        aluno: student,
        treinos: treinos.map(serializeWorkoutSummary),
      });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { date?: string } }>(
    "/professor/alunos/:id/treino",
    async (request, reply) => {
      const tenantId = request.user.tenantId;
      const student = await prisma.student.findFirst({
        where: { id: request.params.id, tenantId, active: true },
        select: { id: true, nomeCompleto: true },
      });
      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const dateParam = request.query.date;
      let treino;

      if (dateParam) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          return reply.status(400).send({ error: "Data inválida. Use AAAA-MM-DD." });
        }
        treino = await prisma.studentWorkout.findUnique({
          where: {
            studentId_workoutDate: {
              studentId: student.id,
              workoutDate: parseWorkoutDate(dateParam),
            },
          },
          include: workoutInclude,
        });
      } else {
        treino = await prisma.studentWorkout.findFirst({
          where: { studentId: student.id, tenantId, active: true },
          include: workoutInclude,
          orderBy: { workoutDate: "desc" },
        });
      }

      return reply.send({
        aluno: student,
        treino: treino && treino.active ? serializeWorkout(treino) : null,
      });
    },
  );

  app.put<{ Params: { id: string } }>(
    "/professor/alunos/:id/treino",
    async (request, reply) => {
      const parsed = saveStudentWorkoutSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
        });
      }

      const tenantId = request.user.tenantId;
      const student = await prisma.student.findFirst({
        where: { id: request.params.id, tenantId, active: true },
        select: { id: true },
      });
      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const data = parsed.data;
      const allowed = await assertProfessorAccess(request.user.sub, tenantId, data.modalityId ?? "");
      if (!data.modalityId || !allowed) {
        return reply.status(403).send({ error: "Modalidade não liberada para você." });
      }

      const workoutDate = parseWorkoutDate(data.workoutDate);
      const exerciseIds = data.exercises.map((item) => item.exerciseId);
      const validCount = await prisma.exercise.count({
        where: { id: { in: exerciseIds }, active: true },
      });
      if (validCount !== exerciseIds.length) {
        return reply.status(400).send({ error: "Um ou mais exercícios selecionados não existem." });
      }

      const treino = await prisma.$transaction(async (tx) => {
        const existing = await tx.studentWorkout.findUnique({
          where: {
            studentId_workoutDate: { studentId: student.id, workoutDate },
          },
          select: { id: true },
        });

        if (existing) {
          await tx.studentWorkoutExercise.deleteMany({ where: { studentWorkoutId: existing.id } });
          return tx.studentWorkout.update({
            where: { id: existing.id },
            data: {
              title: data.title.trim(),
              notes: data.notes?.trim() || null,
              modalityId: data.modalityId,
              assignedBy: request.user.sub,
              source: "OWNER",
              active: true,
              exercises: {
                create: data.exercises.map((item) => ({
                  exerciseId: item.exerciseId,
                  phase: item.phase,
                  order: item.order,
                  sets: item.sets,
                  reps: item.reps,
                  load: item.load?.trim() || null,
                  restSeconds: item.restSeconds ?? 60,
                  notes: item.notes?.trim() || null,
                })),
              },
            },
            include: workoutInclude,
          });
        }

        return tx.studentWorkout.create({
          data: {
            tenantId,
            studentId: student.id,
            modalityId: data.modalityId,
            title: data.title.trim(),
            notes: data.notes?.trim() || null,
            workoutDate,
            assignedBy: request.user.sub,
            source: "OWNER",
            exercises: {
              create: data.exercises.map((item) => ({
                exerciseId: item.exerciseId,
                phase: item.phase,
                order: item.order,
                sets: item.sets,
                reps: item.reps,
                load: item.load?.trim() || null,
                restSeconds: item.restSeconds ?? 60,
                notes: item.notes?.trim() || null,
              })),
            },
          },
          include: workoutInclude,
        });
      });

      return reply.send({
        treino: serializeWorkout(treino),
        message: "Treino salvo e publicado para o aluno.",
      });
    },
  );
}

export async function registerStudentModalityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/student/treino-modalidades", { preHandler: [requireStudent] }, async (request, reply) => {
    const student = await prisma.student.findUnique({
      where: { id: request.studentId },
      select: { tenantId: true, planoModalidade: true },
    });

    if (!student) {
      return reply.status(404).send({ error: "Aluno não encontrado." });
    }

    await ensureTenantModalities(student.tenantId);
    const tenantPlans = await getTenantPlans(student.tenantId);

    const modalidades = await prisma.modality.findMany({
      where: { tenantId: student.tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: modalityListInclude,
    });

    const accessible = modalidades.filter((item) =>
      modalityMatchesPlan(item, student.planoModalidade, tenantPlans),
    );

    return reply.send({
      planoModalidade: student.planoModalidade,
      modalidades: accessible.map(serializeModality),
    });
  });

  app.get<{ Querystring: { modalityId: string } }>(
    "/student/modality-aquecimento",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const modalityId = request.query.modalityId;
      if (!modalityId) {
        return reply.status(400).send({ error: "Informe a modalidade." });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { tenantId: true, planoModalidade: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const tenantPlans = await getTenantPlans(student.tenantId);
      const modality = await prisma.modality.findFirst({
        where: { id: modalityId, tenantId: student.tenantId, active: true },
      });

      if (!modality) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      if (!modalityMatchesPlan(modality, student.planoModalidade, tenantPlans)) {
        return reply.status(403).send({ error: "Modalidade não incluída no seu plano." });
      }

      const warmupItems = normalizeWarmupExercises(modality.warmupExercises);
      if (warmupItems.length === 0) {
        return reply.send({ exercises: [] });
      }

      const catalogExerciseIds = warmupItems
        .map((item) => item.exerciseId)
        .filter((item): item is string => Boolean(item));

      const exercises = await prisma.exercise.findMany({
        where: {
          active: true,
          id: { in: catalogExerciseIds },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          muscleGroup: true,
          equipment: true,
          instructions: true,
          imageUrl: true,
          gifUrl: true,
          phases: true,
          bodyRegion: true,
        },
      });

      const exerciseById = new Map(exercises.map((item) => [item.id, item]));

      return reply.send({
        exercises: warmupItems
          .map((item) => {
            const catalogExercise = item.exerciseId
              ? exerciseById.get(item.exerciseId)
              : null;
            const exercise =
              catalogExercise ??
              (item.customName
                ? {
                    id: `custom-${modality.id}-${item.order}`,
                    slug: `custom-${item.order}`,
                    name: item.customName,
                    muscleGroup: "Personalizado",
                    equipment: null,
                    instructions: "",
                    imageUrl: null,
                    gifUrl: null,
                    phases: ["INICIO"],
                    bodyRegion: "AQUECIMENTO" as const,
                  }
                : null);
            if (!exercise) return null;
            return {
              id: `${modality.id}-${item.order}`,
              exerciseId: item.exerciseId ?? exercise.id,
              phase: "INICIO" as const,
              order: item.order,
              sets: item.sets,
              reps: item.reps ?? "1",
              load: item.load,
              restSeconds: item.restSeconds ?? 60,
              notes: item.notes,
              completedSets: [] as number[],
              exercise,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      });
    },
  );

  app.get<{ Querystring: { modalityId: string } }>(
    "/student/treino-aulas-datas",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const modalityId = request.query.modalityId;
      if (!modalityId) {
        return reply.status(400).send({ error: "Informe a modalidade." });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { tenantId: true, planoModalidade: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const tenantPlans = await getTenantPlans(student.tenantId);
      const modality = await prisma.modality.findFirst({
        where: { id: modalityId, tenantId: student.tenantId, active: true },
        include: {
          scheduleSlots: {
            where: { active: true },
            orderBy: [{ weekday: "asc" as const }, { startTime: "asc" as const }],
          },
        },
      });

      if (!modality) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      if (!modalityMatchesPlan(modality, student.planoModalidade, tenantPlans)) {
        return reply.status(403).send({ error: "Modalidade não incluída no seu plano." });
      }

      const lessons = await prisma.professorLesson.findMany({
        where: { tenantId: student.tenantId, modalityId, active: true },
        select: { classDate: true },
        orderBy: { classDate: "asc" },
      });

      const dateSet = new Set(lessons.map((lesson) => formatClassDate(lesson.classDate)));

      if (modality.scheduleRepeatsMonthly && modality.scheduleSlots.length > 0) {
        const month = currentMonthInput();
        const parsedMonth = parseMonthInput(month);
        if (parsedMonth) {
          const weekdays = Array.from(new Set(modality.scheduleSlots.map((slot) => slot.weekday)));
          const cancellations = await prisma.modalityScheduleCancellation.findMany({
            where: { tenantId: student.tenantId, modalityId: modality.id },
          });
          const cancelledKeys = buildCancellationKeySet(cancellations);

          for (const classDate of listDatesInMonth(
            parsedMonth.year,
            parsedMonth.month,
            weekdays,
          )) {
            const weekday = weekdayFromDateInput(classDate);
            const hasOpenSlot = modality.scheduleSlots.some(
              (slot) =>
                slot.weekday === weekday &&
                !isOccurrenceCancelled(
                  cancelledKeys,
                  classDate,
                  slot.startTime,
                  slot.endTime,
                ),
            );
            if (hasOpenSlot) {
              dateSet.add(classDate);
            }
          }
        }
      }

      const dates = Array.from(dateSet)
        .sort()
        .map((classDate) => ({ classDate, hasLesson: true }));

      return reply.send({ dates });
    },
  );

  app.get<{ Querystring: { modalityId: string; classDate: string } }>(
    "/student/treino-aulas",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const { modalityId, classDate } = request.query;
      if (!modalityId || !classDate) {
        return reply.status(400).send({ error: "Informe modalidade e data." });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { tenantId: true, planoModalidade: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      await ensureTenantModalities(student.tenantId);
      const tenantPlans = await getTenantPlans(student.tenantId);

      const modality = await prisma.modality.findFirst({
        where: { id: modalityId, tenantId: student.tenantId, active: true },
        include: {
          scheduleSlots: {
            where: { active: true },
            orderBy: [{ weekday: "asc" as const }, { startTime: "asc" as const }],
          },
        },
      });

      if (!modality) {
        return reply.status(404).send({ error: "Modalidade não encontrada." });
      }

      if (!modalityMatchesPlan(modality, student.planoModalidade, tenantPlans)) {
        return reply.status(403).send({ error: "Esta modalidade não está incluída no seu plano." });
      }

      const weekday = weekdayFromDateInput(classDate);
      const cancellations = await prisma.modalityScheduleCancellation.findMany({
        where: {
          tenantId: student.tenantId,
          modalityId: modality.id,
          classDate: parseClassDate(classDate),
        },
      });
      const cancelledKeys = buildCancellationKeySet(cancellations);

      const lessons = await prisma.professorLesson.findMany({
        where: {
          tenantId: student.tenantId,
          modalityId: modality.id,
          active: true,
          classDate: parseClassDate(classDate),
        },
        orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
        include: lessonInclude,
      });

      const professorSlots = await prisma.professorScheduleSlot.findMany({
        where: {
          tenantId: student.tenantId,
          modalityId: modality.id,
          weekday,
          active: true,
        },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: [{ startTime: "asc" }],
      });

      const modalitySlots = modality.scheduleSlots.filter((slot) => slot.weekday === weekday);
      const slotSources =
        professorSlots.length > 0
          ? professorSlots.map((slot) => ({
              startTime: slot.startTime,
              endTime: slot.endTime,
              professorName: slot.user.name ?? slot.user.email,
            }))
          : modalitySlots.map((slot) => ({
              startTime: slot.startTime,
              endTime: slot.endTime,
              professorName: null as string | null,
            }));

      const findLessonForSlot = (startTime: string, endTime: string) =>
        lessons.find(
          (lesson) =>
            lesson.startTime === startTime &&
            lesson.endTime === endTime,
        ) ?? null;

      const horariosFromLessons = lessons
        .filter(
          (lesson) =>
            !lesson.startTime ||
            !lesson.endTime ||
            !isOccurrenceCancelled(
              cancelledKeys,
              classDate,
              lesson.startTime,
              lesson.endTime,
            ),
        )
        .map((lesson) => ({
        startTime: lesson.startTime ?? "00:00",
        endTime: lesson.endTime ?? "23:59",
        label:
          lesson.startTime && lesson.endTime
            ? `${lesson.startTime} – ${lesson.endTime}`
            : lesson.title,
        professorName: lesson.professor?.name ?? lesson.professor?.email ?? null,
        lesson: serializeProfessorLesson(lesson),
      }));

      const usedKeys = new Set(
        horariosFromLessons.map((item) => `${item.startTime}-${item.endTime}`),
      );

      const horariosFromSlots = slotSources
        .filter(
          (slot) =>
            !usedKeys.has(`${slot.startTime}-${slot.endTime}`) &&
            !isOccurrenceCancelled(cancelledKeys, classDate, slot.startTime, slot.endTime),
        )
        .map((slot) => {
          const lesson = findLessonForSlot(slot.startTime, slot.endTime);
          return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: `${slot.startTime} – ${slot.endTime}`,
            professorName:
              lesson?.professor?.name ?? lesson?.professor?.email ?? slot.professorName,
            lesson: lesson ? serializeProfessorLesson(lesson) : null,
          };
        });

      const horarios = [...horariosFromLessons, ...horariosFromSlots].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );

      return reply.send({
        planoModalidade: student.planoModalidade,
        modality: serializeModality(modality),
        classDate,
        weekday,
        horarios,
      });
    },
  );

  app.get<{ Querystring: { classDate: string } }>(
    "/student/grade-dia",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const { classDate } = request.query;
      if (!classDate) {
        return reply.status(400).send({ error: "Informe a data." });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { tenantId: true, planoModalidade: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      await ensureTenantModalities(student.tenantId);
      const tenantPlans = await getTenantPlans(student.tenantId);
      const weekday = weekdayFromDateInput(classDate);

      const modalidades = await prisma.modality.findMany({
        where: { tenantId: student.tenantId, active: true },
        include: {
          scheduleSlots: {
            where: { active: true },
            orderBy: [{ weekday: "asc" as const }, { startTime: "asc" as const }],
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      const accessible = modalidades.filter((item) =>
        modalityMatchesPlan(item, student.planoModalidade, tenantPlans),
      );

      const cancellations = await prisma.modalityScheduleCancellation.findMany({
        where: {
          tenantId: student.tenantId,
          classDate: parseClassDate(classDate),
        },
      });
      const cancelledKeys = buildCancellationKeySet(cancellations);

      const entries: Array<{
        modalityId: string;
        modalityName: string;
        contentType: string;
        startTime: string;
        endTime: string;
        label: string;
        hasLesson: boolean;
      }> = [];

      for (const modality of accessible) {
        const slotsForDay = modality.scheduleSlots.filter((slot) => slot.weekday === weekday);
        if (slotsForDay.length === 0 && !modality.scheduleRepeatsMonthly) continue;

        for (const slot of slotsForDay) {
          if (
            isOccurrenceCancelled(cancelledKeys, classDate, slot.startTime, slot.endTime)
          ) {
            continue;
          }

          const lesson = await prisma.professorLesson.findFirst({
            where: {
              tenantId: student.tenantId,
              modalityId: modality.id,
              active: true,
              classDate: parseClassDate(classDate),
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
            select: { id: true },
          });

          entries.push({
            modalityId: modality.id,
            modalityName: modality.name,
            contentType: modality.contentType,
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: `${slot.startTime} – ${slot.endTime}`,
            hasLesson: Boolean(lesson),
          });
        }
      }

      entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

      return reply.send({
        planoModalidade: student.planoModalidade,
        classDate,
        weekday,
        sequencia: entries,
      });
    },
  );

  app.get<{ Querystring: { modalityId?: string } }>(
    "/student/galeria",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const student = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { tenantId: true, planoModalidade: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      await ensureTenantModalities(student.tenantId);
      const tenantPlans = await getTenantPlans(student.tenantId);

      const modalidades = await prisma.modality.findMany({
        where: { tenantId: student.tenantId, active: true, contentType: "VIDEO_GALLERY" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { lessons: { where: { active: true } } } } },
      });

      const accessibleModalidades = modalidades.filter((item) =>
        modalityMatchesPlan(item, student.planoModalidade, tenantPlans),
      );

      const matched = accessibleModalidades.find((item) =>
        modalityMatchesPlan(item, student.planoModalidade, tenantPlans),
      );
      const selectedModalityId =
        request.query.modalityId ?? matched?.id ?? accessibleModalidades[0]?.id ?? null;

      const selectedModality =
        accessibleModalidades.find((item) => item.id === selectedModalityId) ?? null;

      const lessons = selectedModality
        ? await prisma.professorLesson.findMany({
            where: {
              tenantId: student.tenantId,
              modalityId: selectedModality.id,
              active: true,
            },
            orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
            include: lessonInclude,
          })
        : [];

      return reply.send({
        planoModalidade: student.planoModalidade,
        modalidadeAtual: matched ? serializeModality(matched) : null,
        modalidadeSelecionada: selectedModality ? serializeModality(selectedModality) : null,
        modalidades: accessibleModalidades.map(serializeModality),
        aulas: lessons.map(serializeProfessorLesson),
      });
    },
  );

  app.get("/student/frequencia", { preHandler: [requireStudent] }, async (request, reply) => {
    const student = await prisma.student.findUnique({
      where: { id: request.studentId },
      select: { tenantId: true, planoModalidade: true },
    });

    if (!student) {
      return reply.status(404).send({ error: "Aluno não encontrado." });
    }

    await ensureTenantModalities(student.tenantId);
    const tenantPlans = await getTenantPlans(student.tenantId);

    const modalidades = await prisma.modality.findMany({
      where: { tenantId: student.tenantId, active: true, contentType: "VIDEO_GALLERY" },
    });

    const matchedModalityIds = modalidades
      .filter((item) => modalityMatchesPlan(item, student.planoModalidade, tenantPlans))
      .map((item) => item.id);

    const aulasDisponiveis = await prisma.professorLesson.findMany({
      where: {
        tenantId: student.tenantId,
        modalityId: { in: matchedModalityIds },
        active: true,
      },
      orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
      include: lessonInclude,
    });

    const presencas = await prisma.lessonAttendance.findMany({
      where: { studentId: request.studentId! },
      include: {
        lesson: {
          include: lessonInclude,
        },
      },
      orderBy: { markedAt: "desc" },
    });

    const attendanceByLesson = new Map(
      presencas.map((item) => [item.lessonId, item]),
    );

    return reply.send({
      planoModalidade: student.planoModalidade,
      aulasDisponiveis: aulasDisponiveis.map((lesson) => {
        const attendance = attendanceByLesson.get(lesson.id);
        const status = attendance ? effectiveAttendanceStatus(attendance) : null;
        return {
          ...serializeProfessorLesson(lesson),
          presencaStatus: status,
          presencaMarcada: status === "VALIDATED",
          presencaPendente: status === "STUDENT_CONFIRMED",
        };
      }),
      historico: presencas
        .filter((item) => effectiveAttendanceStatus(item) === "VALIDATED")
        .map((item) => ({
          id: item.id,
          markedAt: item.markedAt.toISOString(),
          professorValidatedAt: item.professorValidatedAt?.toISOString() ?? null,
          aula: serializeProfessorLesson(item.lesson),
        })),
      totalPresencas: presencas.filter(
        (item) => effectiveAttendanceStatus(item) === "VALIDATED",
      ).length,
    });
  });

  app.post<{ Params: { id: string } }>(
    "/student/aulas/:id/presenca",
    { preHandler: [requireStudent] },
    async (request, reply) => {
      const student = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { tenantId: true, planoModalidade: true },
      });

      if (!student) {
        return reply.status(404).send({ error: "Aluno não encontrado." });
      }

      const lesson = await prisma.professorLesson.findFirst({
        where: {
          id: request.params.id,
          tenantId: student.tenantId,
          active: true,
        },
        include: { modality: true },
      });

      if (!lesson) {
        return reply.status(404).send({ error: "Aula não encontrada." });
      }

      const tenantPlans = await getTenantPlans(student.tenantId);
      if (!modalityMatchesPlan(lesson.modality, student.planoModalidade, tenantPlans)) {
        return reply.status(403).send({ error: "Esta aula não pertence à sua modalidade." });
      }

      const existing = await prisma.lessonAttendance.findUnique({
        where: {
          lessonId_studentId: {
            lessonId: lesson.id,
            studentId: request.studentId!,
          },
        },
      });

      if (existing) {
        const status = effectiveAttendanceStatus(existing);
        if (status === "VALIDATED") {
          return reply.send({
            presenca: serializeLessonAttendance(existing),
            message: "Sua presença já foi validada pelo professor.",
          });
        }
        if (status === "STUDENT_CONFIRMED") {
          return reply.send({
            presenca: serializeLessonAttendance(existing),
            message: "Confirmação já enviada. Aguarde a validação do professor.",
          });
        }
      }

      const now = new Date();
      const attendance = await prisma.lessonAttendance.upsert({
        where: {
          lessonId_studentId: {
            lessonId: lesson.id,
            studentId: request.studentId!,
          },
        },
        update: {
          status: "STUDENT_CONFIRMED",
          studentConfirmedAt: now,
          markedAt: now,
          professorValidatedAt: null,
        },
        create: {
          tenantId: student.tenantId,
          lessonId: lesson.id,
          studentId: request.studentId!,
          status: "STUDENT_CONFIRMED",
          studentConfirmedAt: now,
          markedAt: now,
        },
      });

      return reply.send({
        presenca: serializeLessonAttendance(attendance),
        message: "Confirmação enviada. Aguarde a validação do professor.",
      });
    },
  );
}
