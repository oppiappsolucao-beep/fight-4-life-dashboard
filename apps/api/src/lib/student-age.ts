/** Menor de 18 anos: cobrança Asaas em nome do responsável, não do aluno. */

export function parseBirthDate(dataNascimento: string): Date | null {
  const raw = dataNascimento.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const date = new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function getAgeYears(dataNascimento: string, reference = new Date()): number | null {
  const birth = parseBirthDate(dataNascimento);
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

export interface BillingPayerInput {
  dataNascimento: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone?: string | null;
  responsavelNome?: string | null;
  responsavelCpf?: string | null;
  responsavelEmail?: string | null;
  responsavelTelefone?: string | null;
}

export interface BillingPayer {
  isMinor: boolean;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  missingResponsible: boolean;
}

/**
 * Quem aparece como pagador no Asaas.
 * Menor → responsável obrigatório; adulto → o próprio aluno.
 */
export function resolveBillingPayer(student: BillingPayerInput): BillingPayer {
  const isMinor = isMinorStudent(student.dataNascimento);

  if (!isMinor) {
    return {
      isMinor: false,
      name: student.nomeCompleto.trim(),
      cpf: student.cpf,
      email: student.email.trim().toLowerCase(),
      phone: student.telefone?.trim() || null,
      missingResponsible: false,
    };
  }

  const name = student.responsavelNome?.trim() || "";
  const cpf = student.responsavelCpf?.trim() || "";
  const email = student.responsavelEmail?.trim().toLowerCase() || "";
  const missingResponsible = !name || !cpf || !email;

  return {
    isMinor: true,
    name,
    cpf,
    email,
    phone: student.responsavelTelefone?.trim() || student.telefone?.trim() || null,
    missingResponsible,
  };
}
