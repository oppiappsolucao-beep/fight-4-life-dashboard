import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  ensureModalityTemplates,
  ensureTenantModalities,
  isAllowedVideoUrl,
  modalityMatchesPlan,
  parseClassDate,
  serializeModality,
  serializeModalityTemplate,
  serializeProfessor,
  serializeProfessorLesson,
  slugifyModality,
} from "../../lib/modalities.js";
import { normalizeScheduleSlots, serializeScheduleSlot, weekdayFromDateInput } from "../../lib/schedules.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireStudent } from "../../middleware/student.js";
import {
  modalityScheduleSchema,
  modalityTemplateSchema,
  ownerLessonCreateSchema,
  professorCreateSchema,
  professorLessonActiveSchema,
  professorLessonSchema,
  professorSelfSchema,
  professorUpdateSchema,
  tenantModalityCreateSchema,
  tenantModalityOfferSchema,
  tenantModalityUpdateSchema,
} from "./schemas.js";

const lessonInclude = {
  modality: { select: { id: true, name: true, slug: true } },
  professor: { select: { id: true, name: true, email: true } },
  _count: { select: { attendances: true } },
} as const;

async function buildProfessorStats(
  tenantId: string,
  userId: string,
  modalityIds: string[],
) {
  if (modalityIds.length === 0) return [];

  const [modalities, students, lessons, assignments] = await Promise.all([
    prisma.modality.findMany({
      where: { tenantId, id: { in: modalityIds } },
      select: { id: true, name: true, linkedPlans: true },
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
      modalityMatchesPlan(modality, student.planoModalidade),
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
        linkedPlans: [],
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
      include: { _count: { select: { lessons: true } } },
    });

    return reply.send({ modalidades: modalidades.map(serializeModality) });
  });

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
        presencas: presencas.map((item) => ({
          id: item.id,
          markedAt: item.markedAt.toISOString(),
          student: item.student,
        })),
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

    const modalidades = await prisma.modality.findMany({
      where: { tenantId: student.tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: modalityListInclude,
    });

    const accessible = modalidades.filter((item) =>
      modalityMatchesPlan(item, student.planoModalidade),
    );

    return reply.send({
      planoModalidade: student.planoModalidade,
      modalidades: accessible.map(serializeModality),
    });
  });

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

      if (!modalityMatchesPlan(modality, student.planoModalidade)) {
        return reply.status(403).send({ error: "Esta modalidade não está incluída no seu plano." });
      }

      const weekday = weekdayFromDateInput(classDate);
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
            (lesson.startTime === startTime && lesson.endTime === endTime) ||
            (!lesson.startTime &&
              !lesson.endTime &&
              slotSources.length <= 1 &&
              lessons.length === 1),
        ) ?? null;

      let horarios = slotSources.map((slot) => {
        const lesson = findLessonForSlot(slot.startTime, slot.endTime);
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: `${slot.startTime} – ${slot.endTime}`,
          professorName: lesson?.professor?.name ?? lesson?.professor?.email ?? slot.professorName,
          lesson: lesson ? serializeProfessorLesson(lesson) : null,
        };
      });

      if (horarios.length === 0 && lessons.length > 0) {
        horarios = lessons.map((lesson) => ({
          startTime: lesson.startTime ?? "00:00",
          endTime: lesson.endTime ?? "23:59",
          label: lesson.startTime && lesson.endTime
            ? `${lesson.startTime} – ${lesson.endTime}`
            : "Aula do dia",
          professorName: lesson.professor?.name ?? lesson.professor?.email ?? null,
          lesson: serializeProfessorLesson(lesson),
        }));
      }

      return reply.send({
        planoModalidade: student.planoModalidade,
        modality: serializeModality(modality),
        classDate,
        weekday,
        horarios,
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

      const modalidades = await prisma.modality.findMany({
        where: { tenantId: student.tenantId, active: true, contentType: "VIDEO_GALLERY" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { lessons: { where: { active: true } } } } },
      });

      const accessibleModalidades = modalidades.filter((item) =>
        modalityMatchesPlan(item, student.planoModalidade),
      );

      const matched = accessibleModalidades.find((item) =>
        modalityMatchesPlan(item, student.planoModalidade),
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

    const modalidades = await prisma.modality.findMany({
      where: { tenantId: student.tenantId, active: true, contentType: "VIDEO_GALLERY" },
    });

    const matchedModalityIds = modalidades
      .filter((item) => modalityMatchesPlan(item, student.planoModalidade))
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

    const markedLessonIds = new Set(presencas.map((item) => item.lessonId));

    return reply.send({
      planoModalidade: student.planoModalidade,
      aulasDisponiveis: aulasDisponiveis.map((lesson) => ({
        ...serializeProfessorLesson(lesson),
        presencaMarcada: markedLessonIds.has(lesson.id),
      })),
      historico: presencas.map((item) => ({
        id: item.id,
        markedAt: item.markedAt.toISOString(),
        aula: serializeProfessorLesson(item.lesson),
      })),
      totalPresencas: presencas.length,
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

      if (!modalityMatchesPlan(lesson.modality, student.planoModalidade)) {
        return reply.status(403).send({ error: "Esta aula não pertence à sua modalidade." });
      }

      const attendance = await prisma.lessonAttendance.upsert({
        where: {
          lessonId_studentId: {
            lessonId: lesson.id,
            studentId: request.studentId!,
          },
        },
        update: { markedAt: new Date() },
        create: {
          tenantId: student.tenantId,
          lessonId: lesson.id,
          studentId: request.studentId!,
        },
      });

      return reply.send({
        presenca: {
          id: attendance.id,
          markedAt: attendance.markedAt.toISOString(),
          lessonId: lesson.id,
        },
        message: "Presença registrada.",
      });
    },
  );
}
