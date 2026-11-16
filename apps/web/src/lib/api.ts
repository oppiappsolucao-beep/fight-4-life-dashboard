export type BillingNoticePhase = "tres_dias" | "vence_hoje" | "dois_dias_apos";

export interface BillingScreenNotice {
  phase: BillingNoticePhase;
  dueDate: string;
  message: string;
  studentId: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  avisoFatura?: BillingScreenNotice;
  diaVencimento?: string;
  studentId?: string;

  constructor(
    message: string,
    status: number,
    extra?: {
      code?: string;
      avisoFatura?: BillingScreenNotice;
      diaVencimento?: string;
      studentId?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = extra?.code;
    this.avisoFatura = extra?.avisoFatura;
    this.diaVencimento = extra?.diaVencimento;
    this.studentId = extra?.studentId;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? "oppifit";

export function getTenantSlug(): string {
  return localStorage.getItem("tenantSlug") ?? DEFAULT_TENANT_SLUG;
}

export function setTenantSlug(slug: string): void {
  localStorage.setItem("tenantSlug", slug);
}

export function clearTenantSlug(): void {
  localStorage.removeItem("tenantSlug");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string,
): Promise<T> {
  const token = localStorage.getItem("token");
  const tenantSlug = getTenantSlug();
  const hasBody =
    options.body !== undefined && options.body !== null && options.body !== "";

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      "X-Tenant-Slug": tenantSlug,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(studentId ? { "X-Student-Id": studentId } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (typeof data.error === "string" ? data.error : undefined) ??
      (typeof data.message === "string" ? data.message : undefined) ??
      (response.status === 500 || response.status === 503
        ? "Servidor indisponível. Verifique se o banco Neon está configurado."
        : `Erro na requisição (${response.status}).`);
    const aviso = data.avisoFatura;
    const avisoFatura =
      aviso &&
      typeof aviso === "object" &&
      typeof aviso.phase === "string" &&
      typeof aviso.dueDate === "string" &&
      typeof aviso.message === "string" &&
      typeof aviso.studentId === "string"
        ? (aviso as BillingScreenNotice)
        : undefined;
    throw new ApiError(message, response.status, {
      code: typeof data.code === "string" ? data.code : undefined,
      avisoFatura,
      diaVencimento: typeof data.diaVencimento === "string" ? data.diaVencimento : undefined,
      studentId: typeof data.studentId === "string" ? data.studentId : undefined,
    });
  }

  return data as T;
}
