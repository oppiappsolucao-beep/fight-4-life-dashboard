export type BillingDueStatus = "em_dia" | "vencido" | "hoje";

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

export function billingStatusLabel(status: BillingDueStatus): string {
  if (status === "hoje") return "Vence hoje";
  if (status === "vencido") return "Em atraso";
  return "Em dia";
}
