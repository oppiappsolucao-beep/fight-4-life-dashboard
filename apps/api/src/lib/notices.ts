import { NoticeAudience } from "@prisma/client";
import { prisma } from "./prisma.js";

export const NOTICE_TIMEZONE = "America/Sao_Paulo";

export const DEFAULT_NOTICES: Record<NoticeAudience, string> = {
  ALUNO: "Bom treino!",
  PROFESSOR: "Um bom dia de trabalho!",
};

const AUDIENCES = [NoticeAudience.ALUNO, NoticeAudience.PROFESSOR] as const;

export type AcademyClock = {
  date: string;
  hour: number;
  minute: number;
};

export function academyClock(reference = new Date()): AcademyClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NOTICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(reference);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  let hour = Number(read("hour"));
  if (hour === 24) hour = 0;

  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    hour,
    minute: Number(read("minute")),
  };
}

/** A mensagem padrão entra à 00:01, horário de Brasília. */
export function isPastDailyNoticeTime(reference = new Date()): boolean {
  const clock = academyClock(reference);
  return clock.hour > 0 || clock.minute >= 1;
}

export function serializeNotice(notice: {
  audience: NoticeAudience;
  noticeDate: string;
  message: string;
  automatic: boolean;
}) {
  return {
    audience: notice.audience,
    noticeDate: notice.noticeDate,
    message: notice.message,
    automatic: notice.automatic,
  };
}

export async function ensureDailyNotices(tenantId: string, reference = new Date()) {
  await ensureNoticeTable();
  if (!isPastDailyNoticeTime(reference)) return;
  const { date } = academyClock(reference);

  await Promise.all(
    AUDIENCES.map((audience) =>
      prisma.dailyNotice.upsert({
        where: {
          tenantId_audience_noticeDate: {
            tenantId,
            audience,
            noticeDate: date,
          },
        },
        update: {},
        create: {
          tenantId,
          audience,
          noticeDate: date,
          message: DEFAULT_NOTICES[audience],
          automatic: true,
        },
      }),
    ),
  );
}

let noticeTableReady = false;

export async function ensureNoticeTable(): Promise<void> {
  if (noticeTableReady) return;

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "NoticeAudience" AS ENUM ('ALUNO', 'PROFESSOR');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyNotice" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "audience" "NoticeAudience" NOT NULL,
      "noticeDate" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "automatic" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "DailyNotice_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DailyNotice_tenantId_audience_noticeDate_key"
    ON "DailyNotice"("tenantId", "audience", "noticeDate");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DailyNotice_tenantId_noticeDate_idx"
    ON "DailyNotice"("tenantId", "noticeDate");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "DailyNotice"
        ADD CONSTRAINT "DailyNotice_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  noticeTableReady = true;
}

let lastEnsuredDate: string | null = null;

export async function ensureAllTenantsDailyNotices(reference = new Date()) {
  if (!isPastDailyNoticeTime(reference)) return;
  const { date } = academyClock(reference);
  if (lastEnsuredDate === date) return;

  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true },
  });

  for (const tenant of tenants) {
    await ensureDailyNotices(tenant.id, reference);
  }

  lastEnsuredDate = date;
}

export function startDailyNoticeScheduler(log: (error: unknown) => void) {
  const tick = () => {
    ensureAllTenantsDailyNotices().catch(log);
  };

  tick();
  const timer = setInterval(tick, 20_000);
  timer.unref();
}
