/**
 * Taxa OPPI Fit por aluno que PAGOU pela solução (por academia, no mês da academia).
 *
 * Ex.: 89 pagas → 89 × R$ 1,90
 *      105 pagas → 100 × R$ 1,90 + 5 × R$ 1,49
 */

export const PLATFORM_FEE_TIER1_BRL = 1.9;
export const PLATFORM_FEE_TIER2_BRL = 1.49;
export const PLATFORM_FEE_TIER1_LIMIT = 100;

export function brlToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToBrl(cents: number): number {
  return cents / 100;
}

/** Taxa (R$) da N-ésima cobrança paga no ciclo da academia (1-based). */
export function platformFeeBrlForPaidIndex(paidIndex1Based: number): number {
  if (paidIndex1Based < 1) return 0;
  return paidIndex1Based <= PLATFORM_FEE_TIER1_LIMIT
    ? PLATFORM_FEE_TIER1_BRL
    : PLATFORM_FEE_TIER2_BRL;
}

export function platformFeeCentsForPaidIndex(paidIndex1Based: number): number {
  return brlToCents(platformFeeBrlForPaidIndex(paidIndex1Based));
}

export interface PlatformFeeBreakdown {
  paidCount: number;
  tier1Count: number;
  tier2Count: number;
  tier1TotalBrl: number;
  tier2TotalBrl: number;
  totalBrl: number;
  totalCents: number;
}

/** Soma a taxa para `paidCount` pagamentos confirmados no ciclo. */
export function calculatePlatformFeesForPaidCount(paidCount: number): PlatformFeeBreakdown {
  const safe = Math.max(0, Math.floor(paidCount));
  const tier1Count = Math.min(safe, PLATFORM_FEE_TIER1_LIMIT);
  const tier2Count = Math.max(0, safe - PLATFORM_FEE_TIER1_LIMIT);
  const tier1TotalBrl = tier1Count * PLATFORM_FEE_TIER1_BRL;
  const tier2TotalBrl = tier2Count * PLATFORM_FEE_TIER2_BRL;
  const totalBrl = tier1TotalBrl + tier2TotalBrl;

  return {
    paidCount: safe,
    tier1Count,
    tier2Count,
    tier1TotalBrl,
    tier2TotalBrl,
    totalBrl,
    totalCents: brlToCents(totalBrl),
  };
}
