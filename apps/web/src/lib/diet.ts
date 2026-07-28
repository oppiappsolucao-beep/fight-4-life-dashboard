/** Quantidade de cardápios semanais únicos no ciclo. */
export const DIET_WEEK_VARIANT_COUNT = 4;

/**
 * Índice da semana no ciclo (0..3).
 * Semanas consecutivas não repetem; o mês desloca a ordem
 * (ex.: a 1ª deste mês pode aparecer como 3ª no mês seguinte).
 */
export function resolveDietWeekIndex(
  isoDate: string,
  variantCount = DIET_WEEK_VARIANT_COUNT,
): number {
  const date = new Date(`${isoDate}T12:00:00`);
  const month = date.getMonth();
  const weekOfMonth = Math.floor((date.getDate() - 1) / 7);
  return ((weekOfMonth - month * 2) % variantCount + variantCount) % variantCount;
}
