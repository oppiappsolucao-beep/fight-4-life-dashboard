import { formatIsoDate } from "./billing.js";

/**
 * "Mês da academia": ciclo de 1 mês a partir do dia de aniversário da academia
 * (dia do createdAt, ou billingCycleDay configurado 1–28).
 *
 * Ex.: academia criada no dia 15 → ciclo 15/mar → 14/abr, depois 15/abr → 14/mai...
 */

export function resolveBillingCycleDay(
  createdAt: Date,
  billingCycleDay?: number | null,
): number {
  if (
    typeof billingCycleDay === "number" &&
    Number.isFinite(billingCycleDay) &&
    billingCycleDay >= 1 &&
    billingCycleDay <= 28
  ) {
    return billingCycleDay;
  }
  const day = createdAt.getUTCDate();
  return Math.min(Math.max(day, 1), 28);
}

export interface AcademyBillingCycle {
  /** Chave estável do ciclo (data de início ISO). */
  key: string;
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  cycleDay: number;
}

function clampDayInMonth(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return new Date(Date.UTC(year, monthIndex, safeDay, 0, 0, 0, 0));
}

/** Ciclo da academia que contém a data de referência. */
export function getAcademyBillingCycle(
  createdAt: Date,
  reference = new Date(),
  billingCycleDay?: number | null,
): AcademyBillingCycle {
  const cycleDay = resolveBillingCycleDay(createdAt, billingCycleDay);
  const ref = new Date(reference);
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();

  let start = clampDayInMonth(y, m, cycleDay);
  if (ref.getTime() < start.getTime()) {
    const prev = m === 0 ? 11 : m - 1;
    const prevYear = m === 0 ? y - 1 : y;
    start = clampDayInMonth(prevYear, prev, cycleDay);
  }

  const nextMonth = start.getUTCMonth() === 11 ? 0 : start.getUTCMonth() + 1;
  const nextYear =
    start.getUTCMonth() === 11 ? start.getUTCFullYear() + 1 : start.getUTCFullYear();
  const nextStart = clampDayInMonth(nextYear, nextMonth, cycleDay);
  const end = new Date(nextStart.getTime() - 1);

  return {
    key: formatIsoDate(start),
    start,
    end,
    startIso: formatIsoDate(start),
    endIso: formatIsoDate(end),
    cycleDay,
  };
}
