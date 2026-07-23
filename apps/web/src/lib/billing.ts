export type BillingDueStatus = "em_dia" | "vencido" | "hoje";

export interface StudentBillingFields {
  diaVencimento: string;
  acessoLiberadoAte: string | null;
}

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

export function getEffectiveDueStatus(
  student: StudentBillingFields,
  reference = new Date(),
): BillingDueStatus {
  if (hasActiveBillingRelease(student, reference)) return "em_dia";
  return getDueStatus(student.diaVencimento, reference);
}

export function parseDueDay(diaVencimento: string): number {
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

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function billingStatusLabel(status: BillingDueStatus, liberadoAte?: string | null): string {
  if (status === "em_dia" && liberadoAte) return "Liberado pela academia";
  if (status === "hoje") return "Vence hoje";
  if (status === "vencido") return "Em atraso";
  return "Em dia";
}
