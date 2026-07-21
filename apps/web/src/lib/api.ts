const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? "oppi-tech";

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
    throw new Error(message);
  }

  return data as T;
}
