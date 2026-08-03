/** Helpers de idade no front (espelha a regra da API: menor de 18). */

export function parseBirthDateLocal(dataNascimento: string): Date | null {
  const raw = dataNascimento.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function getAgeYears(dataNascimento: string, reference = new Date()): number | null {
  const birth = parseBirthDateLocal(dataNascimento);
  if (!birth) return null;
  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function isMinorStudent(dataNascimento: string, reference = new Date()): boolean {
  const age = getAgeYears(dataNascimento, reference);
  if (age === null) return false;
  return age < 18;
}
