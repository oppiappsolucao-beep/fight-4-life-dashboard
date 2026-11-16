import type { BillingScreenNotice } from "./api";

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
