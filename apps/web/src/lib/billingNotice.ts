import { ApiError, type BillingNoticePhase, type BillingScreenNotice } from "./api";
import { parseDueDay } from "./billing";

const ACADEMY_TIMEZONE = "America/Sao_Paulo";

const BILLING_NOTICE_MESSAGES: Record<BillingNoticePhase, string> = {
  tres_dias:
    "Prezado aluno, faltam 3 dias para o vencimento da sua fatura. Entre em contato com a recepção.",
  vence_hoje: "Prezado aluno, a sua fatura vence hoje. Entre em contato com a recepção.",
  dois_dias_apos:
    "Prezado aluno, sua fatura venceu há 2 dias. Entre em contato com a recepção.",
};

function academyToday(reference: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACADEMY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const date = new Date(read("year"), read("month") - 1, read("day"));
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildBillingScreenNotice(
  diaVencimento: string,
  studentId: string,
  reference = new Date(),
): BillingScreenNotice | null {
  const day = parseDueDay(diaVencimento);
  const today = academyToday(reference);
  const phases: Array<{ daysUntil: number; phase: BillingNoticePhase }> = [
    { daysUntil: 3, phase: "tres_dias" },
    { daysUntil: 0, phase: "vence_hoje" },
    { daysUntil: -2, phase: "dois_dias_apos" },
  ];

  for (const offset of [-1, 0, 1]) {
    const due = new Date(today.getFullYear(), today.getMonth() + offset, day);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    const match = phases.find((item) => item.daysUntil === daysUntil);
    if (!match) continue;
    return {
      phase: match.phase,
      dueDate: formatIsoDate(due),
      message: BILLING_NOTICE_MESSAGES[match.phase],
      studentId,
    };
  }

  return null;
}

export function billingNoticeFromError(
  err: unknown,
  fallbackStudentId?: string,
): BillingScreenNotice | null {
  if (!(err instanceof ApiError)) return null;
  const studentId = err.avisoFatura?.studentId ?? err.studentId ?? fallbackStudentId;
  if (err.diaVencimento && studentId) {
    const built = buildBillingScreenNotice(err.diaVencimento, studentId);
    if (built?.phase === "dois_dias_apos") return built;
  }
  return err.avisoFatura ?? null;
}

function storageKey(notice: BillingScreenNotice): string {
  return `billing-notice:${notice.studentId}:${notice.dueDate}:${notice.phase}`;
}

export function isBillingNoticeDismissed(notice: BillingScreenNotice): boolean {
  try {
    return localStorage.getItem(storageKey(notice)) === "1";
  } catch {
    return false;
  }
}

export function dismissBillingNotice(notice: BillingScreenNotice): void {
  try {
    localStorage.setItem(storageKey(notice), "1");
  } catch {
    // O aviso continua fechado nesta tela mesmo se o navegador bloquear o armazenamento.
  }
}
