export type StudentLoginType = "cpf" | "email";

export interface StudentSession {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  identifier: string;
  loginType: StudentLoginType;
  tenantSlug: string;
}

const STORAGE_KEY = "studentSession";

export function setStudentSession(session: StudentSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getStudentSession(): StudentSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StudentSession;
  } catch {
    return null;
  }
}

export function clearStudentSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem("studentIdentifier");
  sessionStorage.removeItem("studentLoginType");
}

export function hasStudentSession(): boolean {
  return Boolean(getStudentSession());
}
