export type BillingDueStatus = "em_dia" | "vencido" | "hoje";

export interface StudentBillingFields {
  diaVencimento: string;
  acessoLiberadoAte: string | null;
}

export const STUDENT_BILLING_BLOCKED_MESSAGE =
  "Por favor entrar em contato com a academia.";

function parseIsoDateEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasActiveBillingRelease(
  student: StudentBillingFields,
  reference = new Date(),
): boolean {
  if (!student.acessoLiberadoAte) return false;
  const releaseUntil = parseIsoDateEnd(student.acessoLiberadoAte);
  if (!releaseUntil) return false;
  return releaseUntil.getTime() >= reference.getTime();
}

export function isStudentBillingBlocked(
  student: StudentBillingFields,
  reference = new Date(),
  chargeStatus?: string | null,
): boolean {
  if (hasActiveBillingRelease(student, reference)) return false;
  if (chargeStatus === "CANCELLED" || chargeStatus === "REFUNDED") return true;
  return getDueStatus(student.diaVencimento, reference) === "vencido";
}

export function getEffectiveDueStatus(
  student: StudentBillingFields,
  reference = new Date(),
): BillingDueStatus {
  if (hasActiveBillingRelease(student, reference)) return "em_dia";
  return getDueStatus(student.diaVencimento, reference);
}

export function parseDueDay(diaVencimento: string): number {
  const iso = diaVencimento.match(/\d{4}-\d{2}-(\d{2})/);
  if (iso) {
    const fromIso = Number(iso[1]);
    if (fromIso >= 1 && fromIso <= 31) return fromIso;
  }

  const leading = diaVencimento.trim().match(/^(\d{1,2})(?:\D|$)/);
  if (leading) {
    const fromLeading = Number(leading[1]);
    if (fromLeading >= 1 && fromLeading <= 31) return fromLeading;
  }

  const day = Number.parseInt(diaVencimento.replace(/\D/g, ""), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return 1;
  return day;
}

export function getNextDueDate(diaVencimento: string, reference = new Date()): Date {
  const day = parseDueDay(diaVencimento);
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);

  let due = new Date(today.getFullYear(), today.getMonth(), day);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    due = new Date(today.getFullYear(), today.getMonth() + 1, day);
    due.setHours(0, 0, 0, 0);
  }

  return due;
}

export function getDueStatus(diaVencimento: string, reference = new Date()): BillingDueStatus {
  const day = parseDueDay(diaVencimento);
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);

  const currentDue = new Date(today.getFullYear(), today.getMonth(), day);
  currentDue.setHours(0, 0, 0, 0);

  if (currentDue.getTime() === today.getTime()) return "hoje";
  if (currentDue < today) return "vencido";
  return "em_dia";
}

export type BillingNoticePhase = "tres_dias" | "vence_hoje" | "dois_dias_apos";

export interface BillingScreenNotice {
  phase: BillingNoticePhase;
  dueDate: string;
  message: string;
}

const BILLING_NOTICE_MESSAGES: Record<BillingNoticePhase, string> = {
  tres_dias:
    "Prezado aluno, faltam 3 dias para o vencimento da sua fatura. Entre em contato com a recepção.",
  vence_hoje: "Prezado aluno, a sua fatura vence hoje. Entre em contato com a recepção.",
  dois_dias_apos:
    "Prezado aluno, sua fatura venceu há 2 dias. Entre em contato com a recepção.",
};

const ACADEMY_TIMEZONE = "America/Sao_Paulo";

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function academyCalendarToday(reference: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACADEMY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return startOfLocalDay(new Date(read("year"), read("month") - 1, read("day")));
}

function diffCalendarDays(from: Date, to: Date): number {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function getBillingScreenNotice(
  diaVencimento: string,
  reference = new Date(),
): BillingScreenNotice | null {
  const day = parseDueDay(diaVencimento);
  const today = academyCalendarToday(reference);
  const phases: Array<{ daysUntil: number; phase: BillingNoticePhase }> = [
    { daysUntil: 3, phase: "tres_dias" },
    { daysUntil: 0, phase: "vence_hoje" },
    { daysUntil: -2, phase: "dois_dias_apos" },
  ];

  for (const offset of [-1, 0, 1]) {
    const due = startOfLocalDay(new Date(today.getFullYear(), today.getMonth() + offset, day));
    const daysUntil = diffCalendarDays(today, due);
    const match = phases.find((item) => item.daysUntil === daysUntil);
    if (!match) continue;
    return {
      phase: match.phase,
      dueDate: formatIsoDate(due),
      message: BILLING_NOTICE_MESSAGES[match.phase],
    };
  }

  return null;
}

export function billingBlockedBody(student: { id: string; diaVencimento: string }) {
  const aviso = getBillingScreenNotice(student.diaVencimento);
  return {
    error: aviso?.phase === "dois_dias_apos" ? aviso.message : STUDENT_BILLING_BLOCKED_MESSAGE,
    code: "BILLING_BLOCKED" as const,
    studentId: student.id,
    diaVencimento: student.diaVencimento,
    ...(aviso && aviso.phase === "dois_dias_apos"
      ? { avisoFatura: { ...aviso, studentId: student.id } }
      : {}),
  };
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatBrDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function getWeekRange(reference = new Date()): { start: string; end: string } {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}
